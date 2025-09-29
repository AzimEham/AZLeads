import { Queue, Worker, Job } from 'bullmq';
import { getRedis } from '../lib/redis';
import { logger } from '../lib/logger';

// Job queues
let forwardLeadQueue: Queue;
let retentionQueue: Queue;

// Workers
let forwardWorker: Worker;
let retentionWorker: Worker;

export async function setupQueues(): Promise<void> {
  const redis = getRedis();

  // Initialize queues
  forwardLeadQueue = new Queue('forward-lead', {
    connection: redis,
    defaultJobOptions: {
      attempts: 6,
      backoff: {
        type: 'exponential',
        delay: 1000, // Start with 1 second
      },
      removeOnComplete: 100,
      removeOnFail: 50,
    },
  });

  retentionQueue = new Queue('retention', {
    connection: redis,
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
    },
  });

  // Setup workers
  await setupWorkers();

  // Setup recurring jobs
  await setupRecurringJobs();

  logger.info('Job queues initialized successfully');
}

async function setupWorkers(): Promise<void> {
  const redis = getRedis();

  // Forward lead worker
  const { processForwardLead } = await import('./forwardLead');
  forwardWorker = new Worker('forward-lead', processForwardLead, {
    connection: redis,
    concurrency: 10, // Process up to 10 jobs concurrently
  });

  forwardWorker.on('completed', (job: Job) => {
    logger.info('Forward job completed', { jobId: job.id, leadId: job.data.leadId });
  });

  forwardWorker.on('failed', (job: Job | undefined, error: Error) => {
    logger.error('Forward job failed', { 
      jobId: job?.id, 
      leadId: job?.data?.leadId, 
      error: error.message 
    });
  });

  // Retention worker
  const { processRetention } = await import('./retention');
  retentionWorker = new Worker('retention', processRetention, {
    connection: redis,
    concurrency: 1, // Run one at a time
  });

  retentionWorker.on('completed', (job: Job) => {
    logger.info('Retention job completed', { jobId: job.id });
  });

  retentionWorker.on('failed', (job: Job | undefined, error: Error) => {
    logger.error('Retention job failed', { jobId: job?.id, error: error.message });
  });
}

async function setupRecurringJobs(): Promise<void> {
  // Daily retention cleanup at 2 AM
  await retentionQueue.add(
    'cleanup',
    {},
    {
      repeat: {
        cron: '0 2 * * *', // Daily at 2 AM
      },
      jobId: 'daily-retention-cleanup', // Prevent duplicates
    }
  );

  logger.info('Recurring jobs scheduled');
}

export function getForwardLeadQueue(): Queue {
  if (!forwardLeadQueue) {
    throw new Error('Forward lead queue not initialized');
  }
  return forwardLeadQueue;
}

export function getRetentionQueue(): Queue {
  if (!retentionQueue) {
    throw new Error('Retention queue not initialized');
  }
  return retentionQueue;
}

// Graceful shutdown
export async function shutdownQueues(): Promise<void> {
  logger.info('Shutting down job queues...');
  
  await Promise.all([
    forwardWorker?.close(),
    retentionWorker?.close(),
    forwardLeadQueue?.close(),
    retentionQueue?.close(),
  ]);

  logger.info('Job queues shut down successfully');
}

// Handle process signals
process.on('SIGTERM', shutdownQueues);
process.on('SIGINT', shutdownQueues);