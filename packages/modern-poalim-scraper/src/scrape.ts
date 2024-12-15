// Script to test out cal scraping. Run with:
// tsx packages/modern-poalim-scraper/src/scrape.ts
import dotenv from 'dotenv';
import { init } from './index.js';
import { CalOptions } from './scrapers/cal.js';

dotenv.config();

async function main() {
  if (
    !process.env['CAL_USERNAME'] ||
    !process.env['CAL_PASSWORD'] ||
    !process.env['CAL_LAST4DIGITS']
  )
    throw new Error('CAL_USERNAME and CAL_PASSWORD must be set');

  const { cal, close } = await init({
    headless: false,
    userAgent:
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/78.0.3904.108 Safari/537.36',
  });

  try {
    const scraper = await cal(
      {
        username: process.env['CAL_USERNAME'],
        password: process.env['CAL_PASSWORD'],
        last4Digits: process.env['CAL_LAST4DIGITS'],
      },
      new CalOptions(),
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
