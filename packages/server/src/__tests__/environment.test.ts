import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// We must mock dotenv to prevent it from overwriting our manual process.env changes
// or picking up a real .env file that might confuse things
vi.mock('dotenv', () => ({
  config: vi.fn(),
}));

describe('Environment Configuration', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };

    // Mock common required vars here
    process.env.POSTGRES_HOST = 'localhost';
    process.env.POSTGRES_PORT = '5432';
    process.env.POSTGRES_DB = 'test_db';
    process.env.POSTGRES_USER = 'test_user';
    process.env.POSTGRES_PASSWORD = 'test_password';
    process.env.DEFAULT_FINANCIAL_ENTITY_ID = 'some-id';
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should load Auth0 configuration when provided', async () => {
    process.env.AUTH0_DOMAIN = 'test-domain';
    process.env.AUTH0_AUDIENCE = 'test-audience';
    process.env.AUTH0_CLIENT_ID = 'test-client-id';
    process.env.AUTH0_CLIENT_SECRET = 'test-client-secret';
    process.env.AUTH0_MANAGEMENT_AUDIENCE = 'test-management-audience';

    const { env } = await import('../environment.js');

    expect(env.auth0).toEqual({
      domain: 'test-domain',
      audience: 'test-audience',
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
      managementAudience: 'test-management-audience',
    });
  });

  it('should not load Auth0 configuration when variables are missing', async () => {
    delete process.env.AUTH0_DOMAIN;
    delete process.env.AUTH0_AUDIENCE;
    delete process.env.AUTH0_CLIENT_ID;
    delete process.env.AUTH0_CLIENT_SECRET;
    delete process.env.AUTH0_MANAGEMENT_AUDIENCE;

    const { env } = await import('../environment.js');

    expect(env.auth0).toBeUndefined();
  });

  it('should fail validation when partially configured', async () => {
    // Reset modules to ensure environment.ts is re-executed
    vi.resetModules();

    // Ensure clean slate for this test
    delete process.env.AUTH0_DOMAIN;
    delete process.env.AUTH0_AUDIENCE;
    delete process.env.AUTH0_CLIENT_ID;
    delete process.env.AUTH0_CLIENT_SECRET;
    delete process.env.AUTH0_MANAGEMENT_AUDIENCE;

    process.env.AUTH0_DOMAIN = 'test-domain';
    // Missing others

    // Since environment.ts exits the process on failure, we need to spy on process.exit
    // and console.error
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as any);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      await import('../environment.js');
    } catch (e) {
      // Expected error because we mocked process.exit to not actually exit, 
      // so code continued and hit the extractConfig check
    }

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('❌ Invalid environment variables:'),
      expect.stringContaining('AUTH0_AUDIENCE'), // Expect mention of missing field
    );
  });
});
