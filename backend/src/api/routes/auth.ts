import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { config } from '../../config/config';
import { getDatabase } from '../../db/database';
import { RedisHelper } from '../../lib/redis';
import { ApiError } from '../../lib/errors';
import { authenticateJWT, AuthenticatedRequest } from '../middleware/auth';
import { logger } from '../../lib/logger';

const router = Router();

interface LoginRequest {
  email: string;
  password: string;
}

interface RefreshRequest {
  refresh_token: string;
}

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: User login
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
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 access_token:
 *                   type: string
 *                 refresh_token:
 *                   type: string
 *                 user:
 *                   type: object
 */
router.post('/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password }: LoginRequest = req.body;

    if (!email || !password) {
      throw new ApiError(400, 'MISSING_CREDENTIALS', 'Email and password are required');
    }

    const db = getDatabase();
    const user = await db.user.findUnique({
      where: { email: email.toLowerCase() }
    });

    if (!user || !await bcrypt.compare(password, user.passwordHash)) {
      throw new ApiError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
    }

    // Generate tokens
    const accessToken = jwt.sign(
      { sub: user.id, email: user.email, role: user.role },
      config.jwtAccessSecret,
      { expiresIn: config.jwtAccessTtl }
    );

    const refreshToken = jwt.sign(
      { sub: user.id, type: 'refresh' },
      config.jwtRefreshSecret,
      { expiresIn: config.jwtRefreshTtl }
    );

    // Store refresh token
    await RedisHelper.set(`refresh_token:${user.id}`, refreshToken, 7 * 24 * 60 * 60); // 7 days

    logger.info('User logged in', { userId: user.id, email: user.email });

    res.json({
      access_token: accessToken,
      refresh_token: refreshToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/auth/refresh:
 *   post:
 *     tags: [Auth]
 *     summary: Refresh access token
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               refresh_token:
 *                 type: string
 *     responses:
 *       200:
 *         description: Tokens refreshed
 */
router.post('/refresh', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { refresh_token }: RefreshRequest = req.body;

    if (!refresh_token) {
      throw new ApiError(400, 'MISSING_REFRESH_TOKEN', 'Refresh token is required');
    }

    const decoded = jwt.verify(refresh_token, config.jwtRefreshSecret) as any;
    
    if (decoded.type !== 'refresh') {
      throw new ApiError(401, 'INVALID_TOKEN', 'Invalid token type');
    }

    // Verify stored refresh token
    const storedToken = await RedisHelper.get(`refresh_token:${decoded.sub}`);
    if (storedToken !== refresh_token) {
      throw new ApiError(401, 'INVALID_REFRESH_TOKEN', 'Invalid refresh token');
    }

    const db = getDatabase();
    const user = await db.user.findUnique({
      where: { id: decoded.sub },
      select: { id: true, email: true, role: true }
    });

    if (!user) {
      throw new ApiError(401, 'USER_NOT_FOUND', 'User not found');
    }

    // Generate new tokens
    const newAccessToken = jwt.sign(
      { sub: user.id, email: user.email, role: user.role },
      config.jwtAccessSecret,
      { expiresIn: config.jwtAccessTtl }
    );

    const newRefreshToken = jwt.sign(
      { sub: user.id, type: 'refresh' },
      config.jwtRefreshSecret,
      { expiresIn: config.jwtRefreshTtl }
    );

    // Update stored refresh token
    await RedisHelper.set(`refresh_token:${user.id}`, newRefreshToken, 7 * 24 * 60 * 60);

    res.json({
      access_token: newAccessToken,
      refresh_token: newRefreshToken,
    });
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      next(new ApiError(401, 'INVALID_TOKEN', 'Invalid or expired refresh token'));
    } else {
      next(error);
    }
  }
});

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     tags: [Auth]
 *     summary: User logout
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logout successful
 */
router.post('/logout', authenticateJWT, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.split(' ')[1];

    if (token) {
      // Add token to revocation list
      await RedisHelper.set(`revoked_token:${token}`, '1', 60 * 60); // 1 hour
    }

    // Remove refresh token
    if (req.user) {
      await RedisHelper.del(`refresh_token:${req.user.id}`);
    }

    logger.info('User logged out', { userId: req.user?.id });

    res.json({ message: 'Logout successful' });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/auth/profile:
 *   get:
 *     tags: [Auth]
 *     summary: Get current user profile
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile
 */
router.get('/profile', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  res.json(req.user);
});

export default router;