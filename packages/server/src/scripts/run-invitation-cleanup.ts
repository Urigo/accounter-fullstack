import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { env } from '../environment.js';
import { cleanupExpiredInvitations, type Logger } from '../jobs/cleanup-expired-invitations.js';
import { DBProvider } from '../modules/app-providers/db.provider.js';
import { Auth0ManagementProvider } from '../modules/auth/providers/auth0-management.provider.js';

const { Pool } = pg;

const logger: Logger = {
  info: (message, meta) => {
    if (meta !== undefined) {
      console.log(message, meta);
      return;
    }
    console.log(message);
  },
  error: (message, meta) => {
    if (meta !== undefined) {
      console.error(message, meta);
      return;
    }
    console.error(message);
  },
};

async function runCleanup(): Promise<void> {
  if (!env.auth0) {
    logger.info('Auth0 is not configured. Skipping invitation cleanup.');
    return;
  }

  const pool = new Pool({
    user: env.postgres.user,
    password: env.postgres.password,
    host: env.postgres.host,
    port: Number(env.postgres.port),
    database: env.postgres.db,
    ssl: env.postgres.ssl ? { rejectUnauthorized: false } : false,
    max: Math.min(env.postgres.max, 10),
  });

  const db = new DBProvider(pool);
  const auth0 = new Auth0ManagementProvider(env);

  try {
    const result = await cleanupExpiredInvitations(db, auth0, logger);
    logger.info('Invitation cleanup complete', result);
  } finally {
    await db.shutdown();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runCleanup().catch(err => {
    logger.error('Failed to run invitation cleanup script', { err });
    process.exit(1);
  });
}
