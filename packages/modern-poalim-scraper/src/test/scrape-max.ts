// Script to test out discount scraping. Run with:
// tsx packages/modern-poalim-scraper/src/test/scrape-discount.ts
import dotenv from 'dotenv';
import { init } from '../index.js';

dotenv.config({ path: '../../.env' });

async function main() {
  if (!process.env['MAX_USERNAME'] || !process.env['MAX_PASSWORD'])
    throw new Error('MAX_USERNAME and MAX_PASSWORD must be set');

  const { max, close } = await init({ headless: true });

  try {
    const transactions = await max({
      username: process.env['MAX_USERNAME'],
      password: process.env['MAX_PASSWORD'],
    });

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
