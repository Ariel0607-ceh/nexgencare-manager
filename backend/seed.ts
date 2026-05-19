import { prisma } from './utils/prisma';
import bcrypt from 'bcryptjs';

async function seed() {
  const hashed = await bcrypt.hash('123456', 10);
  
  const user = await prisma.user.upsert({
    where: { email: 'zihan@gmail.com' },
    update: {},
    create: {
      email: 'zihan@gmail.com',
      password: hashed,
      name: 'zihan',
      role: 'ADMIN',
    },
  });
  
  console.log('Admin created:', user.email);
}

seed()
  .catch((err) => {
    console.error('Seed error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });