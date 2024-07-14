import puppeteer from 'puppeteer';
import {
  hapoalim,
  hapoalimCredentials,
  hapoalimOptions,
  isracard,
  isracardCredentials,
  isracardOptions,
} from './scrapers/scrapers-index.js';
import { newPage } from './utils/browser-util.js';

export async function init() {
  /* this initiates browser and returns every scraper as function */
  /* each scraper opens its own page                              */
  const browser = await puppeteer.launch({ headless: false });

  return {
    hapoalim: async (credentials: hapoalimCredentials, options?: hapoalimOptions) => {
      //return hapoalim.init
      const page = await newPage(browser);
      return hapoalim(page, credentials, options);
    },
    isracard: async (credentials: isracardCredentials, options?: isracardOptions) => {
      //return isracard.init
      const page = await newPage(browser);
      return isracard(page, credentials, options);
    },
    close: () => {
      return browser.close();
    },
  };
}
