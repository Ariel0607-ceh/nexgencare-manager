import { Router } from 'express';
import { prisma } from '../utils/prisma';
import { authenticate } from '../middleware/auth';
import type { AuthRequest } from '../middleware/auth';
import { logAction } from '../utils/audit';

const router = Router();

// Generate unique job ID
async function generateJobId(): Promise<string> {
  const year = new Date().getFullYear();
  const count = await prisma.job.count({
    where: {
      createdAt: {
        gte: new Date(year, 0, 1),
        lt: new Date(year + 1, 0, 1),
      },
    },
  });
  return `LC-${year}-${String(count + 1).padStart(4, '0')}`;
}

// Get all jobs
router.get('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const { status, search, clientId } = req.query;

    const where: any = {};

    if (status) {
      where.status = status;
    }

    if (clientId) {
      where.clientId = clientId;
    }

    if (search) {
      where.OR = [
        { jobId: { contains: search as string, mode: 'insensitive' } },
        { client: { fullName: { contains: search as string, mode: 'insensitive' } } },
        { device: { brand: { contains: search as string, mode: 'insensitive' } } },
        { device: { model: { contains: search as string, mode: 'insensitive' } } },
      ];
    }

    const jobs = await prisma.job.findMany({
      where,
      include: {
        client: {
          select: {
            id: true,
            fullName: true,
            phone: true,
          },
        },
        device: true,
        assignedTo: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: {
            checklist: true,
            mediaFiles: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(jobs);
  } catch (error) {
    console.error('Get jobs error:', error);
    res.status(500).json({ error: 'Failed to fetch jobs' });
  }
});

// Get job statistics
router.get('/stats/overview', authenticate, async (_req: AuthRequest, res) => {
  try {
    const [
      totalJobs,
      receivedJobs,
      inProgressJobs,
      cleaningCompletedJobs,
      readyForPickupJobs,
      completedJobs,
      todayJobs,
    ] = await Promise.all([
      prisma.job.count(),
      prisma.job.count({ where: { status: 'RECEIVED' } }),
      prisma.job.count({ where: { status: 'IN_PROGRESS' } }),
      prisma.job.count({ where: { status: 'CLEANING_COMPLETED' } }),
      prisma.job.count({ where: { status: 'READY_FOR_PICKUP' } }),
      prisma.job.count({ where: { status: 'COMPLETED' } }),
      prisma.job.count({
        where: {
          createdAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
          },
        },
      }),
    ]);

    res.json({
      total: totalJobs,
      received: receivedJobs,
      inProgress: inProgressJobs,
      cleaningCompleted: cleaningCompletedJobs,
      readyForPickup: readyForPickupJobs,
      completed: completedJobs,
      today: todayJobs,
      pending: receivedJobs + inProgressJobs + cleaningCompletedJobs + readyForPickupJobs,
    });
  } catch (error) {
    console.error('Get job stats error:', error);
    res.status(500).json({ error: 'Failed to fetch job statistics' });
  }
});

// Get job by ID
router.get('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const id = req.params.id as string;

    const job = await prisma.job.findUnique({
      where: { id },
      include: {
        client: true,
        device: true,
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            name: true,
          },
        },
        checklist: {
          orderBy: { createdAt: 'asc' },
        },
        mediaFiles: {
          orderBy: { createdAt: 'desc' },
        },
        consentForm: true,
        handoverRecord: true,
        auditLogs: {
          include: {
            user: {
              select: {
                name: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
      },
    });

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    res.json(job);
  } catch (error) {
    console.error('Get job error:', error);
    res.status(500).json({ error: 'Failed to fetch job' });
  }
});

// Create job (Device Intake)
router.post('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const {
      clientId,
      brand,
      model,
      serialNumber,
      deviceType,
      scratches,
      damageNotes,
      reportedIssues,
      notes,
    } = req.body;

    const jobId = await generateJobId();

    // Create device first
    const device = await prisma.device.create({
      data: {
        brand,
        model,
        serialNumber,
        deviceType: deviceType || 'LAPTOP',
      },
    });

    // Create job with device
    const job = await prisma.job.create({
      data: {
        jobId,
        clientId,
        deviceId: device.id,
        createdById: req.user!.userId,
        scratches,
        damageNotes,
        reportedIssues,
        notes,
        status: 'RECEIVED',
      },
      include: {
        client: true,
        device: true,
      },
    });

    // Create default checklist items for laptop cleaning
    const checklistItems = [
      { title: 'Remove internal fan (4-6 screws)', description: 'Carefully remove the internal cooling fan' },
      { title: 'Remove heatsink (8-12 screws)', description: 'Detach the heatsink assembly from the motherboard' },
      { title: 'Clean old CPU thermal paste', description: 'Remove all old thermal paste from CPU' },
      { title: 'Clean old GPU thermal paste', description: 'Remove all old thermal paste from GPU' },
      { title: 'Repaste CPU with new thermal paste', description: 'Apply new thermal paste to CPU' },
      { title: 'Repaste GPU with new thermal paste', description: 'Apply new thermal paste to GPU' },
      { title: 'Reattach heatsink (8-12 screws)', description: 'Secure heatsink back in place' },
      { title: 'Reattach internal fan (4-6 screws)', description: 'Secure cooling fan back in place' },
      { title: 'Check battery connection', description: 'Verify battery is properly connected' },
      { title: 'Check all cables near fan', description: 'Ensure all cables are properly seated' },
    ];

    await prisma.checklistItem.createMany({
      data: checklistItems.map((item) => ({
        ...item,
        jobId: job.id,
      })),
    });

    await logAction('JOB_CREATED', 'Job', job.id, req.user?.userId, job.id, {
      jobId: job.jobId,
      clientId,
      deviceBrand: brand,
      deviceModel: model,
    });

    res.status(201).json(job);
  } catch (error) {
    console.error('Create job error:', error);
    res.status(500).json({ error: 'Failed to create job' });
  }
});

