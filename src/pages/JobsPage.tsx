import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import type { Job } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Search,
  Plus,
  Laptop,
  ArrowRight,
  Filter,
  Trash2,
  Eye,
} from 'lucide-react';
import { toast } from 'sonner';

const statusOptions = [
  { value: 'ALL', label: 'All Status' },
  { value: 'RECEIVED', label: 'Received' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'CLEANING_COMPLETED', label: 'Cleaning Done' },
  { value: 'READY_FOR_PICKUP', label: 'Ready for Pickup' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  RECEIVED: { label: 'Received', variant: 'secondary' },
  IN_PROGRESS: { label: 'In Progress', variant: 'default' },
  CLEANING_COMPLETED: { label: 'Cleaning Done', variant: 'outline' },
  READY_FOR_PICKUP: { label: 'Ready', variant: 'default' },
  COMPLETED: { label: 'Completed', variant: 'default' },
  CANCELLED: { label: 'Cancelled', variant: 'destructive' },
};

export default function JobsPage() {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  useEffect(() => {
    loadJobs();
  }, [searchQuery, statusFilter]);

  const loadJobs = async () => {
    try {
      const params: any = {};
      if (searchQuery) params.search = searchQuery;
      if (statusFilter !== 'ALL') params.status = statusFilter;
      
      const data = await api.getJobs(params);
      setJobs(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to load jobs:', error);
      toast.error('Failed to load jobs');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteJob = async (jobId: string, jobName: string) => {
    // Confirm before deleting
    if (!confirm(`Are you sure you want to delete job ${jobName}?`)) {
      return;
    }

    try {
      await api.deleteJob(jobId);
      toast.success('Job deleted successfully');
      loadJobs(); // Refresh the list
    } catch (error) {
      console.error('Failed to delete job:', error);
      toast.error('Failed to delete job');
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Jobs</h1>
          <p className="text-muted-foreground">
            Manage service jobs and track progress
          </p>
        </div>
        <Button asChild>
          <Link to="/admin/jobs/new">
            <Plus className="w-4 h-4 mr-2" />
            New Job
          </Link>
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by job ID, client name, device brand..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              {statusOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Jobs List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : jobs.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Laptop className="w-12 h-12 text-muted-foreground mb-3" />
            <p className="text-lg font-medium">No jobs found</p>
            <p className="text-muted-foreground mb-4">
              {searchQuery || statusFilter !== 'ALL'
                ? 'Try adjusting your filters'
                : 'Create your first service job'}
            </p>
            <Button asChild>
              <Link to="/admin/jobs/new">Create Job</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {jobs.map((job) => {
            const status = statusConfig[job.status] || { label: job.status, variant: 'secondary' };
            return (
              <Card key={job.id} className="hover:bg-accent transition-colors">
                <CardContent className="p-5">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    
                    {/* Left: Job Info (clickable to view details) */}
                    <div 
                      className="flex items-center gap-4 flex-1 cursor-pointer"
                      onClick={() => navigate(`/admin/jobs/${job.id}`)}
                    >
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <Laptop className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold">{job.jobId}</p>
                          <Badge variant={status.variant}>{status.label}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-0.5">
                          {job.client?.fullName} • {job.device?.brand} {job.device?.model}
                        </p>
                      </div>
                    </div>

                    {/* Right: Action Buttons */}
                    <div className="flex items-center gap-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => navigate(`/admin/jobs/${job.id}`)}
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        View
                      </Button>
                      <Button 
                        variant="destructive" 
                        size="sm"
                        onClick={() => handleDeleteJob(job.id, job.jobId)}
                      >
                        <Trash2 className="w-4 h-4 mr-1" />
                        Delete
                      </Button>
                    </div>

                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}