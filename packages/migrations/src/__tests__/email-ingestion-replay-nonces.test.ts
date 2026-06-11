import { beforeAll, describe, expect, it } from 'vitest';
import migration from '../actions/2026-06-10T12-00-00.add-email-ingestion-replay-nonces.js';

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
    expect(migration.name).toBe('2026-06-10T12-00-00.add-email-ingestion-replay-nonces.sql');
  });

  it('exports a run function', () => {
    expect(typeof migration.run).toBe('function');
  });
});

// ---------------------------------------------------------------------------
// Schema validation
// ---------------------------------------------------------------------------

describe('replay nonces table DDL', () => {
  let ddl: string;

  beforeAll(() => {
    ddl = getMigrationSql();
  });

  it('creates the email_ingestion_replay_nonces table', () => {
    expect(ddl).toMatch(/CREATE TABLE/i);
    expect(ddl).toMatch(/email_ingestion_replay_nonces/);
  });

  it('includes a nonce column', () => {
    expect(ddl).toMatch(/\bnonce\b/);
  });

  it('includes an expires_at column for window-based uniqueness', () => {
    expect(ddl).toMatch(/\bexpires_at\b/);
  });

  it('includes a created_at column', () => {
    expect(ddl).toMatch(/\bcreated_at\b/);
  });

  it('has a unique index on nonce for replay prevention', () => {
    expect(ddl).toMatch(/CREATE UNIQUE INDEX/i);
    expect(ddl).toMatch(/nonce/);
  });

  it('has an index on expires_at for expiry-based cleanup', () => {
    expect(ddl).toMatch(/CREATE INDEX/i);
    expect(ddl).toMatch(/expires_at/);
  });

  it('enables Row Level Security', () => {
    expect(ddl).toMatch(/ENABLE ROW LEVEL SECURITY/i);
    expect(ddl).toMatch(/FORCE ROW LEVEL SECURITY/i);
  });

  it('has an open SELECT policy for nonce lookup before tenant is known', () => {
    expect(ddl).toMatch(/FOR SELECT/i);
    expect(ddl).toMatch(/USING \(TRUE\)/i);
  });

  it('has a tenant-scoped write policy', () => {
    expect(ddl).toMatch(/get_current_business_id/);
  });
});
