import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import {
  TrendingUp,
  Users,
  Laptop,
  DollarSign,
  Activity,
  BarChart3,
  PieChart,
  ArrowUpRight,
  CalendarDays,
  Calendar,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart as RePieChart, Pie, Cell, LineChart, Line } from 'recharts';

const COLORS = ['#10b981', '#f59e0b', '#3b82f6', '#ef4444', '#8b5cf6', '#6b7280'];

interface DashboardStats {
  revenue: {
    total: number;
    totalHandovers: number;
    paidCount: number;
    unpaidCount: number;
  };
  clients: {
    total: number;
    newThisMonth: number;
  };
  jobsByStatus: Array<{ status: string; count: number; label: string }>;
  monthlyJobs: Array<{ month: string; count: number }>;
  dailyJobs: Array<{ date: string; count: number }>;
  deviceTypes: Array<{ type: string; count: number }>;
  topClients: Array<{ name: string; jobCount: number }>;
  dailyRevenue: Array<{ date: string; amount: number }>;
  monthlyRevenue: Array<{ month: string; amount: number }>;
}

type TimeView = 'day' | 'month';

export default function StatisticsDashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [revenueView, setRevenueView] = useState<TimeView>('month');
  const [jobsView, setJobsView] = useState<TimeView>('month');
  const [statusView, setStatusView] = useState<TimeView>('month');

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/stats/dashboard', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error('Failed to load statistics:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-80" />
          <Skeleton className="h-80" />
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold">Statistics Dashboard</h1>
        <p className="text-muted-foreground mt-2">Failed to load statistics</p>
      </div>
    );
  }

  const revenueData = revenueView === 'day' 
    ? (stats.dailyRevenue || []).map(d => ({ label: d.date, value: d.amount }))
    : (stats.monthlyRevenue || []).map(d => ({ label: d.month, value: d.amount }));

  const jobsData = jobsView === 'day'
    ? (stats.dailyJobs || []).map(d => ({ label: d.date, value: d.count }))
    : (stats.monthlyJobs || []).map(d => ({ label: d.month, value: d.count }));

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Statistics Dashboard</h1>
        <p className="text-muted-foreground">
          Business overview and performance metrics
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Revenue</p>
                <p className="text-2xl font-bold">RM {stats.revenue.total.toFixed(2)}</p>
              </div>
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-green-600" />
              </div>
            </div>
            <div className="flex items-center gap-1 mt-2 text-sm">
              <span className="text-muted-foreground">{stats.revenue.totalHandovers} completed jobs</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Clients</p>
                <p className="text-2xl font-bold">{stats.clients.total}</p>
              </div>
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                <Users className="w-5 h-5 text-blue-600" />
              </div>
            </div>
            <div className="flex items-center gap-1 mt-2 text-sm">
              <ArrowUpRight className="w-4 h-4 text-green-500" />
              <span className="text-green-600">{stats.clients.newThisMonth} new this month</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Jobs</p>
                <p className="text-2xl font-bold">
                  {stats.jobsByStatus
                    .filter(j => ['RECEIVED', 'IN_PROGRESS', 'CLEANING_COMPLETED', 'READY_FOR_PICKUP'].includes(j.status))
                    .reduce((acc, j) => acc + j.count, 0)}
                </p>
              </div>
              <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
                <Activity className="w-5 h-5 text-amber-600" />
              </div>
            </div>
            <div className="flex items-center gap-1 mt-2 text-sm">
              <span className="text-muted-foreground">In progress & pending</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Completed Jobs</p>
                <p className="text-2xl font-bold">
                  {stats.jobsByStatus.find(j => j.status === 'COMPLETED')?.count || 0}
                </p>
              </div>
              <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                <Laptop className="w-5 h-5 text-purple-600" />
              </div>
            </div>
            <div className="flex items-center gap-1 mt-2 text-sm">
              <span className="text-muted-foreground">
                {stats.revenue.paidCount} paid • {stats.revenue.unpaidCount} unpaid
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Chart */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <DollarSign className="w-5 h-5" />
                Revenue Trend
              </CardTitle>
              <div className="flex gap-1">
                <Button
                  variant={revenueView === 'day' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setRevenueView('day')}
                >
                  <CalendarDays className="w-3 h-3 mr-1" />
                  Day
                </Button>
                <Button
                  variant={revenueView === 'month' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setRevenueView('month')}
                >
                  <Calendar className="w-3 h-3 mr-1" />
                  Month
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={revenueData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" />
                <YAxis />
                <Tooltip formatter={(value: number) => `RM ${value.toFixed(2)}`} />
                <Bar dataKey="value" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Monthly Jobs Trend */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                Jobs Trend
              </CardTitle>
              <div className="flex gap-1">
                <Button
                  variant={jobsView === 'day' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setJobsView('day')}
                >
                  <CalendarDays className="w-3 h-3 mr-1" />
                  Day
                </Button>
                <Button
                  variant={jobsView === 'month' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setJobsView('month')}
                >
                  <Calendar className="w-3 h-3 mr-1" />
                  Month
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={jobsData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Jobs by Status */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <PieChart className="w-5 h-5" />
                Jobs by Status
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <RePieChart>
                <Pie
                  data={stats.jobsByStatus}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ label, count }) => `${label}: ${count}`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="count"
                >
                  {stats.jobsByStatus.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </RePieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Device Type Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Laptop className="w-5 h-5" />
              Device Type Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={stats.deviceTypes} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="type" type="category" width={100} />
                <Tooltip />
                <Bar dataKey="count" fill="#10b981" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 3 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Clients */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Top Clients by Job Count
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {stats.topClients.map((client, index) => (
                <div key={client.name} className="flex items-center gap-4">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium">
                    {index + 1}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">{client.name}</p>
                    <div className="w-full bg-muted rounded-full h-2 mt-1">
                      <div
                        className="bg-primary h-2 rounded-full"
                        style={{
                          width: `${(client.jobCount / Math.max(...stats.topClients.map(c => c.jobCount))) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                  <span className="text-sm font-medium">{client.jobCount} jobs</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}