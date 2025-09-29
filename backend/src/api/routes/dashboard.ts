import { Router, Request, Response, NextFunction } from 'express';
import { getDatabase } from '../../db/database';
import { authenticateJWT } from '../middleware/auth';

const router = Router();

/**
 * @swagger
 * /api/dashboard/kpi:
 *   get:
 *     tags: [Dashboard]
 *     summary: Get KPI data
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: range
 *         schema:
 *           type: string
 *           enum: [1d, 7d, 14d, 30d, 90d]
 *     responses:
 *       200:
 *         description: KPI data
 */
router.get('/kpi', authenticateJWT, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const range = req.query.range as string || '30d';
    const days = parseInt(range.replace('d', ''));
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const db = getDatabase();

    // Get leads count
    const leadsCount = await db.lead.count({
      where: {
        createdAt: { gte: startDate },
      },
    });

    // Get conversions count (approved leads)
    const conversionsCount = await db.lead.count({
      where: {
        createdAt: { gte: startDate },
        status: 'approved',
      },
    });

    // Get total payout (income)
    const payoutSum = await db.lead.aggregate({
      where: {
        createdAt: { gte: startDate },
        status: 'approved',
        payout: { not: null },
      },
      _sum: {
        payout: true,
      },
    });

    const income = Number(payoutSum._sum.payout || 0);
    const cost = income * 0.8; // Assume 80% cost ratio for demo
    const profit = income - cost;
    const conversionRate = leadsCount > 0 ? (conversionsCount / leadsCount) * 100 : 0;

    res.json({
      income,
      cost,
      profit,
      leads: leadsCount,
      conversions: conversionsCount,
      conversionRate,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/dashboard/charts:
 *   get:
 *     tags: [Dashboard]
 *     summary: Get chart data
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: range
 *         schema:
 *           type: string
 *           enum: [1d, 7d, 14d, 30d, 90d]
 *     responses:
 *       200:
 *         description: Chart data
 */
router.get('/charts', authenticateJWT, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const range = req.query.range as string || '30d';
    const days = parseInt(range.replace('d', ''));
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const db = getDatabase();

    // Daily leads trend
    const dailyLeads = await db.$queryRaw`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as leads,
        COUNT(CASE WHEN status = 'approved' THEN 1 END) as conversions
      FROM leads 
      WHERE created_at >= ${startDate}
      GROUP BY DATE(created_at)
      ORDER BY date
    ` as any[];

    // Leads by affiliate
    const leadsByAffiliate = await db.$queryRaw`
      SELECT 
        a.name,
        COUNT(l.id) as leads
      FROM affiliates a
      LEFT JOIN leads l ON a.id = l.affiliate_id AND l.created_at >= ${startDate}
      GROUP BY a.id, a.name
      HAVING COUNT(l.id) > 0
      ORDER BY leads DESC
      LIMIT 10
    ` as any[];

    // Leads by advertiser
    const leadsByAdvertiser = await db.$queryRaw`
      SELECT 
        a.name,
        COUNT(l.id) as leads
      FROM advertisers a
      LEFT JOIN leads l ON a.id = l.advertiser_id AND l.created_at >= ${startDate}
      GROUP BY a.id, a.name
      HAVING COUNT(l.id) > 0
      ORDER BY leads DESC
      LIMIT 10
    ` as any[];

    // Leads by status
    const leadsByStatus = await db.lead.groupBy({
      by: ['status'],
      where: {
        createdAt: { gte: startDate },
      },
      _count: {
        status: true,
      },
    });

    const statusColors = {
      pending: '#f59e0b',
      forwarded: '#3b82f6',
      approved: '#10b981',
      rejected: '#ef4444',
      no_mapping: '#6b7280',
      forward_failed: '#dc2626',
    };

    const transformedStatusData = leadsByStatus.map(item => ({
      name: item.status,
      value: item._count.status,
      color: statusColors[item.status as keyof typeof statusColors] || '#6b7280',
    }));

    res.json({
      dailyLeads: dailyLeads.map(item => ({
        date: item.date.toISOString().split('T')[0],
        leads: Number(item.leads),
        conversions: Number(item.conversions),
      })),
      leadsByAffiliate: leadsByAffiliate.map(item => ({
        name: item.name,
        leads: Number(item.leads),
      })),
      leadsByAdvertiser: leadsByAdvertiser.map(item => ({
        name: item.name,
        leads: Number(item.leads),
      })),
      leadsByStatus: transformedStatusData,
    });
  } catch (error) {
    next(error);
  }
});

export default router;