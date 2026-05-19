import { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import type { Client } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { ArrowLeft, Plus, Search, User, FileText, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function NewJobPage() {
  const navigate = useNavigate();
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isClientDialogOpen, setIsClientDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showConsentModal, setShowConsentModal] = useState(false);
  
  const [formData, setFormData] = useState({
    clientId: '',
    brand: '',
    model: '',
    serialNumber: '',
    deviceType: 'LAPTOP' as 'LAPTOP' | 'DESKTOP' | 'SMARTPHONE',
    scratches: '',
    damageNotes: '',
    reportedIssues: '',
    notes: '',
    receivedAt: '',
    createdByName: '',
  });

  const [consentData, setConsentData] = useState({
    voluntaryHandover: true,
    allowCleaning: true,
    acknowledgeRisk: true,
    confirmCondition: true,
    clientSignature: '',
    staffWitnessName: '',
  });

  const [newClientData, setNewClientData] = useState({
    fullName: '',
    phone: '',
    email: '',
    address: '',
  });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  useEffect(() => {
    loadClients();
  }, [searchQuery]);

  const loadClients = async () => {
    try {
      const data = await api.getClients(searchQuery || undefined);
      setClients(data);
    } catch (error) {
      console.error('Failed to load clients:', error);
    }
  };

  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newClientData.fullName || !newClientData.phone) {
      toast.error('Name and phone are required');
      return;
    }

    try {
      const client = await api.createClient(newClientData);
      setSelectedClient(client);
      setFormData({ ...formData, clientId: client.id });
      setIsClientDialogOpen(false);
      setNewClientData({ fullName: '', phone: '', email: '', address: '' });
      toast.success('Client created and selected');
      loadClients();
    } catch (error) {
      console.error('Failed to create client:', error);
      toast.error('Failed to create client');
    }
  };

  const handlePreSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.clientId) {
      toast.error('Please select a client');
      return;
    }

    if (!formData.brand || !formData.model) {
      toast.error('Brand and model are required');
      return;
    }

    if (!formData.receivedAt) {
      toast.error('Received date is required');
      return;
    }

    setConsentData({
      ...consentData,
      staffWitnessName: formData.createdByName.trim() || 'Zihan',
    });
    setShowConsentModal(true);
  };

  const handleFinalSubmit = async () => {
    if (!consentData.clientSignature) {
      toast.error('Client signature is required');
      return;
    }

    setIsLoading(true);
    try {
      const job = await api.createJob({
        ...formData,
        consentForm: consentData,
      });
      toast.success('Job created successfully');
      navigate(`/admin/jobs/${job.id}`);
    } catch (error) {
      console.error('Failed to create job:', error);
      toast.error('Failed to create job');
    } finally {
      setIsLoading(false);
    }
  };

  const selectClient = (client: Client) => {
    setSelectedClient(client);
    setFormData({ ...formData, clientId: client.id });
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
      setConsentData(prev => ({ ...prev, clientSignature: canvas.toDataURL() }));
    }
  }, []);

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setConsentData(prev => ({ ...prev, clientSignature: '' }));
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="outline" size="icon" onClick={() => navigate('/admin/jobs')}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">New Service Job</h1>
          <p className="text-muted-foreground">Register a new device for cleaning service</p>
        </div>
      </div>

      <form onSubmit={handlePreSubmit} className="space-y-6">
        {/* Client Selection */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">1. Select Client</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {selectedClient ? (
              <div className="flex items-center justify-between p-4 rounded-lg bg-muted">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">{selectedClient.fullName}</p>
                    <p className="text-sm text-muted-foreground">{selectedClient.phone}</p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedClient(null);
                    setFormData({ ...formData, clientId: '' });
                  }}
                >
                  Change
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search existing clients..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
                
                <div className="max-h-48 overflow-y-auto space-y-2">
                  {clients.map((client) => (
                    <button
                      key={client.id}
                      type="button"
                      onClick={() => selectClient(client)}
                      className="w-full flex items-center gap-3 p-3 rounded-lg border hover:bg-accent transition-colors text-left"
                    >
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <User className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">{client.fullName}</p>
                        <p className="text-xs text-muted-foreground">{client.phone}</p>
                      </div>
                    </button>
                  ))}
                </div>

                <Dialog open={isClientDialogOpen} onOpenChange={setIsClientDialogOpen}>
                  <DialogTrigger asChild>
                    <Button type="button" variant="outline" className="w-full">
                      <Plus className="w-4 h-4 mr-2" />
                      Create New Client
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create New Client</DialogTitle>
                      <DialogDescription>
                        Add a new client to the system
                      </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleCreateClient} className="space-y-4">
                      <div className="space-y-2">
                        <Label>Full Name *</Label>
                        <Input
                          value={newClientData.fullName}
                          onChange={(e) => setNewClientData({ ...newClientData, fullName: e.target.value })}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Phone *</Label>
                        <Input
                          value={newClientData.phone}
                          onChange={(e) => setNewClientData({ ...newClientData, phone: e.target.value })}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Email</Label>
                        <Input
                          type="email"
                          value={newClientData.email}
                          onChange={(e) => setNewClientData({ ...newClientData, email: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Address</Label>
                        <Input
                          value={newClientData.address}
                          onChange={(e) => setNewClientData({ ...newClientData, address: e.target.value })}
                        />
                      </div>
                      <DialogFooter>
                        <Button type="submit">Create Client</Button>
                      </DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Job Creator */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">2. Job Creator</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="createdByName">Created By (optional)</Label>
              <Input
                id="createdByName"
                value={formData.createdByName}
                onChange={(e) => setFormData({ ...formData, createdByName: e.target.value })}
                placeholder="e.g., Zihan"
              />
              <p className="text-xs text-muted-foreground">Leave blank to default to "Zihan"</p>
            </div>
          </CardContent>
        </Card>

        {/* Device Information */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">3. Device Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="deviceType">Device Type *</Label>
                <Select
                  value={formData.deviceType}
                  onValueChange={(value: 'LAPTOP' | 'DESKTOP' | 'SMARTPHONE') =>
                    setFormData({ ...formData, deviceType: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LAPTOP">Laptop</SelectItem>
                    <SelectItem value="DESKTOP">Desktop</SelectItem>
                    <SelectItem value="SMARTPHONE">Smartphone</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="brand">Brand *</Label>
                <Input
                  id="brand"
                  value={formData.brand}
                  onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                  placeholder="e.g., Dell, HP, Lenovo, Apple, Samsung"
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="model">Model *</Label>
                <Input
                  id="model"
                  value={formData.model}
                  onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                  placeholder="e.g., XPS 15, ThinkPad T490, iPhone 15"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="serialNumber">Serial Number (optional)</Label>
                <Input
                  id="serialNumber"
                  value={formData.serialNumber}
                  onChange={(e) => setFormData({ ...formData, serialNumber: e.target.value })}
                  placeholder="Device serial number"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Job Dates */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">4. Job Dates</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="receivedAt">Received Date *</Label>
              <Input
                type="datetime-local"
                id="receivedAt"
                value={formData.receivedAt}
                onChange={(e) => setFormData({ ...formData, receivedAt: e.target.value })}
                required
              />
              <p className="text-xs text-muted-foreground">This date will be used for consent and checklist timestamps</p>
            </div>
          </CardContent>
        </Card>

        {/* Physical Condition */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">5. Physical Condition (BEFORE)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="scratches">Scratches / Cosmetic Issues</Label>
              <Textarea
                id="scratches"
                value={formData.scratches}
                onChange={(e) => setFormData({ ...formData, scratches: e.target.value })}
                placeholder="Describe any visible scratches, dents, or cosmetic damage..."
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="damageNotes">Damage Notes</Label>
              <Textarea
                id="damageNotes"
                value={formData.damageNotes}
                onChange={(e) => setFormData({ ...formData, damageNotes: e.target.value })}
                placeholder="Note any existing damage to the device..."
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reportedIssues">Issues Reported by Client</Label>
              <Textarea
                id="reportedIssues"
                value={formData.reportedIssues}
                onChange={(e) => setFormData({ ...formData, reportedIssues: e.target.value })}
                placeholder="Any issues the client mentioned (overheating, noise, etc.)..."
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Additional Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Any other relevant information..."
                rows={2}
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate('/admin/jobs')}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? 'Creating...' : 'Proceed to Consent'}
          </Button>
        </div>
      </form>

      {/* Consent Modal */}
      <Dialog open={showConsentModal} onOpenChange={setShowConsentModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Client Consent Form
            </DialogTitle>
            <DialogDescription>
              The client must sign this consent form before the job can be created.
              Consent timestamp will match the received date: {formData.receivedAt ? new Date(formData.receivedAt).toLocaleString() : 'Not set'}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
                <p>I confirm that I am handing over this device voluntarily for cleaning service.</p>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
                <p>I agree to allow the technician to disassemble and clean the device as needed.</p>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
                <p>I understand there is a minor risk of damage during the cleaning process.</p>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
                <p>I confirm the device condition has been accurately described.</p>
              </div>
            </div>

            <div className="border-t pt-4">
              <Label className="text-base font-medium">Client Digital Signature *</Label>
              <p className="text-sm text-muted-foreground mb-3">Please sign below</p>
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
              <Label>Staff Witness Name</Label>
              <Input 
                value={consentData.staffWitnessName}
                onChange={(e) => setConsentData({ ...consentData, staffWitnessName: e.target.value })}
                placeholder="Staff member name" 
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConsentModal(false)}>
              Back to Form
            </Button>
            <Button onClick={handleFinalSubmit} disabled={!consentData.clientSignature || isLoading}>
              {isLoading ? 'Creating...' : 'Create Job'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}