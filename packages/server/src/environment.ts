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

const AuthorizationModel = zod.union([
  zod.object({
    AUTHORIZED_USERS: zod.string(),
  }),
  zod.void(),
]);

const configs = {
  postgres: PostgresModel.safeParse(process.env),
  cloudinary: CloudinaryModel.safeParse(process.env),
  greenInvoice: GreenInvoiceModel.safeParse(process.env),
  authorization: AuthorizationModel.safeParse(process.env),
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
  },
} as const;
