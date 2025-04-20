// Script to test out MAX scraping. Run with:
// tsx packages/modern-israeli-scrapers/src/test/scrape-max.ts
import dotenv from 'dotenv';
import { init } from '../index.js';

dotenv.config({ path: '../../.env' });

async function main() {
  if (!process.env['MAX_USERNAME'] || !process.env['MAX_PASSWORD'])
    throw new Error('MAX_USERNAME and MAX_PASSWORD must be set');

  const { max, close } = await init({ headless: true });

  try {
    const scraper = await max({
      username: process.env['MAX_USERNAME'],
      password: process.env['MAX_PASSWORD'],
    });

    const transactions = await scraper.getTransactions();

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
