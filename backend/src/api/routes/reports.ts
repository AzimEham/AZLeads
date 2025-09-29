import { Router, Request, Response, NextFunction } from 'express';
import { getDatabase } from '../../db/database';
import { authenticateJWT } from '../middleware/auth';

const router = Router();

/**
 * @swagger
 * /api/reports:
 *   get:
 *     tags: [Reports]
 *     summary: Get comprehensive report data
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: range
 *         schema:
 *           type: string
 *           enum: [7d, 14d, 30d, 90d]
 *     responses:
 *       200:
 *         description: Report data
 */
router.get('/', authenticateJWT, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const range = req.query.range as string || '30d';
    const days = parseInt(range.replace('d', ''));
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const db = getDatabase();

    // Performance data (daily)
    const performance = await db.$queryRaw`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as leads,
        COUNT(CASE WHEN status = 'approved' THEN 1 END) as conversions,
        COALESCE(SUM(CASE WHEN status = 'approved' THEN payout ELSE 0 END), 0) as revenue
      FROM leads 
      WHERE created_at >= ${startDate}
      GROUP BY DATE(created_at)
      ORDER BY date
    ` as any[];

    // Affiliate performance
    const affiliatePerformance = await db.$queryRaw`
      SELECT 
        a.name as affiliate,
        COUNT(l.id) as leads,
        COUNT(CASE WHEN l.status = 'approved' THEN 1 END) as conversions,
        COALESCE(SUM(CASE WHEN l.status = 'approved' THEN l.payout ELSE 0 END), 0) as revenue,
        CASE 
          WHEN COUNT(l.id) > 0 THEN (COUNT(CASE WHEN l.status = 'approved' THEN 1 END) * 100.0 / COUNT(l.id))
          ELSE 0 
        END as conversion_rate
      FROM affiliates a
      LEFT JOIN leads l ON a.id = l.affiliate_id AND l.created_at >= ${startDate}
      GROUP BY a.id, a.name
      HAVING COUNT(l.id) > 0
      ORDER BY revenue DESC
      LIMIT 20
    ` as any[];

    // Advertiser performance
    const advertiserPerformance = await db.$queryRaw`
      SELECT 
        a.name as advertiser,
        COUNT(l.id) as leads,
        COUNT(CASE WHEN l.status = 'approved' THEN 1 END) as conversions,
        COALESCE(SUM(CASE WHEN l.status = 'approved' THEN l.payout ELSE 0 END), 0) as payout
      FROM advertisers a
      LEFT JOIN leads l ON a.id = l.advertiser_id AND l.created_at >= ${startDate}
      GROUP BY a.id, a.name
      HAVING COUNT(l.id) > 0
      ORDER BY payout DESC
      LIMIT 20
    ` as any[];

    // Conversion funnel
    const totalLeads = await db.lead.count({
      where: { createdAt: { gte: startDate } },
    });

    const forwardedLeads = await db.lead.count({
      where: { 
        createdAt: { gte: startDate },
        status: { in: ['forwarded', 'approved', 'rejected'] },
      },
    });

    const approvedLeads = await db.lead.count({
      where: { 
        createdAt: { gte: startDate },
        status: 'approved',
      },
    });

    const conversionFunnel = [
      {
        stage: 'Total Leads',
        count: totalLeads,
        percentage: 100,
      },
      {
        stage: 'Forwarded',
        count: forwardedLeads,
        percentage: totalLeads > 0 ? Math.round((forwardedLeads / totalLeads) * 100) : 0,
      },
      {
        stage: 'Approved',
        count: approvedLeads,
        percentage: totalLeads > 0 ? Math.round((approvedLeads / totalLeads) * 100) : 0,
      },
    ];

    res.json({
      performance: performance.map(item => ({
        date: item.date.toISOString().split('T')[0],
        leads: Number(item.leads),
        conversions: Number(item.conversions),
        revenue: Number(item.revenue),
      })),
      affiliatePerformance: affiliatePerformance.map(item => ({
        affiliate: item.affiliate,
        leads: Number(item.leads),
        conversions: Number(item.conversions),
        revenue: Number(item.revenue),
        conversionRate: Number(item.conversion_rate),
      })),
      advertiserPerformance: advertiserPerformance.map(item => ({
        advertiser: item.advertiser,
        leads: Number(item.leads),
        conversions: Number(item.conversions),
        payout: Number(item.payout),
      })),
      conversionFunnel,
    });
  } catch (error) {
    next(error);
  }
});

export default router;