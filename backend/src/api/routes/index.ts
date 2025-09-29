import { Router } from 'express';
import authRoutes from './auth';
import trackRoutes from './track';
import callbackRoutes from './callback';
import affiliatesRoutes from './affiliates';
import advertisersRoutes from './advertisers';
import offersRoutes from './offers';
import mappingsRoutes from './mappings';
import leadsRoutes from './leads';
import commissionsRoutes from './commissions';
import usersRoutes from './users';
import dashboardRoutes from './dashboard';
import reportsRoutes from './reports';
import exportsRoutes from './exports';
import financeRoutes from './finance';

export function setupRoutes(): Router {
  const router = Router();

  // Public routes
  router.use('/track', trackRoutes);
  router.use('/advertiser_callback', callbackRoutes);
  router.use('/auth', authRoutes);

  // Protected routes
  router.use('/affiliates', affiliatesRoutes);
  router.use('/advertisers', advertisersRoutes);
  router.use('/offers', offersRoutes);
  router.use('/mappings', mappingsRoutes);
  router.use('/leads', leadsRoutes);
  router.use('/commissions', commissionsRoutes);
  router.use('/users', usersRoutes);
  router.use('/dashboard', dashboardRoutes);
  router.use('/reports', reportsRoutes);
  router.use('/exports', exportsRoutes);
  router.use('/finance', financeRoutes);

  return router;
}