import { Router, Request, Response, NextFunction } from 'express';
import { getDatabase } from '../../db/database';
import { ApiError } from '../../lib/errors';
import { authenticateJWT, requireRole } from '../middleware/auth';
import { logger } from '../../lib/logger';

const router = Router();

interface CreateAdvertiserRequest {
  name: string;
  endpoint_url: string;
  endpoint_secret?: string;
  platform?: string;
}

/**
 * @swagger
 * /api/advertisers:
 *   get:
 *     tags: [Advertisers]
 *     summary: List advertisers
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of advertisers
 */
router.get('/', authenticateJWT, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.page_size as string) || 20;
    const skip = (page - 1) * pageSize;

    const db = getDatabase();

    const [advertisers, total] = await Promise.all([
      db.advertiser.findMany({
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          endpointUrl: true,
          endpointSecret: true, // We'll transform this
          platform: true,
          createdAt: true,
        },
      }),
      db.advertiser.count(),
    ]);

    // Transform to hide secret but show if it exists
    const transformedAdvertisers = advertisers.map(advertiser => ({
      ...advertiser,
      hasSecret: !!advertiser.endpointSecret,
      endpointSecret: advertiser.endpointSecret ? '***' : '',
    }));

    res.json({
      items: transformedAdvertisers,
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
 * /api/advertisers:
 *   post:
 *     tags: [Advertisers]
 *     summary: Create advertiser
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
 *               endpoint_url:
 *                 type: string
 *               endpoint_secret:
 *                 type: string
 *               platform:
 *                 type: string
 *     responses:
 *       201:
 *         description: Advertiser created
 */
router.post('/', authenticateJWT, requireRole(['admin']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, endpoint_url, endpoint_secret, platform }: CreateAdvertiserRequest = req.body;

    if (!name || !endpoint_url) {
      throw new ApiError(400, 'MISSING_FIELDS', 'Name and endpoint_url are required');
    }

    const db = getDatabase();

    const advertiser = await db.advertiser.create({
      data: {
        name,
        endpointUrl: endpoint_url,
        endpointSecret: endpoint_secret || '',
        platform: platform || 'Generic',
      },
    });

    logger.info('Advertiser created', { 
      advertiserId: advertiser.id, 
      name: advertiser.name,
    });

    res.status(201).json({
      id: advertiser.id,
      name: advertiser.name,
      endpoint_url: advertiser.endpointUrl,
      platform: advertiser.platform,
      hasSecret: !!advertiser.endpointSecret,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/advertisers/{id}:
 *   get:
 *     tags: [Advertisers]
 *     summary: Get advertiser by ID
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
 *         description: Advertiser details
 */
router.get('/:id', authenticateJWT, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const db = getDatabase();

    const advertiser = await db.advertiser.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        endpointUrl: true,
        endpointSecret: true,
        platform: true,
        createdAt: true,
      },
    });

    if (!advertiser) {
      throw new ApiError(404, 'ADVERTISER_NOT_FOUND', 'Advertiser not found');
    }

    // Transform response
    const response = {
      ...advertiser,
      hasSecret: !!advertiser.endpointSecret,
      endpointSecret: advertiser.endpointSecret ? '***' : '',
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/advertisers/{id}:
 *   put:
 *     tags: [Advertisers]
 *     summary: Update advertiser
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
 *         description: Advertiser updated
 */
router.put('/:id', authenticateJWT, requireRole(['admin']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const db = getDatabase();

    const advertiser = await db.advertiser.findUnique({ where: { id } });
    if (!advertiser) {
      throw new ApiError(404, 'ADVERTISER_NOT_FOUND', 'Advertiser not found');
    }

    const updateData: any = {};
    
    if (updates.name) updateData.name = updates.name;
    if (updates.endpoint_url) updateData.endpointUrl = updates.endpoint_url;
    if (updates.endpoint_secret !== undefined) updateData.endpointSecret = updates.endpoint_secret;
    if (updates.platform) updateData.platform = updates.platform;

    const updatedAdvertiser = await db.advertiser.update({
      where: { id },
      data: updateData,
    });

    logger.info('Advertiser updated', { advertiserId: id });

    res.json({
      id: updatedAdvertiser.id,
      name: updatedAdvertiser.name,
      endpoint_url: updatedAdvertiser.endpointUrl,
      platform: updatedAdvertiser.platform,
      hasSecret: !!updatedAdvertiser.endpointSecret,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/advertisers/{id}:
 *   delete:
 *     tags: [Advertisers]
 *     summary: Delete advertiser
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
 *         description: Advertiser deleted
 */
router.delete('/:id', authenticateJWT, requireRole(['admin']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const db = getDatabase();

    const advertiser = await db.advertiser.findUnique({ where: { id } });
    if (!advertiser) {
      throw new ApiError(404, 'ADVERTISER_NOT_FOUND', 'Advertiser not found');
    }

    await db.advertiser.delete({ where: { id } });

    logger.info('Advertiser deleted', { advertiserId: id });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;