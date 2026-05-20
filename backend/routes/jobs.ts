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
//FIXED: POST /api/jobs inside src/routes/jobs.ts
router.post('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const { 
      clientId, 
      brand, 
      model, 
      serialNumber, 
      deviceType, 
      notes, 
      consentForm 
    } = req.body;

    if (!clientId || !brand || !model) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const uniqueJobId = await generateJobId();

    // Execute everything inside a transaction to prevent partial saves
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create the device entry
      const device = await tx.device.create({
        data: {
          brand,
          model,
          serialNumber,
          deviceType: deviceType || 'LAPTOP',
        },
      });

      // 2. Create the job entry linked to client and device
      const job = await tx.job.create({
        data: {
          jobId: uniqueJobId,
          clientId,
          deviceId: device.id,
          status: 'RECEIVED',
          notes,
          createdById: req.user!.userId,
        },
      });

      // 3. Create default checklist items (Adjust titles as necessary for your shop workflows)
      const defaultTasks = [
        'Initial Inspection & Diagnostic Run',
        'External and Internal Dust Cleaning',
        'Thermal Paste Replacement',
        'Component Assembly & Stability Testing'
      ];

      await tx.checklistItem.createMany({
        data: defaultTasks.map((title) => ({
          jobId: job.id,
          title,
        })),
      });

      // 4. NEW: If consent data exists, save it directly to the database!
      if (consentForm) {
        await tx.consentForm.create({
          data: {
            jobId: job.id,
            voluntaryHandover: consentForm.voluntaryHandover ?? true,
            allowCleaning: consentForm.allowCleaning ?? true,
            acknowledgeRisk: consentForm.acknowledgeRisk ?? true,
            confirmCondition: consentForm.confirmCondition ?? true,
            clientSignature: consentForm.clientSignature,
            clientSignedAt: consentForm.clientSignature ? new Date() : null,
            staffWitnessName: consentForm.staffWitnessName || 'Staff Member',
            createdBy: req.user!.userId,
          },
        });
      }

      return job;
    });

    await logAction('JOB_CREATED', 'Job', result.id, req.user?.userId, result.id, {
      jobId: uniqueJobId,
    });

    res.status(201).json(result);
  } catch (error) {
    console.error('Create job and save intake consent form error:', error);
    res.status(500).json({ error: 'Failed to fully register new job file' });
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
