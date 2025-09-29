import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../../config/config';
import { getDatabase } from '../../db/database';
import { RedisHelper } from '../../lib/redis';
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
    
    // Check if token is revoked
    const isRevoked = await RedisHelper.exists(`revoked_token:${token}`);
    if (isRevoked) {
      throw new ApiError(401, 'TOKEN_REVOKED', 'Token has been revoked');
    }

    const decoded = jwt.verify(token, config.jwtAccessSecret) as any;
    
    // Get user from database to ensure they still exist
    const db = getDatabase();
    const user = await db.user.findUnique({
      where: { id: decoded.sub },
      select: { id: true, email: true, role: true }
    });

    if (!user) {
      throw new ApiError(401, 'USER_NOT_FOUND', 'User not found');
    }

    req.user = user;
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
    const affiliates = await db.affiliate.findMany({
      where: { active: true },
      select: {
        id: true,
        name: true,
        apiKeyHash: true,
        ipWhitelist: true
      }
    });

    let authenticatedAffiliate = null;
    
    // Check API key against all active affiliates
    // Note: In production, you'd want to hash the provided key and compare
    // For demo purposes, we'll assume the hash comparison is done here
    for (const affiliate of affiliates) {
      // TODO: Implement proper bcrypt/argon2 hash comparison
      if (affiliate.apiKeyHash === apiKey) {
        authenticatedAffiliate = affiliate;
        break;
      }
    }

    if (!authenticatedAffiliate) {
      throw new ApiError(401, 'INVALID_API_KEY', 'Invalid API key');
    }

    // IP whitelist check
    const clientIp = req.ip || req.connection.remoteAddress;
    if (clientIp && authenticatedAffiliate.ipWhitelist) {
      const allowedIps = authenticatedAffiliate.ipWhitelist as string[];
      // TODO: Implement CIDR range checking
      // For now, simple IP match
      const isAllowed = allowedIps.some(ip => 
        ip === clientIp || ip === '0.0.0.0/0'
      );
      
      if (!isAllowed) {
        throw new ApiError(403, 'IP_NOT_ALLOWED', 'IP address not in whitelist');
      }
    }

    // Update last used timestamp
    await db.affiliate.update({
      where: { id: authenticatedAffiliate.id },
      data: { lastUsedAt: new Date() }
    });

    req.affiliate = authenticatedAffiliate;
    next();
  } catch (error) {
    next(error);
  }
}