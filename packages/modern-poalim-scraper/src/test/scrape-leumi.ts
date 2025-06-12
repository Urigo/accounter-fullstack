// Script to test out MAX scraping. Run with:
// tsx packages/modern-poalim-scraper/src/test/scrape-max.ts
import dotenv from 'dotenv';
import { init } from '../index.js';

dotenv.config({ path: '../../.env' });

async function main() {
  if (!process.env['LEUMI_USERNAME'] || !process.env['LEUMI_PASSWORD'])
    throw new Error('LEUMI_USERNAME and LEUMI_PASSWORD must be set');

  const { leumi, close } = await init({ headless: false });

  const credentials = {
    username: process.env['LEUMI_USERNAME'],
    password: process.env['LEUMI_PASSWORD'],
  };

  try {
    await leumi(credentials, {
      // validateSchema: true,
      // isBusiness: true,
    });

    // if (scraper === 'Unknown Error') {
    //   throw new Error('Unknown Error logging into Leumi');
    // }

    // const transactions = await scraper.getAccountsData();

    // console.log(transactions);
  } catch (error) {
    console.error(error);
  } finally {
    console.debug('closing');
    await close();
    console.debug('done');
  }
}

main().catch(console.error);
