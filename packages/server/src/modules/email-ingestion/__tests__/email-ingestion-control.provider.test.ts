import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DBProvider } from '../../app-providers/db.provider.js';
import { EmailIngestionControlProvider } from '../providers/email-ingestion-control.provider.js';

// ---------------------------------------------------------------------------
// Mock DB helpers
// ---------------------------------------------------------------------------

type MockQueryResult = { rows: Record<string, unknown>[]; rowCount: number };

function isControlStatement(text: string): boolean {
  return (
    text === 'BEGIN' || text === 'COMMIT' || text === 'ROLLBACK' || text.includes('set_config')
  );
}

function makeDbProvider(
  queryImpl: (text: string, params?: unknown[]) => MockQueryResult,
): DBProvider {
  // resolveAlias runs on the raw pool; the grant-table ops (issueGrant /
  // validateAndConsumeGrant) run on a pooled client inside a transaction. One
  // shared mock backs both pool.query and the connected client.query: control
  // statements (BEGIN / SET LOCAL / COMMIT / ROLLBACK) are served transparently
  // and data queries delegate to queryImpl, so every query is recorded in one
  // place.
  const query = vi.fn().mockImplementation((text: unknown, params?: unknown[]) => {
    const sqlText = typeof text === 'string' ? text : '';
    if (isControlStatement(sqlText)) {
      return { rows: [], rowCount: 0 };
    }
    return queryImpl(sqlText, params);
  });
  const release = vi.fn();
  return {
    pool: {
      query,
      connect: vi.fn().mockResolvedValue({ query, release }),
    },
  } as unknown as DBProvider;
}

// ---------------------------------------------------------------------------
// resolveAlias
// ---------------------------------------------------------------------------

describe('EmailIngestionControlProvider.resolveAlias', () => {
  it('returns found=true with tenantId for a known active alias', async () => {
    const db = makeDbProvider(() => ({
      rows: [{ owner_id: 'tenant-uuid-1' }],
      rowCount: 1,
    }));
    const provider = new EmailIngestionControlProvider(db);
    const result = await provider.resolveAlias('invoice@tenant.example.com');

    expect(result.found).toBe(true);
    if (result.found) {
      expect(result.tenantId).toBe('tenant-uuid-1');
    }
  });

  it('returns found=false with UNKNOWN_ALIAS reason when alias is not in table', async () => {
    const db = makeDbProvider(() => ({ rows: [], rowCount: 0 }));
    const provider = new EmailIngestionControlProvider(db);
    const result = await provider.resolveAlias('notfound@example.com');

    expect(result.found).toBe(false);
    if (!result.found) {
      expect(result.reason).toBe('UNKNOWN_ALIAS');
    }
  });

  it('returns found=false for an inactive alias (query filters is_active=TRUE)', async () => {
    // The provider queries with is_active = TRUE, so an inactive alias returns 0 rows.
    const db = makeDbProvider(() => ({ rows: [], rowCount: 0 }));
    const provider = new EmailIngestionControlProvider(db);
    const result = await provider.resolveAlias('inactive@example.com');

    expect(result.found).toBe(false);
    if (!result.found) {
      expect(result.reason).toBe('UNKNOWN_ALIAS');
    }
  });

  it('queries with lowercased alias and active flag', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [], rowCount: 0 });
    const db = { pool: { query } } as unknown as DBProvider;
    const provider = new EmailIngestionControlProvider(db);

    await provider.resolveAlias('Mixed@Case.Example.COM');

    const [sql, params] = query.mock.calls[0] as [string, unknown[]];
    expect(sql.toLowerCase()).toMatch(/is_active/);
    expect(params[0]).toBe('mixed@case.example.com');
  });
});

// ---------------------------------------------------------------------------
// issueGrant
// ---------------------------------------------------------------------------

describe('EmailIngestionControlProvider.issueGrant', () => {
  const grantInput = {
    tenantId: 'tenant-uuid-1',
    messageId: 'msg-abc-123',
    rawMessageHash: 'sha256-abc',
    expiresAt: new Date('2026-06-11T00:05:00Z'),
    correlationId: 'corr-xyz',
  };

  let provider: EmailIngestionControlProvider;
  let mockDb: DBProvider;

  beforeEach(() => {
    mockDb = makeDbProvider(() => ({
      rows: [
        {
          id: 'grant-row-uuid',
          jti: 'jti-value',
          owner_id: 'tenant-uuid-1',
          action: 'ingest',
          expires_at: new Date('2026-06-11T00:05:00Z'),
        },
      ],
      rowCount: 1,
    }));
    provider = new EmailIngestionControlProvider(mockDb);
  });

  it('returns a grant with jti and tenantId', async () => {
    const grant = await provider.issueGrant(grantInput);
    expect(typeof grant.jti).toBe('string');
    expect(grant.jti.length).toBeGreaterThan(0);
    expect(grant.tenantId).toBe('tenant-uuid-1');
  });

  it('returns a grant with messageId and rawMessageHash matching input', async () => {
    const grant = await provider.issueGrant(grantInput);
    expect(grant.messageId).toBe('msg-abc-123');
    expect(grant.rawMessageHash).toBe('sha256-abc');
  });

  it('returns a grant with action=ingest and valid expiresAt', async () => {
    const grant = await provider.issueGrant(grantInput);
    expect(grant.action).toBe('ingest');
    expect(grant.expiresAt).toBeInstanceOf(Date);
  });

  it('includes decisionId and auditId as non-empty strings', async () => {
    const grant = await provider.issueGrant(grantInput);
    expect(typeof grant.decisionId).toBe('string');
    expect(grant.decisionId.length).toBeGreaterThan(0);
    expect(typeof grant.auditId).toBe('string');
    expect(grant.auditId.length).toBeGreaterThan(0);
  });

  it('decisionId and auditId are distinct', async () => {
    const grant = await provider.issueGrant(grantInput);
    expect(grant.decisionId).not.toBe(grant.auditId);
  });

  it('inserts into the grants table with correct tenant binding', async () => {
    await provider.issueGrant(grantInput);
    const query = mockDb.pool.query as ReturnType<typeof vi.fn>;
    // The INSERT runs on the pooled client among BEGIN / SET LOCAL / COMMIT, so
    // locate it rather than assuming a fixed call index.
    const insertCall = query.mock.calls.find(
      ([sql]) =>
        typeof sql === 'string' && /insert.*email_ingestion_grants/s.test(sql.toLowerCase()),
    ) as [string, unknown[]] | undefined;
    expect(insertCall).toBeDefined();
    const params = insertCall![1];
    expect(params).toContain('tenant-uuid-1');
    expect(params).toContain('msg-abc-123');
  });
});
