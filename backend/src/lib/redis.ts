import { createClient, RedisClientType } from 'redis';
import { config } from '../config/config';
import { logger } from './logger';

let redisClient: RedisClientType;

export async function setupRedis(): Promise<void> {
  redisClient = createClient({
    url: config.redisUrl,
  });

  redisClient.on('error', (error) => {
    logger.error('Redis error:', error);
  });

  redisClient.on('connect', () => {
    logger.info('Connected to Redis');
  });

  await redisClient.connect();
}

export function getRedis(): RedisClientType {
  if (!redisClient) {
    throw new Error('Redis not initialized. Call setupRedis() first.');
  }
  return redisClient;
}

// Helper functions for common operations
export class RedisHelper {
  static async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    const redis = getRedis();
    if (ttlSeconds) {
      await redis.setEx(key, ttlSeconds, value);
    } else {
      await redis.set(key, value);
    }
  }

  static async get(key: string): Promise<string | null> {
    const redis = getRedis();
    return await redis.get(key);
  }

  static async del(key: string): Promise<void> {
    const redis = getRedis();
    await redis.del(key);
  }

  static async exists(key: string): Promise<boolean> {
    const redis = getRedis();
    return (await redis.exists(key)) === 1;
  }

  static async setJson(key: string, value: any, ttlSeconds?: number): Promise<void> {
    await this.set(key, JSON.stringify(value), ttlSeconds);
  }

  static async getJson(key: string): Promise<any> {
    const value = await this.get(key);
    return value ? JSON.parse(value) : null;
  }

  // Token bucket for rate limiting
  static async checkRateLimit(key: string, limit: number, windowSeconds: number): Promise<boolean> {
    const redis = getRedis();
    const current = await redis.incr(key);
    
    if (current === 1) {
      await redis.expire(key, windowSeconds);
    }
    
    return current <= limit;
  }

  // Idempotency key storage
  static async storeIdempotencyResult(key: string, result: any, ttlSeconds: number = 86400): Promise<void> {
    await this.setJson(`idempotency:${key}`, result, ttlSeconds);
  }

  static async getIdempotencyResult(key: string): Promise<any> {
    return await this.getJson(`idempotency:${key}`);
  }

  // HMAC replay protection
  static async checkReplayAttack(timestamp: string, signature: string): Promise<boolean> {
    const key = `replay:${timestamp}:${signature}`;
    const exists = await this.exists(key);
    
    if (!exists) {
      // Store for 5 minutes
      await this.set(key, '1', 300);
      return false; // Not a replay
    }
    
    return true; // Is a replay
  }
}