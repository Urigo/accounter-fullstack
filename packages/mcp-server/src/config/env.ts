import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as dotenv } from 'dotenv';
import zod from 'zod';

/**
 * Environment configuration for the Accounter MCP server.
 *
 * All configuration is validated at startup with a strict schema. Missing
 * required variables or malformed values cause the process to exit immediately
 * with a clear, actionable error (fail-fast) rather than failing later at
 * request time.
 *
 * | Variable                    | Required | Default                  | Description                                                        |
 * | --------------------------- | -------- | ------------------------ | ------------------------------------------------------------------ |
 * | MCP_PUBLIC_BASE_URL         | yes      | —                        | Public HTTPS origin of this MCP server (used in OAuth metadata).   |
 * | AUTH0_ISSUER_URL            | yes      | —                        | Auth0 issuer/tenant URL used to validate access tokens.           |
 * | AUTH0_AUDIENCE              | yes      | —                        | Expected `aud` claim for incoming access tokens.                  |
 * | GRAPHQL_UPSTREAM_URL        | yes      | —                        | Base URL of the Accounter GraphQL server the tools call.          |
 * | MCP_SERVER_PORT             | no       | 3100                     | TCP port the HTTP transport listens on.                           |
 * | MCP_ENABLED                 | no       | 1                        | Master kill-switch (`1` on / `0` off).                            |
 * | MCP_TOOL_ALLOWLIST          | no       | '' (none)                | Comma-separated tool names allowed in production (least priv).    |
 * | AUTH0_JWKS_URL              | no       | derived from issuer      | JWKS endpoint; defaults to `<issuer>/.well-known/jwks.json`.      |
 * | GRAPHQL_UPSTREAM_TIMEOUT_MS | no       | 10000                    | Upstream GraphQL request timeout budget in milliseconds.          |
 * | MCP_RATE_LIMIT_CONFIG       | no       | '' (defaults applied)    | Optional rate-limit override spec (parsed by the limiter later).  |
 *
 * Secrets are never embedded here; they are supplied via the environment only.
 */

/** Treat an empty string (`''`) as `undefined` so defaults apply cleanly. */
const emptyStringAsUndefined = <T extends zod.ZodType>(input: T) =>
  zod.preprocess((value: unknown) => (value === '' ? undefined : value), input);

const booleanFlag = (defaultValue: '0' | '1') =>
  emptyStringAsUndefined(
    zod
      .union([zod.literal('1'), zod.literal('0')])
      .optional()
      .default(defaultValue),
  );

/**
 * Strict schema for the raw process environment. `.strict()` is intentionally
 * NOT used here because the ambient environment contains many unrelated
 * variables; instead we only read the keys we know about.
 */
export const envSchema = zod.object({
  // --- Required (no safe default) ---
  MCP_PUBLIC_BASE_URL: zod.url({ error: 'MCP_PUBLIC_BASE_URL must be a valid URL' }),
  AUTH0_ISSUER_URL: zod.url({ error: 'AUTH0_ISSUER_URL must be a valid URL' }),
  AUTH0_AUDIENCE: zod.string().min(1, { error: 'AUTH0_AUDIENCE must be a non-empty string' }),
  GRAPHQL_UPSTREAM_URL: zod.url({ error: 'GRAPHQL_UPSTREAM_URL must be a valid URL' }),

  // --- Optional with secure defaults ---
  MCP_SERVER_PORT: emptyStringAsUndefined(
    zod.coerce.number().int().positive().max(65_535).optional().default(3100),
  ),
  MCP_ENABLED: booleanFlag('1'),
  // Least-privilege default: empty allowlist means no tools are exposed unless
  // explicitly enabled. The registry enforces this in later prompts.
  MCP_TOOL_ALLOWLIST: emptyStringAsUndefined(zod.string().optional().default('')),
  AUTH0_JWKS_URL: emptyStringAsUndefined(
    zod.url({ error: 'AUTH0_JWKS_URL must be a valid URL' }).optional(),
  ),
  GRAPHQL_UPSTREAM_TIMEOUT_MS: emptyStringAsUndefined(
    zod.coerce.number().int().positive().max(120_000).optional().default(10_000),
  ),
  MCP_RATE_LIMIT_CONFIG: emptyStringAsUndefined(zod.string().optional().default('')),
});

