import { describe, expect, it } from 'vitest';
import migration from '../actions/2026-06-10T10-00-00.add-email-ingestion-alias-routing.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Minimal sql tag mock: captures raw template string content only, ignoring
 * interpolations (none expected in DDL migrations).
 */
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
  it('exports a name matching the file convention', () => {
    expect(migration.name).toBe(
      '2026-06-10T10-00-00.add-email-ingestion-alias-routing.sql',
    );
  });

  it('exports a run function', () => {
    expect(typeof migration.run).toBe('function');
  });
});

// ---------------------------------------------------------------------------
// Schema validation — DDL content checks
// ---------------------------------------------------------------------------

describe('alias routing DDL', () => {
  let ddl: string;

  it('run() produces DDL output', () => {
    ddl = getMigrationSql();
    expect(typeof ddl).toBe('string');
    expect(ddl.length).toBeGreaterThan(0);
  });

  it('creates the email_ingestion_alias_routing table', () => {
    ddl = getMigrationSql();
    expect(ddl).toMatch(/email_ingestion_alias_routing/);
    expect(ddl).toMatch(/CREATE TABLE/i);
  });

  it('includes required columns: id, alias, owner_id, is_active, created_at, updated_at', () => {
    ddl = getMigrationSql();
    expect(ddl).toMatch(/\bid\b/);
    expect(ddl).toMatch(/\balias\b/);
    expect(ddl).toMatch(/\bowner_id\b/);
    expect(ddl).toMatch(/\bis_active\b/);
    expect(ddl).toMatch(/\bcreated_at\b/);
    expect(ddl).toMatch(/\bupdated_at\b/);
  });

  it('includes a unique active-alias index with normalization (lower function)', () => {
    ddl = getMigrationSql();
    expect(ddl).toMatch(/CREATE UNIQUE INDEX/i);
    expect(ddl).toMatch(/lower\(alias\)/i);
    expect(ddl).toMatch(/is_active\s*=\s*TRUE/i);
  });

  it('includes an owner_id index for tenant-scoped lookups', () => {
    ddl = getMigrationSql();
    expect(ddl).toMatch(/CREATE INDEX/i);
    expect(ddl).toMatch(/owner_id/);
  });

  it('enables Row Level Security', () => {
    ddl = getMigrationSql();
    expect(ddl).toMatch(/ENABLE ROW LEVEL SECURITY/i);
    expect(ddl).toMatch(/FORCE ROW LEVEL SECURITY/i);
  });

  it('includes an unrestricted SELECT policy for alias resolution', () => {
    ddl = getMigrationSql();
    // alias resolution must work before tenant context is set
    expect(ddl).toMatch(/alias_resolution_select/i);
    expect(ddl).toMatch(/FOR SELECT/i);
    expect(ddl).toMatch(/USING\s*\(\s*TRUE\s*\)/i);
  });

  it('includes a tenant-scoped write policy for INSERT/UPDATE/DELETE', () => {
    ddl = getMigrationSql();
    expect(ddl).toMatch(/tenant_isolation_write/i);
    expect(ddl).toMatch(/get_current_business_id/);
  });

  it('includes updated_at trigger', () => {
    ddl = getMigrationSql();
    expect(ddl).toMatch(/CREATE TRIGGER/i);
    expect(ddl).toMatch(/update_general_updated_at/);
  });
});
