import { randomBytes } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { encryptCredentials } from '../helpers/crypto.js';
import { resolveCredentials } from '../helpers/credential-resolver.js';

describe('resolveCredentials', () => {
  const testKey = randomBytes(32).toString('hex');

  beforeEach(() => {
    vi.stubEnv('SETTINGS_ENCRYPTION_KEY', testKey);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns secure_store when DB has encrypted credentials', async () => {
    const creds = { username: 'user1', password: 'pass1' };
    const { encrypted, iv, tag } = encryptCredentials(JSON.stringify(creds));

    const mockPool = {
      query: vi.fn().mockResolvedValue({
        rows: [
          {
            credentials_encrypted: encrypted,
            credentials_iv: iv,
            credentials_tag: tag,
          },
        ],
      }),
    };

    const result = await resolveCredentials(
      'owner-1',
      'hapoalim',
      mockPool as never,
    );

    expect(result).not.toBeNull();
    expect(result?.source).toBe('secure_store');
    expect(result?.credentials.username).toBe('user1');
    expect(result?.credentials.password).toBe('pass1');
  });

  it('falls back to env when DB has no credentials', async () => {
    vi.stubEnv('ISRACARD_ID', '123456789');
    vi.stubEnv('ISRACARD_PASSWORD', 'testpass');
    vi.stubEnv('ISRACARD_6_DIGITS', '654321');

    const mockPool = {
      query: vi.fn().mockResolvedValue({ rows: [] }),
    };

    const result = await resolveCredentials(
      'owner-1',
      'isracard',
      mockPool as never,
    );

    expect(result).not.toBeNull();
    expect(result?.source).toBe('env_fallback');
    expect(result?.credentials.id).toBe('123456789');
    expect(result?.credentials.password).toBe('testpass');
  });

  it('returns null when no DB credentials and no env vars', async () => {
    vi.stubEnv('MIZRAHI_USERNAME', '');
    vi.stubEnv('MIZRAHI_PASSWORD', '');

    const mockPool = {
      query: vi.fn().mockResolvedValue({ rows: [] }),
    };

    const result = await resolveCredentials(
      'owner-1',
      'mizrahi',
      mockPool as never,
    );

    expect(result).toBeNull();
  });

  it('prefers secure store over env fallback', async () => {
    vi.stubEnv('ISRACARD_ID', 'env-id');
    vi.stubEnv('ISRACARD_PASSWORD', 'env-pass');
    vi.stubEnv('ISRACARD_6_DIGITS', '000000');

    const creds = { id: 'db-id', password: 'db-pass', last6Digits: '999999' };
    const { encrypted, iv, tag } = encryptCredentials(JSON.stringify(creds));

    const mockPool = {
      query: vi.fn().mockResolvedValue({
        rows: [
          {
            credentials_encrypted: encrypted,
            credentials_iv: iv,
            credentials_tag: tag,
          },
        ],
      }),
    };

    const result = await resolveCredentials(
      'owner-1',
      'isracard',
      mockPool as never,
    );

    expect(result?.source).toBe('secure_store');
    expect(result?.credentials.id).toBe('db-id');
  });

  it('falls back to env when decryption fails', async () => {
    vi.stubEnv('USER_CODE', 'BG99999');
    vi.stubEnv('PASSWORD', 'envpass');

    const mockPool = {
      query: vi.fn().mockResolvedValue({
        rows: [
          {
            credentials_encrypted: Buffer.from('corrupt'),
            credentials_iv: Buffer.from('badiv'),
            credentials_tag: Buffer.from('badtag'),
          },
        ],
      }),
    };

    const result = await resolveCredentials(
      'owner-1',
      'hapoalim',
      mockPool as never,
    );

    expect(result?.source).toBe('env_fallback');
    expect(result?.credentials.userCode).toBe('BG99999');
  });

  it('handles case-insensitive provider names', async () => {
    vi.stubEnv('ISRACARD_ID', 'id1');
    vi.stubEnv('ISRACARD_PASSWORD', 'pw1');
    vi.stubEnv('ISRACARD_6_DIGITS', '111111');

    const mockPool = {
      query: vi.fn().mockResolvedValue({ rows: [] }),
    };

    const result = await resolveCredentials(
      'owner-1',
      'ISRACARD',
      mockPool as never,
    );

    expect(result?.source).toBe('env_fallback');
  });

  it('does not attempt DB when encryption key is missing', async () => {
    vi.stubEnv('SETTINGS_ENCRYPTION_KEY', '');
    vi.stubEnv('USER_CODE', 'BG12345');
    vi.stubEnv('PASSWORD', 'test');

    const mockPool = {
      query: vi.fn(),
    };

    const result = await resolveCredentials(
      'owner-1',
      'hapoalim',
      mockPool as never,
    );

    expect(result?.source).toBe('env_fallback');
    expect(mockPool.query).not.toHaveBeenCalled();
  });
});
