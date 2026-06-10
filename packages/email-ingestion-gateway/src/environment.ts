import { config as dotenv } from 'dotenv';
import zod from 'zod';

dotenv({
  path:
    process.env.TEST_ENV_FILE && process.env.TEST_ENV_FILE.trim() !== ''
      ? process.env.TEST_ENV_FILE
      : ['.env', '../../.env'],
  debug: process.env.RELEASE ? false : true,
});

// treat an empty string (`''`) as undefined
const emptyString = <T extends zod.ZodType>(input: T) => {
  return zod.preprocess((value: unknown) => {
    if (value === '') return undefined;
    return value;
  }, input);
};

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

const configs = {
  featureFlags: FeatureFlagsModel.safeParse(process.env),
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

const featureFlags = extractConfig(configs.featureFlags);

export const env = {
  featureFlags: {
    v2Enabled: featureFlags.EMAIL_INGESTION_V2_ENABLED === '1',
    shadowMode: featureFlags.EMAIL_INGESTION_SHADOW_MODE === '1',
  },
} as const;

export type Environment = typeof env;