export type RawEnv = zod.infer<typeof envSchema>;

/** Typed, normalized configuration object consumed by the rest of the server. */
export interface AppConfig {
  server: {
    port: number;
    /** Public origin without a trailing slash. */
    publicBaseUrl: string;
    enabled: boolean;
    /** Parsed tool allowlist; empty array means "no tools exposed". */
    toolAllowlist: readonly string[];
  };
  auth0: {
    issuerUrl: string;
    audience: string;
    jwksUrl: string;
  };
  upstream: {
    graphqlUrl: string;
    timeoutMs: number;
  };
  rateLimit: {
    /** Raw config spec; parsed by the rate limiter in a later prompt. */
    raw: string;
  };
}

/** Thrown when environment validation fails. Carries a human-readable report. */
export class EnvValidationError extends Error {
  constructor(public readonly report: string) {
    super(`Invalid environment configuration:\n${report}`);
    this.name = 'EnvValidationError';
  }
}

const stripTrailingSlash = (url: string): string => url.replace(/\/+$/, '');

const deriveJwksUrl = (issuerUrl: string): string =>
  new URL('.well-known/jwks.json', `${stripTrailingSlash(issuerUrl)}/`).toString();

/**
 * Validate a raw environment source and build the typed config. Throws
 * {@link EnvValidationError} on any validation failure. Pure and side-effect
 * free, so it is directly unit-testable.
 */
export function parseEnv(source: NodeJS.ProcessEnv): AppConfig {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    throw new EnvValidationError(JSON.stringify(zod.treeifyError(result.error), null, 2));
  }

  const raw = result.data;
  return {
    server: {
      port: raw.MCP_SERVER_PORT,
      publicBaseUrl: stripTrailingSlash(raw.MCP_PUBLIC_BASE_URL),
      enabled: raw.MCP_ENABLED === '1',
      toolAllowlist: raw.MCP_TOOL_ALLOWLIST.split(',')
        .map(name => name.trim())
        .filter(Boolean),
    },
    auth0: {
      issuerUrl: raw.AUTH0_ISSUER_URL,
      audience: raw.AUTH0_AUDIENCE,
      jwksUrl: raw.AUTH0_JWKS_URL ?? deriveJwksUrl(raw.AUTH0_ISSUER_URL),
    },
    upstream: {
      graphqlUrl: raw.GRAPHQL_UPSTREAM_URL,
      timeoutMs: raw.GRAPHQL_UPSTREAM_TIMEOUT_MS,
    },
    rateLimit: {
      raw: raw.MCP_RATE_LIMIT_CONFIG,
    },
  };
}

/**
 * Load `.env` (package-root relative, or `TEST_ENV_FILE` when set) and validate.
 * On failure, prints a clear report and exits the process (fail-fast startup).
 */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): AppConfig {
  const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
  dotenv({
    path:
      process.env.TEST_ENV_FILE && process.env.TEST_ENV_FILE.trim() !== ''
        ? process.env.TEST_ENV_FILE
        : [resolve(packageRoot, '.env')],
    // Only surface dotenv's own debug noise outside of release builds.
    debug: process.env.RELEASE ? false : undefined,
  });

  try {
    return parseEnv(source);
  } catch (error) {
    if (error instanceof EnvValidationError) {
      // eslint-disable-next-line no-console
      console.error('[env] Invalid environment variables:\n' + error.report);
      process.exit(1);
    }
    throw error;
  }
}

let cachedConfig: AppConfig | undefined;

/**
 * Lazily load and memoize the validated configuration. Deferring the load keeps
 * merely importing this module side-effect free (so unit tests can import the
 * pure helpers without triggering fail-fast `process.exit`), while the first
 * real access still fails fast on a bad environment.
 */
export function getEnv(): AppConfig {
  cachedConfig ??= loadEnv();
  return cachedConfig;
}

/** Test-only hook to reset the memoized config. */
export function resetEnvCache(): void {
  cachedConfig = undefined;
}

/**
 * Validated, typed configuration for this process. Access is lazy: the
 * environment is loaded and validated on first property read.
 */
export const env: AppConfig = new Proxy({} as AppConfig, {
  get: (_target, property: keyof AppConfig) => getEnv()[property],
}) as AppConfig;
