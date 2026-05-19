import { Router } from 'express';
import { prisma } from '../utils/prisma';
import { authenticate } from '../middleware/auth';
import type { AuthRequest } from '../middleware/auth';

const router = Router();

// Get audit logs
router.get('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const { jobId, entityType, limit = '50' } = req.query;

    const where: any = {};
    
    if (jobId) {
      where.jobId = jobId as string;
    }
    
    if (entityType) {
      where.entityType = entityType as string;
    }

    const logs = await prisma.auditLog.findMany({
      where,
      include: {
        user: {
          select: {
            name: true,
          },
        },
        job: {
          select: {
            jobId: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit as string),
    });

    res.json(logs);
  } catch (error) {
    console.error('Get audit logs error:', error);
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

// Get audit logs for a specific job
router.get('/job/:jobId', authenticate, async (req: AuthRequest, res) => {
  try {
    const jobId = req.params.jobId as string;

    const logs = await prisma.auditLog.findMany({
      where: { jobId },
      include: {
        user: {
          select: {
            name: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(logs);
  } catch (error) {
    console.error('Get job audit logs error:', error);
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

export default router;
