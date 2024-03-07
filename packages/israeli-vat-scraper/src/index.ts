import { createRequire } from 'node:module';
import { config } from 'dotenv';
import { getEnvCredentials, updateCredentials } from './handlers/login-handler.js';
import { homePageHandler } from './handlers/main-page-handler.js';
import { validateSchema } from './utils/schema-validator.js';
import type { Config, Report, UserCredentials } from './utils/types.js';

config();

const defaultConfig: Config = {
  visibleBrowser: false,
  expandData: true,
  sortDescending: false,
  validate: true,
  printErrors: true,
  years: undefined,
  logger: console,
};

export const vatScraper = async (
  credentials?: UserCredentials,
  userConfig: Partial<Config> = {},
): Promise<Report[]> => {
  try {
    updateCredentials(credentials || getEnvCredentials());
    const config = { ...defaultConfig, ...userConfig };

    const reports = await homePageHandler(config);

    if (config.validate) {
      const requireFile = createRequire(import.meta.url); // construct the require method
      const schema = requireFile('./src/vatSchema.json'); // use the require method
      const validation = await validateSchema(schema, reports);
      config.logger.log(validation);
    }

    return reports;
  } catch (e) {
    throw new Error(`VatScraper - ${(e as Error)?.message || e}`);
  }
};
