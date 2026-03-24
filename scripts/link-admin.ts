/**
 * Links an Auth0 user to the admin business as business_owner.
 * Run this once after a fresh DB seed for each admin user.
 *
 * Usage:
 *   yarn link-admin <auth0-user-id> <email>
 *
 * Example:
 *   yarn link-admin "auth0|69b88e5090b9219b04ac358a" "owner@example.com"
 */
import { config } from 'dotenv';
import pg from 'pg';

config();

const [auth0UserId, email] = process.argv.slice(2);

if (!auth0UserId || !email) {
  console.error('Usage: yarn link-admin <auth0-user-id> <email>');
  process.exit(1);
}

const businessId = process.env.DEFAULT_FINANCIAL_ENTITY_ID;
if (!businessId) {
  console.error('DEFAULT_FINANCIAL_ENTITY_ID is not set in .env. Run yarn seed first.');
  process.exit(1);
}

async function run() {
  const client = new pg.Client({
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    host: process.env.POSTGRES_HOST,
    port: parseInt(process.env.POSTGRES_PORT || '5432'),
    database: process.env.POSTGRES_DB,
    ssl: process.env.POSTGRES_SSL === '1',
  });

  await client.connect();

  try {
    const userResult = await client.query<{ user_id: string }>(
      `INSERT INTO accounter_schema.business_users (user_id, auth0_user_id, business_id, role_id)
       VALUES (gen_random_uuid(), $1, $2, 'business_owner')
       ON CONFLICT DO NOTHING
       RETURNING user_id`,
      [auth0UserId, businessId],
    );

    let userId: string;
    if (userResult.rows.length > 0) {
      userId = userResult.rows[0].user_id;
      console.log(`Created business_users row: ${userId}`);
    } else {
      const existing = await client.query<{ user_id: string }>(
        `SELECT user_id FROM accounter_schema.business_users
         WHERE auth0_user_id = $1 AND business_id = $2`,
        [auth0UserId, businessId],
      );
      userId = existing.rows[0].user_id;
      console.log(`business_users row already exists: ${userId}`);
    }

    await client.query(
      `INSERT INTO accounter_schema.invitations
         (business_id, email, role_id, user_id, accepted_at, token_hash, expires_at)
       VALUES ($1, $2, 'business_owner', $3, NOW(), 'setup', NOW() + INTERVAL '10 years')
       ON CONFLICT DO NOTHING`,
      [businessId, email, userId],
    );

    console.log(`Auth0 user ${auth0UserId} linked to business ${businessId} as business_owner`);
  } finally {
    await client.end();
  }
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
