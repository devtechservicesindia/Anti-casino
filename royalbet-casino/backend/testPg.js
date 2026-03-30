// backend/testPg.js
import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Client } = pg;
const connectionString = process.env.DATABASE_URL;

async function test() {
  console.log('Testing PG direct connection...');
  const client = new Client({ connectionString });
  try {
    await client.connect();
    console.log('PG Success!');
    const res = await client.query('SELECT NOW()');
    console.log('Time:', res.rows[0]);
    await client.end();
  } catch (err) {
    console.error('PG Failed:', err.message);
    process.exit(1);
  }
}
test();
