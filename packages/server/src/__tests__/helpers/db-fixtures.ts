import type { Pool } from 'pg';
import { seedAdminCore } from '../../../scripts/seed-admin-context.js';
import { emitMetrics } from './diagnostics.js';
import { TestDbSeedError } from './errors.js';

let adminSeeded = false;
let seedInFlight: Promise<void> | null = null;

export async function seedAdminOnce(pgPool: Pool): Promise<void> {
  if (adminSeeded) return;
  if (seedInFlight) return seedInFlight;

  const doSeed = async () => {
    const client = await pgPool.connect();
    try {
      emitMetrics('seeding-start', pgPool);
      await seedAdminCore(client);
      emitMetrics('seeding-complete', pgPool);
      adminSeeded = true;
    } catch (err) {
      throw new TestDbSeedError('Failed to seed admin context', err);
    } finally {
      client.release();
      seedInFlight = null;
    }
  };

  seedInFlight = doSeed();
  return seedInFlight;
}

export function resetSeedFlag() {
  adminSeeded = false;
  seedInFlight = null;
}
