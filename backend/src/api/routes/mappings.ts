import { Router, Request, Response, NextFunction } from 'express';
import { getDatabase } from '../../db/database';
import { ApiError } from '../../lib/errors';
import { authenticateJWT, requireRole } from '../middleware/auth';

const router = Router();

/**
 * @swagger
 * /api/mappings:
 *   get:
 *     tags: [Mappings]
 *     summary: List mappings
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of mappings
 */
router.get('/', authenticateJWT, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.page_size as string) || 20;
    const skip = (page - 1) * pageSize;

    const db = getDatabase();

    const [mappings, total] = await Promise.all([
      db.mapping.findMany({
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          affiliate: {
            select: { id: true, name: true },
          },
          offer: {
            select: { id: true, name: true },
          },
          advertiser: {
            select: { id: true, name: true },
          },
        },
      }),
      db.mapping.count(),
    ]);

    res.json({
      items: mappings,
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
 * /api/mappings:
 *   post:
 *     tags: [Mappings]
 *     summary: Create mapping
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               affiliate_id:
 *                 type: string
 *               offer_id:
 *                 type: string
 *               advertiser_id:
 *                 type: string
 *               forward_url:
 *                 type: string
 *               enabled:
 *                 type: boolean
 *     responses:
 *       201:
 *         description: Mapping created
 */
router.post('/', authenticateJWT, requireRole(['admin']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { affiliate_id, offer_id, advertiser_id, forward_url, enabled = true } = req.body;

    if (!affiliate_id || !offer_id || !advertiser_id) {
      throw new ApiError(400, 'MISSING_FIELDS', 'affiliate_id, offer_id, and advertiser_id are required');
    }

    const db = getDatabase();

    // Verify all entities exist
    const [affiliate, offer, advertiser] = await Promise.all([
      db.affiliate.findUnique({ where: { id: affiliate_id } }),
      db.offer.findUnique({ where: { id: offer_id } }),
      db.advertiser.findUnique({ where: { id: advertiser_id } }),
    ]);

    if (!affiliate) {
      throw new ApiError(404, 'AFFILIATE_NOT_FOUND', 'Affiliate not found');
    }
    if (!offer) {
      throw new ApiError(404, 'OFFER_NOT_FOUND', 'Offer not found');
    }
    if (!advertiser) {
      throw new ApiError(404, 'ADVERTISER_NOT_FOUND', 'Advertiser not found');
    }

    const mapping = await db.mapping.create({
      data: {
        affiliateId: affiliate_id,
        offerId: offer_id,
        advertiserId: advertiser_id,
        forwardUrl: forward_url || '',
        enabled,
      },
      include: {
        affiliate: {
          select: { id: true, name: true },
        },
        offer: {
          select: { id: true, name: true },
        },
        advertiser: {
          select: { id: true, name: true },
        },
      },
    });

    res.status(201).json(mapping);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/mappings/{id}:
 *   get:
 *     tags: [Mappings]
 *     summary: Get mapping by ID
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
 *         description: Mapping details
 */
router.get('/:id', authenticateJWT, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const db = getDatabase();

    const mapping = await db.mapping.findUnique({
      where: { id },
      include: {
        affiliate: {
          select: { id: true, name: true },
        },
        offer: {
          select: { id: true, name: true },
        },
        advertiser: {
          select: { id: true, name: true },
        },
      },
    });

    if (!mapping) {
      throw new ApiError(404, 'MAPPING_NOT_FOUND', 'Mapping not found');
    }

    res.json(mapping);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/mappings/{id}:
 *   put:
 *     tags: [Mappings]
 *     summary: Update mapping
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
 *         description: Mapping updated
 */
router.put('/:id', authenticateJWT, requireRole(['admin']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const db = getDatabase();

    const mapping = await db.mapping.findUnique({ where: { id } });
    if (!mapping) {
      throw new ApiError(404, 'MAPPING_NOT_FOUND', 'Mapping not found');
    }

    const updateData: any = {};
    
    if (updates.affiliate_id) updateData.affiliateId = updates.affiliate_id;
    if (updates.offer_id) updateData.offerId = updates.offer_id;
    if (updates.advertiser_id) updateData.advertiserId = updates.advertiser_id;
    if (updates.forward_url !== undefined) updateData.forwardUrl = updates.forward_url;
    if (updates.enabled !== undefined) updateData.enabled = updates.enabled;

    const updatedMapping = await db.mapping.update({
      where: { id },
      data: updateData,
      include: {
        affiliate: {
          select: { id: true, name: true },
        },
        offer: {
          select: { id: true, name: true },
        },
        advertiser: {
          select: { id: true, name: true },
        },
      },
    });

    res.json(updatedMapping);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/mappings/{id}:
 *   delete:
 *     tags: [Mappings]
 *     summary: Delete mapping
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
 *         description: Mapping deleted
 */
router.delete('/:id', authenticateJWT, requireRole(['admin']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const db = getDatabase();

    const mapping = await db.mapping.findUnique({ where: { id } });
    if (!mapping) {
      throw new ApiError(404, 'MAPPING_NOT_FOUND', 'Mapping not found');
    }

    await db.mapping.delete({ where: { id } });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;