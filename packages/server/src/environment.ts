import { config as dotenv } from 'dotenv';
import zod from 'zod';

// Prefer isolated test env file when provided, otherwise fall back to repo-level .env
dotenv({
  path:
    process.env.TEST_ENV_FILE && process.env.TEST_ENV_FILE.trim() !== ''
      ? process.env.TEST_ENV_FILE
      : ['.env', '../../.env'],
  debug: process.env.RELEASE ? false : true,
});

const isNumberString = (input: unknown) => zod.string().regex(/^\d+$/).safeParse(input).success;

const numberFromNumberOrNumberString = (input: unknown): number | undefined => {
  if (typeof input === 'number') return input;
  if (isNumberString(input)) return Number(input);
  return undefined;
};

const NumberFromString = zod.preprocess(numberFromNumberOrNumberString, zod.number().min(1));

/** Same as `NumberFromString`, but `0` is a meaningful value (e.g. "disabled"). */
const NonNegativeNumberFromString = zod.preprocess(
  numberFromNumberOrNumberString,
  zod.number().min(0),
);

// treat an empty string (`''`) as undefined
const emptyString = <T extends zod.ZodType>(input: T) => {
  return zod.preprocess((value: unknown) => {
    if (value === '') return undefined;
    return value;
  }, input);
};

const PostgresModel = zod.object({
  POSTGRES_SSL: emptyString(zod.union([zod.literal('1'), zod.literal('0')]).optional()),
  POSTGRES_HOST: zod.string(),
  POSTGRES_PORT: NumberFromString,
  POSTGRES_DB: zod.string(),
  POSTGRES_USER: zod.string(),
  POSTGRES_PASSWORD: zod.string(),
  POSTGRES_MAX_CLIENTS: emptyString(NumberFromString).optional().default(20),
  /**
   * How long `pool.connect()` may wait for a free connection before failing.
   * pg's own default is to wait forever, which turns an exhausted pool into a
   * silent, permanent wedge — so this is always set, and the schema rejects
   * `0` to keep "wait forever" unreachable through configuration.
   */
  POSTGRES_CONNECTION_TIMEOUT_MS: emptyString(NumberFromString).optional().default(10_000),
  /**
   * Server-side cap on a single statement. Generous by default so bulk
   * mutations (merges, ledger regeneration, imports) are unaffected; it exists
   * to bound a pathological query, not to police normal ones.
   */
  POSTGRES_STATEMENT_TIMEOUT_MS: emptyString(NumberFromString).optional().default(120_000),
  /**
   * Postgres-side backstop against leaked sessions: a connection left `idle in
   * transaction` this long is terminated by the server.
   *
   * Must stay comfortably above the longest legitimate in-request pause. The
   * request-scoped session model keeps a transaction open across external I/O
   * (document OCR, Green Invoice, Cloudinary), so a too-aggressive value would
   * kill live requests. 5 minutes bounds a leak without touching real traffic.
   */
  POSTGRES_IDLE_IN_TRANSACTION_TIMEOUT_MS: emptyString(NumberFromString)
    .optional()
    .default(300_000),
  /**
   * How long an *idle* pooled connection is kept before the pool retires it.
   *
   * Must stay comfortably **below** the idle cutoff enforced by the database and
   * by anything sitting between the server and it (proxy, load balancer, NAT).
   * A connection killed from the far side while idle stays in the pool: the next
   * checkout hands it out, that request fails immediately with
   * `Connection terminated unexpectedly` / `ECONNRESET`, `pg` discards it, and
   * everything afterwards works — the exact "only the first request after a quiet
   * period fails" signature in #4348. 10 s (pg's own default, now explicit so it
   * cannot drift) is below any realistic middlebox timeout.
   */
  POSTGRES_IDLE_TIMEOUT_MS: emptyString(NumberFromString).optional().default(10_000),
  /**
   * Client-side counterpart to the above: a TenantAwareDBClient whose last
   * query finished this long ago is force-disposed by the watchdog, returning
   * its connection to the pool.
   *
   * Must sit below `POSTGRES_IDLE_IN_TRANSACTION_TIMEOUT_MS` by at least two
   * sweep intervals (enforced at startup, see `watchdogCeilingProblems`). If
   * Postgres gets there first, it kills the session, the client's error handler
   * drops it, and the watchdog's line — the only one that names the last query
   * and the operation — is never written. The default is 300s - 2 x 30s.
   */
  POSTGRES_CLIENT_MAX_IDLE_MS: emptyString(NumberFromString).optional().default(240_000),
  /**
   * The same ceiling for a client whose GraphQL operation is *still executing*.
   * Defaults to `POSTGRES_CLIENT_MAX_IDLE_MS`, and is never lower than it.
   *
   * It used to default to 15 minutes, for document ingestion, which is quiet on
   * the database while it downloads a file, uploads it to Cloudinary and waits
   * on OCR. That allowance could never take effect: a client holding a
   * connection that long is `idle in transaction`, and Postgres terminates it at
   * `POSTGRES_IDLE_IN_TRANSACTION_TIMEOUT_MS` first. Ingestion now hands its
   * connection back for the external stretch (`releaseDbConnectionForExternalWork`),
   * so it is not a connection holder at all while it waits. Like every ceiling,
   * this must stay below the idle-in-transaction timeout (enforced at startup).
   */
  POSTGRES_ACTIVE_CLIENT_MAX_IDLE_MS: emptyString(NumberFromString).optional(),
  /**
   * Ceiling for a client whose caller already hung up.
   *
   * Disposal is deferred for those requests — the operation keeps running and
   * still has to write — and this is what bounds the deferral. Tight on purpose:
   * a request still doing real work keeps querying and never reaches it, while
   * one whose execution died with the connection (a query urql cancelled on the
   * next keystroke) goes silent at once and is reclaimed promptly.
   *
   * Floored at `POSTGRES_STATEMENT_TIMEOUT_MS + 30s` — a long query only bumps
   * activity at its start and end, so a lower value would reclaim a connection
   * mid-query. A smaller setting is raised to that floor rather than honoured.
   */
  POSTGRES_ABORTED_CLIENT_MAX_IDLE_MS: emptyString(NumberFromString).optional().default(150_000),
  /**
   * How often the watchdog sweeps for leaked connections. Defaults to the
   * smaller of 30s and the idle ceiling, so a tightened ceiling is still
   * enforced promptly.
   */
  POSTGRES_WATCHDOG_INTERVAL_MS: emptyString(NumberFromString).optional(),
  /** Interval for the pool/session health heartbeat log. `0` disables it. */
  POSTGRES_MONITOR_INTERVAL_MS: emptyString(NonNegativeNumberFromString).optional().default(30_000),
});

