import { Router, Request, Response, NextFunction } from 'express';
import { getDatabase } from '../../db/database';
import { ApiError } from '../../lib/errors';
import { authenticateJWT } from '../middleware/auth';
import { retryLead } from '../../jobs/forwardLead';
import { logger } from '../../lib/logger';

const router = Router();

/**
 * @swagger
 * /api/leads:
 *   get:
 *     tags: [Leads]
 *     summary: List leads with filtering
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: page_size
 *         schema:
 *           type: integer
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *       - in: query
 *         name: affiliate_id
 *         schema:
 *           type: string
 *       - in: query
 *         name: advertiser_id
 *         schema:
 *           type: string
 *       - in: query
 *         name: country
 *         schema:
 *           type: string
 *       - in: query
 *         name: date_from
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: date_to
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: List of leads
 */
router.get('/', authenticateJWT, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = Math.min(parseInt(req.query.page_size as string) || 20, 100);
    const skip = (page - 1) * pageSize;

    // Filters
    const search = req.query.search as string;
    const status = req.query.status as string;
    const affiliateId = req.query.affiliate_id as string;
    const advertiserId = req.query.advertiser_id as string;
    const country = req.query.country as string;
    const dateFrom = req.query.date_from as string;
    const dateTo = req.query.date_to as string;

    const db = getDatabase();

    // Build where clause
    const where: any = {};

    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
        { azTxId: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (status) {
      where.status = status;
    }

    if (affiliateId) {
      where.affiliateId = affiliateId;
    }

    if (advertiserId) {
      where.advertiserId = advertiserId;
    }

    if (country) {
      where.country = { equals: country, mode: 'insensitive' };
    }

    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) {
        where.createdAt.gte = new Date(dateFrom);
      }
      if (dateTo) {
        const endDate = new Date(dateTo);
        endDate.setHours(23, 59, 59, 999);
        where.createdAt.lte = endDate;
      }
    }

    const [leads, total] = await Promise.all([
      db.lead.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          affiliate: {
            select: { id: true, name: true },
          },
          advertiser: {
            select: { id: true, name: true },
          },
          offer: {
            select: { id: true,  name: true },
          },
        },
      }),
      db.lead.count({ where }),
    ]);

    res.json({
      items: leads,
      total,
      page,
      page_size: pageSize,
      total_pages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/leads/{id}:
 *   get:
 *     tags: [Leads]
 *     summary: Get lead by ID
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Lead details
 */
router.get('/:id', authenticateJWT, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const db = getDatabase();

    const lead = await db.lead.findUnique({
      where: { id },
      include: {
        affiliate: {
          select: { id: true, name: true, email: true },
        },
        advertiser: {
          select: { id: true, name: true, platform: true },
        },
        offer: {
          select: { id: true, name: true, payoutAmount: true },
        },
        trafficLog: {
          select: { rawPayload: true, ip: true, ua: true, receivedAt: true },
        },
        forwardLogs: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        commissions: {
          select: { id: true, amount: true, description: true, createdAt: true },
        },
      },
    });

    if (!lead) {
      throw new ApiError(404, 'LEAD_NOT_FOUND', 'Lead not found');
    }

    res.json(lead);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/leads/{id}/retry:
 *   post:
 *     tags: [Leads]
 *     summary: Retry lead forwarding
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Retry initiated
 */
router.post('/:id/retry', authenticateJWT, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const db = getDatabase();

    const lead = await db.lead.findUnique({
      where: { id },
      select: { id: true, azTxId: true, status: true },
    });

    if (!lead) {
      throw new ApiError(404, 'LEAD_NOT_FOUND', 'Lead not found');
    }

    await retryLead(id);

    logger.info('Lead retry requested', { leadId: id, azTxId: lead.azTxId });

    res.json({ 
      message: 'Retry initiated',
      lead_id: id,
      az_tx_id: lead.azTxId,
    });
  } catch (error) {
    next(error);
  }
});

export default router;