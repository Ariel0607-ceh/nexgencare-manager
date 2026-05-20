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
router.patch('/:id/complete', authenticate, async (req: AuthRequest, res) => {
  try {
    const id = req.params.id as string;
    const { completedAt } = req.body; 

    // 1.  STRICT VALIDATION: Check if completion date is missing
    if (!completedAt) {
      return res.status(400).json({ 
        error: 'Completion Date is required. You must pick a date and time before finalizing the handover.' 
      });
    }

    // 2. Validate that it's a legitimate date format
    const targetCompletionDate = new Date(completedAt);
    if (isNaN(targetCompletionDate.getTime())) {
      return res.status(400).json({ 
        error: 'The completion date provided is invalid. Please select a valid date.' 
      });
    }

    // 3. Find the handover record
    const handoverRecord = await prisma.handoverRecord.findUnique({
      where: { id },
    });

    if (!handoverRecord) {
      return res.status(404).json({ error: 'Handover record not found' });
    }

    if (!handoverRecord.clientSignature) {
      return res.status(400).json({ error: 'Client signature is required' });
    }

    // 4. Safe Database Updates (Only runs if the date validation above passes)
    await prisma.handoverRecord.update({
      where: { id },
      data: {
        clientSignedAt: targetCompletionDate,
      },
    });

    const job = await prisma.job.update({
      where: { id: handoverRecord.jobId },
      data: {
        status: 'COMPLETED',
        completedAt: targetCompletionDate, 
      },
    });

    await logAction('HANDOVER_COMPLETED', 'HandoverRecord', id, req.user?.userId, handoverRecord.jobId, {
      completedAt: targetCompletionDate.toISOString()
    });

    res.json({ message: 'Handover completed successfully', job });
  } catch (error) {
    console.error('Complete handover timestamp assignment error:', error);
    res.status(500).json({ error: 'Failed to process finalized completion logs' });
  }
});

export default router;
