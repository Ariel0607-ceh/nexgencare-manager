export interface User {
  id: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'CLIENT';
}

export interface Client {
  id: string;
  fullName: string;
  phone: string;
  email?: string;
  address?: string;
  createdAt: string;
  updatedAt: string;
  _count?: {
    jobs: number;
  };
  jobs?: Job[];
}

export interface Device {
  id: string;
  brand: string;
  model: string;
  serialNumber?: string;
  deviceType: 'LAPTOP' | 'DESKTOP';
  createdAt: string;
  updatedAt: string;
}

export type JobStatus = 'RECEIVED' | 'IN_PROGRESS' | 'CLEANING_COMPLETED' | 'READY_FOR_PICKUP' | 'COMPLETED' | 'CANCELLED';

export interface Job {
  id: string;
  jobId: string;
  clientId: string;
  deviceId: string;
  status: JobStatus;
  receivedAt: string;
  completedAt?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  createdById: string;
  assignedToId?: string;
  scratches?: string;
  damageNotes?: string;
  reportedIssues?: string;
  client?: Client;
  device?: Device;
  assignedTo?: Pick<User, 'id' | 'name'>;
  createdBy?: Pick<User, 'id' | 'name'>;
  checklist?: ChecklistItem[];
  mediaFiles?: MediaFile[];
  consentForm?: ConsentForm;
  handoverRecord?: HandoverRecord;
  auditLogs?: AuditLog[];
  _count?: {
    checklist: number;
    mediaFiles: number;
  };
}

export interface ChecklistItem {
  id: string;
  jobId: string;
  title: string;
  description?: string;
  completed: boolean;
  notes?: string;
  completedAt?: string;
  completedBy?: string;
  createdAt: string;
  updatedAt: string;
  user?: Pick<User, 'name'>;
}

export type MediaType = 'IMAGE' | 'VIDEO';
export type MediaCategory = 'BEFORE' | 'DURING' | 'AFTER';

export interface MediaFile {
  id: string;
  jobId: string;
  type: MediaType;
  category: MediaCategory;
  url: string;
  publicId: string;
  filename: string;
  mimeType: string;
  size: number;
  uploadedBy: string;
  createdAt: string;
  user?: Pick<User, 'name'>;
}

export interface ConsentForm {
  id: string;
  jobId: string;
  voluntaryHandover: boolean;
  allowCleaning: boolean;
  acknowledgeRisk: boolean;
  confirmCondition: boolean;
  clientSignature?: string;
  clientSignedAt?: string;
  staffWitnessName: string;
  staffWitnessSignature?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  user?: Pick<User, 'name'>;
}

export type PaymentStatus = 'UNPAID' | 'PARTIAL' | 'PAID';

export interface HandoverRecord {
  id: string;
  jobId: string;
  finalCondition?: string;
  clientSignature?: string;
  clientSignedAt?: string;
  staffSignature?: string;
  staffSignedAt?: string;
  paymentStatus: PaymentStatus;
  paymentAmount?: number;
  paymentNotes?: string;
  finalPhotos: string[];
  createdAt: string;
  updatedAt: string;
}

export interface AuditLog {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  jobId?: string;
  userId?: string;
  details?: string;
  ipAddress?: string;
  createdAt: string;
  user?: Pick<User, 'name'>;
  job?: Pick<Job, 'jobId'>;
}

export interface JobStats {
  total: number;
  received: number;
  inProgress: number;
  cleaningCompleted: number;
  readyForPickup: number;
  completed: number;
  today: number;
  pending: number;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface CreateClientData {
  fullName: string;
  phone: string;
  email?: string;
  address?: string;
}

export interface CreateJobData {
  clientId: string;
  brand: string;
  model: string;
  serialNumber?: string;
  deviceType: 'LAPTOP' | 'DESKTOP';
  scratches?: string;
  damageNotes?: string;
  reportedIssues?: string;
  notes?: string;
}

export interface MediaUploadData {
  jobId: string;
  type: MediaType;
  category: MediaCategory;
  fileData: string;
  filename: string;
  mimeType: string;
}
