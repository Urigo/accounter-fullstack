import { config } from 'dotenv';
import pg from 'pg';

config({ path: ['.env', '../../.env'] });

const { Client } = pg;

async function main() {
  const auth0UserId = process.env['AUTH0_USER_ID'];
  const note = process.env['NOTE'] ?? null;

  if (!auth0UserId) {
    console.error('❌ AUTH0_USER_ID env var is required');
    console.error(
      '   Usage: AUTH0_USER_ID=auth0|xxx yarn workspace @accounter/server seed:super-admin',
    );
    process.exit(1);
  }

  const client = new Client({
    user: process.env['POSTGRES_USER'] ?? 'postgres',
    password: process.env['POSTGRES_PASSWORD'] ?? 'postgres',
    host: process.env['POSTGRES_HOST'] ?? 'localhost',
    port: parseInt(process.env['POSTGRES_PORT'] ?? '5432', 10),
    database: process.env['POSTGRES_DB'] ?? 'accounter',
    ssl: process.env['POSTGRES_SSL'] === '1',
  });

  await client.connect();

  try {
    await client.query(
      `INSERT INTO accounter_schema.super_admins (auth0_user_id, note)
       VALUES ($1, $2)
       ON CONFLICT (auth0_user_id) DO NOTHING`,
      [auth0UserId, note],
    );
    console.log(`✅ Super admin seeded: ${auth0UserId}`);
  } finally {
    await client.end();
  }
}

main().catch(err => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
