import { prisma } from './utils/prisma';
import bcrypt from 'bcryptjs';

async function seed() {
  console.log('Seeding database...');

  // Create default admin user
  const adminExists = await prisma.user.findUnique({
    where: { email: 'admin@nexgencare.com' },
  });

  if (!adminExists) {
    const hashedPassword = await bcrypt.hash('admin123', 10);
    const admin = await prisma.user.create({
      data: {
        email: 'admin@nexgencare.com',
        password: hashedPassword,
        name: 'System Admin',
        role: 'ADMIN',
      },
    });
    console.log('Created admin user:', admin.email);
  } else {
    console.log('Admin user already exists');
  }

  // Create sample clients
  const sampleClients = [
    { fullName: 'John Smith', phone: '+1-555-0101', email: 'john@example.com', address: '123 Main St, New York' },
    { fullName: 'Sarah Johnson', phone: '+1-555-0102', email: 'sarah@example.com', address: '456 Oak Ave, Los Angeles' },
    { fullName: 'Michael Brown', phone: '+1-555-0103', email: 'michael@example.com' },
    { fullName: 'Emily Davis', phone: '+1-555-0104', address: '789 Pine Rd, Chicago' },
    { fullName: 'David Wilson', phone: '+1-555-0105', email: 'david@example.com' },
  ];

  for (const clientData of sampleClients) {
    const existing = await prisma.client.findFirst({
      where: { phone: clientData.phone },
    });

    if (!existing) {
      await prisma.client.create({
        data: clientData,
      });
      console.log('Created client:', clientData.fullName);
    }
  }

  console.log('Seed completed!');
}

seed()
  .catch((error) => {
    console.error('Seed error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
