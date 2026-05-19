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


// TEMPORARY: Force reset admin password (remove after using once)
app.get('/api/reset-password', async (_req, res) => {
  try {
    const bcrypt = await import('bcryptjs');
    const hashed = await bcrypt.default.hash('123456', 10);
    
    const user = await prisma.user.upsert({
      where: { email: 'zihan@gmail.com' },
      update: { 
        password: hashed,      // <-- FORCE overwrite
        name: 'zihan',
        role: 'ADMIN'
      },
      create: {
        email: 'zihan@gmail.com',
        password: hashed,
        name: 'zihan',
        role: 'ADMIN',
      },
    });
    
    res.json({ 
      success: true, 
      message: 'Password reset to 123456',
      user: { id: user.id, email: user.email, name: user.name }
    });
  } catch (err: any) {
    console.error('Reset error:', err);
    res.status(500).json({ error: err.message });
  }
});


// Serve static files from the React app
//app.use(express.static(path.join(__dirname, '../../dist')));

// Handle React routing, return all requests to React app
/*app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, '../../dist/index.html'));
});*/

// Error handling
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`NexGen Care server running on port ${PORT}`);
});

export default app;
