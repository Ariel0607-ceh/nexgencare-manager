import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@/lib/api';
import type { Client } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Search,
  Plus,
  Phone,
  Mail,
  MapPin,
  ClipboardList,
  ArrowRight,
  User,
} from 'lucide-react';
import { toast } from 'sonner';

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    fullName: '',
    phone: '',
    email: '',
    address: '',
  });

  useEffect(() => {
    loadClients();
  }, [searchQuery]);

  const loadClients = async () => {
    try {
      const data = await api.getClients(searchQuery || undefined);
      // Ensure we always have an array
      setClients(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to load clients:', error);
      setClients([]); // Don't crash, just show empty
      toast.error('Failed to load clients - backend not connected');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.fullName || !formData.phone) {
      toast.error('Name and phone are required');
      return;
    }

    try {
      await api.createClient(formData);
      toast.success('Client created successfully');
      setIsDialogOpen(false);
      setFormData({ fullName: '', phone: '', email: '', address: '' });
      loadClients();
    } catch (error) {
      console.error('Failed to create client:', error);
      toast.error('Failed to create client');
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Clients</h1>
          <p className="text-muted-foreground">
            Manage your client records
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Add Client
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Add New Client</DialogTitle>
              <DialogDescription>
                Create a new client record for device services.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full Name *</Label>
                  <Input
                    id="fullName"
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    placeholder="John Smith"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone / WhatsApp *</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+1-555-0101"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email (optional)</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="john@example.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address">Address (optional)</Label>
                  <Input
                    id="address"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    placeholder="123 Main St, City"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit">Create Client</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search clients by name, phone, or email..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Clients List */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      ) : clients.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <User className="w-12 h-12 text-muted-foreground mb-3" />
            <p className="text-lg font-medium">No clients found</p>
            <p className="text-muted-foreground mb-4">
              {searchQuery ? 'Try a different search term' : 'Add your first client to get started'}
            </p>
            {!searchQuery && (
              <Button onClick={() => setIsDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Add Client
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {clients.map((client) => (
            <Link key={client.id} to={`/admin/clients/${client.id}`}>
              <Card className="hover:bg-accent transition-colors cursor-pointer h-full">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <User className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold">{client.fullName}</h3>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Phone className="w-3 h-3" />
                          {client.phone}
                        </div>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-muted-foreground" />
                  </div>

                  <div className="mt-4 space-y-2">
                    {client.email && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Mail className="w-4 h-4" />
                        {client.email}
                      </div>
                    )}
                    {client.address && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <MapPin className="w-4 h-4" />
                        {client.address}
                      </div>
                    )}
                  </div>

                  <div className="mt-4 pt-3 border-t flex items-center gap-2 text-sm">
                    <ClipboardList className="w-4 h-4 text-muted-foreground" />
                    <span className="text-muted-foreground">
                      {client._count?.jobs || 0} service jobs
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
