import type { Pool } from 'pg';
import { connectTestDb, closeTestDb } from './db-connection.js';
import { runMigrationsIfNeeded, LATEST_MIGRATION_NAME } from './db-migrations.js';
import { seedAdminOnce } from './db-fixtures.js';
import { withTestTransaction } from './test-transaction.js';

export class TestDatabase {
  private pool: Pool | null = null;

  async connect(): Promise<Pool> {
    this.pool = await connectTestDb();
    return this.pool;
  }

  getPool(): Pool {
    if (!this.pool) throw new Error('TestDatabase not connected');
    return this.pool;
  }

  async ensureLatestSchema(): Promise<void> {
    if (!this.pool) await this.connect();
    await runMigrationsIfNeeded(this.getPool());
  }

  async seedAdmin(): Promise<void> {
    if (!this.pool) await this.connect();
    await seedAdminOnce(this.getPool());
  }

  async withTransaction<T>(fn: Parameters<typeof withTestTransaction<T>>[1]) {
    if (!this.pool) await this.connect();
    return withTestTransaction(this.getPool(), fn);
  }

  async close(): Promise<void> {
    await closeTestDb();
    this.pool = null;
  }
}

export { LATEST_MIGRATION_NAME };
