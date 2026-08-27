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
 * | MCP_TOOL_ALLOWLIST          | no       | '' (all tools)           | Comma-separated allowed tool names; empty ⇒ no restriction.       |
 * | MCP_ENABLE_WRITE_TOOLS      | no       | 0                        | Expose mutating (write) tools (`1` on / `0` off).                 |
 * | AUTH0_JWKS_URL              | no       | derived from issuer      | JWKS endpoint; defaults to `<issuer>/.well-known/jwks.json`.      |
 * | GRAPHQL_UPSTREAM_TIMEOUT_MS | no       | 10000                    | Upstream GraphQL request timeout budget in milliseconds.          |
 * | GRAPHQL_UPSTREAM_LONG_TIMEOUT_MS | no  | 300000                   | Budget for long-running upstream calls (document ingestion).      |
 * | MCP_RATE_LIMIT_CONFIG       | no       | '' (defaults applied)    | Optional rate-limit override spec (parsed by the limiter later).  |
 * | OTEL_ENABLED                | no       | 0                        | Master switch for OpenTelemetry tracing (`1` on / `0` off).       |
 * | OTEL_SERVICE_NAME           | no       | accounter-mcp-server     | `service.name` resource attribute.                                |
 * | OTEL_SERVICE_NAMESPACE      | no       | accounter                | `service.namespace` resource attribute.                           |
 * | OTEL_DEPLOYMENT_ENV         | no       | NODE_ENV or development  | `deployment.environment.name` resource attribute.                 |
 * | OTEL_EXPORTER_OTLP_ENDPOINT | if OTEL  | —                        | OTLP/HTTP traces endpoint (required when OTEL_ENABLED=1).          |
 * | OTEL_EXPORTER_OTLP_HEADERS  | no       | —                        | OTLP exporter headers as `key=value,key=value`.                   |
 * | OTEL_TRACES_SAMPLER         | no       | always_on                | Sampler strategy (see builder.ts).                                |
 * | OTEL_TRACES_SAMPLER_ARG     | if ratio | —                        | Ratio 0–1, required for the ratio-based samplers.                 |
 * | OTEL_STARTUP_STRICT         | no       | —                        | `true` ⇒ a telemetry startup failure aborts the process.          |
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
export const envSchema = zod
  .object({
    // --- Required (no safe default) ---
    MCP_PUBLIC_BASE_URL: zod.url({ message: 'MCP_PUBLIC_BASE_1URL must be a valid URL' }),
    AUTH0_ISSUER_URL: zod.url({ message: 'AUTH0_ISSUER_URL must be a valid URL' }),
    AUTH0_AUDIENCE: zod.string().min(1, { message: 'AUTH0_AUDIENCE must be a non-empty string' }),
    GRAPHQL_UPSTREAM_URL: zod.url({ message: 'GRAPHQL_UPSTREAM_URL must be a valid URL' }),

    // --- Optional with secure defaults ---
    MCP_SERVER_PORT: emptyStringAsUndefined(
      zod.coerce.number().int().positive().max(65_535).optional().default(3100),
    ),
    MCP_ENABLED: booleanFlag('1'),
    // Tool allowlist: an empty value imposes no restriction (every registered
    // tool is exposed); a non-empty value restricts `tools/list` and `tools/call`
    // to exactly the named tools. Enforced in `mcp/handler.ts` via
    // `tools/allowlist.ts`. When narrowing, keep `accounter_list_business_memberships`
    // in the set — it is the discovery entry point for business scoping.
    MCP_TOOL_ALLOWLIST: emptyStringAsUndefined(zod.string().optional().default('')),
    // Master switch for mutating tools. Defaults to OFF so upgrading a running
    // deployment never silently grants the model write access: an operator has
    // to opt in per environment. Orthogonal to (and evaluated together with)
    // MCP_TOOL_ALLOWLIST — turning writes on still respects a narrowed allowlist,
    // and a write tool named in the allowlist stays hidden while this is off.
    MCP_ENABLE_WRITE_TOOLS: booleanFlag('0'),
    AUTH0_JWKS_URL: emptyStringAsUndefined(
      zod.url({ message: 'AUTH0_JWKS_URL must be a valid URL' }).optional(),
    ),
    GRAPHQL_UPSTREAM_TIMEOUT_MS: emptyStringAsUndefined(
      zod.coerce.number().int().positive().max(120_000).optional().default(10_000),
    ),
    // Budget for the operations that are slow by nature rather than by fault:
    // document ingestion downloads the file, uploads it to Cloudinary and runs
    // OCR before it writes. The ordinary budget is sized for a database read and
    // expires mid-upload every time, so those calls get this one instead.
    GRAPHQL_UPSTREAM_LONG_TIMEOUT_MS: emptyStringAsUndefined(
      zod.coerce.number().int().positive().max(900_000).optional().default(300_000),
    ),
    MCP_RATE_LIMIT_CONFIG: emptyStringAsUndefined(zod.string().optional().default('')),

    // --- OpenTelemetry (traces exported over OTLP/HTTP to Grafana Tempo) ---
    // Mirrors the main server's OTEL_* configuration so both services share one
    // Grafana backend and the same conventions. Disabled by default; when enabled
    // the exporter endpoint is required. See `../telemetry/builder.ts`.
    OTEL_ENABLED: booleanFlag('0'),
    OTEL_SERVICE_NAME: emptyStringAsUndefined(
      zod.string().optional().default('accounter-mcp-server'),
    ),
    OTEL_SERVICE_NAMESPACE: emptyStringAsUndefined(zod.string().optional().default('accounter')),
    OTEL_DEPLOYMENT_ENV: emptyStringAsUndefined(
      zod
        .string()
        .optional()
        .default(process.env.NODE_ENV ?? 'development'),
    ),
    OTEL_EXPORTER_OTLP_ENDPOINT: emptyStringAsUndefined(zod.string().optional()),
    OTEL_EXPORTER_OTLP_HEADERS: emptyStringAsUndefined(zod.string().optional()),
    OTEL_TRACES_SAMPLER: emptyStringAsUndefined(
      zod
        .enum([
          'parentbased_traceidratio',
          'always_on',
          'always_off',
          'traceidratio',
          'parentbased_always_on',
          'parentbased_always_off',
        ])
        .optional()
        .default('always_on'),
    ),
    OTEL_TRACES_SAMPLER_ARG: emptyStringAsUndefined(zod.string().optional()),
    OTEL_STARTUP_STRICT: emptyStringAsUndefined(
      zod.union([zod.literal('true'), zod.literal('false')]).optional(),
    ),
  })
  .superRefine((data, ctx) => {
    if (data.OTEL_ENABLED === '1' && !data.OTEL_EXPORTER_OTLP_ENDPOINT) {
      ctx.addIssue({
        code: 'custom',
        path: ['OTEL_EXPORTER_OTLP_ENDPOINT'],
        message: 'OTEL_EXPORTER_OTLP_ENDPOINT is required when OTEL_ENABLED is "1".',
      });
    }

    const usesRatioSampler =
      data.OTEL_TRACES_SAMPLER === 'parentbased_traceidratio' ||
      data.OTEL_TRACES_SAMPLER === 'traceidratio';

    if (usesRatioSampler) {
      if (data.OTEL_TRACES_SAMPLER_ARG === undefined) {
        ctx.addIssue({
          code: 'custom',
          path: ['OTEL_TRACES_SAMPLER_ARG'],
          message:
            'OTEL_TRACES_SAMPLER_ARG is required when OTEL_TRACES_SAMPLER is a ratio sampler ("traceidratio" or "parentbased_traceidratio").',
        });
      } else {
        const num = Number(data.OTEL_TRACES_SAMPLER_ARG);
        if (!Number.isFinite(num) || num < 0 || num > 1) {
          ctx.addIssue({
            code: 'custom',
            path: ['OTEL_TRACES_SAMPLER_ARG'],
            message: 'OTEL_TRACES_SAMPLER_ARG must be a numeric string between 0 and 1.',
          });
        }
      }
    }
  });

