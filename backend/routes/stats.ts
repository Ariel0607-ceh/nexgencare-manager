import { Router } from 'express';
import { prisma } from '../utils/prisma';
import { authenticate } from '../middleware/auth';
import type { AuthRequest } from '../middleware/auth';

const router = Router();

router.get('/dashboard', authenticate, async (req: AuthRequest, res) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfPast30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // 1. CLIENT STATS
    const totalClients = await prisma.client.count();
    const newClientsThisMonth = await prisma.client.count({
      where: { createdAt: { gte: startOfMonth } },
    });

    // 2. REVENUE & HANDOVER STATS
    const handovers = await prisma.handoverRecord.findMany({
      select: {
        paymentStatus: true,
        paymentAmount: true,
      },
    });

    let totalRevenue = 0;
    let paidCount = 0;
    let unpaidCount = 0;

    handovers.forEach((h) => {
      if (h.paymentAmount) totalRevenue += h.paymentAmount;
      if (h.paymentStatus === 'PAID') paidCount++;
      else if (h.paymentStatus === 'UNPAID') unpaidCount++;
    });

    // 3. JOBS BY STATUS MATRIX
    const jobsGroupByStatus = await prisma.job.groupBy({
      by: ['status'],
      _count: { id: true },
    });

    const statusLabels: Record<string, string> = {
      RECEIVED: 'Received',
      IN_PROGRESS: 'In Progress',
      CLEANING_COMPLETED: 'Cleaning Completed',
      READY_FOR_PICKUP: 'Ready For Pickup',
      COMPLETED: 'Completed',
      CANCELLED: 'Cancelled',
    };

    const jobsByStatus = jobsGroupByStatus.map((g) => ({
      status: g.status,
      count: g._count.id,
      label: statusLabels[g.status] || g.status,
    }));

    // 4. DEVICE TYPES CHART DATA
    const jobsWithDevices = await prisma.job.findMany({
      include: { device: true },
    });

    const deviceCounts: Record<string, number> = {};
    jobsWithDevices.forEach((j) => {
      if (j.device) {
        const type = j.device.deviceType; // LAPTOP or DESKTOP
        deviceCounts[type] = (deviceCounts[type] || 0) + 1;
      }
    });

    const deviceTypes = Object.entries(deviceCounts).map(([type, count]) => ({
      type: type === 'LAPTOP' ? 'Laptop' : 'Desktop',
      count,
    }));

    // 5. TOP CLIENTS (Sorted by highest job processing metrics)
    const topClientsRaw = await prisma.client.findMany({
      include: {
        _count: { select: { jobs: true } },
      },
      orderBy: {
        jobs: { _count: 'desc' },
      },
      take: 5,
    });

    const topClients = topClientsRaw.map((c) => ({
      name: c.fullName,
      jobCount: c._count.jobs,
    }));

    // 6. TIME TRENDS (Daily & Monthly Charts)
    // Fetch recent handovers with complete dates for historical graphs
    const recentHandovers = await prisma.handoverRecord.findMany({
      where: { createdAt: { gte: startOfPast30Days } },
      select: { createdAt: true, paymentAmount: true },
      orderBy: { createdAt: 'asc' },
    });

    // Generate clean group strings for Daily Trend Charts
    const dailyRevMap: Record<string, number> = {};
    const dailyJobMap: Record<string, number> = {};

    recentHandovers.forEach((h) => {
      const dateStr = new Date(h.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      dailyRevMap[dateStr] = (dailyRevMap[dateStr] || 0) + (h.paymentAmount || 0);
      dailyJobMap[dateStr] = (dailyJobMap[dateStr] || 0) + 1;
    });

    const dailyJobs = Object.entries(dailyJobMap).map(([date, count]) => ({ date, count }));
    const dailyRevenue = Object.entries(dailyRevMap).map(([date, amount]) => ({ date, amount }));

    // Monthly Aggregations (Fallback mocks if history isn't deep enough yet)
    const currentMonthLabel = now.toLocaleDateString('en-US', { month: 'short' });
    const monthlyJobs = [{ month: currentMonthLabel, count: jobsWithDevices.length }];
    const monthlyRevenue = [{ month: currentMonthLabel, amount: totalRevenue }];

    // 7. RESPOND WITH DYNAMIC STRUCT MATCHING THE DASHBOARD INTERFACE
    res.json({
      revenue: {
        total: totalRevenue,
        totalHandovers: handovers.length,
        paidCount,
        unpaidCount,
      },
      clients: {
        total: totalClients,
        newThisMonth: newClientsThisMonth,
      },
      jobsByStatus,
      monthlyJobs,
      dailyJobs,
      deviceTypes,
      topClients,
      dailyRevenue,
      monthlyRevenue,
    });
  } catch (error) {
    console.error('Fetch precise dashboard metrics matrix error:', error);
    res.status(500).json({ error: 'Failed to compile comprehensive engine statistics' });
  }
});

export default router;