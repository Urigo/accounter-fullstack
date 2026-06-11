import { beforeAll, describe, expect, it } from 'vitest';
import migration from '../actions/2026-06-10T13-00-00.add-email-ingestion-quarantine.js';

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
    expect(migration.name).toBe('2026-06-10T13-00-00.add-email-ingestion-quarantine.sql');
  });

  it('exports a run function', () => {
    expect(typeof migration.run).toBe('function');
  });
});

// ---------------------------------------------------------------------------
// Schema validation
// ---------------------------------------------------------------------------

describe('quarantine table DDL', () => {
  let ddl: string;

  beforeAll(() => {
    ddl = getMigrationSql();
  });

  it('creates the email_ingestion_quarantine table', () => {
    expect(ddl).toMatch(/CREATE TABLE/i);
    expect(ddl).toMatch(/email_ingestion_quarantine/);
  });

  it('includes reason_code column', () => {
    expect(ddl).toMatch(/\breason_code\b/);
  });

  it('includes tenant_candidate column', () => {
    expect(ddl).toMatch(/\btenant_candidate\b/);
  });

  it('includes message identifier columns', () => {
    expect(ddl).toMatch(/\bmessage_id\b/);
    expect(ddl).toMatch(/\braw_message_hash\b/);
  });

  it('includes correlation_id column', () => {
    expect(ddl).toMatch(/\bcorrelation_id\b/);
  });

  it('includes status column', () => {
    expect(ddl).toMatch(/\bstatus\b/);
  });

  it('includes retry_count column', () => {
    expect(ddl).toMatch(/\bretry_count\b/);
  });

  it('includes created_at and updated_at columns', () => {
    expect(ddl).toMatch(/\bcreated_at\b/);
    expect(ddl).toMatch(/\bupdated_at\b/);
  });

  it('has a triage index on reason_code', () => {
    expect(ddl).toMatch(/CREATE INDEX/i);
    expect(ddl).toMatch(/reason_code/);
  });

  it('has a triage index on status', () => {
    expect(ddl).toMatch(/status/);
  });

  it('has a triage index on created_at for date-based triage', () => {
    expect(ddl).toMatch(/created_at/);
  });

  it('enables Row Level Security with tenant isolation', () => {
    expect(ddl).toMatch(/ENABLE ROW LEVEL SECURITY/i);
    expect(ddl).toMatch(/FORCE ROW LEVEL SECURITY/i);
    expect(ddl).toMatch(/CREATE POLICY/i);
    expect(ddl).toMatch(/get_current_business_id/);
  });

  it('sets updated_at via trigger', () => {
    expect(ddl).toMatch(/CREATE TRIGGER/i);
    expect(ddl).toMatch(/update_general_updated_at/);
  });
});
