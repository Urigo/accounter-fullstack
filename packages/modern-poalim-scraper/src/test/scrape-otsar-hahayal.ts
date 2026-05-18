// Script to test out MAX scraping. Run with:
// tsx packages/modern-poalim-scraper/src/test/scrape-max.ts
import dotenv from 'dotenv';
import { init } from '../index.js';

dotenv.config({ path: [`.env`, `../../.env`] });

async function main() {
  if (!process.env['OTSAR_HAHAYAL_USERNAME'] || !process.env['OTSAR_HAHAYAL_PASSWORD'])
    throw new Error('OTSAR_HAHAYAL_USERNAME and OTSAR_HAHAYAL_PASSWORD must be set');

  const { otsarHahayal, close } = await init({ headless: true });

  const credentials = {
    userCode: process.env['OTSAR_HAHAYAL_USERNAME'],
    password: process.env['OTSAR_HAHAYAL_PASSWORD'],
  };

  try {
    const scraper = await otsarHahayal(credentials, {
      validateSchema: true,
      headless: true,
    });

    try {
      const accounts = await scraper.getAccounts();

      if (accounts.isValid && accounts.data?.[0]) {
        const ilsTransactions = await scraper.ilsTransactions({
          accountNumber: Number(accounts.data[0].account),
          branch: accounts.data[0].branch,
        });

        console.log(ilsTransactions);

        const foreignTransactions = await scraper.foreignTransactions({
          accountNumber: Number(accounts.data[0].account),
          branch: accounts.data[0].branch,
        });

        console.log(foreignTransactions);
      }

      console.log(scraper.foreignTransactions);
    } finally {
      await scraper.close();
    }
  } catch (error) {
    console.error(error);
  } finally {
    console.debug('closing');
    await close();
    console.debug('done');
  }
}

main().catch(console.error);
