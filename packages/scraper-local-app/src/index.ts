import Listr from 'listr';
import pg from 'pg';
import { config } from './env.js';
import { getCurrencyRates } from './scrapers/currency-rates.js';
import { getPoalimData } from './scrapers/poalim/index.js';

const { Pool } = pg;

export async function scrape() {
  const pool = new Pool(config.database);

  const closeContext = {
    onDone: async () => {
      pool.end();
    },
  };

  const tasks = new Listr(
    [
      {
        title: 'Currency Rates',
        task: async () => getCurrencyRates(pool),
      },
      ...(config.poalimAccounts?.map((creds, i) => ({
        title: `Poalim Account ${creds.nickname ?? i + 1}`,
        task: async () => await getPoalimData(pool, creds, closeContext),
      })) ?? []),
    ],
    { concurrent: true },
  );

  await tasks.run().catch(err => {
    console.error(err);
  });
  await closeContext.onDone();
  console.log('Tasks completed.');
}

scrape();
