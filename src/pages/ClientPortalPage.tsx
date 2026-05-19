import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { Job } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Search,
  Laptop,
  ArrowRight,
  QrCode,
  Shield,
  User,
  Phone,
} from 'lucide-react';
import { toast } from 'sonner';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://nexgencare-manager.onrender.com';

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  RECEIVED: { label: 'Received', variant: 'secondary' },
  IN_PROGRESS: { label: 'In Progress', variant: 'default' },
  CLEANING_COMPLETED: { label: 'Cleaning Done', variant: 'outline' },
  READY_FOR_PICKUP: { label: 'Ready', variant: 'default' },
  COMPLETED: { label: 'Completed', variant: 'default' },
  CANCELLED: { label: 'Cancelled', variant: 'destructive' },
};

export default function ClientPortalPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [jobs, setJobs] = useState<Job[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      toast.error('Please enter your name, phone number, or job ID');
      return;
    }

    setIsLoading(true);
    setHasSearched(true);
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/public/jobs/search?q=${encodeURIComponent(searchQuery.trim())}`
      );
      
      if (!response.ok) {
        throw new Error('Search failed');
      }
      
      const data = await response.json();
      setJobs(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Search error:', error);
      toast.error('Search failed. Please try again.');
      setJobs([]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted">
      {/* Header */}
      <header className="bg-card border-b">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img 
                src="/logo.png" 
                alt="NexGen Care" 
                className="h-20 w-auto object-contain"
              />
            </div>
            <Link 
              to="/login"
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-accent"
            >
              <Shield className="w-4 h-4" />
              Admin Login
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Search Section */}
        <Card className="mb-8">
          <CardHeader className="text-center">
            <CardTitle>Track Your Device</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Enter your name, phone number, or job ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                />
              </div>
              <Button onClick={handleSearch} disabled={isLoading}>
                {isLoading ? 'Searching...' : 'Search'}
              </Button>
            </div>
            <p className="text-sm text-muted-foreground mt-3 text-center">
              Search by your name, phone number, or the job ID provided during intake
            </p>
          </CardContent>
        </Card>

        {/* Results */}
        {hasSearched && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">
              {jobs.length > 0 ? `Found ${jobs.length} result(s)` : 'Search Results'}
            </h2>
            
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-28" />
                ))}
              </div>
            ) : jobs.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <QrCode className="w-12 h-12 text-muted-foreground mb-3" />
                  <p className="text-lg font-medium">No jobs found</p>
                  <p className="text-muted-foreground">
                    Please check your name, phone number, or job ID and try again
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {jobs.map((job) => {
                  const status = statusConfig[job.status] || { label: job.status, variant: 'secondary' };
                  return (
                    <Link key={job.id} to={`/job/${job.id}`}>
                      <Card className="hover:bg-accent transition-colors cursor-pointer">
                        <CardContent className="p-5">
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                            
                            {/* LEFT: Client Info (Prominent) */}
                            <div className="flex items-center gap-4 flex-1">
                              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                <User className="w-6 h-6 text-primary" />
                              </div>
                              <div className="space-y-1">
                                {/* CLIENT NAME - First & Prominent */}
                                <p className="font-bold text-lg">
                                  {job.client?.fullName || 'Unknown Client'}
                                </p>
                                {/* PHONE */}
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                  <Phone className="w-3.5 h-3.5" />
                                  <span>{job.client?.phone || 'No phone'}</span>
                                </div>
                                {/* JOB ID & DEVICE */}
                                <div className="flex items-center gap-2 text-sm">
                                  <span className="font-medium text-primary">{job.jobId}</span>
                                  <span className="text-muted-foreground">•</span>
                                  <span className="text-muted-foreground">
                                    {job.device?.brand} {job.device?.model}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* RIGHT: Status & Arrow */}
                            <div className="flex items-center gap-3">
                              <Badge variant={status.variant} className="text-sm">
                                {status.label}
                              </Badge>
                              <ArrowRight className="w-5 h-5 text-muted-foreground" />
                            </div>

                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Features */}
        {!hasSearched && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
            <Card>
              <CardContent className="p-6 text-center">
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Search className="w-6 h-6 text-primary" />
                </div>
                <h3 className="font-semibold mb-1">Track Status</h3>
                <p className="text-sm text-muted-foreground">
                  Check the current status of your device cleaning
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6 text-center">
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Laptop className="w-6 h-6 text-primary" />
                </div>
                <h3 className="font-semibold mb-1">View Proof</h3>
                <p className="text-sm text-muted-foreground">
                  See before and after photos of your device
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6 text-center">
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3">
                  <QrCode className="w-6 h-6 text-primary" />
                </div>
                <h3 className="font-semibold mb-1">Digital Receipt</h3>
                <p className="text-sm text-muted-foreground">
                  Sign digital handover when collecting your device
                </p>
              </CardContent>
            </Card>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t mt-12">
        <div className="max-w-4xl mx-auto px-4 py-6 text-center text-sm text-muted-foreground">
          <p>NexGen Care - Professional Laptop Cleaning Services</p>
          <p className="mt-1">Est. 2026</p>
        </div>
      </footer>
    </div>
  );
}