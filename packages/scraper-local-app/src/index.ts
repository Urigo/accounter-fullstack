import Listr, { ListrTask } from 'listr';
import pg from 'pg';
import { config } from './env.js';
import { Logger } from './logger.js';
// import { getCurrencyRates } from './scrapers/currency-rates.js';
// import { getPoalimData } from './scrapers/poalim/index.js';
import { getIsracardAmexData } from './scrapers/isracard-amex/index.js';

const { Pool } = pg;
type Context = { logger: Logger };

export async function scrape() {
  const pool = new Pool(config.database);

  const logger = new Logger();

  const tasks = new Listr<Context>(
    [
      // {
      //   title: 'Currency Rates',
      //   task: async ctx => getCurrencyRates(pool, ctx.logger),
      // },
      // ...(config.poalimAccounts?.map(
      //   (creds, i) =>
      //     ({
      //       title: `Poalim Account ${creds.nickname ?? i + 1}`,
      //       task: async ctx => await getPoalimData(pool, creds, ctx.logger),
      //     }) as ListrTask<Context>,
      // ) ?? []),
      // ...(config.isracardAccounts?.map(
      //   (creds, i) =>
      //     ({
      //       title: `Isracard ${creds.nickname ?? i + 1}`,
      //       task: async ctx => await getIsracardAmexData('ISRACARD', pool, creds, ctx.logger),
      //     }) as ListrTask<Context>,
      // ) ?? []),
      ...(config.amexAccounts?.map(
        (creds, i) =>
          ({
            title: `American Express ${creds.nickname ?? i + 1}`,
            task: async ctx => await getIsracardAmexData('AMEX', pool, creds, ctx.logger),
          }) as ListrTask<Context>,
      ) ?? []),
    ],
    { concurrent: true },
  );

  await tasks.run({ logger }).catch(err => {
    console.error(err);
  });
  pool.end();
  console.log('Tasks completed.');

  await logger.reLog();
}

scrape();
