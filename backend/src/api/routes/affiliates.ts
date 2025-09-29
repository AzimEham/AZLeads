import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '../../db/database';
import { ApiError } from '../../lib/errors';
import { authenticateJWT, requireRole } from '../middleware/auth';
import { logger } from '../../lib/logger';

const router = Router();

interface CreateAffiliateRequest {
  name: string;
  email: string;
  ips: string[];
}

interface UpdateAffiliateRequest {
  name?: string;
  email?: string;
  ip_whitelist?: string[];
  active?: boolean;
}

/**
 * @swagger
 * /api/affiliates:
 *   get:
 *     tags: [Affiliates]
 *     summary: List affiliates
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
 *     responses:
 *       200:
 *         description: List of affiliates
 */
router.get('/', authenticateJWT, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.page_size as string) || 20;
    const skip = (page - 1) * pageSize;

    const db = getDatabase();

    const [affiliates, total] = await Promise.all([
      db.affiliate.findMany({
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          email: true,
          ipWhitelist: true,
          active: true,
          lastUsedAt: true,
          createdAt: true,
          apiKeyHash: true, // We'll return a flag instead
        },
      }),
      db.affiliate.count(),
    ]);

    // Transform response to hide sensitive data
    const transformedAffiliates = affiliates.map(affiliate => ({
      ...affiliate,
      hasApiKey: !!affiliate.apiKeyHash,
      apiKeyHash: undefined,
    }));

    res.json({
      items: transformedAffiliates,
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
 * /api/affiliates:
 *   post:
 *     tags: [Affiliates]
 *     summary: Create affiliate
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
 *               email:
 *                 type: string
 *               ip_whitelist:
 *                 type: array
 *                 items:
 *                   type: string
 *               active:
 *                 type: boolean
 *     responses:
 *       201:
 *         description: Affiliate created
 */
router.post('/', authenticateJWT, requireRole(['admin']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, email, ip_whitelist, active = true } = req.body;

    if (!name || !email) {
      throw new ApiError(400, 'MISSING_FIELDS', 'Name and email are required');
    }

    const db = getDatabase();

    // Generate API key
    const apiKey = `azl_${uuidv4().replace(/-/g, '')}`;
    const apiKeyHash = await bcrypt.hash(apiKey, 12);

    const affiliate = await db.affiliate.create({
      data: {
        name,
        email: email.toLowerCase(),
        apiKeyHash,
        ipWhitelist: ip_whitelist || [],
        active,
      },
    });

    logger.info('Affiliate created', { 
      affiliateId: affiliate.id, 
      name: affiliate.name,
      email: affiliate.email,
    });

    res.status(201).json({
      id: affiliate.id,
      name: affiliate.name,
      email: affiliate.email,
      api_key: apiKey, // Only shown once
      active: affiliate.active,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/affiliates/{id}:
 *   get:
 *     tags: [Affiliates]
 *     summary: Get affiliate by ID
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
 *         description: Affiliate details
 */
router.get('/:id', authenticateJWT, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const db = getDatabase();

    const affiliate = await db.affiliate.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        ipWhitelist: true,
        active: true,
        lastUsedAt: true,
        createdAt: true,
      },
    });

    if (!affiliate) {
      throw new ApiError(404, 'AFFILIATE_NOT_FOUND', 'Affiliate not found');
    }

    res.json(affiliate);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/affiliates/{id}:
 *   put:
 *     tags: [Affiliates]
 *     summary: Update affiliate
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *               ip_whitelist:
 *                 type: array
 *                 items:
 *                   type: string
 *               active:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Affiliate updated
 */
router.put('/:id', authenticateJWT, requireRole(['admin']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const updates: UpdateAffiliateRequest = req.body;
    
    const db = getDatabase();

    const affiliate = await db.affiliate.findUnique({ where: { id } });
    if (!affiliate) {
      throw new ApiError(404, 'AFFILIATE_NOT_FOUND', 'Affiliate not found');
    }

    const updateData: any = {};
    
    if (updates.name) updateData.name = updates.name;
    if (updates.email) updateData.email = updates.email.toLowerCase();
    if (updates.ip_whitelist !== undefined) updateData.ipWhitelist = updates.ip_whitelist;
    if (updates.active !== undefined) updateData.active = updates.active;

    const updatedAffiliate = await db.affiliate.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        ipWhitelist: true,
        active: true,
        lastUsedAt: true,
        createdAt: true,
      },
    });

    logger.info('Affiliate updated', { affiliateId: id });

    res.json(updatedAffiliate);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/affiliates/{id}:
 *   delete:
 *     tags: [Affiliates]
 *     summary: Delete affiliate
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
 *         description: Affiliate deleted
 */
router.delete('/:id', authenticateJWT, requireRole(['admin']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const db = getDatabase();

    const affiliate = await db.affiliate.findUnique({ where: { id } });
    if (!affiliate) {
      throw new ApiError(404, 'AFFILIATE_NOT_FOUND', 'Affiliate not found');
    }

    await db.affiliate.delete({ where: { id } });

    logger.info('Affiliate deleted', { affiliateId: id });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

// Public registration endpoint for affiliates
/**
 * @swagger
 * /api/affiliate/register:
 *   post:
 *     tags: [Affiliates]
 *     summary: Register new affiliate (public)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *               ips:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       201:
 *         description: Affiliate registered
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 affiliate_id:
 *                   type: string
 *                 api_key:
 *                   type: string
 */
router.post('/register', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, email, ips = [] }: CreateAffiliateRequest = req.body;

    if (!name || !email) {
      throw new ApiError(400, 'MISSING_FIELDS', 'Name and email are required');
    }

    const db = getDatabase();

    // Generate API key
    const apiKey = `azl_${uuidv4().replace(/-/g, '')}`;
    const apiKeyHash = await bcrypt.hash(apiKey, 12);

    const affiliate = await db.affiliate.create({
      data: {
        name,
        email: email.toLowerCase(),
        apiKeyHash,
        ipWhitelist: ips,
        active: true,
      },
    });

    logger.info('Affiliate registered', { 
      affiliateId: affiliate.id, 
      name: affiliate.name,
      email: affiliate.email,
    });

    res.status(201).json({
      affiliate_id: affiliate.id,
      api_key: apiKey,
    });
  } catch (error) {
    next(error);
  }
});

export default router;