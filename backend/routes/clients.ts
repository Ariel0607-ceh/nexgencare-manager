import { Router } from 'express';
import { prisma } from '../utils/prisma';
import { authenticate } from '../middleware/auth';
import type { AuthRequest } from '../middleware/auth';
import { logAction } from '../utils/audit';

const router = Router();

// Get all clients
router.get('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const { search } = req.query;
    
    const where = search ? {
      OR: [
        { fullName: { contains: search as string, mode: 'insensitive' as const } },
        { phone: { contains: search as string } },
        { email: { contains: search as string, mode: 'insensitive' as const } },
      ],
    } : {};

    const clients = await prisma.client.findMany({
      where,
      include: {
        _count: {
          select: { jobs: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(clients);
  } catch (error) {
    console.error('Get clients error:', error);
    res.status(500).json({ error: 'Failed to fetch clients' });
  }
});

// Get client by ID
router.get('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const id = req.params.id as string;

    const client = await prisma.client.findUnique({
      where: { id },
      include: {
        jobs: {
          include: {
            device: true,
            _count: {
              select: { checklist: true, mediaFiles: true },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    res.json(client);
  } catch (error) {
    console.error('Get client error:', error);
    res.status(500).json({ error: 'Failed to fetch client' });
  }
});

// Create client
router.post('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const { fullName, phone, email, address } = req.body;

    const client = await prisma.client.create({
      data: {
        fullName,
        phone,
        email,
        address,
      },
    });

    await logAction('CLIENT_CREATED', 'Client', client.id, req.user?.userId, undefined, {
      fullName,
      phone,
    });

    res.status(201).json(client);
  } catch (error) {
    console.error('Create client error:', error);
    res.status(500).json({ error: 'Failed to create client' });
  }
});

// Update client
router.put('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const id = req.params.id as string;
    const { fullName, phone, email, address } = req.body;

    const client = await prisma.client.update({
      where: { id },
      data: {
        fullName,
        phone,
        email,
        address,
      },
    });

    await logAction('CLIENT_UPDATED', 'Client', client.id, req.user?.userId, undefined, {
      fullName,
      phone,
    });

    res.json(client);
  } catch (error) {
    console.error('Update client error:', error);
    res.status(500).json({ error: 'Failed to update client' });
  }
});

// Delete client
router.delete('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const id = req.params.id as string;

    await prisma.client.delete({
      where: { id },
    });

    await logAction('CLIENT_DELETED', 'Client', id, req.user?.userId);

    res.json({ message: 'Client deleted successfully' });
  } catch (error) {
    console.error('Delete client error:', error);
    res.status(500).json({ error: 'Failed to delete client' });
  }
});

export default router;
