import { Job } from 'bullmq';
import axios from 'axios';
import crypto from 'crypto';
import { getDatabase } from '../db/database';
import { getForwardLeadQueue } from './queue';
import { Metrics } from '../lib/metrics';
import { logger } from '../lib/logger';
import { config } from '../config/config';

interface ForwardLeadJobData {
  leadId: string;
}

export async function addForwardLeadJob(leadId: string): Promise<void> {
  const queue = getForwardLeadQueue();
  await queue.add('forward', { leadId }, {
    priority: 10, // High priority for immediate forwarding
  });
}

export async function processForwardLead(job: Job<ForwardLeadJobData>): Promise<void> {
  const { leadId } = job.data;
  const startTime = Date.now();

  logger.info('Processing forward lead job', { jobId: job.id, leadId });

  try {
    const db = getDatabase();
    
    // Get lead with related data
    const lead = await db.lead.findUnique({
      where: { id: leadId },
      include: {
        affiliate: true,
        offer: {
          include: {
            advertiser: true,
          }
        },
        trafficLog: true,
      },
    });

    if (!lead) {
      throw new Error(`Lead not found: ${leadId}`);
    }

    if (lead.status !== 'pending') {
      logger.info('Lead already processed', { leadId, status: lead.status });
      return;
    }

    // Find mapping for this lead
    const mapping = await db.mapping.findFirst({
      where: {
        affiliateId: lead.affiliateId,
        offerId: lead.offerId,
        enabled: true,
      },
      include: {
        advertiser: true,
      },
    });

    if (!mapping) {
      logger.warn('No mapping found for lead', { 
        leadId, 
        affiliateId: lead.affiliateId, 
        offerId: lead.offerId 
      });
      
      await db.lead.update({
        where: { id: leadId },
        data: { status: 'no_mapping' },
      });
      
      Metrics.recordForwardAttempt('no_mapping', 'no_mapping');
      return;
    }

    // Apply field mappings and create anonymized payload
    const advertiser = mapping.advertiser;
    const anonymizedPayload = await buildAnonymizedPayload(lead, advertiser);

    // Determine endpoint URL
    const endpointUrl = mapping.forwardUrl || advertiser.endpointUrl;

    // Prepare request
    const requestPayload = {
      az_tx_id: lead.azTxId,
      ...anonymizedPayload,
    };

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'AZLeads/1.0',
    };

    // Add HMAC signature if advertiser has secret
    if (advertiser.endpointSecret) {
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const bodyString = JSON.stringify(requestPayload);
      const signature = createHmacSignature(advertiser.endpointSecret, timestamp, bodyString);
      
      headers['X-Signature'] = `${config.hmacAlgo}=${signature}`;
      headers['X-Signature-Timestamp'] = timestamp;
    }

    // Log forward attempt
    const attemptNo = job.attemptsMade + 1;
    
    try {
      logger.info('Forwarding lead to advertiser', {
        leadId,
        advertiserId: advertiser.id,
        endpointUrl,
        attemptNo,
      });

      const response = await axios.post(endpointUrl, requestPayload, {
        headers,
        timeout: 30000, // 30 second timeout
        validateStatus: (status) => status < 500, // Don't throw on 4xx errors
      });

      // Log forward attempt
      await db.forwardLog.create({
        data: {
          leadId,
          attemptNo,
          request: { url: endpointUrl, headers, body: requestPayload },
          response: {
            status: response.status,
            headers: response.headers,
            body: response.data,
          },
          statusCode: response.status,
        },
      });

      const latencySeconds = (Date.now() - startTime) / 1000;
      Metrics.recordForwardLatency(advertiser.id, latencySeconds);

      if (response.status >= 200 && response.status < 300) {
        // Success
        await db.lead.update({
          where: { id: leadId },
          data: { 
            status: 'forwarded',
            advertiserId: advertiser.id,
            advertiserResponse: response.data,
            updatedAt: new Date(),
          },
        });

        Metrics.recordForwardAttempt(advertiser.id, 'success');
        logger.info('Lead forwarded successfully', { leadId, advertiserId: advertiser.id });
        
      } else {
        // Client error (4xx) - don't retry
        await db.lead.update({
          where: { id: leadId },
          data: { 
            status: 'forward_failed',
            advertiserId: advertiser.id,
            advertiserResponse: response.data,
            updatedAt: new Date(),
          },
        });

        Metrics.recordForwardAttempt(advertiser.id, 'client_error');
        throw new Error(`Advertiser returned ${response.status}: ${JSON.stringify(response.data)}`);
      }

    } catch (error: any) {
      // Log failed attempt
      await db.forwardLog.create({
        data: {
          leadId,
          attemptNo,
          request: { url: endpointUrl, headers, body: requestPayload },
          response: { error: error.message },
          statusCode: error.response?.status || null,
        },
      });

      if (error.response?.status && error.response.status < 500) {
        // Client error - don't retry
        await db.lead.update({
          where: { id: leadId },
          data: { 
            status: 'forward_failed',
            advertiserId: advertiser.id,
            updatedAt: new Date(),
          },
        });
        Metrics.recordForwardAttempt(advertiser.id, 'client_error');
      } else {
        // Server error - will retry
        Metrics.recordForwardAttempt(advertiser.id, 'server_error');
        
        // Update status if this was the final attempt
        if (job.attemptsMade >= (job.opts.attempts || 3) - 1) {
          await db.lead.update({
            where: { id: leadId },
            data: { 
              status: 'forward_failed',
              advertiserId: advertiser.id,
              updatedAt: new Date(),
            },
          });
        }
      }

      throw error; // Re-throw to trigger retry logic
    }

  } catch (error: any) {
    logger.error('Forward lead job failed', { 
      jobId: job.id, 
      leadId, 
      error: error.message,
      attemptsMade: job.attemptsMade,
    });
    throw error;
  }
}

