import { Router } from 'express';
import { prisma } from '../utils/prisma';
import { cloudinary } from '../utils/cloudinary';
import { authenticate } from '../middleware/auth';
import type { AuthRequest } from '../middleware/auth';
import { logAction } from '../utils/audit';

const router = Router();

// Get media files for a job
router.get('/job/:jobId', authenticate, async (req: AuthRequest, res) => {
  try {
    const jobId = req.params.jobId as string;
    const { category } = req.query;

    const where: any = { jobId };
    if (category) {
      where.category = category;
    }

    const mediaFiles = await prisma.mediaFile.findMany({
      where,
      include: {
        user: {
          select: {
            name: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(mediaFiles);
  } catch (error) {
    console.error('Get media error:', error);
    res.status(500).json({ error: 'Failed to fetch media files' });
  }
});

// Upload media file
router.post('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const { jobId, type, category, fileData, filename, mimeType } = req.body;

    if (!fileData || !jobId || !type || !category) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Upload to Cloudinary
    const uploadResult = await cloudinary.uploader.upload(fileData, {
      folder: `nexgen-care/${jobId}/${category.toLowerCase()}`,
      resource_type: type === 'VIDEO' ? 'video' : 'image',
      public_id: `${Date.now()}_${filename?.replace(/\.[^/.]+$/, '') || 'media'}`,
    });

    // Save to database
    const mediaFile = await prisma.mediaFile.create({
      data: {
        jobId,
        type: type as 'IMAGE' | 'VIDEO',
        category: category as 'BEFORE' | 'DURING' | 'AFTER',
        url: uploadResult.secure_url,
        publicId: uploadResult.public_id,
        filename: filename || 'unknown',
        mimeType: mimeType || (type === 'VIDEO' ? 'video/mp4' : 'image/jpeg'),
        size: uploadResult.bytes || 0,
        uploadedBy: req.user!.userId,
      },
      include: {
        user: {
          select: {
            name: true,
          },
        },
      },
    });

    await logAction('MEDIA_UPLOADED', 'MediaFile', mediaFile.id, req.user?.userId, jobId, {
      type,
      category,
      filename,
    });

    res.status(201).json(mediaFile);
  } catch (error) {
    console.error('Upload media error:', error);
    res.status(500).json({ error: 'Failed to upload media file' });
  }
});

// Delete media file
router.delete('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const id = req.params.id as string;

    const mediaFile = await prisma.mediaFile.findUnique({
      where: { id },
    });

    if (!mediaFile) {
      return res.status(404).json({ error: 'Media file not found' });
    }

    // Delete from Cloudinary
    try {
      await cloudinary.uploader.destroy(mediaFile.publicId, {
        resource_type: mediaFile.type === 'VIDEO' ? 'video' : 'image',
      });
    } catch (cloudinaryError) {
      console.error('Cloudinary delete error:', cloudinaryError);
    }

    // Delete from database
    await prisma.mediaFile.delete({
      where: { id },
    });

    await logAction('MEDIA_DELETED', 'MediaFile', id, req.user?.userId, mediaFile.jobId);

    res.json({ message: 'Media file deleted' });
  } catch (error) {
    console.error('Delete media error:', error);
    res.status(500).json({ error: 'Failed to delete media file' });
  }
});

export default router;
