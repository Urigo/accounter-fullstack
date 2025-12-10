#!/usr/bin/env node
/**
 * CI Migration Verification Script
 *
 * Checks that the latest migration has been applied to the database.
 * Exits with code 1 if migrations are stale.
 *
 * Usage:
 *   node --import ./scripts/register-esm.js ./scripts/verify-migrations.ts
 */
import { Client } from 'pg';
import { checkLatestMigration } from '../packages/server/src/__tests__/helpers/migration-verification.js';

const schema = process.env.POSTGRES_SCHEMA || 'accounter_schema';

async function main() {
  const client = new Client({
    host: process.env.POSTGRES_HOST,
    port: Number(process.env.POSTGRES_PORT),
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    database: process.env.POSTGRES_DB,
  });

  try {
    await client.connect();
    const result = await checkLatestMigration(client, schema);

    if (!result.isLatest) {
      console.error('❌ Latest migration NOT applied:', result.latestMigrationName);
      console.error('   Error:', result.errorMessage);
      process.exit(1);
    }

    console.log('✅ Latest migration verified:', result.latestMigrationName);
  } catch (error) {
    console.error('❌ Migration verification failed:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
