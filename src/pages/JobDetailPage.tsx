import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import type { Job } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ArrowLeft,
  Laptop,
  User,
  Phone,
  CheckCircle,
  Circle,
  Upload,
  FileText,
  Signature,
  Trash2,
  Pencil,
  QrCode,
  Printer,
  Save,
  X,
  Lock,
  AlertTriangle,
  Play,
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

const safeFormat = (date: string | null | undefined, fmt: string) => {
  if (!date) return 'N/A';
  try {
    return format(new Date(date), fmt);
  } catch {
    return 'Invalid date';
  }
};

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  RECEIVED: { label: 'Received', variant: 'secondary' },
  IN_PROGRESS: { label: 'In Progress', variant: 'default' },
  CLEANING_COMPLETED: { label: 'Cleaning Done', variant: 'outline' },
  READY_FOR_PICKUP: { label: 'Ready', variant: 'default' },
  COMPLETED: { label: 'Completed', variant: 'default' },
  CANCELLED: { label: 'Cancelled', variant: 'destructive' },
};

const statusFlow = [
  { status: 'RECEIVED', label: 'Received' },
  { status: 'IN_PROGRESS', label: 'In Progress' },
  { status: 'CLEANING_COMPLETED', label: 'Cleaning Done' },
  { status: 'READY_FOR_PICKUP', label: 'Ready' },
  { status: 'COMPLETED', label: 'Completed' },
];

const tabAvailability: Record<string, string[]> = {
  overview: ['RECEIVED', 'IN_PROGRESS', 'CLEANING_COMPLETED', 'READY_FOR_PICKUP', 'COMPLETED', 'CANCELLED'],
  checklist: ['IN_PROGRESS', 'CLEANING_COMPLETED', 'READY_FOR_PICKUP', 'COMPLETED'],
  media: ['IN_PROGRESS', 'CLEANING_COMPLETED', 'READY_FOR_PICKUP', 'COMPLETED'],
  consent: ['RECEIVED', 'IN_PROGRESS', 'CLEANING_COMPLETED', 'READY_FOR_PICKUP', 'COMPLETED'],
  handover: ['READY_FOR_PICKUP', 'COMPLETED'],
};

const validStatusTransitions: Record<string, string[]> = {
  'RECEIVED': ['IN_PROGRESS', 'CANCELLED'],
  'IN_PROGRESS': ['CLEANING_COMPLETED', 'CANCELLED'],
  'CLEANING_COMPLETED': ['READY_FOR_PICKUP', 'CANCELLED'],
  'READY_FOR_PICKUP': ['COMPLETED', 'CANCELLED'],
  'COMPLETED': [],
  'CANCELLED': ['RECEIVED'],
};