async function buildAnonymizedPayload(lead: any, advertiser: any): Promise<any> {
  const db = getDatabase();
  
  // Get field mappings for this advertiser
  const fieldMappings = await db.fieldMapping.findMany({
    where: { 
      advertiserId: advertiser.id,
      allowlist: true,
    },
  });

  const payload: any = {};
  const rawPayload = lead.trafficLog.rawPayload;

  // Standard fields that are always included
  const standardFields = {
    email: lead.email,
    phone: lead.phone,
    first_name: lead.firstName,
    last_name: lead.lastName,
    country: lead.country,
  };

  // Apply field mappings or use standard mapping
  if (fieldMappings.length > 0) {
    for (const mapping of fieldMappings) {
      let value = rawPayload[mapping.sourceField] || standardFields[mapping.sourceField as keyof typeof standardFields];
      
      if (value !== undefined && value !== null) {
        // Apply transforms if specified
        if (mapping.transform) {
          value = applyTransform(value, mapping.transform);
        }
        
        payload[mapping.targetField] = value;
      }
    }
  } else {
    // Default mapping - include standard fields
    Object.entries(standardFields).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        payload[key] = value;
      }
    });
  }

  return payload;
}

function applyTransform(value: any, transform: any): any {
  if (!transform || typeof value !== 'string') {
    return value;
  }

  switch (transform.type) {
    case 'uppercase':
      return value.toUpperCase();
    case 'lowercase':
      return value.toLowerCase();
    case 'trim':
      return value.trim();
    case 'concat':
      return transform.template?.replace('{{value}}', value) || value;
    default:
      return value;
  }
}

function createHmacSignature(secret: string, timestamp: string, body: string): string {
  const payload = `${timestamp}:${body}`;
  return crypto
    .createHmac(config.hmacAlgo, secret)
    .update(payload)
    .digest('hex');
}

// Manual retry function
export async function retryLead(leadId: string): Promise<void> {
  const db = getDatabase();
  
  // Reset lead status to pending
  await db.lead.update({
    where: { id: leadId },
    data: { 
      status: 'pending',
      updatedAt: new Date(),
    },
  });

  // Add new forward job
  await addForwardLeadJob(leadId);
  
  logger.info('Lead manual retry initiated', { leadId });
}