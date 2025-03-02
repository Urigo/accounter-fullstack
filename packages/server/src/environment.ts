import { config as dotenv } from 'dotenv';
import zod from 'zod';

dotenv({
  path: '../../.env',
  debug: process.env.RELEASE ? false : true,
});

const isNumberString = (input: unknown) => zod.string().regex(/^\d+$/).safeParse(input).success;

const numberFromNumberOrNumberString = (input: unknown): number | undefined => {
  if (typeof input === 'number') return input;
  if (isNumberString(input)) return Number(input);
  return undefined;
};

const NumberFromString = zod.preprocess(numberFromNumberOrNumberString, zod.number().min(1));

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
});

const CloudinaryModel = zod.union([
  zod.object({
    CLOUDINARY_NAME: zod.string(),
    CLOUDINARY_API_KEY: zod.string(),
    CLOUDINARY_API_SECRET: zod.string(),
  }),
  zod.void(),
]);

const GreenInvoiceModel = zod.union([
  zod.object({
    GREEN_INVOICE_ID: zod.string(),
    GREEN_INVOICE_SECRET: zod.string(),
  }),
  zod.void(),
]);

const AuthorizationModel = zod.object({
  AUTHORIZED_USERS: zod.union([zod.string(), zod.void()]),
  DEFAULT_FINANCIAL_ENTITY_ID: zod.string(),
});

const HiveModel = zod.union([
  zod.object({
    HIVE_TOKEN: zod.string().optional(),
    HIVE_GATEWAY_PORT: NumberFromString.optional(),
    HIVE_SUBGRAPH_PORT: NumberFromString.optional(),
    HIVE_DEV_REGISTRY_TOKEN: zod.string().optional(),
    HIVE_MAIN_REGISTRY_TOKEN: zod.string(),
    HIVE_STAGING_REGISTRY_TOKEN: zod.string().optional(),
  }),
  zod.void(),
]);

const GoogleModel = zod.union([
  zod.object({
    GOOGLE_DRIVE_API_KEY: zod.string().optional(),
  }),
  zod.void(),
]);

const configs = {
  postgres: PostgresModel.safeParse(process.env),
  cloudinary: CloudinaryModel.safeParse(process.env),
  greenInvoice: GreenInvoiceModel.safeParse(process.env),
  authorization: AuthorizationModel.safeParse(process.env),
  hive: HiveModel.safeParse(process.env),
  google: GoogleModel.safeParse(process.env),
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

function extractConfig<Input, Output>(config: zod.SafeParseReturnType<Input, Output>): Output {
  if (!config.success) {
    throw new Error('Something went wrong.');
  }
  return config.data;
}

const postgres = extractConfig(configs.postgres);
const cloudinary = extractConfig(configs.cloudinary);
const greenInvoice = extractConfig(configs.greenInvoice);
const authorization = extractConfig(configs.authorization);
const hive = extractConfig(configs.hive);
const google = extractConfig(configs.google);

export const env = {
  postgres: {
    host: postgres.POSTGRES_HOST,
    port: postgres.POSTGRES_PORT,
    db: postgres.POSTGRES_DB,
    user: postgres.POSTGRES_USER,
    password: postgres.POSTGRES_PASSWORD,
    ssl: postgres.POSTGRES_SSL === '1',
  },
  cloudinary: {
    name: cloudinary?.CLOUDINARY_NAME,
    apiKey: cloudinary?.CLOUDINARY_API_KEY,
    apiSecret: cloudinary?.CLOUDINARY_API_SECRET,
  },
  greenInvoice: {
    id: greenInvoice?.GREEN_INVOICE_ID,
    secret: greenInvoice?.GREEN_INVOICE_SECRET,
  },
  authorization: {
    users: authorization?.AUTHORIZED_USERS,
    adminBusinessId: authorization?.DEFAULT_FINANCIAL_ENTITY_ID,
  },
  hive: {
    hiveToken: hive?.HIVE_TOKEN,
    hiveGatewayPort: hive?.HIVE_GATEWAY_PORT ?? 4000,
    hiveSubgraphPort: hive?.HIVE_SUBGRAPH_PORT ?? 4001,
    hiveDevRegistryToken: hive?.HIVE_DEV_REGISTRY_TOKEN,
    hiveMainRegistryToken: hive?.HIVE_MAIN_REGISTRY_TOKEN ?? '',
    hiveStagingRegistryToken: hive?.HIVE_STAGING_REGISTRY_TOKEN,
  },
  google: {
    driveApiKey: google?.GOOGLE_DRIVE_API_KEY,
  },
} as const;
