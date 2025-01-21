import Listr, { ListrTask } from 'listr';
import pg, { type Pool as PgPool, type PoolConfig } from 'pg';
import { init } from '@accounter/modern-poalim-scraper';
import { config } from './env.js';
import { makeId } from './helpers/misc.js';
import { Logger } from './logger.js';
import { getCalData, type CalCredentials } from './scrapers/cal/index.js';
import { getCurrencyRates } from './scrapers/currency-rates.js';
import { getDiscountData, type DiscountCredentials } from './scrapers/discount/index.js';
import { getIsracardAmexData } from './scrapers/isracard-amex/index.js';
import type { AmexCredentials, IsracardCredentials } from './scrapers/isracard-amex/index.js';
import { getMaxData, type MaxCredentials } from './scrapers/max/index.js';
import type { PoalimContext, PoalimCredentials } from './scrapers/poalim/index.js';
import { getPoalimData } from './scrapers/poalim/index.js';

export type Config = {
  database: PoolConfig;
  showBrowser?: boolean;
  fetchBankOfIsraelRates?: boolean;
  poalimAccounts?: PoalimCredentials[];
  discountAccounts?: DiscountCredentials[];
  isracardAccounts?: IsracardCredentials[];
  amexAccounts?: AmexCredentials[];
  calAccounts?: CalCredentials[];
  maxAccounts?: MaxCredentials[];
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

  // Poalim accounts must be initiated before tasks list, as they might require phone code to be entered
  const poalimContexts = await Promise.all(
    (config.poalimAccounts ?? []).map(async credentials => {
      logger.log('Poalim Scraper Init');

      logger.log('Bank Poalim Login');

      if (!credentials.userCode || !credentials.password) {
        throw new Error('Missing credentials for Hapoalim');
      }

      const isBusiness = credentials.options?.isBusinessAccount === false ? false : true;

      const newPoalimInstance = await scraper.hapoalim(credentials, {
        validateSchema: true,
        isBusiness,
      });

      if (newPoalimInstance === 'Unknown Error') {
        throw new Error('Unknown Error logging into Hapoalim');
      }

      return {
        nickname: credentials.nickname,
        key: credentials.nickname ? `POALIM_${credentials.nickname}` : makeId(8),
        acceptedAccountNumbers: credentials.options?.acceptedAccountNumbers ?? [],
        scraper: newPoalimInstance,
      } as PoalimContext;
    }),
  );

  const tasksList = new Listr<MainContext>(
    [
      {
        title: 'Currency Rates',
        skip: () => {
          const shouldFetchCurrencyRates =
            config.fetchBankOfIsraelRates == null ? true : config.fetchBankOfIsraelRates;
          if (!shouldFetchCurrencyRates) {
            return 'Skipping currency rates';
          }
          return false;
        },
        task: async ctx => getCurrencyRates(ctx),
      },
      ...(poalimContexts.map(
        (creds, i) =>
          ({
            title: `Poalim Account ${creds.nickname ?? i + 1}`,
            task: async () =>
              await getPoalimData(creds).catch(e => {
                logger.error(e);
              }),
          }) as ListrTask,
      ) ?? []),
      ...(config.discountAccounts?.map((creds, i) => {
        const nickname = `Discount ${creds.nickname ?? i + 1}`;
        return {
          title: nickname,
          task: async (_, task) =>
            await getDiscountData({ ...creds, nickname }, task).catch(e => {
              logger.error(e);
            }),
        } as ListrTask;
      }) ?? []),
      ...(config.isracardAccounts?.map(
        (creds, i) =>
          ({
            title: `Isracard ${creds.nickname ?? i + 1}`,
            task: async (_, task) =>
              await getIsracardAmexData('ISRACARD', creds, task).catch(e => {
                logger.error(e);
              }),
          }) as ListrTask,
      ) ?? []),
      ...(config.amexAccounts?.map(
        (creds, i) =>
          ({
            title: `American Express ${creds.nickname ?? i + 1}`,
            task: async (_, task) =>
              await getIsracardAmexData('AMEX', creds, task).catch(e => {
                logger.error(e);
              }),
          }) as ListrTask,
      ) ?? []),
      ...(config.calAccounts?.map(
        (creds, i) =>
          ({
            title: `CAL ${creds.nickname ?? i + 1}`,
            task: async (_, task) =>
              await getCalData(creds, task).catch(e => {
                logger.error(e);
              }),
          }) as ListrTask,
      ) ?? []),
      ...(config.maxAccounts?.map(
        (creds, i) =>
          ({
            title: `MAX ${creds.nickname ?? i + 1}`,
            task: async (_, task) =>
              await getMaxData(creds, task, `MAX-${creds.nickname ?? i + 1}`).catch(e => {
                logger.error(e);
              }),
          }) as ListrTask,
      ) ?? []),
    ],
    { concurrent: true },
  );

  await tasksList.run({ logger, scraper, pool }).catch(err => {
    logger.error(err);
  });
  console.log('Tasks completed.');
  pool.end();
  scraper.close();
  await logger.reLog();
  return;
}

scrape();
