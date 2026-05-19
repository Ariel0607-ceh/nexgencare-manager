import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import type { Job } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import {
  ArrowLeft,
  CheckCircle,
  Circle,
  Shield,
  Play,
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import QRCode from 'react-qr-code';

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  RECEIVED: { label: 'Received', variant: 'secondary' },
  IN_PROGRESS: { label: 'In Progress', variant: 'default' },
  CLEANING_COMPLETED: { label: 'Cleaning Done', variant: 'outline' },
  READY_FOR_PICKUP: { label: 'Ready', variant: 'default' },
  COMPLETED: { label: 'Completed', variant: 'default' },
  CANCELLED: { label: 'Cancelled', variant: 'destructive' },
};

export default function ClientJobViewPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const [job, setJob] = useState<Job | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [signatureData, setSignatureData] = useState('');
  const [isDrawing, setIsDrawing] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [lightbox, setLightbox] = useState<{
    open: boolean;
    url: string;
    type: string;
    filename: string;
  }>({
    open: false,
    url: '',
    type: 'IMAGE',
    filename: '',
  });

  useEffect(() => {
    if (jobId) {
      loadJob();
    }
  }, [jobId]);

  const loadJob = async () => {
    try {
      const response = await fetch(`http://localhost:3001/api/public/jobs/${jobId}`);
      
      if (response.ok) {
        const data = await response.json();
        setJob(data);
        setIsLoading(false);
        return;
      }
      
      const searchResponse = await fetch(
        `http://localhost:3001/api/public/jobs/search?q=${encodeURIComponent(jobId!)}`
      );
      
      if (!searchResponse.ok) {
        const err = await searchResponse.json();
        throw new Error(err.error || 'Search failed');
      }
      
      const searchResults = await searchResponse.json();
      
      const foundJob = searchResults.find(
        (j: any) => j.id === jobId || j.jobId === jobId
      );
      
      if (foundJob) {
        const detailResponse = await fetch(
          `http://localhost:3001/api/public/jobs/${foundJob.id}`
        );
        if (detailResponse.ok) {
          const fullJob = await detailResponse.json();
          setJob(fullJob);
        } else {
          setJob(foundJob);
        }
      } else {
        setJob(null);
        toast.error('Job not found');
      }
    } catch (error) {
      console.error('Failed to load job:', error);
      toast.error('Failed to load job details');
      setJob(null);
    } finally {
      setIsLoading(false);
    }
  };

  const startDrawing = useCallback((e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    
    ctx.beginPath();
    ctx.moveTo(clientX - rect.left, clientY - rect.top);
  }, []);

  const draw = useCallback((e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#000';
    ctx.lineTo(clientX - rect.left, clientY - rect.top);
    ctx.stroke();
  }, [isDrawing]);

  const stopDrawing = useCallback(() => {
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (canvas) {
      setSignatureData(canvas.toDataURL());
    }
  }, []);

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setSignatureData('');
  };

  const handleSignHandover = async () => {
    if (!signatureData) {
      toast.error('Please sign first');
      return;
    }
    try {
      const response = await fetch(`http://localhost:3001/api/public/handover/${jobId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientSignature: signatureData,
          paymentStatus: 'UNPAID',
        }),
      });
      
      if (!response.ok) throw new Error('Failed to sign handover');
      
      toast.success('Handover signed successfully');
      loadJob();
    } catch (error) {
      toast.error('Failed to sign handover');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-40" />
          <Skeleton className="h-60" />
        </div>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted p-6">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-lg">Job not found</p>
          <Button asChild className="mt-4">
            <Link to="/">Back to Portal</Link>
          </Button>
        </div>
      </div>
    );
  }

  const status = statusConfig[job.status] || { label: job.status, variant: 'secondary' };
  const beforeMedia = job.mediaFiles?.filter((m) => m.category === 'BEFORE') || [];
  const duringMedia = job.mediaFiles?.filter((m) => m.category === 'DURING') || [];
  const afterMedia = job.mediaFiles?.filter((m) => m.category === 'AFTER') || [];
  const completedChecklist = job.checklist?.filter((item) => item.completed).length || 0;
  const totalChecklist = job.checklist?.length || 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted">
      {/* Header */}
      <header className="bg-card border-b">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="outline" size="icon" asChild>
                <Link to="/">
                  <ArrowLeft className="w-4 h-4" />
                </Link>
              </Button>
              <div className="flex items-center gap-3">
                <img 
                  src="/logo.png" 
                  alt="NexGen Care" 
                  className="h-14 w-auto object-contain"
                />
              </div>
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

      <main className="max-w-4xl mx-auto px-4 py-6">
        {/* Job Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold">{job.jobId}</h1>
            <Badge variant={status.variant}>{status.label}</Badge>
          </div>
          <p className="text-muted-foreground">
            {job.device?.brand} {job.device?.model}
          </p>
        </div>

        {/* Status Progress */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              {[
                { status: 'RECEIVED', label: 'Received' },
                { status: 'IN_PROGRESS', label: 'In Progress' },
                { status: 'CLEANING_COMPLETED', label: 'Cleaning Done' },
                { status: 'READY_FOR_PICKUP', label: 'Ready' },
                { status: 'COMPLETED', label: 'Completed' },
              ].map((step, index) => {
                const isActive = ['RECEIVED', 'IN_PROGRESS', 'CLEANING_COMPLETED', 'READY_FOR_PICKUP', 'COMPLETED'].indexOf(job.status) >= index;
                const isCurrent = step.status === job.status;
                return (
                  <div key={step.status} className="flex items-center">
                    <div className="flex flex-col items-center">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-xs ${
                          isCurrent
                            ? 'bg-primary text-primary-foreground'
                            : isActive
                            ? 'bg-primary/20 text-primary'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {isActive ? <CheckCircle className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
                      </div>
                      <span className={`text-xs mt-1 ${isCurrent ? 'font-medium' : 'text-muted-foreground'}`}>
                        {step.label}
                      </span>
                    </div>
                    {index < 4 && (
                      <div className={`w-8 lg:w-16 h-0.5 mx-1 ${isActive ? 'bg-primary' : 'bg-muted'}`} />
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="details">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="checklist">Checklist</TabsTrigger>
            <TabsTrigger value="media">Photos</TabsTrigger>
            <TabsTrigger value="handover">Handover</TabsTrigger>
          </TabsList>

          {/* Details Tab */}
          <TabsContent value="details" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Your Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="font-medium">{job.client?.fullName}</p>
                  <p className="text-sm text-muted-foreground">{job.client?.phone}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Device Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="font-medium">{job.device?.brand} {job.device?.model}</p>
                  <p className="text-sm text-muted-foreground">
                    {job.device?.deviceType} • {job.device?.serialNumber || 'No serial'}
                  </p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">QR Code</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col items-center">
                <div className="bg-white p-4 rounded-lg">
                  <QRCode value={`${window.location.origin}/job/${job.id}`} size={150} />
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  Scan to view this job status
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Checklist Tab */}
          <TabsContent value="checklist">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Cleaning Progress ({completedChecklist}/{totalChecklist})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {job.checklist?.map((item) => (
                    <div
                      key={item.id}
                      className={`flex items-center gap-3 p-3 rounded-lg ${
                        item.completed ? 'bg-green-50' : 'bg-muted'
                      }`}
                    >
                      {item.completed ? (
                        <CheckCircle className="w-5 h-5 text-green-500 shrink-0" />
                      ) : (
                        <Circle className="w-5 h-5 text-muted-foreground shrink-0" />
                      )}
                      <span className={item.completed ? 'line-through text-muted-foreground' : ''}>
                        {item.title}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Media Tab */}
          <TabsContent value="media" className="space-y-6">
            {[
              { title: 'Before (Intake)', media: beforeMedia },
              { title: 'During (Cleaning)', media: duringMedia },
              { title: 'After (Result)', media: afterMedia },
            ].map((section) => (
              <Card key={section.title}>
                <CardHeader>
                  <CardTitle className="text-base">{section.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  {section.media.length === 0 ? (
                    <p className="text-muted-foreground text-center py-4">No photos yet</p>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                      {section.media.map((file) => (
                        <div
                          key={file.id}
                          className="cursor-pointer"
                          onClick={() =>
                            setLightbox({
                              open: true,
                              url: file.url,
                              type: file.type,
                              filename: file.filename,
                            })
                          }
                        >
                          {file.type === 'IMAGE' ? (
                            <img
                              src={file.url}
                              alt={file.filename}
                              className="w-full h-32 object-cover rounded-lg"
                            />
                          ) : (
                            <div className="relative w-full h-32 bg-black rounded-lg overflow-hidden">
                              <video
                                src={file.url}
                                className="w-full h-full object-cover opacity-70"
                                preload="metadata"
                                muted
                              />
                              <div className="absolute inset-0 flex items-center justify-center">
                                <div className="w-10 h-10 bg-white/90 rounded-full flex items-center justify-center shadow-lg">
                                  <Play className="w-5 h-5 text-black ml-0.5" />
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          {/* Handover Tab */}
          <TabsContent value="handover">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Device Handover</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {job.status === 'COMPLETED' ? (
                  <div className="p-4 bg-green-50 rounded-lg text-center">
                    <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-2" />
                    <p className="font-medium text-green-700">Job Completed</p>
                    <p className="text-sm text-green-600">
                      Your device has been returned on {job.completedAt && format(new Date(job.completedAt), 'PPp')}
                    </p>
                  </div>
                ) : job.status === 'READY_FOR_PICKUP' ? (
                  <>
                    <div className="p-4 bg-blue-50 rounded-lg">
                      <p className="font-medium text-blue-700">Your device is ready!</p>
                      <p className="text-sm text-blue-600">
                        Please visit our location to collect your device.
                      </p>
                    </div>

                    <Separator />

                    <div>
                      <Label className="text-base font-medium">Sign to Confirm Receipt</Label>
                      <p className="text-sm text-muted-foreground mb-3">
                        Please sign below to confirm you received your device
                      </p>
                      <div className="border rounded-lg p-2 bg-white">
                        <canvas
                          ref={canvasRef}
                          width={600}
                          height={150}
                          className="w-full border rounded cursor-crosshair"
                          onMouseDown={startDrawing}
                          onMouseMove={draw}
                          onMouseUp={stopDrawing}
                          onMouseLeave={stopDrawing}
                          onTouchStart={startDrawing}
                          onTouchMove={draw}
                          onTouchEnd={stopDrawing}
                        />
                      </div>
                      <div className="flex gap-2 mt-2">
                        <Button variant="outline" size="sm" onClick={clearSignature}>
                          Clear
                        </Button>
                        <Button onClick={handleSignHandover} disabled={!signatureData}>
                          Confirm Receipt
                        </Button>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">
                      Handover will be available when your device is ready for pickup
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {/* Footer */}
      <footer className="border-t mt-12">
        <div className="max-w-4xl mx-auto px-4 py-6 text-center text-sm text-muted-foreground">
          <p>NexGen Care - Professional Laptop Cleaning Services</p>
        </div>
      </footer>

      {/* Media Lightbox */}
      <Dialog open={lightbox.open} onOpenChange={(open) => setLightbox({ ...lightbox, open })}>
        <DialogContent className="max-w-5xl w-full p-0 overflow-hidden bg-black/95 border-none">
          <div className="flex items-center justify-center min-h-[300px] max-h-[85vh] p-2">
            {lightbox.type === 'IMAGE' ? (
              <img
                src={lightbox.url}
                alt={lightbox.filename}
                className="max-w-full max-h-[85vh] object-contain rounded-lg"
              />
            ) : (
              <video
                src={lightbox.url}
                controls
                autoPlay
                className="max-w-full max-h-[85vh] rounded-lg"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}