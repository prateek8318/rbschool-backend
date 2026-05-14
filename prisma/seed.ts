import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('123456', 10);
  
  const admin = await prisma.authUser.upsert({
    where: { userId: 'admin_1' },
    update: {},
    create: {
      userId: 'admin_1',
      schoolId: 'school_1',
      role: 'admin',
      passwordHash: passwordHash,
      isActive: true,
    },
  });

  console.log('Seed completed: Admin user created');
  console.log('Email: admin@gmail.com (Logic handles this email as admin)');
  console.log('Password: 123456');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
