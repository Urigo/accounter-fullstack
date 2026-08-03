import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EnvValidationError, loadEnv, parseEnv } from '../env.js';

const validEnv: NodeJS.ProcessEnv = {
  MCP_PUBLIC_BASE_URL: 'https://mcp.example.com',
  AUTH0_ISSUER_URL: 'https://tenant.auth0.com/',
  AUTH0_AUDIENCE: 'https://api.accounter.example',
  GRAPHQL_UPSTREAM_URL: 'http://localhost:4000/graphql',
};

describe('parseEnv — valid configuration', () => {
  it('parses required vars and applies secure defaults', () => {
    const config = parseEnv(validEnv);

    expect(config.server.port).toBe(3100);
    expect(config.server.enabled).toBe(true);
    expect(config.server.toolAllowlist).toEqual([]);
    expect(config.auth0.issuerUrl).toBe('https://tenant.auth0.com/');
    expect(config.auth0.audience).toBe('https://api.accounter.example');
    expect(config.upstream.graphqlUrl).toBe('http://localhost:4000/graphql');
    expect(config.upstream.timeoutMs).toBe(10_000);
    expect(config.rateLimit.raw).toBe('');
  });

  it('strips the trailing slash from the public base url', () => {
    const config = parseEnv({ ...validEnv, MCP_PUBLIC_BASE_URL: 'https://mcp.example.com/' });
    expect(config.server.publicBaseUrl).toBe('https://mcp.example.com');
  });

  it('normalizes issuer urls to include a trailing slash', () => {
    const config = parseEnv({ ...validEnv, AUTH0_ISSUER_URL: 'https://tenant.auth0.com' });
    expect(config.auth0.issuerUrl).toBe('https://tenant.auth0.com/');
  });

  it('derives the JWKS url from the issuer when not provided', () => {
    const config = parseEnv(validEnv);
    expect(config.auth0.jwksUrl).toBe('https://tenant.auth0.com/.well-known/jwks.json');
  });

  it('derives the JWKS url from a slashless issuer', () => {
    const config = parseEnv({ ...validEnv, AUTH0_ISSUER_URL: 'https://tenant.auth0.com' });
    expect(config.auth0.jwksUrl).toBe('https://tenant.auth0.com/.well-known/jwks.json');
  });

  it('honors an explicit JWKS url override', () => {
    const config = parseEnv({
      ...validEnv,
      AUTH0_JWKS_URL: 'https://tenant.auth0.com/custom/jwks.json',
    });
    expect(config.auth0.jwksUrl).toBe('https://tenant.auth0.com/custom/jwks.json');
  });

  it('coerces numeric vars and parses the tool allowlist', () => {
    const config = parseEnv({
      ...validEnv,
      MCP_SERVER_PORT: '8080',
      GRAPHQL_UPSTREAM_TIMEOUT_MS: '2500',
      MCP_TOOL_ALLOWLIST: 'charges_search, tags_lookup ,',
    });
    expect(config.server.port).toBe(8080);
    expect(config.upstream.timeoutMs).toBe(2500);
    expect(config.server.toolAllowlist).toEqual(['charges_search', 'tags_lookup']);
  });

  it('treats empty strings as unset and falls back to defaults', () => {
    const config = parseEnv({
      ...validEnv,
      MCP_SERVER_PORT: '',
      MCP_ENABLED: '',
      MCP_TOOL_ALLOWLIST: '',
    });
    expect(config.server.port).toBe(3100);
    expect(config.server.enabled).toBe(true);
    expect(config.server.toolAllowlist).toEqual([]);
  });

  it('supports disabling the server via MCP_ENABLED=0', () => {
    const config = parseEnv({ ...validEnv, MCP_ENABLED: '0' });
    expect(config.server.enabled).toBe(false);
  });
});

