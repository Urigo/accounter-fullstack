import Listr from 'listr';
import pg from 'pg';
import { getCurrencyRates } from 'scrapers/currency-rates.js';
import { config } from './env.js';

const { Pool } = pg;

export async function scrape() {
  const pool = new Pool(config.database);

  const tasks = new Listr(
    [
      {
        title: 'Currency Rates',
        task: async () => getCurrencyRates(pool),
      },
    ],
    { concurrent: true },
  );

  await tasks
    .run()
    .catch(err => {
      console.error(err);
    })
    .finally(async () => {
      await pool.end();
    });
  console.log('Tasks completed.');
}

scrape();
