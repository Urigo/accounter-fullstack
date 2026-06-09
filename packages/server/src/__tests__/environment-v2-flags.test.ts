import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('dotenv', () => ({
  config: vi.fn(),
}));

describe('Server Environment – v2 feature flags', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };

    process.env.POSTGRES_HOST = 'localhost';
    process.env.POSTGRES_PORT = '5432';
    process.env.POSTGRES_DB = 'test_db';
    process.env.POSTGRES_USER = 'test_user';
    process.env.POSTGRES_PASSWORD = 'test_password';
    process.env.CREDENTIALS_ENCRYPTION_KEY =
      'a'.repeat(64); // 64-char hex string for validation

    delete process.env.MULTI_TENANT_INGEST_V2_ENABLED;
    delete process.env.MULTI_TENANT_INGEST_SHADOW_MODE;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('defaults MULTI_TENANT_INGEST_V2_ENABLED to false', async () => {
    const { env } = await import('../environment.js');
    expect(env.v2Flags.ingestV2Enabled).toBe(false);
  });

  it('defaults MULTI_TENANT_INGEST_SHADOW_MODE to false when v2 is disabled', async () => {
    const { env } = await import('../environment.js');
    expect(env.v2Flags.shadowMode).toBe(false);
  });

  it('defaults MULTI_TENANT_INGEST_SHADOW_MODE to true when v2 is enabled and shadow not set', async () => {
    process.env.MULTI_TENANT_INGEST_V2_ENABLED = '1';
    const { env } = await import('../environment.js');
    expect(env.v2Flags.ingestV2Enabled).toBe(true);
    expect(env.v2Flags.shadowMode).toBe(true);
  });

  it('parses MULTI_TENANT_INGEST_V2_ENABLED=1 as true', async () => {
    process.env.MULTI_TENANT_INGEST_V2_ENABLED = '1';
    const { env } = await import('../environment.js');
    expect(env.v2Flags.ingestV2Enabled).toBe(true);
  });

  it('parses MULTI_TENANT_INGEST_V2_ENABLED=0 as false', async () => {
    process.env.MULTI_TENANT_INGEST_V2_ENABLED = '0';
    const { env } = await import('../environment.js');
    expect(env.v2Flags.ingestV2Enabled).toBe(false);
  });

  it('parses MULTI_TENANT_INGEST_SHADOW_MODE=0 as false even when v2 is enabled', async () => {
    process.env.MULTI_TENANT_INGEST_V2_ENABLED = '1';
    process.env.MULTI_TENANT_INGEST_SHADOW_MODE = '0';
    const { env } = await import('../environment.js');
    expect(env.v2Flags.shadowMode).toBe(false);
  });

  it('parses MULTI_TENANT_INGEST_SHADOW_MODE=1 as true', async () => {
    process.env.MULTI_TENANT_INGEST_SHADOW_MODE = '1';
    const { env } = await import('../environment.js');
    expect(env.v2Flags.shadowMode).toBe(true);
  });

  it('rejects invalid MULTI_TENANT_INGEST_V2_ENABLED value', async () => {
    process.env.MULTI_TENANT_INGEST_V2_ENABLED = 'yes';

    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as never);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      await import('../environment.js');
    } catch {
      // expected – extractConfig throws after mocked process.exit
    }

    expect(exitSpy).toHaveBeenCalledWith(1);
    exitSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('rejects invalid MULTI_TENANT_INGEST_SHADOW_MODE value', async () => {
    process.env.MULTI_TENANT_INGEST_SHADOW_MODE = 'enabled';

    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as never);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      await import('../environment.js');
    } catch {
      // expected – extractConfig throws after mocked process.exit
    }

    expect(exitSpy).toHaveBeenCalledWith(1);
    exitSpy.mockRestore();
    errorSpy.mockRestore();
  });
});
