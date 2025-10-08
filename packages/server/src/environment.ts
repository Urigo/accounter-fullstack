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

const GreenInvoiceModel = zod.union([
  zod
    .object({
      GREEN_INVOICE_ID: zod.string().optional(),
      GREEN_INVOICE_SECRET: zod.string().optional(),
    })
    .superRefine((data, ctx) => {
      if (!!data.GREEN_INVOICE_ID !== !!data.GREEN_INVOICE_SECRET) {
        ctx.addIssue({
          code: 'custom',
          message: 'GREEN_INVOICE_ID and GREEN_INVOICE_SECRET must be provided together.',
        });
      }
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
  }),
  zod.void(),
]);

const GoogleDriveModel = zod.union([
  zod.object({
    GOOGLE_DRIVE_API_KEY: zod.string().optional(),
  }),
  zod.void(),
]);

const DeelModel = zod.union([
  zod.object({
    DEEL_TOKEN: zod.string().optional(),
  }),
  zod.void(),
]);

const configs = {
  postgres: PostgresModel.safeParse(process.env),
  cloudinary: CloudinaryModel.safeParse(process.env),
  greenInvoice: GreenInvoiceModel.safeParse(process.env),
  authorization: AuthorizationModel.safeParse(process.env),
  hive: HiveModel.safeParse(process.env),
  googleDrive: GoogleDriveModel.safeParse(process.env),
  deel: DeelModel.safeParse(process.env),
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
const greenInvoice = extractConfig(configs.greenInvoice);
const authorization = extractConfig(configs.authorization);
const hive = extractConfig(configs.hive);
const googleDrive = extractConfig(configs.googleDrive);
const deel = extractConfig(configs.deel);

export const env = {
  postgres: {
    host: postgres.POSTGRES_HOST,
    port: postgres.POSTGRES_PORT,
    db: postgres.POSTGRES_DB,
    user: postgres.POSTGRES_USER,
    password: postgres.POSTGRES_PASSWORD,
    ssl: postgres.POSTGRES_SSL === '1',
  },
  cloudinary: cloudinary?.CLOUDINARY_API_KEY
    ? {
        name: cloudinary.CLOUDINARY_NAME,
        apiKey: cloudinary.CLOUDINARY_API_KEY,
        apiSecret: cloudinary.CLOUDINARY_API_SECRET,
      }
    : undefined,
  greenInvoice: greenInvoice?.GREEN_INVOICE_ID
    ? {
        id: greenInvoice.GREEN_INVOICE_ID,
        secret: greenInvoice.GREEN_INVOICE_SECRET,
      }
    : undefined,
  authorization: {
    users: authorization?.AUTHORIZED_USERS,
    adminBusinessId: authorization?.DEFAULT_FINANCIAL_ENTITY_ID,
  },
  hive: hive?.HIVE_TOKEN
    ? {
        hiveToken: hive.HIVE_TOKEN,
      }
    : undefined,
  googleDrive: googleDrive?.GOOGLE_DRIVE_API_KEY
    ? {
        driveApiKey: googleDrive.GOOGLE_DRIVE_API_KEY,
      }
    : undefined,
  deel: deel?.DEEL_TOKEN
    ? {
        apiToken: deel.DEEL_TOKEN,
      }
    : undefined,
} as const;
