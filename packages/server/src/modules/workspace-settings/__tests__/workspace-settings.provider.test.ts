import { randomBytes } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkspaceSettingsProvider } from '../providers/workspace-settings.provider.js';

function createMockDb(rows: unknown[] = []) {
  return {
    query: vi.fn().mockResolvedValue({ rows, rowCount: rows.length }),
  };
}

function createMockAuth(businessId = 'biz-1') {
  return {
    getAuthContext: vi.fn().mockResolvedValue({
      tenant: { businessId },
      user: { userId: 'user-1' },
    }),
  };
}

function createMockEnv() {
  return { cloudinary: undefined } as never;
}

describe('WorkspaceSettingsProvider', () => {
  const testKey = randomBytes(32).toString('hex');

  beforeEach(() => {
    vi.stubEnv('SETTINGS_ENCRYPTION_KEY', testKey);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('getWorkspaceSettings', () => {
    it('returns null when no settings exist', async () => {
      const provider = new WorkspaceSettingsProvider(
        createMockDb([]) as never,
        createMockAuth() as never, createMockEnv(),
      );
      const result = await provider.getWorkspaceSettings();
      expect(result).toBeNull();
    });

    it('returns settings when they exist', async () => {
      const row = { id: '1', owner_id: 'biz-1', company_name: 'Acme', logo_url: null };
      const provider = new WorkspaceSettingsProvider(
        createMockDb([row]) as never,
        createMockAuth() as never, createMockEnv(),
      );
      const result = await provider.getWorkspaceSettings();
      expect(result).toEqual(row);
    });
  });

  describe('upsertWorkspaceSettings', () => {
    it('calls INSERT ON CONFLICT with correct params', async () => {
      const row = { id: '1', owner_id: 'biz-1', company_name: 'Acme', logo_url: null };
      const db = createMockDb([row]);
      const provider = new WorkspaceSettingsProvider(db as never, createMockAuth() as never, createMockEnv());

      const result = await provider.upsertWorkspaceSettings({ companyName: 'Acme' });
      expect(result.company_name).toBe('Acme');
      expect(db.query).toHaveBeenCalledTimes(1);
      const [sql, params] = db.query.mock.calls[0];
      expect(sql).toContain('INSERT INTO accounter_schema.workspace_settings');
      expect(params[0]).toBe('biz-1');
      expect(params[1]).toBe('Acme');
    });
  });

  describe('source connections', () => {
    it('getSourceConnections returns all connections for the owner', async () => {
      const rows = [
        { id: '1', provider: 'isracard', display_name: 'Isracard' },
        { id: '2', provider: 'mizrahi', display_name: 'Mizrahi' },
      ];
      const provider = new WorkspaceSettingsProvider(
        createMockDb(rows) as never,
        createMockAuth() as never, createMockEnv(),
      );
      const result = await provider.getSourceConnections();
      expect(result).toHaveLength(2);
    });

    it('createSourceConnection encrypts credentials', async () => {
      const row = { id: '1', provider: 'isracard', credentials_encrypted: Buffer.from('x') };
      const db = createMockDb([row]);
      const provider = new WorkspaceSettingsProvider(db as never, createMockAuth() as never, createMockEnv());

      await provider.createSourceConnection({
        provider: 'isracard',
        displayName: 'Isracard',
        credentials: { id: '12345', password: 'secret' },
      });

      const [, params] = db.query.mock.calls[0];
      // params[4] is credentials_encrypted - should be a Buffer, not plain text
      expect(params[4]).toBeInstanceOf(Buffer);
      // params[5] is iv, params[6] is tag
      expect(params[5]).toBeInstanceOf(Buffer);
      expect(params[6]).toBeInstanceOf(Buffer);
    });

    it('createSourceConnection stores null when no credentials provided', async () => {
      const row = { id: '1', provider: 'isracard', credentials_encrypted: null };
      const db = createMockDb([row]);
      const provider = new WorkspaceSettingsProvider(db as never, createMockAuth() as never, createMockEnv());

      await provider.createSourceConnection({
        provider: 'isracard',
        displayName: 'Isracard',
      });

      const [, params] = db.query.mock.calls[0];
      expect(params[4]).toBeNull();
      expect(params[5]).toBeNull();
      expect(params[6]).toBeNull();
    });

    it('createSourceConnection throws when no encryption key and credentials provided', async () => {
      vi.stubEnv('SETTINGS_ENCRYPTION_KEY', '');
      const provider = new WorkspaceSettingsProvider(
        createMockDb([]) as never,
        createMockAuth() as never, createMockEnv(),
      );

      await expect(
        provider.createSourceConnection({
          provider: 'isracard',
          displayName: 'Isracard',
          credentials: { password: 'x' },
        }),
      ).rejects.toThrow('SETTINGS_ENCRYPTION_KEY');
    });

    it('deleteSourceConnection returns true on success', async () => {
      const db = createMockDb();
      db.query.mockResolvedValue({ rows: [], rowCount: 1 });
      const provider = new WorkspaceSettingsProvider(db as never, createMockAuth() as never, createMockEnv());

      const result = await provider.deleteSourceConnection('conn-1');
      expect(result).toBe(true);
    });

    it('deleteSourceConnection returns false when not found', async () => {
      const db = createMockDb();
      db.query.mockResolvedValue({ rows: [], rowCount: 0 });
      const provider = new WorkspaceSettingsProvider(db as never, createMockAuth() as never, createMockEnv());

      const result = await provider.deleteSourceConnection('conn-nonexistent');
      expect(result).toBe(false);
    });
  });

  describe('security', () => {
    it('getDecryptedCredentials round-trips through encrypt/decrypt', async () => {
      const creds = { username: 'user', password: 'pass123' };
      const db = createMockDb();
      const provider = new WorkspaceSettingsProvider(db as never, createMockAuth() as never, createMockEnv());

      // Simulate createSourceConnection
      const { encryptCredentials } = await import('../helpers/crypto.js');
      const { encrypted, iv, tag } = encryptCredentials(JSON.stringify(creds));

      // Mock getSourceConnectionById to return encrypted data
      db.query.mockResolvedValue({
        rows: [
          {
            id: 'conn-1',
            owner_id: 'biz-1',
            credentials_encrypted: encrypted,
            credentials_iv: iv,
            credentials_tag: tag,
          },
        ],
        rowCount: 1,
      });

      const result = await provider.getDecryptedCredentials('conn-1');
      expect(result).toEqual(creds);
    });

    it('getDecryptedCredentials returns null when no credentials stored', async () => {
      const db = createMockDb([
        {
          id: 'conn-1',
          owner_id: 'biz-1',
          credentials_encrypted: null,
          credentials_iv: null,
          credentials_tag: null,
        },
      ]);
      const provider = new WorkspaceSettingsProvider(db as never, createMockAuth() as never, createMockEnv());

      const result = await provider.getDecryptedCredentials('conn-1');
      expect(result).toBeNull();
    });
  });
});
