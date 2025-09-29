import { Router, Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import shortUuid from 'short-uuid';
import { getDatabase } from '../../db/database';
import { RedisHelper } from '../../lib/redis';
import { ApiError } from '../../lib/errors';
import { authenticateAffiliate } from '../middleware/auth';
import { trackRateLimiter } from '../middleware/rateLimit';
import { Metrics } from '../../lib/metrics';
import { addForwardLeadJob } from '../../jobs/forwardLead';
import { logger } from '../../lib/logger';

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

    // Check for existing idempotency result
    if (idempotencyKey) {
      const existingResult = await RedisHelper.getIdempotencyResult(idempotencyKey);
      if (existingResult) {
        logger.info('Returning idempotent result', { 
          idempotencyKey, 
          affiliateId: affiliate.id 
        });
        return res.json(existingResult);
      }
    }

    const db = getDatabase();
    
    // Get client IP and user agent
    const clientIp = req.ip || '127.0.0.1';
    const userAgent = req.get('User-Agent') || 'Unknown';
    
    // Generate unique AZ transaction ID
    const azTxId = `AZ-${shortUuid.generate()}`;

    try {
      await db.$transaction(async (tx) => {
        // Create traffic log
        const trafficLog = await tx.trafficLog.create({
          data: {
            affiliateId: affiliate.id,
            offerId: payload.offer_id || null,
            rawPayload: payload,
            ip: clientIp,
            ua: userAgent,
          },
        });

        // Create lead with pending status
        const lead = await tx.lead.create({
          data: {
            trafficLogId: trafficLog.id,
            azTxId,
            affiliateId: affiliate.id,
            offerId: payload.offer_id || null,
            email: payload.email || null,
            phone: payload.phone || null,
            firstName: payload.first_name || null,
            lastName: payload.last_name || null,
            country: payload.country || null,
            status: 'pending',
          },
        });

        // Record metrics
        Metrics.recordInboundLead(affiliate.id, 'received');

        // Enqueue forward job immediately
        await addForwardLeadJob(lead.id);

        const result = {
          ok: true,
          az_tx_id: azTxId,
          lead_id: lead.id,
        };

        // Store idempotency result if key provided
        if (idempotencyKey) {
          await RedisHelper.storeIdempotencyResult(idempotencyKey, result);
        }

        logger.info('Lead tracked successfully', {
          leadId: lead.id,
          azTxId,
          affiliateId: affiliate.id,
          offerId: payload.offer_id,
        });

        res.json(result);
      });
    } catch (dbError) {
      logger.error('Database error in track endpoint', { error: dbError, affiliateId: affiliate.id });
      throw new ApiError(500, 'DATABASE_ERROR', 'Failed to process lead');
    }

  } catch (error) {
    next(error);
  }
});

export default router;