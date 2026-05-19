import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@/lib/api';
import type { JobStats, Job } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ClipboardList,
  Clock,
  CheckCircle,
  TrendingUp,
  Plus,
  ArrowRight,
  Laptop,
} from 'lucide-react';
import { format } from 'date-fns';

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  RECEIVED: { label: 'Received', variant: 'secondary' },
  IN_PROGRESS: { label: 'In Progress', variant: 'default' },
  CLEANING_COMPLETED: { label: 'Cleaning Done', variant: 'outline' },
  READY_FOR_PICKUP: { label: 'Ready', variant: 'default' },
  COMPLETED: { label: 'Completed', variant: 'default' },
  CANCELLED: { label: 'Cancelled', variant: 'destructive' },
};

export default function DashboardPage() {
  const [stats, setStats] = useState<JobStats | null>(null);
  const [recentJobs, setRecentJobs] = useState<Job[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // TEMP: Check backend connection
  useEffect(() => {
    api.getClients().then(() => {
      console.log('✅ Backend connected');
    }).catch(() => {
      console.log('❌ No backend - running in local mode');
    });
  }, []);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      const [statsData, jobsData] = await Promise.all([
        api.getJobStats().catch(() => null),
        api.getJobs().catch(() => []),
      ]);
      setStats(statsData || null);
      setRecentJobs(Array.isArray(jobsData) ? jobsData.slice(0, 10) : []);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
      setStats(null);
      setRecentJobs([]);
    } finally {
      setIsLoading(false);
    }
  };

  const statCards = [
    {
      title: 'Total Jobs',
      value: stats?.total || 0,
      icon: ClipboardList,
      color: 'text-blue-500',
      bgColor: 'bg-blue-50',
    },
    {
      title: 'Pending',
      value: stats?.pending || 0,
      icon: Clock,
      color: 'text-amber-500',
      bgColor: 'bg-amber-50',
    },
    {
      title: 'Completed',
      value: stats?.completed || 0,
      icon: CheckCircle,
      color: 'text-green-500',
      bgColor: 'bg-green-50',
    },
    {
      title: "Today's Jobs",
      value: stats?.today || 0,
      icon: TrendingUp,
      color: 'text-purple-500',
      bgColor: 'bg-purple-50',
    },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Overview of your laptop cleaning service operations
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild>
            <Link to="/admin/jobs/new">
              <Plus className="w-4 h-4 mr-2" />
              New Job
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.title}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      {stat.title}
                    </p>
                    {isLoading ? (
                      <Skeleton className="h-8 w-16 mt-1" />
                    ) : (
                      <p className="text-3xl font-bold mt-1">{stat.value}</p>
                    )}
                  </div>
                  <div className={`p-3 rounded-lg ${stat.bgColor}`}>
                    <Icon className={`w-5 h-5 ${stat.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Status Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Job Status Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {[
              { label: 'Received', value: stats?.received || 0, color: 'bg-gray-500' },
              { label: 'In Progress', value: stats?.inProgress || 0, color: 'bg-blue-500' },
              { label: 'Cleaning Done', value: stats?.cleaningCompleted || 0, color: 'bg-indigo-500' },
              { label: 'Ready', value: stats?.readyForPickup || 0, color: 'bg-cyan-500' },
              { label: 'Completed', value: stats?.completed || 0, color: 'bg-green-500' },
            ].map((item) => (
              <div key={item.label} className="text-center p-3 rounded-lg bg-muted">
                <div className={`w-3 h-3 rounded-full ${item.color} mx-auto mb-2`} />
                <p className="text-2xl font-bold">{item.value}</p>
                <p className="text-xs text-muted-foreground">{item.label}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recent Jobs */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Recent Jobs</CardTitle>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/admin/jobs">
              View All
              <ArrowRight className="w-4 h-4 ml-1" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : recentJobs.length === 0 ? (
            <div className="text-center py-8">
              <Laptop className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">No jobs yet</p>
              <Button className="mt-4" asChild>
                <Link to="/admin/jobs/new">Create First Job</Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {recentJobs.map((job) => {
                const status = statusConfig[job.status] || { label: job.status, variant: 'secondary' };
                return (
                  <Link
                    key={job.id}
                    to={`/admin/jobs/${job.id}`}
                    className="flex items-center justify-between p-4 rounded-lg border hover:bg-accent transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Laptop className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{job.jobId}</p>
                          <Badge variant={status.variant}>{status.label}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {job.client?.fullName} • {job.device?.brand} {job.device?.model}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(job.createdAt), 'MMM dd, yyyy')}
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
