import Listr, { ListrTask } from 'listr';
import pg, { type Pool as PgPool, type PoolConfig } from 'pg';
import type { PoalimCredentials } from 'scrapers/poalim/index.js';
import { init } from '@accounter/modern-poalim-scraper';
import { config } from './env.js';
import { Logger } from './logger.js';
import { getCurrencyRates } from './scrapers/currency-rates.js';
import { getIsracardAmexData } from './scrapers/isracard-amex/index.js';
import type { AmexCredentials, IsracardCredentials } from './scrapers/isracard-amex/index.js';
import { getPoalimData } from './scrapers/poalim/index.js';

export type Config = {
  database: PoolConfig;
  showBrowser?: boolean;
  poalimAccounts?: PoalimCredentials[];
  isracardAccounts?: IsracardCredentials[];
  amexAccounts?: AmexCredentials[];
};

const { Pool } = pg;
export type MainContext = {
  logger: Logger;
  scraper: Awaited<ReturnType<typeof init>>;
  pool: PgPool;
};

export async function scrape() {
  const pool = new Pool(config.database);
  const logger = new Logger();
  const scraper = await init({ headless: !config.showBrowser });

  const tasksList = new Listr<MainContext>(
    [
      {
        title: 'Currency Rates',
        task: async ctx => getCurrencyRates(ctx),
      },
      ...(config.poalimAccounts?.map(
        (creds, i) =>
          ({
            title: `Poalim Account ${creds.nickname ?? i + 1}`,
            task: async () =>
              await getPoalimData(creds).catch(e => {
                console.log(e);
              }),
          }) as ListrTask,
      ) ?? []),
      ...(config.isracardAccounts?.map(
        (creds, i) =>
          ({
            title: `Isracard ${creds.nickname ?? i + 1}`,
            task: async (_, task) =>
              await getIsracardAmexData('ISRACARD', creds, task).catch(e => {
                console.log(e);
              }),
          }) as ListrTask,
      ) ?? []),
      ...(config.amexAccounts?.map(
        (creds, i) =>
          ({
            title: `American Express ${creds.nickname ?? i + 1}`,
            task: async (_, task) =>
              await getIsracardAmexData('AMEX', creds, task).catch(e => {
                console.log(e);
              }),
          }) as ListrTask,
      ) ?? []),
    ],
    { concurrent: true },
  );

  await tasksList.run({ logger, scraper, pool }).catch(err => {
    console.error(err);
  });
  pool.end();
  console.log('Tasks completed.');

  await logger.reLog();
  return;
}

scrape();
