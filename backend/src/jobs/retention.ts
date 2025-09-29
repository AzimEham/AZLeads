import { Job } from 'bullmq';
import { getDatabase } from '../db/database';
import { logger } from '../lib/logger';
import { config } from '../config/config';

interface RetentionJobData {
  [key: string]: any;
}

export async function processRetention(job: Job<RetentionJobData>): Promise<void> {
  logger.info('Processing retention cleanup job', { jobId: job.id });

  try {
    const db = getDatabase();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - config.retentionDays);

    // Delete old traffic logs
    const deletedTrafficLogs = await db.trafficLog.deleteMany({
      where: {
        receivedAt: {
          lt: cutoffDate,
        },
      },
    });

    // Delete old callback logs
    const deletedCallbackLogs = await db.callbackLog.deleteMany({
      where: {
        receivedAt: {
          lt: cutoffDate,
        },
      },
    });

    // Delete old forward logs for leads older than retention period
    const deletedForwardLogs = await db.forwardLog.deleteMany({
      where: {
        createdAt: {
          lt: cutoffDate,
        },
        lead: {
          createdAt: {
            lt: cutoffDate,
          },
        },
      },
    });

    logger.info('Retention cleanup completed', {
      jobId: job.id,
      cutoffDate: cutoffDate.toISOString(),
      deletedTrafficLogs: deletedTrafficLogs.count,
      deletedCallbackLogs: deletedCallbackLogs.count,
      deletedForwardLogs: deletedForwardLogs.count,
    });

  } catch (error: any) {
    logger.error('Retention cleanup failed', { 
      jobId: job.id, 
      error: error.message 
    });
    throw error;
  }
}