import { describe, expect, it, vi } from 'vitest';
import type { TenantAwareDBClient } from '../../app-providers/tenant-db-client.js';
import { EmailIngestionAliasProvider } from '../providers/email-ingestion-alias.provider.js';

const row = {
  id: 'alias-uuid-1',
  alias: 'invoice@tenant.example.com',
  owner_id: 'tenant-uuid-1',
  is_active: true,
  created_at: new Date('2026-01-01T00:00:00.000Z'),
  updated_at: new Date('2026-01-01T00:00:00.000Z'),
};

function makeProvider(query: ReturnType<typeof vi.fn>) {
  const db = { query } as unknown as TenantAwareDBClient;
  return new EmailIngestionAliasProvider(db);
}

describe('EmailIngestionAliasProvider.createAlias', () => {
  it('inserts with alias + owner and returns the row', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [row], rowCount: 1 });
    const provider = makeProvider(query);

    const result = await provider.createAlias('invoice@tenant.example.com', 'tenant-uuid-1');

    expect(query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO'), [
      'invoice@tenant.example.com',
      'tenant-uuid-1',
    ]);
    expect(result).toEqual({ success: true, alias: row });
  });

  it('maps a unique-violation to a generic conflict result', async () => {
    const query = vi.fn().mockRejectedValue(Object.assign(new Error('dup'), { code: '23505' }));
    const provider = makeProvider(query);

    const result = await provider.createAlias('dup@x.com', 'tenant-uuid-1');

    expect(result).toEqual({ success: false, message: 'Alias "dup@x.com" is already in use' });
  });

  it('rethrows non-unique errors', async () => {
    const query = vi.fn().mockRejectedValue(Object.assign(new Error('boom'), { code: '08006' }));
    const provider = makeProvider(query);

    await expect(provider.createAlias('a@x.com', 'tenant-uuid-1')).rejects.toThrow('boom');
  });
});

describe('EmailIngestionAliasProvider.setAliasActive', () => {
  it('returns the updated row on success', async () => {
    const updated = { ...row, is_active: false };
    const query = vi.fn().mockResolvedValue({ rows: [updated], rowCount: 1 });
    const provider = makeProvider(query);

    const result = await provider.setAliasActive('alias-uuid-1', false);

    expect(query).toHaveBeenCalledWith(expect.stringContaining('UPDATE'), [false, 'alias-uuid-1']);
    expect(result).toEqual({ success: true, alias: updated });
  });

  it('returns not-found when RLS scopes the update to zero rows', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [], rowCount: 0 });
    const provider = makeProvider(query);

    const result = await provider.setAliasActive('missing', true);

    expect(result).toEqual({ success: false, message: 'Alias not found or not authorized' });
  });
});

describe('EmailIngestionAliasProvider.listAliases', () => {
  it('returns [] without querying when scope is empty', async () => {
    const query = vi.fn();
    const provider = makeProvider(query);

    const result = await provider.listAliases([]);

    expect(result).toEqual([]);
    expect(query).not.toHaveBeenCalled();
  });

  it('filters by owner scope', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [row], rowCount: 1 });
    const provider = makeProvider(query);

    const result = await provider.listAliases(['tenant-uuid-1', 'tenant-uuid-2']);

    expect(query).toHaveBeenCalledWith(expect.stringContaining('owner_id = ANY($1)'), [
      ['tenant-uuid-1', 'tenant-uuid-2'],
    ]);
    expect(result).toEqual([row]);
  });
});
