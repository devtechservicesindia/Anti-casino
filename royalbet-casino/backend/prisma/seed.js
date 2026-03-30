/**
 * RoyalBet Casino – Prisma Seed Script
 *
 * Populates:
 *   - 5 TokenPackages
 *   - 8 Achievements
 *   - 1 Admin user (admin@royalbet.in)
 *
 * Run: npx prisma db seed
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

// ── Token Packages ────────────────────────────────────────────────────────────
const TOKEN_PACKAGES = [
  {
    name: 'Starter',
    tokenAmount: 1000,
    priceInr: '99.00',
    bonusTokens: 0,
    isActive: true,
    displayOrder: 1,
  },
  {
    name: 'Popular',
    tokenAmount: 5500,
    priceInr: '499.00',
    bonusTokens: 500,
    isActive: true,
    displayOrder: 2,
  },
  {
    name: 'Value',
    tokenAmount: 12000,
    priceInr: '999.00',
    bonusTokens: 1500,
    isActive: true,
    displayOrder: 3,
  },
  {
    name: 'Mega',
    tokenAmount: 30000,
    priceInr: '2499.00',
    bonusTokens: 5000,
    isActive: true,
    displayOrder: 4,
  },
  {
    name: 'VIP',
    tokenAmount: 100000,
    priceInr: '7999.00',
    bonusTokens: 20000,
    isActive: true,
    displayOrder: 5,
  },
];

// ── Achievements ──────────────────────────────────────────────────────────────
const ACHIEVEMENTS = [
  {
    name: 'FirstSpin',
    description: 'Play your very first slot spin.',
    icon: '🎰',
    conditionType: 'SLOTS_SPINS',
    conditionValue: 1,
  },
  {
    name: 'HighRoller',
    description: 'Place a single bet of 10,000 tokens or more.',
    icon: '💰',
    conditionType: 'SINGLE_BET',
    conditionValue: 10000,
  },
  {
    name: 'BigWin',
    description: 'Win 50,000 tokens in a single game session.',
    icon: '🏆',
    conditionType: 'SINGLE_WIN',
    conditionValue: 50000,
  },
  {
    name: 'Streak7',
    description: 'Claim your daily bonus 7 days in a row.',
    icon: '🔥',
    conditionType: 'DAILY_STREAK',
    conditionValue: 7,
  },
  {
    name: 'PokerWin',
    description: 'Win 10 poker hands.',
    icon: '♠️',
    conditionType: 'POKER_WINS',
    conditionValue: 10,
  },
  {
    name: 'DiamondHit',
    description: 'Hit the Diamond jackpot on Slots.',
    icon: '💎',
    conditionType: 'SLOTS_JACKPOT',
    conditionValue: 1,
  },
  {
    name: 'Century',
    description: 'Play 100 game sessions total.',
    icon: '💯',
    conditionType: 'TOTAL_SESSIONS',
    conditionValue: 100,
  },
  {
    name: 'ReferKing',
    description: 'Successfully refer 5 friends.',
    icon: '👑',
    conditionType: 'REFERRALS',
    conditionValue: 5,
  },
];

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('🌱 Starting database seed...\n');

  /*
  // ── 1. Token Packages ──────────────────────────────────────────────────────
  console.log('📦 Seeding TokenPackages...');
  for (const pkg of TOKEN_PACKAGES) {
    await prisma.tokenPackage.upsert({
      where: { id: `pkg_${pkg.name.toLowerCase()}` },
      update: pkg,
      create: {
        id: `pkg_${pkg.name.toLowerCase()}`,
        ...pkg,
      },
    });
  }
  console.log(`   ✓ ${TOKEN_PACKAGES.length} token packages seeded.\n`);

  // ── 2. Achievements ────────────────────────────────────────────────────────
  console.log('🏅 Seeding Achievements...');
  for (const ach of ACHIEVEMENTS) {
    await prisma.achievement.upsert({
      where: { name: ach.name },
      update: ach,
      create: ach,
    });
  }
  console.log(`   ✓ ${ ACHIEVEMENTS.length } achievements seeded.\n`);
  */

  // ── 3. Admin User ──────────────────────────────────────────────────────────
  console.log('👤 Seeding Admin user...');
  const adminEmail = 'yvcasino@gmail.com';
  const adminPasswordHash = await bcrypt.hash('yv@123admin', 12);

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      role: 'ADMIN',
      name: 'RoyalBet Admin',
    },
    create: {
      email: adminEmail,
      name: 'RoyalBet Admin',
      passwordHash: adminPasswordHash,
      role: 'ADMIN',
      isBanned: false,
      wallet: {
        create: {
          balance: '999999',
          totalPurchased: '0',
          totalSpent: '0',
        },
      },
    },
    include: { wallet: true },
  });

  // Ensure wallet exists if admin was already in DB without one
  if (!admin.wallet) {
    await prisma.wallet.upsert({
      where: { userId: admin.id },
      update: {},
      create: {
        userId: admin.id,
        balance: '999999',
        totalPurchased: '0',
        totalSpent: '0',
      },
    });
  }

  console.log(`   ✓ Admin seeded: ${adminEmail}`);
  console.log(`   ⚠  Default password is "Admin@RoyalBet2025!" — change it immediately!\n`);

  console.log('✅ Seed complete.');
}

main()
  .catch((err) => {
    console.error('❌ Seed failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
