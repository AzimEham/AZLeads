import { Request, Response, NextFunction } from 'express';
import client from 'prom-client';

// Create a Registry
const register = new client.Registry();

// Add default metrics
client.collectDefaultMetrics({ register });

// Custom metrics
const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10]
});

const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code']
});

const inboundLeadsTotal = new client.Counter({
  name: 'inbound_leads_total',
  help: 'Total number of inbound leads',
  labelNames: ['affiliate_id', 'status']
});

const forwardAttemptsTotal = new client.Counter({
  name: 'forward_attempts_total',
  help: 'Total number of forward attempts',
  labelNames: ['advertiser_id', 'status']
});

const forwardLatency = new client.Histogram({
  name: 'forward_latency_seconds',
  help: 'Latency of lead forwarding in seconds',
  labelNames: ['advertiser_id'],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30]
});

const callbacksTotal = new client.Counter({
  name: 'callbacks_total',
  help: 'Total number of advertiser callbacks',
  labelNames: ['advertiser_id', 'status']
});

// Register metrics
register.registerMetric(httpRequestDuration);
register.registerMetric(httpRequestsTotal);
register.registerMetric(inboundLeadsTotal);
register.registerMetric(forwardAttemptsTotal);
register.registerMetric(forwardLatency);
register.registerMetric(callbacksTotal);

// Middleware to collect HTTP metrics
export function metricsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();

  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    const route = req.route ? req.route.path : req.path;

    httpRequestDuration
      .labels(req.method, route, res.statusCode.toString())
      .observe(duration);

    httpRequestsTotal
      .labels(req.method, route, res.statusCode.toString())
      .inc();
  });

  next();
}

// Route to expose metrics
export async function metricsRoute(req: Request, res: Response): Promise<void> {
  res.set('Content-Type', register.contentType);
  const metrics = await register.metrics();
  res.end(metrics);
}

// Helper functions to record business metrics
export const Metrics = {
  recordInboundLead(affiliateId: string, status: string): void {
    inboundLeadsTotal.labels(affiliateId, status).inc();
  },

  recordForwardAttempt(advertiserId: string, status: string): void {
    forwardAttemptsTotal.labels(advertiserId, status).inc();
  },

  recordForwardLatency(advertiserId: string, latencySeconds: number): void {
    forwardLatency.labels(advertiserId).observe(latencySeconds);
  },

  recordCallback(advertiserId: string, status: string): void {
    callbacksTotal.labels(advertiserId, status).inc();
  }
};