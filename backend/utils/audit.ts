import { prisma } from './prisma';

export async function logAction(
  action: string,
  entityType: string,
  entityId: string,
  userId?: string,
  jobId?: string,
  details?: Record<string, any>
) {
  try {
    await prisma.auditLog.create({
      data: {
        action,
        entityType,
        entityId,
        userId,
        jobId,
        details: details ? JSON.stringify(details) : null,
      },
    });
  } catch (error) {
    console.error('Failed to log action:', error);
  }
}
