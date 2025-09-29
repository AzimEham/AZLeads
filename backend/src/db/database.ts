import { PrismaClient } from '@prisma/client';
import { logger } from '../lib/logger';

let prisma: PrismaClient;

export async function setupDatabase(): Promise<void> {
  prisma = new PrismaClient({
    log: ['error', 'warn'],
  });

  // Test connection
  try {
    await prisma.$connect();
    logger.info('Database connection established');
  } catch (error) {
    logger.error('Failed to connect to database:', error);
    throw error;
  }
}

export function getDatabase(): PrismaClient {
  if (!prisma) {
    throw new Error('Database not initialized. Call setupDatabase() first.');
  }
  return prisma;
}

export { prisma };