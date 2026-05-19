import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import type { Client } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Laptop,
  ClipboardList,
  Pencil,
  Trash2,
  Save,
  X,
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

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [client, setClient] = useState<Client | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editForm, setEditForm] = useState({
    fullName: '',
    phone: '',
    email: '',
    address: '',
  });

  useEffect(() => {
    if (id) {
      loadClient();
    }
  }, [id]);

  const loadClient = async () => {
    try {
      const data = await api.getClient(id!);
      setClient(data);
      setEditForm({
        fullName: data.fullName || '',
        phone: data.phone || '',
        email: data.email || '',
        address: data.address || '',
      });
    } catch (error) {
      console.error('Failed to load client:', error);
      toast.error('Failed to load client');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdate = async () => {
    if (!editForm.fullName || !editForm.phone) {
      toast.error('Name and phone are required');
      return;
    }
    
    try {
      await api.updateClient(id!, editForm);
      toast.success('Client updated successfully');
      setIsEditing(false);
      loadClient();
    } catch (error) {
      console.error('Failed to update client:', error);
      toast.error('Failed to update client');
    }
  };

  const handleDelete = async () => {
    try {
      await api.deleteClient(id!);
      toast.success('Client deleted successfully');
      navigate('/admin/clients');
    } catch (error: any) {
      console.error('Failed to delete client:', error);
      // Show the backend error message
      const message = error.response?.data?.error || 'Failed to delete client';
      toast.error(message);
      setIsDeleting(false);
    }
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

  if (!client) {
    return (
      <div className="p-6">
        <p>Client not found</p>
        <Button asChild className="mt-4">
          <Link to="/admin/clients">Back to Clients</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" asChild>
            <Link to="/admin/clients">
              <ArrowLeft className="w-4 h-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{client.fullName}</h1>
            <p className="text-muted-foreground">Client Details</p>
          </div>
        </div>
        
        {!isEditing && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
              <Pencil className="w-4 h-4 mr-2" />
              Edit
            </Button>
            <Button variant="destructive" size="sm" onClick={() => setIsDeleting(true)}>
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </Button>
          </div>
        )}
      </div>

      {/* Delete Confirmation */}
      {isDeleting && (
        <Card className="border-destructive">
          <CardContent className="p-4">
            <p className="text-destructive font-medium">Are you sure you want to delete this client?</p>
            <p className="text-sm text-muted-foreground">This action cannot be undone.</p>
            <div className="flex gap-2 mt-3">
              <Button variant="destructive" size="sm" onClick={handleDelete}>
                Yes, Delete
              </Button>
              <Button variant="outline" size="sm" onClick={() => setIsDeleting(false)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Edit Form */}
      {isEditing ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Edit Client</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Full Name *</Label>
                <Input
                  value={editForm.fullName}
                  onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Phone *</Label>
                <Input
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Address</Label>
                <Input
                  value={editForm.address}
                  onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                />
              </div>
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
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-lg">Contact Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <Phone className="w-4 h-4 text-muted-foreground" />
                <span>{client.phone}</span>
              </div>
              {client.email && (
                <div className="flex items-center gap-3">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                  <span>{client.email}</span>
                </div>
              )}
              {client.address && (
                <div className="flex items-center gap-3">
                  <MapPin className="w-4 h-4 text-muted-foreground" />
                  <span>{client.address}</span>
                </div>
              )}
              <Separator />
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <Calendar className="w-4 h-4" />
                <span>Registered {format(new Date(client.createdAt), 'MMM dd, yyyy')}</span>
              </div>
            </CardContent>
          </Card>

          {/* Service History */}
          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Service History</CardTitle>
              <Button asChild size="sm">
                <Link to="/admin/jobs/new">
                  <ClipboardList className="w-4 h-4 mr-2" />
                  New Job
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              {client.jobs && client.jobs.length > 0 ? (
                <div className="space-y-3">
                  {client.jobs.map((job) => {
                    const status = statusConfig[job.status] || { label: job.status, variant: 'secondary' };
                    return (
                      <Link key={job.id} to={`/admin/jobs/${job.id}`}>
                        <div className="flex items-center justify-between p-4 rounded-lg border hover:bg-accent transition-colors">
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
                                {job.device?.brand} {job.device?.model}
                              </p>
                            </div>
                          </div>
                          <div className="text-right text-sm text-muted-foreground">
                            {format(new Date(job.createdAt), 'MMM dd, yyyy')}
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8">
                  <ClipboardList className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground">No service history yet</p>
                  <Button className="mt-4" asChild>
                    <Link to="/admin/jobs/new">Create First Job</Link>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}