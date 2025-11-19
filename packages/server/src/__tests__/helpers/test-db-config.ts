import type { PoolConfig } from 'pg';
import { config } from 'dotenv';

// Load environment variables
config();

/**
 * Shared database configuration for test environments
 * Uses environment variables with sensible defaults for local development
 */
export const testDbConfig: PoolConfig = {
  user: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || 'postgres',
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
  database: process.env.POSTGRES_DB || 'accounter',
  ssl: process.env.POSTGRES_SSL === '1',
};

/**
 * Database schema name for queries
 * Allows tests to run in isolated schemas if needed
 */
export const testDbSchema = process.env.POSTGRES_SCHEMA || 'accounter_schema';

/**
 * Helper to build fully-qualified table name
 * @param tableName - Unqualified table name
 * @returns Fully qualified table name with schema prefix
 */
export function qualifyTable(tableName: string): string {
  return `${testDbSchema}.${tableName}`;
}
