import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { max, MaxOptions, type MaxCredentials } from './scrapers/max.js';
import {
  otsarHahayal,
  OtsarHahayalCredentials,
  OtsarHahayalOptions,
} from './scrapers/otsar-hahayal/index.js';
import {
  amex,
  AmexCredentials,
  AmexOptions,
  cal,
  CalCredentials,
  CalOptions,
  discount,
  DiscountCredentials,
  DiscountOptions,
  hapoalim,
  HapoalimCredentials,
  HapoalimOptions,
  isracard,
  IsracardCredentials,
  IsracardOptions,
} from './scrapers/scrapers-index.js';
import { browserTarget, type BrowserOptions } from './utils/browser-launch.js';
import { newPage } from './utils/browser-util.js';

puppeteer.use(StealthPlugin());

export async function init({
  headless = true,
  userAgent,
  browser: browserOptions,
}: {
  headless?: boolean;
  userAgent?: string;
  /** Overrides the browser to launch. Defaults to the installed Google Chrome. */
  browser?: BrowserOptions;
} = {}) {
  /* this initiates browser and returns every scraper as function */
  /* each scraper opens its own page                              */
  const browser = await puppeteer.launch({
    headless,
    args: userAgent ? [`--user-agent=${userAgent}`] : [],
    ...browserTarget(browserOptions),
  });

  return {
    hapoalim: async (credentials: HapoalimCredentials, options?: HapoalimOptions) => {
      //return hapoalim.init
      const page = await newPage(browser);
      return hapoalim(page, credentials, options);
    },
    isracard: async (credentials: IsracardCredentials, options?: IsracardOptions) => {
      //return isracard.init
      const page = await newPage(browser);
      return isracard(page, credentials, options);
    },
    amex: async (credentials: AmexCredentials, options?: AmexOptions) => {
      //return amex.init
      const page = await newPage(browser);
      return amex(page, credentials, options);
    },
    cal: async (credentials: CalCredentials, options?: CalOptions) => {
      //return cal.init
      const page = await newPage(browser);
      return cal(page, credentials, options);
    },
    discount: async (credentials: DiscountCredentials, options?: DiscountOptions) => {
      //return discount.init
      const page = await newPage(browser);
      return discount(page, credentials, options);
    },
    max: async (credentials: MaxCredentials, options?: MaxOptions) => {
      const page = await newPage(browser);
      return max(page, credentials, options);
    },
    otsarHahayal: async (credentials: OtsarHahayalCredentials, options?: OtsarHahayalOptions) => {
      return otsarHahayal(credentials, {
        ...(browserOptions && { browser: browserOptions }),
        ...options,
      });
    },
    close: () => {
      return browser.close();
    },
  };
}

export * from './zod-schemas/types.js';
export { HapoalimOptions } from './scrapers/hapoalim.js';
export type { BrowserOptions } from './utils/browser-launch.js';
