import { beforeAll, describe, expect, it } from 'vitest';
import migration from '../actions/2026-06-22T10-00-00.add-email-ingestion-grant-business-id.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function captureSql(strings: TemplateStringsArray): unknown {
  return strings.join('');
}

function getMigrationSql(): string {
  const result = migration.run({
    sql: captureSql as Parameters<typeof migration.run>[0]['sql'],
    connection: null as never,
  });
  return result as unknown as string;
}

// ---------------------------------------------------------------------------
// Module structure
// ---------------------------------------------------------------------------

describe('migration module structure', () => {
  it('exports the correct name', () => {
    expect(migration.name).toBe('2026-06-22T10-00-00.add-email-ingestion-grant-business-id.sql');
  });

  it('exports a run function', () => {
    expect(typeof migration.run).toBe('function');
  });
});

// ---------------------------------------------------------------------------
// Schema validation
// ---------------------------------------------------------------------------

describe('grant business_id DDL', () => {
  let ddl: string;

  beforeAll(() => {
    ddl = getMigrationSql();
  });

  it('alters the email_ingestion_grants table', () => {
    expect(ddl).toMatch(/ALTER TABLE/i);
    expect(ddl).toMatch(/email_ingestion_grants/);
  });

  it('adds a nullable business_id column idempotently', () => {
    expect(ddl).toMatch(/ADD COLUMN IF NOT EXISTS\s+business_id\s+UUID/i);
    // Nullable: no NOT NULL on the column definition.
    const columnLine = ddl.match(/business_id[^\n;]+/i)?.[0] ?? '';
    expect(columnLine).not.toMatch(/NOT NULL/i);
  });

  it('references businesses with ON DELETE SET NULL (grants survive business deletion)', () => {
    expect(ddl).toMatch(/REFERENCES\s+accounter_schema\.businesses\(id\)/i);
    expect(ddl).toMatch(/ON DELETE SET NULL/i);
  });
});
