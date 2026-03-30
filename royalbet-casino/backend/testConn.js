// backend/testConn.js
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
dotenv.config();
const prisma = new PrismaClient();
async function main() {
  console.log('Testing connection...');
  const user = await prisma.user.findFirst();
  console.log('Success! Found user:', user ? user.email : 'None');
}
main().catch(e => { console.error('Connection failed:', e); process.exit(1); }).finally(() => prisma.$disconnect());