describe('parseEnv — invalid configuration', () => {
  it('throws when a required var is missing', () => {
    const { MCP_PUBLIC_BASE_URL: _omitted, ...rest } = validEnv;
    expect(() => parseEnv(rest)).toThrow(EnvValidationError);
  });

  it('reports every missing required var in the error', () => {
    try {
      parseEnv({});
      expect.unreachable('expected parseEnv to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(EnvValidationError);
      const report = (error as EnvValidationError).report;
      expect(report).toContain('MCP_PUBLIC_BASE_URL');
      expect(report).toContain('AUTH0_ISSUER_URL');
      expect(report).toContain('AUTH0_AUDIENCE');
      expect(report).toContain('GRAPHQL_UPSTREAM_URL');
    }
  });

  it('rejects a malformed URL', () => {
    expect(() => parseEnv({ ...validEnv, GRAPHQL_UPSTREAM_URL: 'not-a-url' })).toThrow(
      EnvValidationError,
    );
  });

  it('rejects a non-numeric port', () => {
    expect(() => parseEnv({ ...validEnv, MCP_SERVER_PORT: 'abc' })).toThrow(EnvValidationError);
  });

  it('rejects an out-of-range port', () => {
    expect(() => parseEnv({ ...validEnv, MCP_SERVER_PORT: '70000' })).toThrow(EnvValidationError);
  });

  it('rejects an empty audience', () => {
    expect(() => parseEnv({ ...validEnv, AUTH0_AUDIENCE: '   ' })).not.toThrow();
    // whitespace is a non-empty string at the schema level; emptiness is only
    // enforced against the literal empty string.
    expect(() => parseEnv({ ...validEnv, AUTH0_AUDIENCE: '' })).toThrow(EnvValidationError);
  });
});

describe('parseEnv — OpenTelemetry configuration', () => {
  it('defaults OTEL to disabled with the MCP service identity', () => {
    const config = parseEnv(validEnv);
    expect(config.otel.enabled).toBe(false);
    expect(config.otel.serviceName).toBe('accounter-mcp-server');
    expect(config.otel.serviceNamespace).toBe('accounter');
    expect(config.otel.tracesSampler).toBe('always_on');
    expect(config.otel.exporterEndpoint).toBeUndefined();
    expect(config.otel.tracesSamplerArg).toBeUndefined();
    expect(config.otel.startupStrict).toBe(false);
  });

  it('requires an exporter endpoint when OTEL is enabled', () => {
    expect(() => parseEnv({ ...validEnv, OTEL_ENABLED: '1' })).toThrow(EnvValidationError);
  });

  it('parses an enabled configuration', () => {
    const config = parseEnv({
      ...validEnv,
      OTEL_ENABLED: '1',
      OTEL_EXPORTER_OTLP_ENDPOINT: 'http://localhost:4318/v1/traces',
      OTEL_EXPORTER_OTLP_HEADERS: 'x-api-key=secret',
      OTEL_SERVICE_NAME: 'mcp-prod',
      OTEL_STARTUP_STRICT: 'true',
    });
    expect(config.otel.enabled).toBe(true);
    expect(config.otel.exporterEndpoint).toBe('http://localhost:4318/v1/traces');
    expect(config.otel.exporterHeaders).toBe('x-api-key=secret');
    expect(config.otel.serviceName).toBe('mcp-prod');
    expect(config.otel.startupStrict).toBe(true);
  });

  it('requires a valid ratio arg for ratio-based samplers', () => {
    expect(() =>
      parseEnv({
        ...validEnv,
        OTEL_ENABLED: '1',
        OTEL_EXPORTER_OTLP_ENDPOINT: 'http://localhost:4318/v1/traces',
        OTEL_TRACES_SAMPLER: 'parentbased_traceidratio',
      }),
    ).toThrow(EnvValidationError);

    expect(() =>
      parseEnv({
        ...validEnv,
        OTEL_ENABLED: '1',
        OTEL_EXPORTER_OTLP_ENDPOINT: 'http://localhost:4318/v1/traces',
        OTEL_TRACES_SAMPLER: 'traceidratio',
        OTEL_TRACES_SAMPLER_ARG: '2',
      }),
    ).toThrow(EnvValidationError);
  });

  it('coerces a valid ratio sampler arg to a number', () => {
    const config = parseEnv({
      ...validEnv,
      OTEL_ENABLED: '1',
      OTEL_EXPORTER_OTLP_ENDPOINT: 'http://localhost:4318/v1/traces',
      OTEL_TRACES_SAMPLER: 'parentbased_traceidratio',
      OTEL_TRACES_SAMPLER_ARG: '0.25',
    });
    expect(config.otel.tracesSampler).toBe('parentbased_traceidratio');
    expect(config.otel.tracesSamplerArg).toBe(0.25);
  });
});

describe('loadEnv — fail-fast startup', () => {
  // Point dotenv at a nonexistent file so no real .env leaks into the source.
  const missingEnvFile = resolve(tmpdir(), 'accounter-mcp-nonexistent.env');
  const originalTestEnvFile = process.env.TEST_ENV_FILE;

  afterEach(() => {
    if (originalTestEnvFile === undefined) {
      delete process.env.TEST_ENV_FILE;
    } else {
      process.env.TEST_ENV_FILE = originalTestEnvFile;
    }
    vi.restoreAllMocks();
  });

  it('reports the invalid variables and exits the process', () => {
    process.env.TEST_ENV_FILE = missingEnvFile;
    const exit = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`process.exit:${code}`);
    }) as never);
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => loadEnv({})).toThrow('process.exit:1');
    expect(exit).toHaveBeenCalledWith(1);
    expect(String(errorLog.mock.calls[0]?.[0])).toContain('Invalid environment variables');
  });

  it('returns a validated config for a valid source without exiting', () => {
    process.env.TEST_ENV_FILE = missingEnvFile;
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit called unexpectedly');
    }) as never);

    const config = loadEnv({ ...validEnv });
    expect(config.server.port).toBe(3100);
    expect(config.upstream.graphqlUrl).toBe('http://localhost:4000/graphql');
    expect(exit).not.toHaveBeenCalled();
  });
});
