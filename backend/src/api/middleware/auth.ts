import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../../config/config';
import { getDatabase } from '../../db/database';
import { ApiError } from '../../lib/errors';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: 'admin' | 'operator';
  };
}

export async function authenticateJWT(
  req: AuthenticatedRequest, 
  res: Response, 
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new ApiError(401, 'AUTH_REQUIRED', 'Authorization header required');
    }

    const token = authHeader.split(' ')[1];

    const decoded = jwt.verify(token, config.jwtAccessSecret) as any;

    const db = getDatabase();
    const { data: user, error } = await db
      .from('users')
      .select('id, email, role')
      .eq('id', decoded.sub)
      .maybeSingle();

    if (error || !user) {
      throw new ApiError(401, 'USER_NOT_FOUND', 'User not found');
    }

    req.user = user as any;
    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      next(new ApiError(401, 'INVALID_TOKEN', 'Invalid or expired token'));
    } else {
      next(error);
    }
  }
}

export function requireRole(roles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new ApiError(401, 'AUTH_REQUIRED', 'Authentication required'));
    }

    if (!roles.includes(req.user.role)) {
      return next(new ApiError(403, 'INSUFFICIENT_PERMISSIONS', 'Insufficient permissions'));
    }

    next();
  };
}

// Affiliate API key authentication
export async function authenticateAffiliate(
  req: Request & { affiliate?: any }, 
  res: Response, 
  next: NextFunction
): Promise<void> {
  try {
    const apiKey = req.headers['x-api-key'] as string;
    
    if (!apiKey) {
      throw new ApiError(401, 'API_KEY_REQUIRED', 'x-api-key header required');
    }

    const db = getDatabase();
    const { data: affiliates, error: affiliatesError } = await db
      .from('affiliates')
      .select('id, name, api_key_hash, ip_whitelist')
      .eq('active', true);

    if (affiliatesError || !affiliates) {
      throw new ApiError(500, 'DATABASE_ERROR', 'Failed to fetch affiliates');
    }

    let authenticatedAffiliate = null;
    
    for (const affiliate of affiliates) {
      if (affiliate.api_key_hash === apiKey) {
        authenticatedAffiliate = affiliate;
        break;
      }
    }

    if (!authenticatedAffiliate) {
      throw new ApiError(401, 'INVALID_API_KEY', 'Invalid API key');
    }

    const clientIp = req.ip || req.connection.remoteAddress;
    if (clientIp && authenticatedAffiliate.ip_whitelist) {
      const allowedIps = authenticatedAffiliate.ip_whitelist as string[];
      const isAllowed = allowedIps.some(ip =>
        ip === clientIp || ip === '0.0.0.0/0'
      );

      if (!isAllowed) {
        throw new ApiError(403, 'IP_NOT_ALLOWED', 'IP address not in whitelist');
      }
    }

    await db
      .from('affiliates')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', authenticatedAffiliate.id);

    req.affiliate = authenticatedAffiliate;
    next();
  } catch (error) {
    next(error);
  }
}