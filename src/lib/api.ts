import axios from 'axios';
import type { AxiosInstance, AxiosError } from 'axios';

const API_BASE_URL = 'https://nexgencare-manager.onrender.com';
  
class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: `${API_BASE_URL}/api`,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor to add auth token
    this.client.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem('token');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor to handle errors
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        if (error.response?.status === 401) {
          console.warn('Auth required for this action');
        }
        return Promise.reject(error);
      }
    );
  }

  // Auth
  async login(email: string, password: string) {
    const response = await this.client.post('/auth/login', { email, password });
    return response.data;
  }

  async getMe() {
    const response = await this.client.get('/auth/me');
    return response.data;
  }

  // Clients
  async getClients(search?: string) {
    const response = await this.client.get('/clients', {
      params: { search },
    });
    return response.data;
  }

  async getClient(id: string) {
    const response = await this.client.get(`/clients/${id}`);
    return response.data;
  }

  async createClient(data: {
    fullName: string;
    phone: string;
    email?: string;
    address?: string;
  }) {
    const response = await this.client.post('/clients', data);
    return response.data;
  }

  async updateClient(
    id: string,
    data: {
      fullName: string;
      phone: string;
      email?: string;
      address?: string;
    }
  ) {
    const response = await this.client.put(`/clients/${id}`, data);
    return response.data;
  }

  async deleteClient(id: string) {
    const response = await this.client.delete(`/clients/${id}`);
    return response.data;
  }

  // Jobs
  async getJobs(params?: { status?: string; search?: string; clientId?: string }) {
    const response = await this.client.get('/jobs', { params });
    return response.data;
  }

  async getJobStats() {
    const response = await this.client.get('/jobs/stats/overview');
    return response.data;
  }

  async getJob(id: string) {
    const response = await this.client.get(`/jobs/${id}`);
    return response.data;
  }

  async createJob(data: {
    clientId: string;
    brand: string;
    model: string;
    serialNumber?: string;
    deviceType: 'LAPTOP' | 'DESKTOP' | 'SMARTPHONE';
    scratches?: string;
    damageNotes?: string;
    reportedIssues?: string;
    notes?: string;
    receivedAt?: string;
    createdByName?: string;
    consentForm?: {
      voluntaryHandover?: boolean;
      allowCleaning?: boolean;
      acknowledgeRisk?: boolean;
      confirmCondition?: boolean;
      clientSignature: string;
      staffWitnessName?: string;
    };
  }) {
    const response = await this.client.post('/jobs', data);
    return response.data;
  }

  async updateJobStatus(id: string, status: string) {
    const response = await this.client.patch(`/jobs/${id}/status`, { status });
    return response.data;
  }

  async updateJob(id: string, data: {
    jobId?: string;
    brand?: string;
    model?: string;
    serialNumber?: string;
    deviceType?: 'LAPTOP' | 'DESKTOP' | 'SMARTPHONE';
    scratches?: string;
    damageNotes?: string;
    reportedIssues?: string;
    notes?: string;
    status?: string;
    receivedAt?: string;
  }) {
    const response = await this.client.put(`/jobs/${id}`, data);
    return response.data;
  }

  async deleteJob(id: string) {
    const response = await this.client.delete(`/jobs/${id}`);
    return response.data;
  }

  // Checklist
  async toggleChecklistItem(id: string, notes?: string) {
    const response = await this.client.patch(`/checklist/${id}/toggle`, { notes });
    return response.data;
  }

  // Media
  async uploadMedia(data: {
    jobId: string;
    type: 'IMAGE' | 'VIDEO';
    category: 'BEFORE' | 'DURING' | 'AFTER';
    fileData: string;
    filename: string;
    mimeType: string;
  }) {
    const response = await this.client.post('/media', data);
    return response.data;
  }

  async deleteMedia(id: string) {
    const response = await this.client.delete(`/media/${id}`);
    return response.data;
  }

  // Consent
  async saveConsentForm(data: {
    jobId: string;
    voluntaryHandover: boolean;
    allowCleaning: boolean;
    acknowledgeRisk: boolean;
    confirmCondition: boolean;
    clientSignature?: string;
    staffWitnessName: string;
  }) {
    const response = await this.client.post('/consent-forms', data);
    return response.data;
  }

  // Handover
  async saveHandoverRecord(data: {
    jobId: string;
    clientSignature?: string;
    paymentStatus: 'UNPAID' | 'PARTIAL' | 'PAID';
    paymentAmount?: number | null;
    paymentNotes?: string;
    finalCondition?: string;
    completedAt?: string | null;
  }) {
    const response = await this.client.post('/handover-records', data);
    return response.data;
  }

  async completeHandover(id: string, completedAt?: string) {
    const response = await this.client.patch(`/handover-records/${id}/complete`, { completedAt });
    return response.data;
  }

  // Public
  async publicJobSearch(q: string) {
    const response = await this.client.get('/public/jobs/search', { params: { q } });
    return response.data;
  }
}

export const api = new ApiClient();