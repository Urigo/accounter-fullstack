// Script to test out MAX scraping. Run with:
// tsx packages/modern-israeli-scrapers/src/test/scrape-max.ts
import dotenv from 'dotenv';
import { init } from '../index.js';

dotenv.config({ path: '../../.env' });

async function main() {
  if (!process.env['USER_CODE'] || !process.env['PASSWORD'])
    throw new Error('USER_CODE and PASSWORD must be set');

  const { hapoalim, close } = await init({ headless: true });

  const credentials = {
    userCode: process.env['USER_CODE'],
    password: process.env['PASSWORD'],
  };

  try {
    const scraper = await hapoalim(credentials, {
      validateSchema: true,
      isBusiness: true,
    });

    if (scraper === 'Unknown Error') {
      throw new Error('Unknown Error logging into Hapoalim');
    }

    const transactions = await scraper.getAccountsData();

    console.log(transactions);
  } catch (error) {
    console.error(error);
  } finally {
    console.debug('closing');
    await close();
    console.debug('done');
  }
}

main().catch(console.error);