// Update job status
router.patch('/:id/status', authenticate, async (req: AuthRequest, res) => {
  try {
    const id = req.params.id as string;
    const { status } = req.body;

    const validTransitions: Record<string, string[]> = {
      RECEIVED: ['IN_PROGRESS', 'CANCELLED'],
      IN_PROGRESS: ['CLEANING_COMPLETED', 'CANCELLED'],
      CLEANING_COMPLETED: ['READY_FOR_PICKUP'],
      READY_FOR_PICKUP: ['COMPLETED'],
      COMPLETED: [],
      CANCELLED: [],
    };

    const currentJob = await prisma.job.findUnique({
      where: { id },
    });

    if (!currentJob) {
      return res.status(404).json({ error: 'Job not found' });
    }

    const allowedTransitions = validTransitions[currentJob.status] || [];
    if (!allowedTransitions.includes(status)) {
      return res.status(400).json({
        error: `Invalid status transition from ${currentJob.status} to ${status}`,
      });
    }

    // If completing job, verify checklist is complete
    if (status === 'COMPLETED') {
      const incompleteItems = await prisma.checklistItem.count({
        where: {
          jobId: id,
          completed: false,
        },
      });

      if (incompleteItems > 0) {
        return res.status(400).json({
          error: 'Cannot complete job. All checklist items must be completed first.',
          incompleteItems,
        });
      }
    }

    const updateData: any = { status };
    if (status === 'COMPLETED') {
      updateData.completedAt = new Date();
    }

    const job = await prisma.job.update({
      where: { id },
      data: updateData,
      include: {
        client: true,
        device: true,
      },
    });

    await logAction('JOB_STATUS_UPDATED', 'Job', job.id, req.user?.userId, job.id, {
      oldStatus: currentJob.status,
      newStatus: status,
    });

    res.json(job);
  } catch (error) {
    console.error('Update job status error:', error);
    res.status(500).json({ error: 'Failed to update job status' });
  }
});

// Assign job to user
router.patch('/:id/assign', authenticate, async (req: AuthRequest, res) => {
  try {
    const id = req.params.id as string;
    const { assignedToId } = req.body;

    const job = await prisma.job.update({
      where: { id },
      data: { assignedToId },
      include: {
        client: true,
        device: true,
        assignedTo: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    await logAction('JOB_ASSIGNED', 'Job', job.id, req.user?.userId, job.id, {
      assignedToId,
    });

    res.json(job);
  } catch (error) {
    console.error('Assign job error:', error);
    res.status(500).json({ error: 'Failed to assign job' });
  }
});

// Update job notes
router.patch('/:id/notes', authenticate, async (req: AuthRequest, res) => {
  try {
    const id = req.params.id as string;
    const { notes } = req.body;

    const job = await prisma.job.update({
      where: { id },
      data: { notes },
    });

    await logAction('JOB_NOTES_UPDATED', 'Job', job.id, req.user?.userId, job.id);

    res.json(job);
  } catch (error) {
    console.error('Update job notes error:', error);
    res.status(500).json({ error: 'Failed to update job notes' });
  }
});

// Delete job
router.delete('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const id = req.params.id as string;

    // Get job to find device ID
    const job = await prisma.job.findUnique({
      where: { id },
    });

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    // Delete job (cascade will handle related records)
    await prisma.job.delete({
      where: { id },
    });

    // Delete associated device
    await prisma.device.delete({
      where: { id: job.deviceId },
    });

    await logAction('JOB_DELETED', 'Job', id, req.user?.userId);

    res.json({ message: 'Job deleted successfully' });
  } catch (error) {
    console.error('Delete job error:', error);
    res.status(500).json({ error: 'Failed to delete job' });
  }
});

export default router;
