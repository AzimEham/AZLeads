import { Router, Request, Response, NextFunction } from 'express';
import { getDatabase } from '../../db/database';
import { ApiError } from '../../lib/errors';
import { authenticateJWT, requireRole } from '../middleware/auth';

const router = Router();

/**
 * @swagger
 * /api/offers:
 *   get:
 *     tags: [Offers]
 *     summary: List offers
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of offers
 */
router.get('/', authenticateJWT, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.page_size as string) || 20;
    const skip = (page - 1) * pageSize;

    const db = getDatabase();

    const [offers, total] = await Promise.all([
      db.offer.findMany({
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          advertiser: {
            select: { id: true, name: true },
          },
        },
      }),
      db.offer.count(),
    ]);

    res.json({
      items: offers,
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
 * /api/offers:
 *   post:
 *     tags: [Offers]
 *     summary: Create offer
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               advertiser_id:
 *                 type: string
 *               payout_amount:
 *                 type: number
 *     responses:
 *       201:
 *         description: Offer created
 */
router.post('/', authenticateJWT, requireRole(['admin']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, advertiser_id, payout_amount } = req.body;

    if (!name || !advertiser_id || payout_amount === undefined) {
      throw new ApiError(400, 'MISSING_FIELDS', 'Name, advertiser_id, and payout_amount are required');
    }

    const db = getDatabase();

    // Verify advertiser exists
    const advertiser = await db.advertiser.findUnique({
      where: { id: advertiser_id },
    });

    if (!advertiser) {
      throw new ApiError(404, 'ADVERTISER_NOT_FOUND', 'Advertiser not found');
    }

    const offer = await db.offer.create({
      data: {
        name,
        advertiserId: advertiser_id,
        payoutAmount: payout_amount,
      },
      include: {
        advertiser: {
          select: { id: true, name: true },
        },
      },
    });

    res.status(201).json(offer);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/offers/{id}:
 *   get:
 *     tags: [Offers]
 *     summary: Get offer by ID
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
 *         description: Offer details
 */
router.get('/:id', authenticateJWT, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const db = getDatabase();

    const offer = await db.offer.findUnique({
      where: { id },
      include: {
        advertiser: {
          select: { id: true, name: true },
        },
      },
    });

    if (!offer) {
      throw new ApiError(404, 'OFFER_NOT_FOUND', 'Offer not found');
    }

    res.json(offer);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/offers/{id}:
 *   put:
 *     tags: [Offers]
 *     summary: Update offer
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
 *         description: Offer updated
 */
router.put('/:id', authenticateJWT, requireRole(['admin']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const db = getDatabase();

    const offer = await db.offer.findUnique({ where: { id } });
    if (!offer) {
      throw new ApiError(404, 'OFFER_NOT_FOUND', 'Offer not found');
    }

    const updateData: any = {};
    
    if (updates.name) updateData.name = updates.name;
    if (updates.advertiser_id) updateData.advertiserId = updates.advertiser_id;
    if (updates.payout_amount !== undefined) updateData.payoutAmount = updates.payout_amount;

    const updatedOffer = await db.offer.update({
      where: { id },
      data: updateData,
      include: {
        advertiser: {
          select: { id: true, name: true },
        },
      },
    });

    res.json(updatedOffer);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/offers/{id}:
 *   delete:
 *     tags: [Offers]
 *     summary: Delete offer
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       204:
 *         description: Offer deleted
 */
router.delete('/:id', authenticateJWT, requireRole(['admin']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const db = getDatabase();

    const offer = await db.offer.findUnique({ where: { id } });
    if (!offer) {
      throw new ApiError(404, 'OFFER_NOT_FOUND', 'Offer not found');
    }

    await db.offer.delete({ where: { id } });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;