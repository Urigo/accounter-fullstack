import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('dotenv', () => ({
  config: vi.fn(),
}));

describe('Email Ingestion Gateway — feature flags env', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };

    delete process.env.EMAIL_INGESTION_V2_ENABLED;
    delete process.env.EMAIL_INGESTION_SHADOW_MODE;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('defaults both flags to false when env vars are absent', async () => {
    const { env } = await import('../environment.js');
    expect(env.featureFlags.v2Enabled).toBe(false);
    expect(env.featureFlags.shadowMode).toBe(false);
  });

  it('treats empty string as false (legacy-safe default)', async () => {
    process.env.EMAIL_INGESTION_V2_ENABLED = '';
    process.env.EMAIL_INGESTION_SHADOW_MODE = '';

    const { env } = await import('../environment.js');
    expect(env.featureFlags.v2Enabled).toBe(false);
    expect(env.featureFlags.shadowMode).toBe(false);
  });

  it('enables v2 when EMAIL_INGESTION_V2_ENABLED=1', async () => {
    process.env.EMAIL_INGESTION_V2_ENABLED = '1';

    const { env } = await import('../environment.js');
    expect(env.featureFlags.v2Enabled).toBe(true);
    expect(env.featureFlags.shadowMode).toBe(false);
  });

  it('enables shadow mode when EMAIL_INGESTION_SHADOW_MODE=1', async () => {
    process.env.EMAIL_INGESTION_SHADOW_MODE = '1';

    const { env } = await import('../environment.js');
    expect(env.featureFlags.v2Enabled).toBe(false);
    expect(env.featureFlags.shadowMode).toBe(true);
  });

  it('enables both flags independently when both are set to 1', async () => {
    process.env.EMAIL_INGESTION_V2_ENABLED = '1';
    process.env.EMAIL_INGESTION_SHADOW_MODE = '1';

    const { env } = await import('../environment.js');
    expect(env.featureFlags.v2Enabled).toBe(true);
    expect(env.featureFlags.shadowMode).toBe(true);
  });

  it('treats value "0" as false', async () => {
    process.env.EMAIL_INGESTION_V2_ENABLED = '0';
    process.env.EMAIL_INGESTION_SHADOW_MODE = '0';

    const { env } = await import('../environment.js');
    expect(env.featureFlags.v2Enabled).toBe(false);
    expect(env.featureFlags.shadowMode).toBe(false);
  });
});

describe('Email Ingestion Gateway — general env', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    delete process.env.PORT;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('defaults port to 3000 when PORT is absent', async () => {
    const { env } = await import('../environment.js');
    expect(env.general.port).toBe(3000);
  });

  it('treats empty string PORT as default 3000', async () => {
    process.env.PORT = '';
    const { env } = await import('../environment.js');
    expect(env.general.port).toBe(3000);
  });

  it('parses an explicit PORT value', async () => {
    process.env.PORT = '4001';
    const { env } = await import('../environment.js');
    expect(env.general.port).toBe(4001);
  });
});

describe('Email Ingestion Gateway — Cloudflare env', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    delete process.env.CF_WEBHOOK_SECRET;
    delete process.env.CF_IP_ALLOWLIST;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('defaults webhookSecret to empty string when CF_WEBHOOK_SECRET is absent', async () => {
    const { env } = await import('../environment.js');
    expect(env.cloudflare.webhookSecret).toBe('');
  });

  it('treats empty CF_WEBHOOK_SECRET as empty string', async () => {
    process.env.CF_WEBHOOK_SECRET = '';
    const { env } = await import('../environment.js');
    expect(env.cloudflare.webhookSecret).toBe('');
  });

  it('exposes CF_WEBHOOK_SECRET when set', async () => {
    process.env.CF_WEBHOOK_SECRET = 'super-secret-value';
    const { env } = await import('../environment.js');
    expect(env.cloudflare.webhookSecret).toBe('super-secret-value');
  });

  it('defaults ipAllowlist to empty array when CF_IP_ALLOWLIST is absent', async () => {
    const { env } = await import('../environment.js');
    expect(env.cloudflare.ipAllowlist).toEqual([]);
  });

  it('parses a single IP from CF_IP_ALLOWLIST', async () => {
    process.env.CF_IP_ALLOWLIST = '198.41.128.1';
    const { env } = await import('../environment.js');
    expect(env.cloudflare.ipAllowlist).toEqual(['198.41.128.1']);
  });

  it('parses multiple entries from a comma-separated CF_IP_ALLOWLIST', async () => {
    process.env.CF_IP_ALLOWLIST = '198.41.128.0/20, 172.16.0.0/12, 10.0.0.1';
    const { env } = await import('../environment.js');
    expect(env.cloudflare.ipAllowlist).toEqual([
      '198.41.128.0/20',
      '172.16.0.0/12',
      '10.0.0.1',
    ]);
  });

  it('treats empty CF_IP_ALLOWLIST as empty array', async () => {
    process.env.CF_IP_ALLOWLIST = '';
    const { env } = await import('../environment.js');
    expect(env.cloudflare.ipAllowlist).toEqual([]);
  });
});

describe('Email Ingestion Gateway — server env', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    delete process.env.GATEWAY_SERVER_URL;
    delete process.env.GATEWAY_CP_TOKEN;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('defaults serverUrl to http://localhost:4000 when absent', async () => {
    const { env } = await import('../environment.js');
    expect(env.server.url).toBe('http://localhost:4000');
  });

  it('treats empty GATEWAY_SERVER_URL as default', async () => {
    process.env.GATEWAY_SERVER_URL = '';
    const { env } = await import('../environment.js');
    expect(env.server.url).toBe('http://localhost:4000');
  });

  it('exposes GATEWAY_SERVER_URL when set', async () => {
    process.env.GATEWAY_SERVER_URL = 'http://server:4000';
    const { env } = await import('../environment.js');
    expect(env.server.url).toBe('http://server:4000');
  });

  it('defaults cpToken to empty string when absent', async () => {
    const { env } = await import('../environment.js');
    expect(env.server.cpToken).toBe('');
  });

  it('exposes GATEWAY_CP_TOKEN when set', async () => {
    process.env.GATEWAY_CP_TOKEN = 'super-secret';
    const { env } = await import('../environment.js');
    expect(env.server.cpToken).toBe('super-secret');
  });

  it('treats empty GATEWAY_CP_TOKEN as empty string', async () => {
    process.env.GATEWAY_CP_TOKEN = '';
    const { env } = await import('../environment.js');
    expect(env.server.cpToken).toBe('');
  });
});
