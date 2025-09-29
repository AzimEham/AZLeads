import { Router, Request, Response, NextFunction } from 'express';
import { getDatabase } from '../../db/database';
import { authenticateJWT } from '../middleware/auth';

const router = Router();

/**
 * @swagger
 * /api/exports/leads.csv:
 *   get:
 *     tags: [Exports]
 *     summary: Export leads to CSV
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *       - in: query
 *         name: affiliate_id
 *         schema:
 *           type: string
 *       - in: query
 *         name: advertiser_id
 *         schema:
 *           type: string
 *       - in: query
 *         name: date_from
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: date_to
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: CSV file
 *         content:
 *           text/csv:
 *             schema:
 *               type: string
 */
router.get('/leads.csv', authenticateJWT, async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Apply same filters as leads endpoint
    const search = req.query.search as string;
    const status = req.query.status as string;
    const affiliateId = req.query.affiliate_id as string;
    const advertiserId = req.query.advertiser_id as string;
    const dateFrom = req.query.date_from as string;
    const dateTo = req.query.date_to as string;

    const db = getDatabase();

    // Build where clause (same as leads endpoint)
    const where: any = {};

    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
        { azTxId: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (status) where.status = status;
    if (affiliateId) where.affiliateId = affiliateId;
    if (advertiserId) where.advertiserId = advertiserId;

    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) {
        const endDate = new Date(dateTo);
        endDate.setHours(23, 59, 59, 999);
        where.createdAt.lte = endDate;
      }
    }

    const leads = await db.lead.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        affiliate: { select: { name: true } },
        advertiser: { select: { name: true } },
        offer: { select: { name: true } },
      },
      take: 10000, // Limit to prevent memory issues
    });

    // Generate CSV
    const csvHeaders = [
      'AZ Transaction ID',
      'Affiliate',
      'Advertiser',
      'Offer',
      'Email',
      'Phone',
      'First Name',
      'Last Name',
      'Country',
      'Status',
      'Advertiser Status',
      'Payout',
      'FTD Date',
      'Created Date',
    ];

    const csvRows = leads.map(lead => [
      lead.azTxId,
      lead.affiliate?.name || '',
      lead.advertiser?.name || '',
      lead.offer?.name || '',
      lead.email || '',
      lead.phone || '',
      lead.firstName || '',
      lead.lastName || '',
      lead.country || '',
      lead.status,
      lead.advertiserStatus || '',
      lead.payout?.toString() || '0',
      lead.ftdAt?.toISOString() || '',
      lead.createdAt.toISOString(),
    ]);

    const csvContent = [
      csvHeaders.join(','),
      ...csvRows.map(row => 
        row.map(field => `"${field.toString().replace(/"/g, '""')}"`).join(',')
      ),
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="leads_${new Date().toISOString().split('T')[0]}.csv"`);
    res.send(csvContent);

  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/exports/commissions.csv:
 *   get:
 *     tags: [Exports]
 *     summary: Export commissions to CSV
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: CSV file
 */
router.get('/commissions.csv', authenticateJWT, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const dateFrom = req.query.date_from as string;
    const dateTo = req.query.date_to as string;
    const affiliateId = req.query.affiliate_id as string;
    const advertiserId = req.query.advertiser_id as string;

    const db = getDatabase();

    const where: any = {};

    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) {
        const endDate = new Date(dateTo);
        endDate.setHours(23, 59, 59, 999);
        where.createdAt.lte = endDate;
      }
    }

    if (affiliateId) where.affiliateId = affiliateId;
    if (advertiserId) where.advertiserId = advertiserId;

    const commissions = await db.commission.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        lead: { select: { azTxId: true } },
        affiliate: { select: { name: true } },
        advertiser: { select: { name: true } },
      },
      take: 10000,
    });

    const csvHeaders = [
      'Lead ID',
      'Affiliate',
      'Advertiser',
      'Amount',
      'Description',
      'Date',
    ];

    const csvRows = commissions.map(commission => [
      commission.lead?.azTxId || 'Manual',
      commission.affiliate.name,
      commission.advertiser.name,
      commission.amount.toString(),
      commission.description,
      commission.createdAt.toISOString(),
    ]);

    const csvContent = [
      csvHeaders.join(','),
      ...csvRows.map(row => 
        row.map(field => `"${field.toString().replace(/"/g, '""')}"`).join(',')
      ),
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="commissions_${new Date().toISOString().split('T')[0]}.csv"`);
    res.send(csvContent);

  } catch (error) {
    next(error);
  }
});

export default router;