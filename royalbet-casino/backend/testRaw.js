// backend/testRaw.js
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
dotenv.config();
const prisma = new PrismaClient();
async function main() {
  console.log('Testing raw connection...');
  const res = await prisma.$queryRaw`SELECT 1`;
  console.log('Success! Res:', res);
}
main().catch(e => { console.error('Raw failed:', e); process.exit(1); }).finally(() => prisma.$disconnect());
