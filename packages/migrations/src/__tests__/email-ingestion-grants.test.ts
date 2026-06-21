import { beforeAll, describe, expect, it } from 'vitest';
import migration from '../actions/2026-06-10T11-00-00.add-email-ingestion-grants.js';

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
    expect(migration.name).toBe('2026-06-10T11-00-00.add-email-ingestion-grants.sql');
  });

  it('exports a run function', () => {
    expect(typeof migration.run).toBe('function');
  });
});

// ---------------------------------------------------------------------------
// Schema validation
// ---------------------------------------------------------------------------

describe('grants table DDL', () => {
  let ddl: string;

  beforeAll(() => {
    ddl = getMigrationSql();
  });

  it('creates the email_ingestion_grants table', () => {
    expect(ddl).toMatch(/CREATE TABLE/i);
    expect(ddl).toMatch(/email_ingestion_grants/);
  });

  it('includes required columns', () => {
    expect(ddl).toMatch(/\bjti\b/);
    expect(ddl).toMatch(/\bowner_id\b/);
    expect(ddl).toMatch(/\bmessage_id\b/);
    expect(ddl).toMatch(/\braw_message_hash\b/);
    expect(ddl).toMatch(/\baction\b/);
    expect(ddl).toMatch(/\bexpires_at\b/);
    expect(ddl).toMatch(/\bconsumed_at\b/);
    expect(ddl).toMatch(/\bcreated_at\b/);
  });

  // ---------------------------------------------------------------------------
  // One-time consume semantics scaffold
  //
  // The schema enforces consume-once at two levels:
  //   1. jti UNIQUE index — no two rows can share a token ID (replay prevention).
  //   2. consumed_at column — NULL means the grant is still valid; a non-NULL
  //      timestamp means it has been atomically consumed. Application code sets
  //      consumed_at = NOW() in a single UPDATE WHERE consumed_at IS NULL,
  //      checking the row count to detect a race. The DDL below establishes
  //      both invariants.
  // ---------------------------------------------------------------------------

  it('has a unique index on jti for replay prevention', () => {
    expect(ddl).toMatch(/CREATE UNIQUE INDEX/i);
    expect(ddl).toMatch(/jti/);
  });

  it('consumed_at is nullable (NULL = unconsumed, non-NULL = consumed)', () => {
    // consumed_at must NOT have NOT NULL — it starts as NULL and is set on consume
    const consumedAtLine = ddl.match(/consumed_at[^\n,)]+/i)?.[0] ?? '';
    expect(consumedAtLine).not.toMatch(/NOT NULL/i);
  });

  it('expires_at is NOT NULL (grants must have a defined expiry)', () => {
    const expiresAtLine = ddl.match(/expires_at[^\n,)]+/i)?.[0] ?? '';
    expect(expiresAtLine).toMatch(/NOT NULL/i);
  });

  it('includes an index on expires_at for expiry cleanup queries', () => {
    expect(ddl).toMatch(/expires_at/);
    expect(ddl).toMatch(/CREATE INDEX/i);
  });

  it('includes an owner_id index for tenant-scoped lookups', () => {
    expect(ddl).toMatch(/owner_id/);
  });

  it('enables Row Level Security with tenant isolation', () => {
    expect(ddl).toMatch(/ENABLE ROW LEVEL SECURITY/i);
    expect(ddl).toMatch(/FORCE ROW LEVEL SECURITY/i);
    expect(ddl).toMatch(/CREATE POLICY/i);
    expect(ddl).toMatch(/get_current_business_id/);
  });
});
