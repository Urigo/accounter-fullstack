import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('dotenv', () => ({
  config: vi.fn(),
}));

describe('Email Ingestion Feature Flags (server)', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };

    // Required by other models in environment.ts
    process.env.POSTGRES_HOST = 'localhost';
    process.env.POSTGRES_PORT = '5432';
    process.env.POSTGRES_DB = 'test_db';
    process.env.POSTGRES_USER = 'test_user';
    process.env.POSTGRES_PASSWORD = 'test_password';
    process.env.CREDENTIALS_ENCRYPTION_KEY = 'a'.repeat(64);

    delete process.env.EMAIL_INGESTION_V2_ENABLED;
    delete process.env.EMAIL_INGESTION_SHADOW_MODE;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('defaults both flags to false when env vars are absent', async () => {
    const { env } = await import('../environment.js');
    expect(env.emailIngestion.v2Enabled).toBe(false);
    expect(env.emailIngestion.shadowMode).toBe(false);
  });

  it('treats empty string as false (legacy-safe default)', async () => {
    process.env.EMAIL_INGESTION_V2_ENABLED = '';
    process.env.EMAIL_INGESTION_SHADOW_MODE = '';

    const { env } = await import('../environment.js');
    expect(env.emailIngestion.v2Enabled).toBe(false);
    expect(env.emailIngestion.shadowMode).toBe(false);
  });

  it('enables v2 when EMAIL_INGESTION_V2_ENABLED=1', async () => {
    process.env.EMAIL_INGESTION_V2_ENABLED = '1';

    const { env } = await import('../environment.js');
    expect(env.emailIngestion.v2Enabled).toBe(true);
    expect(env.emailIngestion.shadowMode).toBe(false);
  });

  it('enables shadow mode when EMAIL_INGESTION_SHADOW_MODE=1', async () => {
    process.env.EMAIL_INGESTION_SHADOW_MODE = '1';

    const { env } = await import('../environment.js');
    expect(env.emailIngestion.v2Enabled).toBe(false);
    expect(env.emailIngestion.shadowMode).toBe(true);
  });

  it('enables both flags independently when both are set to 1', async () => {
    process.env.EMAIL_INGESTION_V2_ENABLED = '1';
    process.env.EMAIL_INGESTION_SHADOW_MODE = '1';

    const { env } = await import('../environment.js');
    expect(env.emailIngestion.v2Enabled).toBe(true);
    expect(env.emailIngestion.shadowMode).toBe(true);
  });

  it('treats value "0" as false', async () => {
    process.env.EMAIL_INGESTION_V2_ENABLED = '0';
    process.env.EMAIL_INGESTION_SHADOW_MODE = '0';

    const { env } = await import('../environment.js');
    expect(env.emailIngestion.v2Enabled).toBe(false);
    expect(env.emailIngestion.shadowMode).toBe(false);
  });
});
