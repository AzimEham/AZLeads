import { Request, Response, NextFunction } from 'express';
import { RedisHelper } from '../../lib/redis';
import { config } from '../../config/config';
import { ApiError } from '../../lib/errors';

export async function rateLimiter(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const ip = req.ip;
    const key = `rate_limit:${ip}`;
    
    // Global rate limit
    const allowed = await RedisHelper.checkRateLimit(key, config.rateLimitGlobal, 60);
    
    if (!allowed) {
      throw new ApiError(429, 'RATE_LIMIT_EXCEEDED', 'Too many requests');
    }

    next();
  } catch (error) {
    next(error);
  }
}

// Specific rate limiter for tracking endpoint
export async function trackRateLimiter(req: Request & { affiliate?: any }, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.affiliate) {
      return next();
    }

    const key = `rate_limit:track:${req.affiliate.id}`;
    const allowed = await RedisHelper.checkRateLimit(key, config.rateLimitTrack, 60);
    
    if (!allowed) {
      throw new ApiError(429, 'RATE_LIMIT_EXCEEDED', 'Track API rate limit exceeded');
    }

    next();
  } catch (error) {
    next(error);
  }
}