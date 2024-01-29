import { diary } from 'diary';

const logger = diary('utils');

export function ensureEnv(name: string, defaultValue?: string): string {
  const value = process.env[name];

  if (value === undefined) {
    if (defaultValue) {
      logger.warn(`Environment variable ${name} is not defined, using default value`);

      return defaultValue;
    }

    throw new Error(`Environment variable ${name} is not defined`);
  }

  return value;
}
