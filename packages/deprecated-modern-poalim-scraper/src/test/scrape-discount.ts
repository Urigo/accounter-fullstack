// Script to test out discount scraping. Run with:
// tsx packages/modern-poalim-scraper/src/test/scrape-discount.ts
import dotenv from 'dotenv';
import { init } from '../index.js';
import { DiscountOptions } from '../scrapers/discount.js';

dotenv.config();

async function main() {
  if (!process.env['DISCOUNT_ID'] || !process.env['DISCOUNT_PASSWORD'])
    throw new Error('DISCOUNT_ID and DISCOUNT_PASSWORD must be set');

  const { discount, close } = await init({ headless: false });

  try {
    const scraper = await discount(
      {
        ID: process.env['DISCOUNT_ID'],
        password: process.env['DISCOUNT_PASSWORD'],
      },
      new DiscountOptions(),
    );

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
