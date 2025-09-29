import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

export const config = {
  // Server
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '4000', 10),
  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:5173').split(','),

  // Database
  databaseUrl: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/azleads',

  // Redis
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',

  // JWT
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET || 'change_me',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || 'change_me_too',
  jwtAccessTtl: process.env.JWT_ACCESS_TTL || '15m',
  jwtRefreshTtl: process.env.JWT_REFRESH_TTL || '7d',

  // Security
  hmacAlgo: process.env.HMAC_ALGO || 'sha256',

  // Application
  appTz: process.env.APP_TZ || 'Asia/Dhaka',
  retentionDays: parseInt(process.env.RETENTION_DAYS || '90', 10),

  // Rate limits
  rateLimitTrack: parseInt(process.env.RATE_LIMIT_TRACK || '100', 10),
  rateLimitGlobal: parseInt(process.env.RATE_LIMIT_GLOBAL || '500', 10),
} as const;

// Validate required environment variables
const requiredEnvVars = ['DATABASE_URL', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
}