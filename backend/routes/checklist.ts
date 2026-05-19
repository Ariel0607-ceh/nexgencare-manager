import { Router } from 'express';
import { prisma } from '../utils/prisma';
import { authenticate } from '../middleware/auth';
import type { AuthRequest } from '../middleware/auth';
import { logAction } from '../utils/audit';

const router = Router();

// Get checklist items for a job
router.get('/job/:jobId', authenticate, async (req: AuthRequest, res) => {
  try {
    const jobId = req.params.jobId as string;

    const items = await prisma.checklistItem.findMany({
      where: { jobId },
      include: {
        user: {
          select: {
            name: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    res.json(items);
  } catch (error) {
    console.error('Get checklist error:', error);
    res.status(500).json({ error: 'Failed to fetch checklist' });
  }
});

// Update checklist item
router.patch('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const id = req.params.id as string;
    const { completed, notes } = req.body;

    const item = await prisma.checklistItem.update({
      where: { id },
      data: {
        completed,
        notes,
        completedAt: completed ? new Date() : null,
        completedBy: completed ? req.user!.userId : null,
      },
      include: {
        user: {
          select: {
            name: true,
          },
        },
      },
    });

    await logAction('CHECKLIST_UPDATED', 'ChecklistItem', item.id, req.user?.userId, item.jobId, {
      itemTitle: item.title,
      completed,
      notes,
    });

    res.json(item);
  } catch (error) {
    console.error('Update checklist error:', error);
    res.status(500).json({ error: 'Failed to update checklist item' });
  }
});

// Toggle checklist item
router.patch('/:id/toggle', authenticate, async (req: AuthRequest, res) => {
  try {
    const id = req.params.id as string;

    const existingItem = await prisma.checklistItem.findUnique({
      where: { id },
    });

    if (!existingItem) {
      return res.status(404).json({ error: 'Checklist item not found' });
    }

    const item = await prisma.checklistItem.update({
      where: { id },
      data: {
        completed: !existingItem.completed,
        completedAt: !existingItem.completed ? new Date() : null,
        completedBy: !existingItem.completed ? req.user!.userId : null,
      },
      include: {
        user: {
          select: {
            name: true,
          },
        },
      },
    });

    await logAction('CHECKLIST_TOGGLED', 'ChecklistItem', item.id, req.user?.userId, item.jobId, {
      itemTitle: item.title,
      completed: item.completed,
    });

    res.json(item);
  } catch (error) {
    console.error('Toggle checklist error:', error);
    res.status(500).json({ error: 'Failed to toggle checklist item' });
  }
});

// Add custom checklist item
router.post('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const { jobId, title, description } = req.body;

    const item = await prisma.checklistItem.create({
      data: {
        jobId,
        title,
        description,
      },
    });

    await logAction('CHECKLIST_ITEM_ADDED', 'ChecklistItem', item.id, req.user?.userId, jobId, {
      title,
      description,
    });

    res.status(201).json(item);
  } catch (error) {
    console.error('Add checklist item error:', error);
    res.status(500).json({ error: 'Failed to add checklist item' });
  }
});

// Delete checklist item
router.delete('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const id = req.params.id as string;

    const item = await prisma.checklistItem.delete({
      where: { id },
    });

    await logAction('CHECKLIST_ITEM_DELETED', 'ChecklistItem', id, req.user?.userId, item.jobId);

    res.json({ message: 'Checklist item deleted' });
  } catch (error) {
    console.error('Delete checklist item error:', error);
    res.status(500).json({ error: 'Failed to delete checklist item' });
  }
});

export default router;
