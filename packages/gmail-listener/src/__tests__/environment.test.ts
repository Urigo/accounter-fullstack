import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('dotenv', () => ({
  config: vi.fn(),
}));

const REQUIRED_ENV = {
  GMAIL_LISTENER_API_KEY: 'test-api-key',
  GMAIL_CLIENT_ID: 'test-client-id',
  GMAIL_CLIENT_SECRET: 'test-client-secret',
  GMAIL_REFRESH_TOKEN: 'test-refresh-token',
  GOOGLE_CLOUD_PROJECT_ID: 'test-project-id',
  GOOGLE_APPLICATION_CREDENTIALS: '/path/to/creds.json',
  SERVER_URL: 'http://localhost:4000',
};

describe('Gateway Environment – v2 feature flags', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv, ...REQUIRED_ENV };
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
