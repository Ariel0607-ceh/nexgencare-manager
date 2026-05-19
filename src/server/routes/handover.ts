import { Router } from 'express';
import { prisma } from '../utils/prisma';
import { authenticate } from '../middleware/auth';
import type { AuthRequest } from '../middleware/auth';
import { logAction } from '../utils/audit';

const router = Router();

// Get handover record for a job
router.get('/job/:jobId', authenticate, async (req: AuthRequest, res) => {
  try {
    const jobId = req.params.jobId as string;

    const handoverRecord = await prisma.handoverRecord.findUnique({
      where: { jobId },
    });

    if (!handoverRecord) {
      return res.status(404).json({ error: 'Handover record not found' });
    }

    res.json(handoverRecord);
  } catch (error) {
    console.error('Get handover error:', error);
    res.status(500).json({ error: 'Failed to fetch handover record' });
  }
});

// Create or update handover record
router.post('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const {
      jobId,
      finalCondition,
      clientSignature,
      staffSignature,
      paymentStatus,
      paymentAmount,
      paymentNotes,
      finalPhotos,
    } = req.body;

    const handoverRecord = await prisma.handoverRecord.upsert({
      where: { jobId },
      update: {
        finalCondition,
        clientSignature,
        clientSignedAt: clientSignature ? new Date() : undefined,
        staffSignature,
        staffSignedAt: staffSignature ? new Date() : undefined,
        paymentStatus,
        paymentAmount,
        paymentNotes,
        finalPhotos,
      },
      create: {
        jobId,
        finalCondition,
        clientSignature,
        clientSignedAt: clientSignature ? new Date() : null,
        staffSignature,
        staffSignedAt: staffSignature ? new Date() : null,
        paymentStatus: paymentStatus || 'UNPAID',
        paymentAmount,
        paymentNotes,
        finalPhotos,
      },
    });

    await logAction('HANDOVER_RECORD_SAVED', 'HandoverRecord', handoverRecord.id, req.user?.userId, jobId, {
      paymentStatus,
      hasClientSignature: !!clientSignature,
      hasStaffSignature: !!staffSignature,
    });

    res.status(201).json(handoverRecord);
  } catch (error) {
    console.error('Save handover error:', error);
    res.status(500).json({ error: 'Failed to save handover record' });
  }
});

// Complete handover (mark job as completed)
router.post('/:id/complete', authenticate, async (req: AuthRequest, res) => {
  try {
    const id = req.params.id as string;

    const handoverRecord = await prisma.handoverRecord.findUnique({
      where: { id },
    });

    if (!handoverRecord) {
      return res.status(404).json({ error: 'Handover record not found' });
    }

    if (!handoverRecord.clientSignature) {
      return res.status(400).json({ error: 'Client signature is required' });
    }

    // Update handover record
    await prisma.handoverRecord.update({
      where: { id },
      data: {
        clientSignedAt: new Date(),
      },
    });

    // Update job status to completed
    const job = await prisma.job.update({
      where: { id: handoverRecord.jobId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
      },
    });

    await logAction('HANDOVER_COMPLETED', 'HandoverRecord', id, req.user?.userId, handoverRecord.jobId);

    res.json({ message: 'Handover completed successfully', job });
  } catch (error) {
    console.error('Complete handover error:', error);
    res.status(500).json({ error: 'Failed to complete handover' });
  }
});

export default router;
