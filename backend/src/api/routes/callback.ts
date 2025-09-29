import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { getDatabase } from '../../db/database';
import { RedisHelper } from '../../lib/redis';
import { ApiError } from '../../lib/errors';
import { Metrics } from '../../lib/metrics';
import { logger } from '../../lib/logger';
import { config } from '../../config/config';

const router = Router();

interface CallbackRequest {
  az_tx_id: string;
  status: 'approved' | 'rejected' | 'pending';
  external_id?: string;
  payout?: number;
  [key: string]: any;
}

/**
 * @swagger
 * /api/advertiser_callback:
 *   post:
 *     tags: [Callback]
 *     summary: Receive advertiser callback
 *     parameters:
 *       - in: header
 *         name: X-Signature
 *         schema:
 *           type: string
 *       - in: header
 *         name: X-Signature-Timestamp
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               az_tx_id:
 *                 type: string
 *               status:
 *                 type: string
 *                 enum: [approved, rejected, pending]
 *               external_id:
 *                 type: string
 *               payout:
 *                 type: number
 *     responses:
 *       200:
 *         description: Callback processed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 */
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload: CallbackRequest = req.body;
    const signature = req.headers['x-signature'] as string;
    const timestamp = req.headers['x-signature-timestamp'] as string;

    if (!payload.az_tx_id) {
      throw new ApiError(400, 'MISSING_AZ_TX_ID', 'az_tx_id is required');
    }

    if (!payload.status) {
      throw new ApiError(400, 'MISSING_STATUS', 'status is required');
    }

    const db = getDatabase();

    // Find the lead
    const lead = await db.lead.findUnique({
      where: { azTxId: payload.az_tx_id },
      include: {
        advertiser: true,
        affiliate: true,
        offer: true,
      },
    });

    if (!lead) {
      throw new ApiError(404, 'LEAD_NOT_FOUND', `Lead not found: ${payload.az_tx_id}`);
    }

    if (!lead.advertiser) {
      throw new ApiError(400, 'NO_ADVERTISER', 'Lead has no associated advertiser');
    }

    // Verify HMAC signature if advertiser has secret
    if (lead.advertiser.endpointSecret && signature && timestamp) {
      const isValid = await verifyHmacSignature(
        lead.advertiser.endpointSecret,
        timestamp,
        JSON.stringify(payload),
        signature
      );

      if (!isValid) {
        throw new ApiError(401, 'INVALID_SIGNATURE', 'Invalid HMAC signature');
      }

      // Check for replay attacks
      const isReplay = await RedisHelper.checkReplayAttack(timestamp, signature);
      if (isReplay) {
        throw new ApiError(400, 'REPLAY_ATTACK', 'Request has been processed before');
      }
    }

    // Log the callback
    await db.callbackLog.create({
      data: {
        advertiserId: lead.advertiser.id,
        azTxId: payload.az_tx_id,
        payload,
        signature,
        statusCode: 200,
      },
    });

    // Update lead status
    const updateData: any = {
      advertiserStatus: payload.status,
      updatedAt: new Date(),
    };

    if (payload.payout !== undefined) {
      updateData.payout = payload.payout;
    }

    // Set FTD date for approved conversions
    if (payload.status === 'approved' && !lead.ftdAt) {
      updateData.ftdAt = new Date();
      updateData.status = 'approved';
    } else if (payload.status === 'rejected') {
      updateData.status = 'rejected';
    }

    await db.lead.update({
      where: { id: lead.id },
      data: updateData,
    });

    // Create commission for approved leads
    if (payload.status === 'approved' && payload.payout && payload.payout > 0) {
      // Check if commission already exists to prevent duplicates
      const existingCommission = await db.commission.findFirst({
        where: {
          leadId: lead.id,
          advertiserId: lead.advertiser.id,
        },
      });

      if (!existingCommission) {
        await db.commission.create({
          data: {
            leadId: lead.id,
            advertiserId: lead.advertiser.id,
            affiliateId: lead.affiliateId,
            amount: payload.payout,
            description: `Conversion payout for ${payload.az_tx_id}`,
          },
        });

        logger.info('Commission created for approved lead', {
          leadId: lead.id,
          azTxId: payload.az_tx_id,
          payout: payload.payout,
        });
      }
    }

    // Record metrics
    Metrics.recordCallback(lead.advertiser.id, payload.status);

    logger.info('Callback processed successfully', {
      azTxId: payload.az_tx_id,
      status: payload.status,
      advertiserId: lead.advertiser.id,
      externalId: payload.external_id,
      payout: payload.payout,
    });

    res.json({ ok: true });

  } catch (error) {
    next(error);
  }
});

async function verifyHmacSignature(
  secret: string,
  timestamp: string,
  body: string,
  signature: string
): Promise<boolean> {
  try {
    // Check timestamp (reject if older than 5 minutes)
    const now = Math.floor(Date.now() / 1000);
    const requestTime = parseInt(timestamp, 10);
    
    if (Math.abs(now - requestTime) > 300) { // 5 minutes
      logger.warn('Request timestamp too old or in future', { 
        timestamp, 
        now, 
        diff: Math.abs(now - requestTime) 
      });
      return false;
    }

    // Extract algorithm and hash from signature
    const [algorithm, hash] = signature.split('=');
    if (algorithm !== config.hmacAlgo) {
      logger.warn('Invalid HMAC algorithm', { expected: config.hmacAlgo, received: algorithm });
      return false;
    }

    // Compute expected signature
    const payload = `${timestamp}:${body}`;
    const expectedHash = crypto
      .createHmac(config.hmacAlgo, secret)
      .update(payload)
      .digest('hex');

    // Constant-time comparison
    return crypto.timingSafeEqual(
      Buffer.from(hash, 'hex'),
      Buffer.from(expectedHash, 'hex')
    );

  } catch (error) {
    logger.error('Error verifying HMAC signature', { error: error instanceof Error ? error.message : error });
    return false;
  }
}

export default router;