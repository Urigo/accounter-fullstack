import { randomBytes } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkspaceSettingsProvider } from '../providers/workspace-settings.provider.js';

function createMockDb(rows: unknown[] = []) {
  return {
    query: vi.fn().mockResolvedValue({ rows, rowCount: rows.length }),
  };
}

function createMockAuth(businessId: string) {
  return {
    getAuthContext: vi.fn().mockResolvedValue({
      tenant: { businessId },
      user: { userId: 'user-1' },
    }),
  };
}

describe('Workspace isolation', () => {
  const testKey = randomBytes(32).toString('hex');

  beforeEach(() => {
    vi.stubEnv('SETTINGS_ENCRYPTION_KEY', testKey);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('queries are scoped to the authenticated business owner', async () => {
    const db = createMockDb([]);
    const provider = new WorkspaceSettingsProvider(
      db as never,
      createMockAuth('biz-A') as never, {} as never,
    );

    await provider.getWorkspaceSettings();

    const [sql, params] = db.query.mock.calls[0];
    expect(sql).toContain('owner_id = $1');
    expect(params[0]).toBe('biz-A');
  });

  it('different business IDs get different owner_id params', async () => {
    const dbA = createMockDb([]);
    const providerA = new WorkspaceSettingsProvider(
      dbA as never,
      createMockAuth('biz-A') as never, {} as never,
    );
    await providerA.getWorkspaceSettings();
    expect(dbA.query.mock.calls[0][1][0]).toBe('biz-A');

    const dbB = createMockDb([]);
    const providerB = new WorkspaceSettingsProvider(
      dbB as never,
      createMockAuth('biz-B') as never, {} as never,
    );
    await providerB.getWorkspaceSettings();
    expect(dbB.query.mock.calls[0][1][0]).toBe('biz-B');
  });

  it('upsert scoped to owner cannot affect another workspace', async () => {
    const row = { id: '1', owner_id: 'biz-A', company_name: 'A Corp' };
    const db = createMockDb([row]);
    const provider = new WorkspaceSettingsProvider(
      db as never,
      createMockAuth('biz-A') as never, {} as never,
    );

    await provider.upsertWorkspaceSettings({ companyName: 'A Corp Updated' });

    const [sql, params] = db.query.mock.calls[0];
    expect(sql).toContain('owner_id');
    expect(params[0]).toBe('biz-A');
    expect(params).not.toContain('biz-B');
  });

  it('source connections are scoped to owner', async () => {
    const db = createMockDb([]);
    const provider = new WorkspaceSettingsProvider(
      db as never,
      createMockAuth('biz-C') as never, {} as never,
    );

    await provider.getSourceConnections();

    const [sql, params] = db.query.mock.calls[0];
    expect(sql).toContain('owner_id = $1');
    expect(params[0]).toBe('biz-C');
  });

  it('createSourceConnection assigns the correct owner', async () => {
    const row = { id: 'c1', owner_id: 'biz-D', provider: 'isracard' };
    const db = createMockDb([row]);
    const provider = new WorkspaceSettingsProvider(
      db as never,
      createMockAuth('biz-D') as never, {} as never,
    );

    await provider.createSourceConnection({
      provider: 'isracard',
      displayName: 'Test',
    });

    const [, params] = db.query.mock.calls[0];
    expect(params[0]).toBe('biz-D');
  });

  it('deleteSourceConnection scoped to the current owner', async () => {
    const db = createMockDb();
    db.query.mockResolvedValue({ rows: [], rowCount: 1 });
    const provider = new WorkspaceSettingsProvider(
      db as never,
      createMockAuth('biz-E') as never, {} as never,
    );

    await provider.deleteSourceConnection('conn-1');

    const [sql, params] = db.query.mock.calls[0];
    expect(sql).toContain('owner_id = $');
    expect(params).toContain('biz-E');
    expect(params).toContain('conn-1');
  });
});
