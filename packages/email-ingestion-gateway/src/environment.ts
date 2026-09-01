import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as dotenv } from 'dotenv';
import zod from 'zod';

// Resolve `.env` relative to this file (package root is one level up from `src/`)
// so it loads regardless of the process's current working directory.
const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

dotenv({
  path:
    process.env.TEST_ENV_FILE && process.env.TEST_ENV_FILE.trim() !== ''
      ? process.env.TEST_ENV_FILE
      : [resolve(packageRoot, '.env')],
  // Opt-in rather than opt-out. In the deployed container the environment comes
  // from the platform and there is no `.env` file, so dotenv's debug output wrote
  // a "failed to load … ENOENT" line plus an "injected env (0)" line on every
  // boot. Both are expected there, but they read as errors at the top of an
  // incident log. The previous `RELEASE`-based gate depended on a variable that
  // is not actually set in the deployment (#4345).
  debug: process.env.DOTENV_DEBUG === '1',
  // Suppresses dotenv's own "injected env (0) from .env // tip: …" banner, which
  // is printed independently of `debug` and is equally meaningless in the
  // deployed container.
  quiet: process.env.DOTENV_DEBUG !== '1',
});

// treat an empty string (`''`) as undefined
const emptyString = <T extends zod.ZodType>(input: T) => {
  return zod.preprocess((value: unknown) => {
    if (value === '') return undefined;
    return value;
  }, input);
};

const GeneralModel = zod.object({
  PORT: emptyString(zod.coerce.number().optional().default(3000)),
});

const FeatureFlagsModel = zod.object({
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

const CloudflareModel = zod.object({
  /** Shared HMAC-SHA256 secret for validating Cloudflare webhook signatures */
  CF_WEBHOOK_SECRET: emptyString(zod.string().optional()),
  /** Comma-separated list of allowed source IPs or IPv4 CIDRs (empty = allowlist disabled) */
  CF_IP_ALLOWLIST: emptyString(zod.string().optional().default('')),
});

const ServerModel = zod.object({
  /** Base URL of the accounter GraphQL server (e.g. http://localhost:4000) */
  GATEWAY_SERVER_URL: emptyString(zod.url().optional().default('http://localhost:4000')),
  /** Shared secret sent in X-Gateway-CP-Token header for gateway_control_plane auth */
  GATEWAY_CP_TOKEN: emptyString(zod.string().optional().default('')),
});

const configs = {
  general: GeneralModel.safeParse(process.env),
  featureFlags: FeatureFlagsModel.safeParse(process.env),
  cloudflare: CloudflareModel.safeParse(process.env),
  server: ServerModel.safeParse(process.env),
};

const environmentErrors: Array<string> = [];

for (const config of Object.values(configs)) {
  if (config.success === false) {
    environmentErrors.push(JSON.stringify(config.error.format(), null, 4));
  }
}

if (environmentErrors.length) {
  const fullError = environmentErrors.join(`\n`);
  console.error('[env] Invalid environment variables:', fullError);
  process.exit(1);
}

function extractConfig<Output>(config: zod.ZodSafeParseResult<Output>): Output {
  if (!config.success) {
    throw new Error('Something went wrong.');
  }
  return config.data;
}

const general = extractConfig(configs.general);
const featureFlags = extractConfig(configs.featureFlags);
const cloudflare = extractConfig(configs.cloudflare);
const server = extractConfig(configs.server);

export const env = {
  general: {
    port: general.PORT,
  },
  featureFlags: {
    v2Enabled: featureFlags.EMAIL_INGESTION_V2_ENABLED === '1',
    shadowMode: featureFlags.EMAIL_INGESTION_SHADOW_MODE === '1',
  },
  cloudflare: {
    webhookSecret: cloudflare.CF_WEBHOOK_SECRET ?? '',
    ipAllowlist: (cloudflare.CF_IP_ALLOWLIST ?? '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean),
  },
  server: {
    url: server.GATEWAY_SERVER_URL,
    cpToken: server.GATEWAY_CP_TOKEN,
  },
} as const;

export type Environment = typeof env;
