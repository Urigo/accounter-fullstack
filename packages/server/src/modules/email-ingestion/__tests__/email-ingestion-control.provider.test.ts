import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TenantAwareDBClient } from '../../app-providers/tenant-db-client.js';
import { EmailIngestionControlProvider } from '../providers/email-ingestion-control.provider.js';

// ---------------------------------------------------------------------------
// Mock DB helpers
// ---------------------------------------------------------------------------

type MockQueryResult = { rows: Record<string, unknown>[]; rowCount: number };

function makeDb(queryImpl: (text: string, params?: unknown[]) => MockQueryResult): TenantAwareDBClient {
  return {
    query: vi.fn().mockImplementation(queryImpl),
  } as unknown as TenantAwareDBClient;
}

// ---------------------------------------------------------------------------
// resolveAlias
// ---------------------------------------------------------------------------

describe('EmailIngestionControlProvider.resolveAlias', () => {
  it('returns found=true with tenantId for a known active alias', async () => {
    const db = makeDb(() => ({
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
    const db = makeDb(() => ({ rows: [], rowCount: 0 }));
    const provider = new EmailIngestionControlProvider(db);
    const result = await provider.resolveAlias('notfound@example.com');

    expect(result.found).toBe(false);
    if (!result.found) {
      expect(result.reason).toBe('UNKNOWN_ALIAS');
    }
  });

  it('returns found=false for an inactive alias (query filters is_active=TRUE)', async () => {
    // The provider queries with is_active = TRUE, so an inactive alias returns 0 rows.
    const db = makeDb(() => ({ rows: [], rowCount: 0 }));
    const provider = new EmailIngestionControlProvider(db);
    const result = await provider.resolveAlias('inactive@example.com');

    expect(result.found).toBe(false);
    if (!result.found) {
      expect(result.reason).toBe('UNKNOWN_ALIAS');
    }
  });

  it('queries with lowercased alias and active flag', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [], rowCount: 0 });
    const db = { query } as unknown as TenantAwareDBClient;
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
  let mockDb: TenantAwareDBClient;

  beforeEach(() => {
    mockDb = makeDb(() => ({
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
    const query = (mockDb.query as ReturnType<typeof vi.fn>);
    const [sql, params] = query.mock.calls[0] as [string, unknown[]];
    expect(sql.toLowerCase()).toMatch(/insert.*email_ingestion_grants/s);
    expect(params).toContain('tenant-uuid-1');
    expect(params).toContain('msg-abc-123');
  });
});
