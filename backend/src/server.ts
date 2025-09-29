import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createServer } from 'http';
import { config } from './config/config';
import { logger } from './lib/logger';
import { setupDatabase } from './db/database';
import { setupRedis } from './lib/redis';
import { setupQueues } from './jobs/queue';
import { setupRoutes } from './api/routes';
import { errorHandler, notFoundHandler } from './api/middleware/error';
import { requestLogger } from './api/middleware/logger';
import { rateLimiter } from './api/middleware/rateLimit';
import { setupSwagger } from './swagger/setup';
import { metricsMiddleware, metricsRoute } from './lib/metrics';

const app = express();
const server = createServer(app);

// Trust proxy for accurate IP detection
app.set('trust proxy', true);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false, // Allow Swagger UI
}));

// CORS configuration
app.use(cors({
  origin: config.corsOrigins,
  credentials: false,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key', 'Idempotency-Key'],
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use(requestLogger);

// Metrics middleware
app.use(metricsMiddleware);

// Rate limiting
app.use(rateLimiter);

// Health check (before auth)
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  });
});

// Metrics endpoint
app.get('/metrics', metricsRoute);

// Setup Swagger documentation
setupSwagger(app);

// API routes
app.use('/api', setupRoutes());

// Error handlers (must be last)
app.use(notFoundHandler);
app.use(errorHandler);

async function startServer() {
  try {
    // Initialize database
    await setupDatabase();
    logger.info('Database connected successfully');

    // Initialize Redis
    await setupRedis();
    logger.info('Redis connected successfully');

    // Setup job queues
    await setupQueues();
    logger.info('Job queues initialized');

    // Start server
    server.listen(config.port, () => {
      logger.info(`Server running on port ${config.port}`);
      logger.info(`Environment: ${config.nodeEnv}`);
      logger.info(`API Documentation: http://localhost:${config.port}/docs`);
    });

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('Process terminated');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  server.close(() => {
    logger.info('Process terminated');
    process.exit(0);
  });
});

startServer();

export default app;