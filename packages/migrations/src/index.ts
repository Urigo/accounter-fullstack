#!/usr/bin/env node
import { createPool } from 'slonik';
import { createConnectionString } from './connection-string.js';
import { env } from './environment.js';
import { runPGMigrations } from './run-pg-migrations.js';

async function migrations() {
  const slonik = await createPool(createConnectionString(env.postgres), {
    // 10 minute timeout per statement
    statementTimeout: 10 * 60 * 1000,
  });

  // This is used by production build of this package.
  // We are building a "cli" out of the package, so we need a workaround to pass the command to run.

  console.log('Running the UP migrations');

  try {
    await runPGMigrations({ slonik });
    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

migrations();
