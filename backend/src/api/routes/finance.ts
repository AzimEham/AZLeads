import { Router, Request, Response, NextFunction } from 'express';
import { getDatabase } from '../../db/database';
import { authenticateJWT } from '../middleware/auth';

const router = Router();

/**
 * @swagger
 * /api/finance/summary:
 *   get:
 *     tags: [Finance]
 *     summary: Get financial summary
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Financial summary
 */
router.get('/summary', authenticateJWT, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = getDatabase();

    // Total commissions
    const totalCommissionsResult = await db.commission.aggregate({
      _sum: { amount: true },
    });

    // This month commissions
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const thisMonthResult = await db.commission.aggregate({
      where: {
        createdAt: { gte: startOfMonth },
      },
      _sum: { amount: true },
    });

    // Pending payouts (approved leads without commissions)
    const pendingPayoutsResult = await db.lead.aggregate({
      where: {
        status: 'approved',
        payout: { not: null },
        commissions: { none: {} },
      },
      _sum: { payout: true },
    });

    res.json({
      totalCommissions: Number(totalCommissionsResult._sum.amount || 0),
      pendingPayouts: Number(pendingPayoutsResult._sum.payout || 0),
      thisMonth: Number(thisMonthResult._sum.amount || 0),
    });
  } catch (error) {
    next(error);
  }
});

export default router;