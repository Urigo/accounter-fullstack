import { config as dotenv } from 'dotenv';
import zod from 'zod';

dotenv();

const AuthorizationModel = zod.object({
  GMAIL_LISTENER_API_KEY: zod.string(),
});

const GmailModel = zod.object({
  GMAIL_CLIENT_ID: zod.string(),
  GMAIL_CLIENT_SECRET: zod.string(),
  GMAIL_REFRESH_TOKEN: zod.string(),
  GMAIL_LABEL_PATH: zod.string().optional(),
  GOOGLE_CLOUD_PROJECT_ID: zod.string(),
  GOOGLE_APPLICATION_CREDENTIALS: zod.string(),
  PUBSUB_TOPIC: zod.string().optional(),
  PUBSUB_SUBSCRIPTION: zod.string().optional(),
});

const GeneralModel = zod.object({
  SERVER_URL: zod.url(),
});

const configs = {
  authorization: AuthorizationModel.safeParse(process.env),
  gmail: GmailModel.safeParse(process.env),
  general: GeneralModel.safeParse(process.env),
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

const authorization = extractConfig(configs.authorization);
const gmail = extractConfig(configs.gmail);
const general = extractConfig(configs.general);

export const env = {
  authorization: {
    apiKey: authorization.GMAIL_LISTENER_API_KEY,
  },
  gmail: {
    clientId: gmail.GMAIL_CLIENT_ID,
    clientSecret: gmail.GMAIL_CLIENT_SECRET,
    refreshToken: gmail.GMAIL_REFRESH_TOKEN,
    labelPath: gmail.GMAIL_LABEL_PATH?.replace(/\/$/, '') || 'accounter/documents', // Default label if not specified
    cloudProjectId: gmail.GOOGLE_CLOUD_PROJECT_ID,
    appCredentials: gmail.GOOGLE_APPLICATION_CREDENTIALS,
    topicName: gmail.PUBSUB_TOPIC || 'gmail-notifications',
    subscriptionName: gmail.PUBSUB_SUBSCRIPTION || 'gmail-notifications-sub',
  },
  general: {
    serverUrl: general.SERVER_URL,
  },
} as const;

export type Environment = typeof env;
