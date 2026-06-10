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
