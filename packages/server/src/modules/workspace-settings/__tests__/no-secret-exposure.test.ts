import { describe, expect, it } from 'vitest';
import type { SourceConnectionRow } from '../providers/workspace-settings.provider.js';
import { workspaceSettingsResolvers } from '../resolvers/workspace-settings.resolvers.js';

describe('SourceConnection resolver security', () => {
  const resolvers = workspaceSettingsResolvers.SourceConnection!;

  const fakeRow: SourceConnectionRow = {
    id: 'conn-1',
    owner_id: 'biz-1',
    provider: 'isracard',
    display_name: 'My Isracard',
    account_identifier: '3300',
    status: 'active',
    credentials_encrypted: Buffer.from('encrypted-stuff'),
    credentials_iv: Buffer.from('iv-data'),
    credentials_tag: Buffer.from('tag-data'),
    last_sync_at: new Date('2026-03-19'),
    last_sync_error: null,
    financial_account_id: null,
    created_at: new Date('2026-03-19'),
    updated_at: new Date('2026-03-19'),
  };

  it('never exposes credentials_encrypted through any field', () => {
    const fieldNames = Object.keys(resolvers);
    expect(fieldNames).not.toContain('credentialsEncrypted');
    expect(fieldNames).not.toContain('credentials_encrypted');
    expect(fieldNames).not.toContain('credentials');
    expect(fieldNames).not.toContain('credentialsIv');
    expect(fieldNames).not.toContain('credentialsTag');
  });

  it('hasCredentials returns true when credentials exist', () => {
    const hasCredentials = (resolvers as Record<string, Function>).hasCredentials;
    expect(hasCredentials(fakeRow)).toBe(true);
  });

  it('hasCredentials returns false when no credentials', () => {
    const hasCredentials = (resolvers as Record<string, Function>).hasCredentials;
    expect(hasCredentials({ ...fakeRow, credentials_encrypted: null })).toBe(false);
  });

  it('all resolved fields contain no secret data', () => {
    const resolved: Record<string, unknown> = {};
    for (const [field, resolver] of Object.entries(resolvers)) {
      if (typeof resolver === 'function') {
        resolved[field] = resolver(fakeRow, {}, {} as never, {} as never);
      }
    }

    const allValues = Object.values(resolved).map(v => (v instanceof Buffer ? v.toString() : v));
    const serialized = JSON.stringify(allValues);

    expect(serialized).not.toContain('encrypted-stuff');
    expect(serialized).not.toContain('iv-data');
    expect(serialized).not.toContain('tag-data');
  });
});
