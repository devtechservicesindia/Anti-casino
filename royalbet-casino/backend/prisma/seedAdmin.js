/**
 * backend/prisma/seedAdmin.js
 * Creates or updates the specific admin user requested by the user.
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function main() {
  const email = 'yvcasino@gmail.com';
  const password = 'yv@123admin';
  const rounds = 12;

  console.log(`🌱 Seeding admin: ${email}...`);

  const passwordHash = await bcrypt.hash(password, rounds);

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      passwordHash,
      role: 'ADMIN',
      isBanned: false,
    },
    create: {
      email,
      name: 'YV Casino Admin',
      passwordHash,
      role: 'ADMIN',
      isBanned: false,
      wallet: {
        create: {
          balance: 10000,
          totalPurchased: 0,
          totalSpent: 0,
        },
      },
    },
    include: { wallet: true },
  });

  // Ensure wallet exists if user was already in DB without one
  if (!user.wallet) {
    await prisma.wallet.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
        balance: 10000,
        totalPurchased: 0,
        totalSpent: 0,
      },
    });
  }

  console.log(`✅ Admin seeded successfully: ${email}`);
}

main()
  .catch((e) => {
    console.error('❌ Error seeding admin:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
