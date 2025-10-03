import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import { getDatabase } from '../../db/database';
import { ApiError } from '../../lib/errors';
import { authenticateJWT, requireRole } from '../middleware/auth';

const router = Router();

router.get('/', authenticateJWT, requireRole(['admin']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.page_size as string) || 20;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const db = getDatabase();

    const { count } = await db
      .from('users')
      .select('*', { count: 'exact', head: true });

    const { data: users, error } = await db
      .from('users')
      .select('id, email, role, created_at')
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) {
      throw new ApiError(500, 'DATABASE_ERROR', 'Failed to fetch users');
    }

    res.json({
      items: users || [],
      total: count || 0,
      page,
      page_size: pageSize,
      total_pages: Math.ceil((count || 0) / pageSize),
    });
  } catch (error) {
    next(error);
  }
});

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

    const { data: existingUser } = await db
      .from('users')
      .select('id')
      .eq('email', email.toLowerCase())
      .maybeSingle();

    if (existingUser) {
      throw new ApiError(400, 'USER_EXISTS', 'User with this email already exists');
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const { data: user, error } = await db
      .from('users')
      .insert({
        email: email.toLowerCase(),
        password_hash: passwordHash,
        role,
      })
      .select('id, email, role, created_at')
      .single();

    if (error) {
      throw new ApiError(500, 'DATABASE_ERROR', 'Failed to create user');
    }

    res.status(201).json(user);
  } catch (error) {
    next(error);
  }
});

router.put('/:id', authenticateJWT, requireRole(['admin']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { email, password, role } = req.body;

    const db = getDatabase();

    const { data: user } = await db
      .from('users')
      .select('id')
      .eq('id', id)
      .maybeSingle();

    if (!user) {
      throw new ApiError(404, 'USER_NOT_FOUND', 'User not found');
    }

    const updateData: any = {};

    if (email) {
      const { data: emailCheck } = await db
        .from('users')
        .select('id')
        .eq('email', email.toLowerCase())
        .neq('id', id)
        .maybeSingle();

      if (emailCheck) {
        throw new ApiError(400, 'EMAIL_EXISTS', 'Email already in use');
      }
      updateData.email = email.toLowerCase();
    }

    if (role && ['admin', 'operator'].includes(role)) {
      updateData.role = role;
    }

    if (password) {
      if (password.length < 6) {
        throw new ApiError(400, 'WEAK_PASSWORD', 'Password must be at least 6 characters');
      }
      updateData.password_hash = await bcrypt.hash(password, 12);
    }

    const { data: updatedUser, error } = await db
      .from('users')
      .update(updateData)
      .eq('id', id)
      .select('id, email, role, created_at')
      .single();

    if (error) {
      throw new ApiError(500, 'DATABASE_ERROR', 'Failed to update user');
    }

    res.json(updatedUser);
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', authenticateJWT, requireRole(['admin']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const db = getDatabase();

    const { data: user } = await db
      .from('users')
      .select('id')
      .eq('id', id)
      .maybeSingle();

    if (!user) {
      throw new ApiError(404, 'USER_NOT_FOUND', 'User not found');
    }

    const { error } = await db
      .from('users')
      .delete()
      .eq('id', id);

    if (error) {
      throw new ApiError(500, 'DATABASE_ERROR', 'Failed to delete user');
    }

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;
