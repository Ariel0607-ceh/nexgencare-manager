import express from 'express';
import cors from 'cors';

// Import routes
import authRoutes from './routes/auth';
import clientRoutes from './routes/clients';
import jobRoutes from './routes/jobs';
import checklistRoutes from './routes/checklist';
import mediaRoutes from './routes/media';
import consentRoutes from './routes/consent';
import handoverRoutes from './routes/handover';
import auditRoutes from './routes/audit';
import { prisma } from './utils/prisma';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/checklist', checklistRoutes);
app.use('/api/media', mediaRoutes);
app.use('/api/consent', consentRoutes);
app.use('/api/handover', handoverRoutes);
app.use('/api/audit', auditRoutes);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});


// ==================== PUBLIC API (No Auth Required) ====================
app.get('/api/public/jobs/search', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || (q as string).trim().length < 2) {
      return res.status(400).json({ error: 'Please enter at least 2 characters' });
    }

    const queryStr = (q as string).trim();

    // Use Prisma's native methods instead of raw SQL
    const jobs = await prisma.job.findMany({
      where: {
        OR: [
          { jobId: { contains: queryStr, mode: 'insensitive' } },
          { client: { fullName: { contains: queryStr, mode: 'insensitive' } } },
          { client: { phone: { contains: queryStr, mode: 'insensitive' } } },
        ],
      },
      include: {
        client: true,
        device: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 20,
    });

    res.json(jobs.map(job => ({
      id: job.id,
      jobId: job.jobId,
      status: job.status,
      client: { 
        fullName: job.client?.fullName || 'Unknown Client', 
        phone: job.client?.phone || 'N/A' 
      },
      device: { 
        brand: job.device?.brand || '', 
        model: job.device?.model || '' 
      }
    })));
  } catch (err) {
    console.error('Public search error:', err);
    res.status(500).json({ error: 'Search failed' });
  }
});

// ==================== GET PUBLIC JOB BY ID ====================
app.get('/api/public/jobs/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Try finding by raw database id first, fallback to the human-readable jobId if needed
    const job = await prisma.job.findFirst({
      where: {
        OR: [
          { id: id },
          { jobId: id }
        ]
      },
      include: {
        client: {
          select: {
            fullName: true,
            phone: true,
          }
        },
        device: {
          select: {
            brand: true,
            model: true,
          }
        },
        checklist: {
          orderBy: {
            createdAt: 'asc' // Keeps your checklist steps in chronological order
          }
        }
      }
    });

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    // Standardize structure for your frontend component
    res.json({
      id: job.id,
      jobId: job.jobId,
      status: job.status,
      notes: job.notes,
      receivedAt: job.receivedAt,
      completedAt: job.completedAt,
      client: {
        fullName: job.client?.fullName || 'Unknown Client',
        phone: job.client?.phone || 'N/A'
      },
      device: {
        brand: job.device?.brand || '',
        model: job.device?.model || ''
      },
      // Maps your checklist items directly so the frontend can display progress checkboxes safely
      checklist: job.checklist.map(item => ({
        id: item.id,
        title: item.title,
        completed: item.completed,
        notes: item.notes,
        completedAt: item.completedAt
      }))
    });
  } catch (err) {
    console.error('Fetch public job error:', err);
    res.status(500).json({ error: 'Failed to retrieve job progress' });
  }
});

// Error handling
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`NexGen Care server running on port ${PORT}`);
});

export default app;
