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

  it('derives the JWKS url from the issuer when not provided', () => {
    const config = parseEnv(validEnv);
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