export type RawEnv = zod.infer<typeof envSchema>;

/** Typed, normalized configuration object consumed by the rest of the server. */
export interface AppConfig {
  server: {
    port: number;
    /** Public origin without a trailing slash. */
    publicBaseUrl: string;
    enabled: boolean;
    /** Parsed tool allowlist; empty array means "no restriction" (all tools). */
    toolAllowlist: readonly string[];
    /** Whether mutating (write) tools are exposed at all. Off by default. */
    writeToolsEnabled: boolean;
  };
  auth0: {
    issuerUrl: string;
    audience: string;
    jwksUrl: string;
  };
  upstream: {
    graphqlUrl: string;
    timeoutMs: number;
    /** Budget for operations a tool marks long-running (document ingestion). */
    longTimeoutMs: number;
  };
  rateLimit: {
    /** Raw config spec; parsed by the rate limiter in a later prompt. */
    raw: string;
  };
  otel: {
    /** Master switch; when false the telemetry SDK is never started. */
    enabled: boolean;
    /** `service.name` resource attribute. */
    serviceName: string;
    /** `service.namespace` resource attribute. */
    serviceNamespace: string;
    /** `deployment.environment.name` resource attribute. */
    deploymentEnv: string;
    /** OTLP/HTTP traces endpoint (e.g. `http://localhost:4318/v1/traces`). */
    exporterEndpoint: string | undefined;
    /** OTLP exporter headers as a raw `key=value,key=value` string. */
    exporterHeaders: string | undefined;
    /** Trace sampler strategy. */
    tracesSampler:
      | 'parentbased_traceidratio'
      | 'always_on'
      | 'always_off'
      | 'traceidratio'
      | 'parentbased_always_on'
      | 'parentbased_always_off';
    /** Ratio (0–1) for the ratio-based samplers; undefined otherwise. */
    tracesSamplerArg: number | undefined;
    /** When true, a telemetry startup failure aborts the process. */
    startupStrict: boolean;
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

const ensureTrailingSlash = (url: string): string => `${stripTrailingSlash(url)}/`;

const deriveJwksUrl = (issuerUrl: string): string =>
  new URL('.well-known/jwks.json', ensureTrailingSlash(issuerUrl)).toString();

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
      writeToolsEnabled: raw.MCP_ENABLE_WRITE_TOOLS === '1',
    },
    auth0: {
      issuerUrl: ensureTrailingSlash(raw.AUTH0_ISSUER_URL),
      audience: raw.AUTH0_AUDIENCE,
      jwksUrl: raw.AUTH0_JWKS_URL ?? deriveJwksUrl(raw.AUTH0_ISSUER_URL),
    },
    upstream: {
      graphqlUrl: raw.GRAPHQL_UPSTREAM_URL,
      timeoutMs: raw.GRAPHQL_UPSTREAM_TIMEOUT_MS,
      longTimeoutMs: Math.max(
        raw.GRAPHQL_UPSTREAM_LONG_TIMEOUT_MS,
        raw.GRAPHQL_UPSTREAM_TIMEOUT_MS,
      ),
    },
    rateLimit: {
      raw: raw.MCP_RATE_LIMIT_CONFIG,
    },
    otel: {
      enabled: raw.OTEL_ENABLED === '1',
      serviceName: raw.OTEL_SERVICE_NAME,
      serviceNamespace: raw.OTEL_SERVICE_NAMESPACE,
      deploymentEnv: raw.OTEL_DEPLOYMENT_ENV,
      exporterEndpoint: raw.OTEL_EXPORTER_OTLP_ENDPOINT,
      exporterHeaders: raw.OTEL_EXPORTER_OTLP_HEADERS,
      tracesSampler: raw.OTEL_TRACES_SAMPLER,
      tracesSamplerArg:
        (raw.OTEL_TRACES_SAMPLER === 'parentbased_traceidratio' ||
          raw.OTEL_TRACES_SAMPLER === 'traceidratio') &&
        raw.OTEL_TRACES_SAMPLER_ARG !== undefined
          ? Number(raw.OTEL_TRACES_SAMPLER_ARG)
          : undefined,
      startupStrict: raw.OTEL_STARTUP_STRICT === 'true',
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
    // Populate the caller-provided source (defaults to process.env) rather than
    // always mutating process.env, so a custom source is honored end to end.
    processEnv: source,
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