const CloudinaryModel = zod.union([
  zod
    .object({
      CLOUDINARY_NAME: zod.string().optional(),
      CLOUDINARY_API_KEY: zod.string().optional(),
      CLOUDINARY_API_SECRET: zod.string().optional(),
    })
    .superRefine((data, ctx) => {
      if (
        !!data.CLOUDINARY_NAME !== !!data.CLOUDINARY_API_KEY ||
        !!data.CLOUDINARY_NAME !== !!data.CLOUDINARY_API_SECRET
      ) {
        ctx.addIssue({
          code: 'custom',
          message:
            'CLOUDINARY_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET must be provided together.',
        });
      }
    }),
  zod.void(),
]);

const HiveModel = zod.union([
  zod.object({
    HIVE_TOKEN: zod.string().optional(),
  }),
  zod.void(),
]);

const GoogleDriveModel = zod.union([
  zod.object({
    GOOGLE_DRIVE_API_KEY: zod.string().optional(),
  }),
  zod.void(),
]);

const CredentialsModel = zod.object({
  CREDENTIALS_ENCRYPTION_KEY: zod
    .string()
    .trim()
    .regex(/^[a-f0-9]{64}$/i),
});

const GeneralModel = zod.object({
  FRONTEND_URL: zod.url().optional(),
});

