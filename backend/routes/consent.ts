import { Router } from 'express';
import { prisma } from '../utils/prisma';
import { authenticate } from '../middleware/auth';
import type { AuthRequest } from '../middleware/auth';
import { logAction } from '../utils/audit';

const router = Router();

// Get consent form for a job
router.get('/job/:jobId', authenticate, async (req: AuthRequest, res) => {
  try {
    const jobId = req.params.jobId as string;

    const consentForm = await prisma.consentForm.findUnique({
      where: { jobId },
      include: {
        user: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!consentForm) {
      return res.status(404).json({ error: 'Consent form not found' });
    }

    res.json(consentForm);
  } catch (error) {
    console.error('Get consent form error:', error);
    res.status(500).json({ error: 'Failed to fetch consent form' });
  }
});

// Create or update consent form
router.post('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const {
      jobId,
      voluntaryHandover,
      allowCleaning,
      acknowledgeRisk,
      confirmCondition,
      clientSignature,
      staffWitnessName,
      staffWitnessSignature,
    } = req.body;

    const consentForm = await prisma.consentForm.upsert({
      where: { jobId },
      update: {
        voluntaryHandover,
        allowCleaning,
        acknowledgeRisk,
        confirmCondition,
        clientSignature,
        clientSignedAt: clientSignature ? new Date() : undefined,
        staffWitnessName,
        staffWitnessSignature,
      },
      create: {
        jobId,
        voluntaryHandover,
        allowCleaning,
        acknowledgeRisk,
        confirmCondition,
        clientSignature,
        clientSignedAt: clientSignature ? new Date() : null,
        staffWitnessName,
        staffWitnessSignature,
        createdBy: req.user!.userId,
      },
      include: {
        user: {
          select: {
            name: true,
          },
        },
      },
    });

    await logAction('CONSENT_FORM_SAVED', 'ConsentForm', consentForm.id, req.user?.userId, jobId, {
      voluntaryHandover,
      allowCleaning,
      acknowledgeRisk,
      confirmCondition,
      hasClientSignature: !!clientSignature,
    });

    res.status(201).json(consentForm);
  } catch (error) {
    console.error('Save consent form error:', error);
    res.status(500).json({ error: 'Failed to save consent form' });
  }
});

// Add client signature
router.patch('/:id/sign-client', authenticate, async (req: AuthRequest, res) => {
  try {
    const id = req.params.id as string;
    const { signature } = req.body;

    const consentForm = await prisma.consentForm.update({
      where: { id },
      data: {
        clientSignature: signature,
        clientSignedAt: new Date(),
      },
    });

    await logAction('CONSENT_SIGNED_CLIENT', 'ConsentForm', id, req.user?.userId, consentForm.jobId);

    res.json(consentForm);
  } catch (error) {
    console.error('Client sign error:', error);
    res.status(500).json({ error: 'Failed to add client signature' });
  }
});

export default router;
