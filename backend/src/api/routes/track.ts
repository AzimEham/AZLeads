import { Router, Request, Response, NextFunction } from 'express';
import shortUuid from 'short-uuid';
import { getDatabase } from '../../db/database';
import { ApiError } from '../../lib/errors';
import { authenticateAffiliate } from '../middleware/auth';
import { trackRateLimiter } from '../middleware/rateLimit';
import { Metrics } from '../../lib/metrics';
import { logger } from '../../lib/logger';
import { config } from '../../config/config';

const router = Router();

interface TrackRequest {
  [key: string]: any;
}

/**
 * @swagger
 * /api/track:
 *   post:
 *     tags: [Tracking]
 *     summary: Track inbound lead from affiliate
 *     security:
 *       - apiKey: []
 *     parameters:
 *       - in: header
 *         name: x-api-key
 *         required: true
 *         schema:
 *           type: string
 *       - in: header
 *         name: Idempotency-Key
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               first_name:
 *                 type: string
 *               last_name:
 *                 type: string
 *               email:
 *                 type: string
 *               phone:
 *                 type: string
 *               country:
 *                 type: string
 *               offer_id:
 *                 type: string
 *     responses:
 *       200:
 *         description: Lead tracked successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                 az_tx_id:
 *                   type: string
 *                 lead_id:
 *                   type: string
 */
router.post('/', authenticateAffiliate, trackRateLimiter, async (req: Request & { affiliate?: any }, res: Response, next: NextFunction) => {
  try {
    const payload: TrackRequest = req.body;
    const affiliate = req.affiliate;
    const idempotencyKey = req.headers['idempotency-key'] as string;


    const db = getDatabase();
    
    // Get client IP and user agent
    const clientIp = req.ip || '127.0.0.1';
    const userAgent = req.get('User-Agent') || 'Unknown';
    
    // Generate unique AZ transaction ID
    const azTxId = `AZ-${shortUuid.generate()}`;

    try {
      const { data: trafficLog, error: trafficLogError } = await db
        .from('traffic_logs')
        .insert({
          affiliate_id: affiliate.id,
          offer_id: payload.offer_id || null,
          raw_payload: payload,
          ip: clientIp,
          ua: userAgent,
        })
        .select()
        .single();

      if (trafficLogError) {
        throw new ApiError(500, 'DATABASE_ERROR', 'Failed to create traffic log');
      }

      const { data: lead, error: leadError } = await db
        .from('leads')
        .insert({
          traffic_log_id: trafficLog.id,
          az_tx_id: azTxId,
          affiliate_id: affiliate.id,
          offer_id: payload.offer_id || null,
          email: payload.email || null,
          phone: payload.phone || null,
          first_name: payload.first_name || null,
          last_name: payload.last_name || null,
          country: payload.country || null,
          status: 'pending',
        })
        .select()
        .single();

      if (leadError) {
        throw new ApiError(500, 'DATABASE_ERROR', 'Failed to create lead');
      }

      Metrics.recordInboundLead(affiliate.id, 'received');

      const edgeFunctionUrl = `${config.supabaseUrl}/functions/v1/forward-lead`;
      fetch(edgeFunctionUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.supabaseServiceKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ leadId: lead.id }),
      }).catch(error => {
        logger.error('Failed to trigger edge function', { error, leadId: lead.id });
      });

      const result = {
        ok: true,
        az_tx_id: azTxId,
        lead_id: lead.id,
      };

      logger.info('Lead tracked successfully', {
        leadId: lead.id,
        azTxId,
        affiliateId: affiliate.id,
        offerId: payload.offer_id,
      });

      res.json(result);
    } catch (dbError) {
      logger.error('Database error in track endpoint', { error: dbError, affiliateId: affiliate.id });
      throw new ApiError(500, 'DATABASE_ERROR', 'Failed to process lead');
    }

  } catch (error) {
    next(error);
  }
});

export default router;