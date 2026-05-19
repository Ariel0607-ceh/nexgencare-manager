import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'dfntweep9',
  api_key: process.env.CLOUDINARY_API_KEY || '957248347786364',
  api_secret: process.env.CLOUDINARY_API_SECRET || 'rIxBQPFucbTqOiWuF5q05gV93GY',
});

export { cloudinary };