const OtelModel = zod
  .object({
    OTEL_ENABLED: emptyString(
      zod
        .union([zod.literal('1'), zod.literal('0')])
        .optional()
        .default('0'),
    ),
    OTEL_SERVICE_NAME: emptyString(zod.string().optional().default('accounter-server')),
    OTEL_SERVICE_NAMESPACE: emptyString(zod.string().optional().default('accounter')),
    OTEL_DEPLOYMENT_ENV: emptyString(
      zod
        .string()
        .optional()
        .default(process.env.NODE_ENV ?? 'development'),
    ),
    OTEL_EXPORTER_OTLP_ENDPOINT: emptyString(zod.string().optional()),
    OTEL_EXPORTER_OTLP_HEADERS: emptyString(zod.string().optional()),
    OTEL_TRACES_SAMPLER: emptyString(
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
    OTEL_TRACES_SAMPLER_ARG: emptyString(zod.string().optional()),
    OTEL_STARTUP_STRICT: emptyString(
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

const GatewayControlPlaneModel = zod.object({
  GATEWAY_CP_TOKEN: emptyString(zod.string().optional()),
});

const EmailIngestionModel = zod.object({
  EMAIL_INGESTION_V2_ENABLED: emptyString(
    zod
      .union([zod.literal('1'), zod.literal('0')])
      .optional()
      .default('0'),
  ),
  EMAIL_INGESTION_SHADOW_MODE: emptyString(
    zod
      .union([zod.literal('1'), zod.literal('0')])
      .optional()
      .default('0'),
  ),
});

// One level for Yoga and Hive (whose Yoga plugin logs through Yoga's logger). Validated here so a
// typo fails startup, and never derived from `DEBUG`, which Yoga would otherwise follow.
const LoggingModel = zod.object({
  SERVER_LOG_LEVEL: emptyString(
    zod.enum(['debug', 'info', 'warn', 'error']).optional().default('info'),
  ),
});

const PriceIndexSyncModel = zod.object({
  PRICE_INDEX_SYNC_ENABLED: emptyString(
    zod
      .union([zod.literal('1'), zod.literal('0')])
      .optional()
      .default('1'),
  ),
});

// The Auth0 SDK (v7+) requires `domain` to be a bare hostname and throws from the
// `ManagementClient` constructor when it carries a scheme, path, query string or
// fragment. The rest of the codebase already assumes a bare hostname too (it builds
// `https://${domain}/...` for the JWKS and issuer URLs), so validate it here: a bad
// value fails at startup with an actionable message instead of throwing later from
// inside the DI container.
const Auth0DomainModel = zod
  .string()
  .min(1)
  .refine(value => !/^[a-z][a-z\d+\-.]*:\/\//i.test(value), {
    message:
      'AUTH0_DOMAIN must not include a scheme (use "tenant.us.auth0.com", not "https://tenant.us.auth0.com")',
  })
  .refine(value => !/[/?#]/.test(value), {
    message: 'AUTH0_DOMAIN must be a bare hostname, without a path, query string or fragment',
  });

const Auth0Model = zod.union([
  zod.object({
    AUTH0_DOMAIN: Auth0DomainModel,
    AUTH0_AUDIENCE: zod.string().min(1),
    AUTH0_CLIENT_ID: zod.string().min(1),
    AUTH0_CLIENT_SECRET: zod.string().min(1),
    AUTH0_MANAGEMENT_AUDIENCE: zod.string().min(1),
  }),
  // If no Auth0 variables are provided, validation passes (optional configuration)
  // We use a looser object check here because process.env is always an object
  zod
    .object({
      AUTH0_DOMAIN: zod.literal('').optional(),
      AUTH0_AUDIENCE: zod.literal('').optional(),
      AUTH0_CLIENT_ID: zod.literal('').optional(),
      AUTH0_CLIENT_SECRET: zod.literal('').optional(),
      AUTH0_MANAGEMENT_AUDIENCE: zod.literal('').optional(),
    })
    .transform(() => undefined),
]);

const configs = {
  postgres: PostgresModel.safeParse(process.env),
  cloudinary: CloudinaryModel.safeParse(process.env),
  hive: HiveModel.safeParse(process.env),
  googleDrive: GoogleDriveModel.safeParse(process.env),
  auth0: Auth0Model.safeParse(process.env),
  credentials: CredentialsModel.safeParse(process.env),
  general: GeneralModel.safeParse(process.env),
  otel: OtelModel.safeParse(process.env),
  emailIngestion: EmailIngestionModel.safeParse(process.env),
  gatewayControlPlane: GatewayControlPlaneModel.safeParse(process.env),
  priceIndexSync: PriceIndexSyncModel.safeParse(process.env),
  logging: LoggingModel.safeParse(process.env),
};

const environmentErrors: Array<string> = [];

for (const config of Object.values(configs)) {
  if (config.success === false) {
    environmentErrors.push(JSON.stringify(config.error.format(), null, 4));
  }
}

if (environmentErrors.length) {
  const fullError = environmentErrors.join(`\n`);
  console.error('❌ Invalid environment variables:', fullError);
  process.exit(1);
}

function extractConfig<Output>(config: zod.ZodSafeParseResult<Output>): Output {
  if (!config.success) {
    throw new Error('Something went wrong.');
  }
  return config.data;
}

const postgres = extractConfig(configs.postgres);
const cloudinary = extractConfig(configs.cloudinary);
const hive = extractConfig(configs.hive);
const googleDrive = extractConfig(configs.googleDrive);
const auth0 = extractConfig(configs.auth0);
const credentials = extractConfig(configs.credentials);
const general = extractConfig(configs.general);
const otel = extractConfig(configs.otel);
const emailIngestion = extractConfig(configs.emailIngestion);
const gatewayControlPlane = extractConfig(configs.gatewayControlPlane);
const priceIndexSync = extractConfig(configs.priceIndexSync);
const logging = extractConfig(configs.logging);

export const env = {
  postgres: {
    host: postgres.POSTGRES_HOST,
    port: postgres.POSTGRES_PORT,
    db: postgres.POSTGRES_DB,
    user: postgres.POSTGRES_USER,
    password: postgres.POSTGRES_PASSWORD,
    ssl: postgres.POSTGRES_SSL === '1',
    max: postgres.POSTGRES_MAX_CLIENTS,
    connectionTimeoutMs: postgres.POSTGRES_CONNECTION_TIMEOUT_MS,
    statementTimeoutMs: postgres.POSTGRES_STATEMENT_TIMEOUT_MS,
    idleInTransactionTimeoutMs: postgres.POSTGRES_IDLE_IN_TRANSACTION_TIMEOUT_MS,
    idleTimeoutMs: postgres.POSTGRES_IDLE_TIMEOUT_MS,
    clientMaxIdleMs: postgres.POSTGRES_CLIENT_MAX_IDLE_MS,
    activeClientMaxIdleMs: Math.max(
      postgres.POSTGRES_ACTIVE_CLIENT_MAX_IDLE_MS ?? postgres.POSTGRES_CLIENT_MAX_IDLE_MS,
      postgres.POSTGRES_CLIENT_MAX_IDLE_MS,
    ),
    // Floored above the statement timeout rather than merely documented as
    // needing to be: a long query bumps activity only at its start and end, so
    // an aborted ceiling below it would reclaim a connection out from under a
    // query that is still running. The margin is what keeps a query that runs
    // right up to the statement timeout from being caught at the boundary.
    abortedClientMaxIdleMs: Math.max(
      postgres.POSTGRES_ABORTED_CLIENT_MAX_IDLE_MS,
      postgres.POSTGRES_STATEMENT_TIMEOUT_MS + 30_000,
    ),
    watchdogIntervalMs:
      postgres.POSTGRES_WATCHDOG_INTERVAL_MS ??
      Math.min(postgres.POSTGRES_CLIENT_MAX_IDLE_MS, 30_000),
    monitorIntervalMs: postgres.POSTGRES_MONITOR_INTERVAL_MS,
  },
  cloudinary: cloudinary?.CLOUDINARY_API_KEY
    ? {
        name: cloudinary.CLOUDINARY_NAME!,
        apiKey: cloudinary.CLOUDINARY_API_KEY!,
        apiSecret: cloudinary.CLOUDINARY_API_SECRET!,
      }
    : undefined,
  hive: hive?.HIVE_TOKEN
    ? {
        hiveToken: hive.HIVE_TOKEN!,
      }
    : undefined,
  googleDrive: googleDrive?.GOOGLE_DRIVE_API_KEY
    ? {
        driveApiKey: googleDrive.GOOGLE_DRIVE_API_KEY!,
      }
    : undefined,
  credentialsEncryptionKey: credentials.CREDENTIALS_ENCRYPTION_KEY,
  auth0: auth0
    ? {
        domain: auth0.AUTH0_DOMAIN,
        audience: auth0.AUTH0_AUDIENCE,
        clientId: auth0.AUTH0_CLIENT_ID,
        clientSecret: auth0.AUTH0_CLIENT_SECRET,
        managementAudience: auth0.AUTH0_MANAGEMENT_AUDIENCE,
      }
    : undefined,
  general: {
    frontendUrl: general?.FRONTEND_URL,
  },
  otel: {
    enabled: otel.OTEL_ENABLED === '1',
    serviceName: otel.OTEL_SERVICE_NAME,
    serviceNamespace: otel.OTEL_SERVICE_NAMESPACE,
    deploymentEnv: otel.OTEL_DEPLOYMENT_ENV,
    exporterEndpoint: otel.OTEL_EXPORTER_OTLP_ENDPOINT,
    exporterHeaders: otel.OTEL_EXPORTER_OTLP_HEADERS,
    tracesSampler: otel.OTEL_TRACES_SAMPLER,
    tracesSamplerArg:
      (otel.OTEL_TRACES_SAMPLER === 'parentbased_traceidratio' ||
        otel.OTEL_TRACES_SAMPLER === 'traceidratio') &&
      otel.OTEL_TRACES_SAMPLER_ARG !== undefined
        ? Number(otel.OTEL_TRACES_SAMPLER_ARG)
        : undefined,
    startupStrict: otel.OTEL_STARTUP_STRICT === 'true',
  },
  emailIngestion: {
    v2Enabled: emailIngestion.EMAIL_INGESTION_V2_ENABLED === '1',
    shadowMode: emailIngestion.EMAIL_INGESTION_SHADOW_MODE === '1',
  },
  gatewayControlPlane: {
    token: gatewayControlPlane.GATEWAY_CP_TOKEN,
  },
  priceIndexSync: {
    enabled: priceIndexSync.PRICE_INDEX_SYNC_ENABLED === '1',
  },
  logging: {
    level: logging.SERVER_LOG_LEVEL,
  },
} as const;

/** The settings {@link watchdogCeilingProblems} checks. */
export type WatchdogCeilingSettings = Pick<
  (typeof env)['postgres'],
  | 'idleInTransactionTimeoutMs'
  | 'clientMaxIdleMs'
  | 'activeClientMaxIdleMs'
  | 'abortedClientMaxIdleMs'
  | 'watchdogIntervalMs'
>;

/**
 * Every leak-watchdog ceiling must leave the watchdog time to act before
 * Postgres does.
 *
 * Postgres terminates a session left `idle in transaction` for
 * `idleInTransactionTimeoutMs`. A leaked client is noticed by the watchdog only
 * on a sweep, so up to one interval after its ceiling has passed; a second
 * interval of margin absorbs timer drift and a sweep that lands just short. If
 * Postgres wins that race, the connection is dropped through the client's error
 * handler instead, and the watchdog's line — the one that names the last query
 * and the leaking operation — is never written. That is what happened in the
 * 2026-10-09 production logs (#4871): 19 sessions killed, no watchdog lines.
 *
 * @returns one message per ceiling that is too high; empty when all are fine.
 */
export function watchdogCeilingProblems(settings: WatchdogCeilingSettings): string[] {
  const margin = 2 * settings.watchdogIntervalMs;
  const limit = settings.idleInTransactionTimeoutMs - margin;
  const ceilings: Array<[name: string, value: number, note?: string]> = [
    ['POSTGRES_CLIENT_MAX_IDLE_MS', settings.clientMaxIdleMs],
    [
      'POSTGRES_ACTIVE_CLIENT_MAX_IDLE_MS',
      settings.activeClientMaxIdleMs,
      'defaults to, and is never lower than, POSTGRES_CLIENT_MAX_IDLE_MS',
    ],
    [
      'POSTGRES_ABORTED_CLIENT_MAX_IDLE_MS',
      settings.abortedClientMaxIdleMs,
      'never lower than POSTGRES_STATEMENT_TIMEOUT_MS + 30s',
    ],
  ];

  return ceilings
    .filter(([, value]) => value > limit)
    .map(
      ([name, value, note]) =>
        `${name} is effectively ${value}ms${note ? ` (${note})` : ''}, but must be at most ` +
        `${limit}ms: POSTGRES_IDLE_IN_TRANSACTION_TIMEOUT_MS (${settings.idleInTransactionTimeoutMs}ms) ` +
        `minus two watchdog sweeps (2 x ${settings.watchdogIntervalMs}ms). Lower the ceiling or raise ` +
        `the idle-in-transaction timeout.`,
    );
}

const watchdogProblems = watchdogCeilingProblems(env.postgres);
if (watchdogProblems.length) {
  console.error('❌ Invalid environment variables:', watchdogProblems.join('\n'));
  process.exit(1);
}
