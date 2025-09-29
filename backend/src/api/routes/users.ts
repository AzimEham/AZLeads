import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import { getDatabase } from '../../db/database';
import { ApiError } from '../../lib/errors';
import { authenticateJWT, requireRole } from '../middleware/auth';

const router = Router();

/**
 * @swagger
 * /api/users:
 *   get:
 *     tags: [Users]
 *     summary: List users
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of users
 */
router.get('/', authenticateJWT, requireRole(['admin']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.page_size as string) || 20;
    const skip = (page - 1) * pageSize;

    const db = getDatabase();

    const [users, total] = await Promise.all([
      db.user.findMany({
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          role: true,
          createdAt: true,
        },
      }),
      db.user.count(),
    ]);

    res.json({
      items: users,
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
 * /api/users:
 *   post:
 *     tags: [Users]
 *     summary: Create user
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *               role:
 *                 type: string
 *                 enum: [admin, operator]
 *     responses:
 *       201:
 *         description: User created
 */
router.post('/', authenticateJWT, requireRole(['admin']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password, role = 'operator' } = req.body;

    if (!email || !password) {
      throw new ApiError(400, 'MISSING_FIELDS', 'Email and password are required');
    }

    if (password.length < 6) {
      throw new ApiError(400, 'WEAK_PASSWORD', 'Password must be at least 6 characters');
    }

    if (!['admin', 'operator'].includes(role)) {
      throw new ApiError(400, 'INVALID_ROLE', 'Role must be admin or operator');
    }

    const db = getDatabase();

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await db.user.create({
      data: {
        email: email.toLowerCase(),
        passwordHash,
        role,
      },
      select: {
        id: true,
        email: true,
        role: true,
        createdAt: true,
      },
    });

    res.status(201).json(user);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/users/{id}:
 *   put:
 *     tags: [Users]
 *     summary: Update user
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
 *         description: User updated
 */
router.put('/:id', authenticateJWT, requireRole(['admin']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { email, password, role } = req.body;
    
    const db = getDatabase();

    const user = await db.user.findUnique({ where: { id } });
    if (!user) {
      throw new ApiError(404, 'USER_NOT_FOUND', 'User not found');
    }

    const updateData: any = {};
    
    if (email) updateData.email = email.toLowerCase();
    if (role && ['admin', 'operator'].includes(role)) updateData.role = role;
    if (password) {
      if (password.length < 6) {
        throw new ApiError(400, 'WEAK_PASSWORD', 'Password must be at least 6 characters');
      }
      updateData.passwordHash = await bcrypt.hash(password, 12);
    }

    const updatedUser = await db.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        email: true,
        role: true,
        createdAt: true,
      },
    });

    res.json(updatedUser);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/users/{id}:
 *   delete:
 *     tags: [Users]
 *     summary: Delete user
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
 *         description: User deleted
 */
router.delete('/:id', authenticateJWT, requireRole(['admin']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const db = getDatabase();

    const user = await db.user.findUnique({ where: { id } });
    if (!user) {
      throw new ApiError(404, 'USER_NOT_FOUND', 'User not found');
    }

    await db.user.delete({ where: { id } });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;