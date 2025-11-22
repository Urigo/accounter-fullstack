export { connectTestDb, closeTestDb } from './db-connection.js';
export { runMigrationsIfNeeded, LATEST_MIGRATION_NAME } from './db-migrations.js';
export { seedAdminOnce } from './db-fixtures.js';
export { withTestTransaction, withConcurrentTransactions } from './test-transaction.js';
export { isPoolHealthy, debugLog, emitMetrics } from './diagnostics.js';
export { TestDbConnectionError, TestDbMigrationError, TestDbSeedError } from './errors.js';
export { TestDatabase } from './test-database.js';

// Backward-compatible no-op reset (seed flag lives in db-fixtures now)
export function resetSetupFlags(): void {}
