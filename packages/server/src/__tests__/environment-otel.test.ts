import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Prevent dotenv from loading a real .env file and overriding our manual env manipulation
vi.mock('dotenv', () => ({
  config: vi.fn(),
}));

describe('OTEL Environment Configuration', () => {
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

    // Clear all OTEL vars for a clean slate
    delete process.env.OTEL_ENABLED;
    delete process.env.OTEL_SERVICE_NAME;
    delete process.env.OTEL_SERVICE_NAMESPACE;
    delete process.env.OTEL_DEPLOYMENT_ENV;
    delete process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
    delete process.env.OTEL_EXPORTER_OTLP_HEADERS;
    delete process.env.OTEL_TRACES_SAMPLER;
    delete process.env.OTEL_TRACES_SAMPLER_ARG;
    delete process.env.OTEL_STARTUP_STRICT;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should use default values when no OTEL env vars are set', async () => {
    const { env } = await import('../environment.js');

    expect(env.otel.enabled).toBe(false);
    expect(env.otel.serviceName).toBe('accounter-server');
    expect(env.otel.serviceNamespace).toBe('accounter');
    expect(env.otel.tracesSampler).toBe('always_on');
    expect(env.otel.startupStrict).toBe(false);
    expect(env.otel.exporterEndpoint).toBeUndefined();
    expect(env.otel.exporterHeaders).toBeUndefined();
    expect(env.otel.tracesSamplerArg).toBeUndefined();
  });

  it('should treat empty string OTEL_ENABLED as disabled', async () => {
    process.env.OTEL_ENABLED = '';

    const { env } = await import('../environment.js');

    expect(env.otel.enabled).toBe(false);
  });

  it('should fail validation when OTEL is enabled but endpoint is missing', async () => {
    process.env.OTEL_ENABLED = '1';
    delete process.env.OTEL_EXPORTER_OTLP_ENDPOINT;

    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as never);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      await import('../environment.js');
    } catch {
      // ignored — extractConfig throws after mocked process.exit
    }

    expect(exitSpy).toHaveBeenCalledWith(1);
    exitSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('should parse a valid enabled OTEL configuration', async () => {
    process.env.OTEL_ENABLED = '1';
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT = 'http://localhost:4318';
    process.env.OTEL_SERVICE_NAME = 'my-service';
    process.env.OTEL_SERVICE_NAMESPACE = 'my-ns';
    process.env.OTEL_DEPLOYMENT_ENV = 'staging';
    process.env.OTEL_TRACES_SAMPLER = 'parentbased_traceidratio';
    process.env.OTEL_TRACES_SAMPLER_ARG = '0.5';
    process.env.OTEL_EXPORTER_OTLP_HEADERS = 'Authorization=Bearer token';
    process.env.OTEL_STARTUP_STRICT = 'true';

    const { env } = await import('../environment.js');

    expect(env.otel.enabled).toBe(true);
    expect(env.otel.exporterEndpoint).toBe('http://localhost:4318');
    expect(env.otel.serviceName).toBe('my-service');
    expect(env.otel.serviceNamespace).toBe('my-ns');
    expect(env.otel.deploymentEnv).toBe('staging');
    expect(env.otel.tracesSampler).toBe('parentbased_traceidratio');
    expect(env.otel.tracesSamplerArg).toBe(0.5);
    expect(env.otel.exporterHeaders).toBe('Authorization=Bearer token');
    expect(env.otel.startupStrict).toBe(true);
  });

  it('should parse OTEL_TRACES_SAMPLER_ARG for traceidratio sampler', async () => {
    process.env.OTEL_ENABLED = '1';
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT = 'http://localhost:4318';
    process.env.OTEL_TRACES_SAMPLER = 'traceidratio';
    process.env.OTEL_TRACES_SAMPLER_ARG = '0.25';

    const { env } = await import('../environment.js');

    expect(env.otel.tracesSampler).toBe('traceidratio');
    expect(env.otel.tracesSamplerArg).toBe(0.25);
  });

  it('should fail validation when OTEL_TRACES_SAMPLER_ARG is out of range', async () => {
    process.env.OTEL_ENABLED = '1';
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT = 'http://localhost:4318';
    process.env.OTEL_TRACES_SAMPLER = 'parentbased_traceidratio';
    process.env.OTEL_TRACES_SAMPLER_ARG = '1.5';

    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as never);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      await import('../environment.js');
    } catch {
      // ignored
    }

    expect(exitSpy).toHaveBeenCalledWith(1);
    exitSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('should fail validation when OTEL_TRACES_SAMPLER_ARG is not numeric', async () => {
    process.env.OTEL_ENABLED = '1';
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT = 'http://localhost:4318';
    process.env.OTEL_TRACES_SAMPLER = 'parentbased_traceidratio';
    process.env.OTEL_TRACES_SAMPLER_ARG = 'not-a-number';

    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as never);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      await import('../environment.js');
    } catch {
      // ignored
    }

    expect(exitSpy).toHaveBeenCalledWith(1);
    exitSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('should accept OTEL_TRACES_SAMPLER_ARG of 0 and 1 (boundaries)', async () => {
    process.env.OTEL_ENABLED = '1';
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT = 'http://localhost:4318';
    process.env.OTEL_TRACES_SAMPLER = 'parentbased_traceidratio';
    process.env.OTEL_TRACES_SAMPLER_ARG = '0';

    const { env: env0 } = await import('../environment.js');
    expect(env0.otel.tracesSamplerArg).toBe(0);

    vi.resetModules();
    process.env.OTEL_TRACES_SAMPLER_ARG = '1';

    const { env: env1 } = await import('../environment.js');
    expect(env1.otel.tracesSamplerArg).toBe(1);
  });

  it('should fail validation when ratio sampler is selected without OTEL_TRACES_SAMPLER_ARG', async () => {
    process.env.OTEL_ENABLED = '1';
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT = 'http://localhost:4318';
    process.env.OTEL_TRACES_SAMPLER = 'parentbased_traceidratio';
    delete process.env.OTEL_TRACES_SAMPLER_ARG;

    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as never);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      await import('../environment.js');
    } catch {
      // ignored
    }

    expect(exitSpy).toHaveBeenCalledWith(1);
    exitSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('should ignore OTEL_TRACES_SAMPLER_ARG when sampler is not ratio-based', async () => {
    process.env.OTEL_ENABLED = '1';
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT = 'http://localhost:4318';
    process.env.OTEL_TRACES_SAMPLER = 'always_off';
    process.env.OTEL_TRACES_SAMPLER_ARG = 'not-a-number';

    const { env } = await import('../environment.js');
    expect(env.otel.tracesSampler).toBe('always_off');
    expect(env.otel.tracesSamplerArg).toBeUndefined();
  });

  it('should not require startup strict and default it to false', async () => {
    process.env.OTEL_ENABLED = '1';
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT = 'http://localhost:4318';
    delete process.env.OTEL_STARTUP_STRICT;

    const { env } = await import('../environment.js');

    expect(env.otel.startupStrict).toBe(false);
  });
});
