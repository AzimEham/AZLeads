import { Router, Request, Response, NextFunction } from 'express';
import { getDatabase } from '../../db/database';
import { ApiError } from '../../lib/errors';
import { authenticateJWT, requireRole } from '../middleware/auth';

const router = Router();

/**
 * @swagger
 * /api/commissions:
 *   get:
 *     tags: [Commissions]
 *     summary: List commissions
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of commissions
 */
router.get('/', authenticateJWT, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.page_size as string) || 20;
    const skip = (page - 1) * pageSize;

    // Filters
    const dateFrom = req.query.date_from as string;
    const dateTo = req.query.date_to as string;
    const affiliateId = req.query.affiliate_id as string;
    const advertiserId = req.query.advertiser_id as string;

    const db = getDatabase();

    // Build where clause
    const where: any = {};

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

    if (affiliateId) {
      where.affiliateId = affiliateId;
    }

    if (advertiserId) {
      where.advertiserId = advertiserId;
    }

    const [commissions, total] = await Promise.all([
      db.commission.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          lead: {
            select: { id: true, azTxId: true },
          },
          affiliate: {
            select: { id: true, name: true },
          },
          advertiser: {
            select: { id: true, name: true },
          },
        },
      }),
      db.commission.count({ where }),
    ]);

    res.json({
      items: commissions,
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
 * /api/commissions:
 *   post:
 *     tags: [Commissions]
 *     summary: Create manual commission adjustment
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               lead_id:
 *                 type: string
 *               advertiser_id:
 *                 type: string
 *               affiliate_id:
 *                 type: string
 *               amount:
 *                 type: number
 *               description:
 *                 type: string
 *     responses:
 *       201:
 *         description: Commission created
 */
router.post('/', authenticateJWT, requireRole(['admin']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { lead_id, advertiser_id, affiliate_id, amount, description } = req.body;

    if (!amount || !description) {
      throw new ApiError(400, 'MISSING_FIELDS', 'Amount and description are required');
    }

    const db = getDatabase();

    // If lead_id is provided, get affiliate and advertiser from lead
    let finalAffiliateId = affiliate_id;
    let finalAdvertiserId = advertiser_id;

    if (lead_id) {
      const lead = await db.lead.findUnique({
        where: { id: lead_id },
        select: { affiliateId: true, advertiserId: true },
      });

      if (!lead) {
        throw new ApiError(404, 'LEAD_NOT_FOUND', 'Lead not found');
      }

      finalAffiliateId = lead.affiliateId;
      finalAdvertiserId = lead.advertiserId;
    }

    if (!finalAffiliateId || !finalAdvertiserId) {
      throw new ApiError(400, 'MISSING_IDS', 'affiliate_id and advertiser_id are required when lead_id is not provided');
    }

    const commission = await db.commission.create({
      data: {
        leadId: lead_id || null,
        affiliateId: finalAffiliateId,
        advertiserId: finalAdvertiserId,
        amount,
        description,
      },
      include: {
        lead: {
          select: { id: true, azTxId: true },
        },
        affiliate: {
          select: { id: true, name: true },
        },
        advertiser: {
          select: { id: true, name: true },
        },
      },
    });

    res.status(201).json(commission);
  } catch (error) {
    next(error);
  }
});

export default router;