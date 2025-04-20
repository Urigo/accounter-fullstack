// Script to test out MAX scraping. Run with:
// tsx packages/modern-poalim-scraper/src/test/scrape-max.ts
import dotenv from 'dotenv';
import { init } from '../index.js';

dotenv.config({ path: '../../.env' });

async function main() {
  if (
    !process.env['ISRACARD_ID'] ||
    !process.env['ISRACARD_PASSWORD'] ||
    !process.env['ISRACARD_6_DIGITS']
  )
    throw new Error('ISRACARD_ID, ISRACARD_PASSWORD and ISRACARD_6_DIGITS must be set');

  const { isracard, close } = await init({ headless: false });

  try {
    const scraper = await isracard({
      ID: process.env['ISRACARD_ID'],
      password: process.env['ISRACARD_PASSWORD'],
      card6Digits: process.env['ISRACARD_6_DIGITS'],
    });

    const dashboards = await scraper.getDashboards();

    console.log(dashboards);
  } catch (error) {
    console.error(error);
  } finally {
    console.debug('closing');
    await close();
    console.debug('done');
  }
}

main().catch(console.error);