export default function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [job, setJob] = useState<Job | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [isStatusDialogOpen, setIsStatusDialogOpen] = useState(false);
  const [newStatus, setNewStatus] = useState('');
  const [uploadCategory, setUploadCategory] = useState<'BEFORE' | 'DURING' | 'AFTER'>('BEFORE');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [signatureData, setSignatureData] = useState('');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);

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

  const [isEditing, setIsEditing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editForm, setEditForm] = useState({
    jobId: '',
    brand: '',
    model: '',
    serialNumber: '',
    deviceType: 'LAPTOP' as 'LAPTOP' | 'DESKTOP' | 'SMARTPHONE',
    scratches: '',
    damageNotes: '',
    reportedIssues: '',
    notes: '',
    status: '',
    receivedAt: '',
  });

  const [checklistNoteModal, setChecklistNoteModal] = useState<{ open: boolean; itemId: string; note: string }>({
    open: false,
    itemId: '',
    note: '',
  });

  // Handover form state
  const [handoverForm, setHandoverForm] = useState<{
    finalCondition: string;
    paymentStatus: 'UNPAID' | 'PARTIAL' | 'PAID';
    paymentAmount: string;
    paymentNotes: string;
    completedAt: string;
  }>({
    finalCondition: '',
    paymentStatus: 'UNPAID',
    paymentAmount: '',
    paymentNotes: '',
    completedAt: '',
  });

  useEffect(() => {
    if (id) {
      loadJob();
    }
  }, [id]);

  const loadJob = async () => {
    try {
      const data = await api.getJob(id!);
      setJob(data);
      setEditForm({
        jobId: data.jobId || '',
        brand: data.device?.brand || '',
        model: data.device?.model || '',
        serialNumber: data.device?.serialNumber || '',
        deviceType: data.device?.deviceType || 'LAPTOP',
        scratches: data.scratches || '',
        damageNotes: data.damageNotes || '',
        reportedIssues: data.reportedIssues || '',
        notes: data.notes || '',
        status: data.status || 'RECEIVED',
        receivedAt: data.receivedAt ? new Date(data.receivedAt).toISOString().slice(0, 16) : '',
      });
      
      if (data.handoverRecord) {
        const validStatus = (s?: string): 'UNPAID' | 'PARTIAL' | 'PAID' => {
          if (s === 'UNPAID' || s === 'PARTIAL' || s === 'PAID') return s;
          return 'UNPAID';
        };

        setHandoverForm({
          finalCondition: data.handoverRecord.finalCondition || '',
          paymentStatus: validStatus(data.handoverRecord.paymentStatus),
          paymentAmount: data.handoverRecord.paymentAmount || '',
          paymentNotes: data.handoverRecord.paymentNotes || '',
          completedAt: data.handoverRecord.completedAt ? new Date(data.handoverRecord.completedAt).toISOString().slice(0, 16) : '',
        });
      }
    } catch (error) {
      console.error('Failed to load job:', error);
      toast.error('Failed to load job details');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdate = async () => {
    try {
      await api.updateJob(id!, editForm);
      toast.success('Job updated successfully');
      setIsEditing(false);
      loadJob();
    } catch (error) {
      console.error('Failed to update job:', error);
      toast.error('Failed to update job');
    }
  };
  
  const handleDelete = async () => {
    try {
      await api.deleteJob(id!);
      toast.success('Job deleted successfully');
      navigate('/admin/jobs');
    } catch (error) {
      console.error('Failed to delete job:', error);
      toast.error('Failed to delete job');
    }
  };

  const handleStatusUpdate = async () => {
    if (!newStatus) return;
    
    try {
      await api.updateJobStatus(id!, newStatus);
      toast.success('Status updated successfully');
      setIsStatusDialogOpen(false);
      setNewStatus('');
      loadJob();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to update status');
    }
  };

  const handleChecklistToggle = async (itemId: string, currentCompleted: boolean) => {
    if (currentCompleted) {
      try {
        await api.toggleChecklistItem(itemId, '');
        loadJob();
      } catch (error) {
        console.error('Failed to toggle checklist:', error);
        toast.error('Failed to update checklist');
      }
      return;
    }

    setChecklistNoteModal({
      open: true,
      itemId,
      note: '',
    });
  };

  const handleSaveChecklistNote = async () => {
    try {
      await api.toggleChecklistItem(checklistNoteModal.itemId, checklistNoteModal.note);
      setChecklistNoteModal({ open: false, itemId: '', note: '' });
      loadJob();
    } catch (error) {
      console.error('Failed to toggle checklist:', error);
      toast.error('Failed to update checklist');
    }
  };

  const allChecklistCompleted = () => {
    if (!job?.checklist || job.checklist.length === 0) return false;
    return job.checklist.every(item => item.completed);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 50 * 1024 * 1024) {
      toast.error('File too large. Maximum 50MB allowed.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setIsUploading(true);

    const reader = new FileReader();

    reader.onerror = () => {
      toast.error('Failed to read file');
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    };

    reader.onloadend = async () => {
      try {
        const base64 = reader.result as string;

        await api.uploadMedia({
          jobId: id!,
          type: file.type.startsWith('video') ? 'VIDEO' : 'IMAGE',
          category: uploadCategory,
          fileData: base64,
          filename: file.name,
          mimeType: file.type,
        });

        toast.success('File uploaded successfully');
        loadJob();
      } catch (error: any) {
        console.error('Upload error:', error);
        toast.error(error.response?.data?.error || 'Failed to upload file');
      } finally {
        setIsUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };

    reader.readAsDataURL(file);
  };

  const handleDeleteMedia = async (mediaId: string) => {
    try {
      await api.deleteMedia(mediaId);
      toast.success('File deleted');
      loadJob();
    } catch (error) {
      toast.error('Failed to delete file');
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


  const handleSaveHandover = async () => {
    if (!allChecklistCompleted()) {
      toast.error('All checklist items must be completed before saving handover');
      return;
    }

    try {
      await api.saveHandoverRecord({
        jobId: id!,
        clientSignature: signatureData,
        paymentStatus: handoverForm.paymentStatus,
        paymentAmount: handoverForm.paymentAmount ? parseFloat(handoverForm.paymentAmount) : null,
        paymentNotes: handoverForm.paymentNotes,
        finalCondition: handoverForm.finalCondition,
        completedAt: handoverForm.completedAt || null,
      });
      toast.success('Handover record saved');
      loadJob();
    } catch (error) {
      toast.error('Failed to save handover');
    }
  };

  const completeHandover = async () => {
    if (!job?.handoverRecord) {
      toast.error('Please save handover record first');
      return;
    }

    if (!allChecklistCompleted()) {
      toast.error('All checklist items must be completed before completing handover');
      return;
    }
    
    const completedAt = handoverForm.completedAt || new Date().toISOString();
    
    try {
      await api.completeHandover(job.handoverRecord.id, completedAt);
      toast.success('Job completed successfully');
      loadJob();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to complete handover');
    }
  };

  const isTabAvailable = (tab: string) => {
    if (!job) return false;
    return tabAvailability[tab]?.includes(job.status) ?? false;
  };

  const getAvailableStatusOptions = () => {
    if (!job) return [];
    return validStatusTransitions[job.status] || [];
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40" />
        <Skeleton className="h-60" />
      </div>
    );
  }

  if (!job) {
    return (
      <div className="p-6">
        <p>Job not found</p>
        <Button asChild className="mt-4">
          <Link to="/admin/jobs">Back to Jobs</Link>
        </Button>
      </div>
    );
  }

  const status = statusConfig[job.status] || { label: job.status, variant: 'secondary' };
  const completedChecklist = job.checklist?.filter((item) => item.completed).length || 0;
  const totalChecklist = job.checklist?.length || 0;
  const checklistComplete = allChecklistCompleted();

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" asChild>
            <Link to="/admin/jobs">
              <ArrowLeft className="w-4 h-4" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold">{job.jobId}</h1>
              <Badge variant={status.variant}>{status.label}</Badge>
            </div>
            <p className="text-muted-foreground">
              {job.client?.fullName} • {job.device?.brand} {job.device?.model}
            </p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => {
            setIsEditing(true);
            setActiveTab('overview');
          }}>
            <Pencil className="w-4 h-4 mr-2" />
            Edit
          </Button>
          <Button variant="destructive" size="sm" onClick={() => setIsDeleting(true)}>
            <Trash2 className="w-4 h-4 mr-2" />
            Delete
          </Button>
          <Button variant="outline" size="sm">
            <QrCode className="w-4 h-4 mr-2" />
            QR Code
          </Button>
          <Button variant="outline" size="sm">
            <Printer className="w-4 h-4 mr-2" />
            Print
          </Button>
          <Button size="sm" onClick={() => setIsStatusDialogOpen(true)}>
            Update Status
          </Button>
        </div>
      </div>

      {/* Status Progress */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            {statusFlow.map((step, index) => {
              const isActive = statusFlow.findIndex((s) => s.status === job.status) >= index;
              const isCurrent = step.status === job.status;
              return (
                <div key={step.status} className="flex items-center">
                  <div className="flex flex-col items-center">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${
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
                  {index < statusFlow.length - 1 && (
                    <div className={`w-12 lg:w-24 h-0.5 mx-2 ${isActive ? 'bg-primary' : 'bg-muted'}`} />
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Checklist Warning Banner */}
      {!checklistComplete && job.status !== 'RECEIVED' && job.status !== 'CANCELLED' && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
            <div>
              <p className="text-amber-800 font-medium">Checklist Incomplete</p>
              <p className="text-sm text-amber-700">
                {completedChecklist} of {totalChecklist} items completed. All items must be checked before proceeding to handover or status updates.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5 lg:w-auto">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="checklist" disabled={!isTabAvailable('checklist')}>
            Checklist ({completedChecklist}/{totalChecklist})
          </TabsTrigger>
          <TabsTrigger value="media" disabled={!isTabAvailable('media')}>
            Media ({job.mediaFiles?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="consent" disabled={!isTabAvailable('consent')}>Consent</TabsTrigger>
          <TabsTrigger value="handover" disabled={!isTabAvailable('handover')}>Handover</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <User className="w-5 h-5" />
                  Client Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="font-medium text-lg">{job.client?.fullName}</p>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Phone className="w-4 h-4" />
                    {job.client?.phone}
                  </div>
                </div>
                {job.client?.email && (
                  <p className="text-sm text-muted-foreground">{job.client.email}</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Laptop className="w-5 h-5" />
                  Device Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {isEditing ? (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Job ID</Label>
                      <Input
                        value={editForm.jobId}
                        onChange={(e) => setEditForm({ ...editForm, jobId: e.target.value })}
                        placeholder="e.g., JOB-ABC123"
                      />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Brand *</Label>
                        <Input
                          value={editForm.brand}
                          onChange={(e) => setEditForm({ ...editForm, brand: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Model *</Label>
                        <Input
                          value={editForm.model}
                          onChange={(e) => setEditForm({ ...editForm, model: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Serial Number</Label>
                        <Input
                          value={editForm.serialNumber}
                          onChange={(e) => setEditForm({ ...editForm, serialNumber: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Device Type</Label>
                        <Select
                          value={editForm.deviceType}
                          onValueChange={(value: 'LAPTOP' | 'DESKTOP' | 'SMARTPHONE') => setEditForm({ ...editForm, deviceType: value })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="LAPTOP">Laptop</SelectItem>
                            <SelectItem value="DESKTOP">Desktop</SelectItem>
                            <SelectItem value="SMARTPHONE">Smartphone</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Received Date</Label>
                      <Input
                        type="datetime-local"
                        value={editForm.receivedAt}
                        onChange={(e) => setEditForm({ ...editForm, receivedAt: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Scratches / Cosmetic</Label>
                      <Textarea
                        value={editForm.scratches}
                        onChange={(e) => setEditForm({ ...editForm, scratches: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Damage Notes</Label>
                      <Textarea
                        value={editForm.damageNotes}
                        onChange={(e) => setEditForm({ ...editForm, damageNotes: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Reported Issues</Label>
                      <Textarea
                        value={editForm.reportedIssues}
                        onChange={(e) => setEditForm({ ...editForm, reportedIssues: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Additional Notes</Label>
                      <Textarea
                        value={editForm.notes}
                        onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={handleUpdate}>
                        <Save className="w-4 h-4 mr-2" />
                        Save Changes
                      </Button>
                      <Button variant="outline" onClick={() => setIsEditing(false)}>
                        <X className="w-4 h-4 mr-2" />
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Brand</p>
                      <p className="font-medium">{job.device?.brand}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Model</p>
                      <p className="font-medium">{job.device?.model}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Type</p>
                      <p className="font-medium">{job.device?.deviceType}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Serial</p>
                      <p className="font-medium">{job.device?.serialNumber || 'N/A'}</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Physical Condition (Intake)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {job.scratches && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Scratches / Cosmetic</p>
                  <p>{job.scratches}</p>
                </div>
              )}
              {job.damageNotes && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Damage Notes</p>
                  <p>{job.damageNotes}</p>
                </div>
              )}
              {job.reportedIssues && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Reported Issues</p>
                  <p>{job.reportedIssues}</p>
                </div>
              )}
              {job.notes && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Additional Notes</p>
                  <p>{job.notes}</p>
                </div>
              )}
              {!job.scratches && !job.damageNotes && !job.reportedIssues && !job.notes && (
                <p className="text-muted-foreground">No condition notes recorded</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Job Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Received</p>
                  <p className="font-medium">{safeFormat(job.receivedAt, 'PPp')}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Created By</p>
                  <p className="font-medium">{job.createdBy?.name || 'N/A'}</p>
                </div>
                {job.assignedTo && (
                  <div>
                    <p className="text-sm text-muted-foreground">Assigned To</p>
                    <p className="font-medium">{job.assignedTo.name}</p>
                  </div>
                )}
                {job.completedAt && (
                  <div>
                    <p className="text-sm text-muted-foreground">Completed</p>
                    <p className="font-medium">{safeFormat(job.completedAt, 'PPp')}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Checklist Tab */}
        <TabsContent value="checklist" className="space-y-4">
          {!isTabAvailable('checklist') ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                <Lock className="w-8 h-8 mx-auto mb-2" />
                <p className="font-medium">Checklist Locked</p>
                <p className="text-sm">Available when job status is "In Progress" or later.</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg">Cleaning Checklist</CardTitle>
                <div className="text-sm text-muted-foreground">
                  {completedChecklist} of {totalChecklist} completed
                </div>
              </CardHeader>
              <CardContent>
                {job.checklist && job.checklist.length > 0 ? (
                  <div className="space-y-3">
                    {job.checklist.map((item, index) => (
                      <div
                        key={item.id}
                        className={`flex items-start gap-4 p-4 rounded-lg border ${
                          item.completed ? 'bg-green-50 border-green-200' : ''
                        }`}
                      >
                        <Checkbox
                          checked={item.completed}
                          onCheckedChange={() => handleChecklistToggle(item.id, item.completed)}
                          className="mt-1"
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">#{index + 1}</span>
                            <p className={`font-medium ${item.completed ? 'line-through text-muted-foreground' : ''}`}>
                              {item.title}
                            </p>
                          </div>
                          {item.description && (
                            <p className="text-sm text-muted-foreground mt-1">{item.description}</p>
                          )}
                          {item.notes && (
                            <p className="text-xs text-amber-600 mt-1">
                              <span className="font-medium">Reason not checked:</span> {item.notes}
                            </p>
                          )}
                          {item.completed && item.completedAt && (
                            <p className="text-xs text-green-600 mt-1">
                              Completed by {item.user?.name} on {safeFormat(item.completedAt, 'PPp')}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-8">No checklist items</p>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Media Tab */}
        <TabsContent value="media" className="space-y-6">
          {!isTabAvailable('media') ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                <Lock className="w-8 h-8 mx-auto mb-2" />
                <p className="font-medium">Media Locked</p>
                <p className="text-sm">Available when job status is "In Progress" or later.</p>
              </CardContent>
            </Card>
          ) : (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Upload Media</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex gap-4">
                    <Select
                      value={uploadCategory}
                      onValueChange={(value: 'BEFORE' | 'DURING' | 'AFTER') => setUploadCategory(value)}
                    >
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="BEFORE">Before (Intake)</SelectItem>
                        <SelectItem value="DURING">During (Cleaning)</SelectItem>
                        <SelectItem value="AFTER">After (Result)</SelectItem>
                      </SelectContent>
                    </Select>
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileUpload}
                      accept="image/*,video/*"
                      className="hidden"
                    />
                    <Button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploading}
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      {isUploading ? 'Uploading...' : 'Upload File'}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {['BEFORE', 'DURING', 'AFTER'].map((category) => {
                const media = job.mediaFiles?.filter((m) => m.category === category) || [];
                return (
                  <Card key={category}>
                    <CardHeader>
                      <CardTitle className="text-lg capitalize">{category.toLowerCase()} Photos & Videos</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {media.length === 0 ? (
                        <p className="text-center text-muted-foreground py-4">No {category.toLowerCase()} media uploaded</p>
                      ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                          {media.map((file) => (
                            <div
                              key={file.id}
                              className="relative group cursor-pointer"
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
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteMedia(file.id);
                                }}
                                className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-md opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                              <p className="text-xs text-muted-foreground mt-1 truncate">{file.filename}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </>
          )}
        </TabsContent>

        {/* Consent Tab */}
        <TabsContent value="consent" className="space-y-6">
          {!isTabAvailable('consent') ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                <Lock className="w-8 h-8 mx-auto mb-2" />
                <p className="font-medium">Consent Locked</p>
                <p className="text-sm">Available for active jobs.</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Client Consent Form
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {job.consentForm ? (
                  <>
                    <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                      <div className="flex items-center gap-2 mb-2">
                        <CheckCircle className="w-5 h-5 text-green-600" />
                        <p className="text-green-700 font-medium">Consent Form Signed</p>
                      </div>
                      <p className="text-sm text-green-600">
                        Signed on {safeFormat(job.consentForm.clientSignedAt, 'PPp')}
                      </p>
                      {job.consentForm.staffWitnessName && (
                        <p className="text-sm text-green-600 mt-1">
                          Staff Witness: {job.consentForm.staffWitnessName}
                        </p>
                      )}
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-start gap-3">
                        <CheckCircle className={`w-5 h-5 mt-0.5 ${job.consentForm.voluntaryHandover ? 'text-green-500' : 'text-gray-300'}`} />
                        <p className={job.consentForm.voluntaryHandover ? '' : 'text-muted-foreground'}>
                          I confirm that I am handing over this device voluntarily for cleaning service.
                        </p>
                      </div>
                      <div className="flex items-start gap-3">
                        <CheckCircle className={`w-5 h-5 mt-0.5 ${job.consentForm.allowCleaning ? 'text-green-500' : 'text-gray-300'}`} />
                        <p className={job.consentForm.allowCleaning ? '' : 'text-muted-foreground'}>
                          I agree to allow the technician to disassemble and clean the device as needed.
                        </p>
                      </div>
                      <div className="flex items-start gap-3">
                        <CheckCircle className={`w-5 h-5 mt-0.5 ${job.consentForm.acknowledgeRisk ? 'text-green-500' : 'text-gray-300'}`} />
                        <p className={job.consentForm.acknowledgeRisk ? '' : 'text-muted-foreground'}>
                          I understand there is a minor risk of damage during the cleaning process.
                        </p>
                      </div>
                      <div className="flex items-start gap-3">
                        <CheckCircle className={`w-5 h-5 mt-0.5 ${job.consentForm.confirmCondition ? 'text-green-500' : 'text-gray-300'}`} />
                        <p className={job.consentForm.confirmCondition ? '' : 'text-muted-foreground'}>
                          I confirm the device condition has been accurately described.
                        </p>
                      </div>
                    </div>

                    {job.consentForm.clientSignature && (
                      <div>
                        <Label className="text-base font-medium">Client Signature</Label>
                        <div className="border rounded-lg p-2 bg-white mt-2">
                          <img 
                            src={job.consentForm.clientSignature} 
                            alt="Client signature" 
                            className="max-h-32 object-contain"
                          />
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="w-12 h-12 mx-auto mb-3" />
                    <p>No consent form on record.</p>
                    <p className="text-sm">Consent should be collected during job creation.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Handover Tab */}
        <TabsContent value="handover" className="space-y-6">
          {!isTabAvailable('handover') ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                <Lock className="w-8 h-8 mx-auto mb-2" />
                <p className="font-medium">Handover Locked</p>
                <p className="text-sm">Available when job status is "Ready for Pickup" or "Completed".</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Signature className="w-5 h-5" />
                  Device Handover
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {job.status === 'COMPLETED' ? (
                  <div className="p-4 bg-green-50 rounded-lg">
                    <p className="text-green-700 font-medium">Job Completed</p>
                    <p className="text-sm text-green-600">
                      This job was completed on {safeFormat(job.completedAt, 'PPp')}
                    </p>
                  </div>
                ) : (
                  <>
                    {!checklistComplete && (
                      <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                        <div className="flex items-center gap-2 mb-2">
                          <AlertTriangle className="w-5 h-5 text-red-600" />
                          <p className="text-red-700 font-medium">Checklist Required</p>
                        </div>
                        <p className="text-sm text-red-600">
                          All checklist items must be completed before handover. Currently {completedChecklist}/{totalChecklist} completed.
                        </p>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="mt-2"
                          onClick={() => setActiveTab('checklist')}
                        >
                          Go to Checklist
                        </Button>
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label>Final Condition Notes</Label>
                      <Textarea 
                        placeholder="Describe the final condition of the device..."
                        value={handoverForm.finalCondition}
                        onChange={(e) => setHandoverForm({ ...handoverForm, finalCondition: e.target.value })}
                      />
                    </div>

                    <Separator />

                    <div>
                      <Label className="text-base font-medium">Client Signature (Receipt Confirmation)</Label>
                      <p className="text-sm text-muted-foreground mb-3">Client: Please sign to confirm receipt</p>
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
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="mt-2"
                        onClick={clearSignature}
                      >
                        Clear Signature
                      </Button>
                    </div>

                    <div className="space-y-2">
                      <Label>Payment Status</Label>
                      <Select 
                        value={handoverForm.paymentStatus}
                        onValueChange={(value) => setHandoverForm({ ...handoverForm, paymentStatus: value as 'UNPAID' | 'PARTIAL' | 'PAID' })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select payment status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="UNPAID">Unpaid</SelectItem>
                          <SelectItem value="PARTIAL">Partial</SelectItem>
                          <SelectItem value="PAID">Paid</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Payment Amount</Label>
                      <Input 
                        type="number" 
                        placeholder="0.00"
                        value={handoverForm.paymentAmount}
                        onChange={(e) => setHandoverForm({ ...handoverForm, paymentAmount: e.target.value })}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Payment Notes</Label>
                      <Textarea 
                        placeholder="Any payment notes..."
                        value={handoverForm.paymentNotes}
                        onChange={(e) => setHandoverForm({ ...handoverForm, paymentNotes: e.target.value })}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Completed Date *</Label>
                      <Input
                        type="datetime-local"
                        value={handoverForm.completedAt}
                        onChange={(e) => setHandoverForm({ ...handoverForm, completedAt: e.target.value })}
                        required
                      />
                      <p className="text-xs text-muted-foreground">This date will be used as the official completion date</p>
                    </div>

                    <div className="flex gap-4">
                      <Button onClick={handleSaveHandover} disabled={!checklistComplete}>
                        Save Handover Record
                      </Button>
                      <Button variant="default" onClick={completeHandover} disabled={!checklistComplete || !job.handoverRecord}>
                        Complete Job
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Checklist Note Modal */}
      <Dialog open={checklistNoteModal.open} onOpenChange={(open) => setChecklistNoteModal({ ...checklistNoteModal, open })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Checklist Item Note</DialogTitle>
            <DialogDescription>
              Provide a reason for checking this item. This helps track why items were marked complete.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label>Note (optional)</Label>
            <Textarea
              className="mt-2"
              placeholder="e.g., Client requested skip, Not applicable, etc."
              value={checklistNoteModal.note}
              onChange={(e) => setChecklistNoteModal({ ...checklistNoteModal, note: e.target.value })}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setChecklistNoteModal({ open: false, itemId: '', note: '' })}>
              Cancel
            </Button>
            <Button onClick={handleSaveChecklistNote}>
              Confirm Check
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Status Update Dialog */}
      <Dialog open={isStatusDialogOpen} onOpenChange={setIsStatusDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Job Status</DialogTitle>
            <DialogDescription>
              Change the current status of this job. Status must follow the workflow: Received → In Progress → Cleaning Completed → Ready for Pickup → Completed.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Select value={newStatus} onValueChange={setNewStatus}>
              <SelectTrigger>
                <SelectValue placeholder="Select new status" />
              </SelectTrigger>
              <SelectContent>
                {getAvailableStatusOptions().map((statusOption) => (
                  <SelectItem key={statusOption} value={statusOption}>
                    {statusConfig[statusOption]?.label || statusOption}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {getAvailableStatusOptions().length === 0 && (
              <p className="text-sm text-muted-foreground mt-2">No status transitions available from "{status.label}"</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsStatusDialogOpen(false);
              setNewStatus('');
            }}>
              Cancel
            </Button>
            <Button onClick={handleStatusUpdate} disabled={!newStatus}>
              Update Status
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleting} onOpenChange={setIsDeleting}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Job</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete job {job.jobId}? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleting(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Delete Job
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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