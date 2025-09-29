import { Request, Response, NextFunction } from 'express';
import { logger } from '../../lib/logger';
import { v4 as uuidv4 } from 'uuid';

export interface RequestWithId extends Request {
  id: string;
}

export function requestLogger(req: RequestWithId, res: Response, next: NextFunction): void {
  req.id = uuidv4();
  
  const start = Date.now();
  
  logger.info('Request started', {
    requestId: req.id,
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
  });

  res.on('finish', () => {
    const duration = Date.now() - start;
    
    logger.info('Request completed', {
      requestId: req.id,
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration,
    });
  });

  next();
}