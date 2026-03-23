import { Listr, type ListrTask } from 'listr2';
import pg, { type Pool as PgPool, type PoolConfig } from 'pg';
import { init } from '@accounter/modern-poalim-scraper';
import { config } from './env.js';
import { makeId } from './helpers/misc.js';
import { Logger } from './logger.js';
import { runCustomMigrations } from './migrate.js';
import { getCalData, type CalCredentials } from './scrapers/cal/index.js';
import { getCurrencyRates } from './scrapers/currency-rates.js';
import { getDiscountData, type DiscountCredentials } from './scrapers/discount/index.js';
import { getIsracardAmexData } from './scrapers/isracard-amex/index.js';
import type { AmexCredentials, IsracardCredentials } from './scrapers/isracard-amex/index.js';
import { scrapeIsracardAlt, type IsracardAltCredentials } from './scrapers/isracard-alt/index.js';
import { getMaxData, type MaxCredentials } from './scrapers/max.js';
import { scrapeMizrahi, type MizrahiCredentials } from './scrapers/mizrahi/index.js';
import type { PoalimContext, PoalimCredentials } from './scrapers/poalim/index.js';
import { getPoalimData } from './scrapers/poalim/index.js';
import { scrapePriority, type PriorityScraperCredentials } from './scrapers/priority/index.js';

export type Config = {
  database: PoolConfig;
  showBrowser?: boolean;
  priorityAccounts?: PriorityScraperCredentials[];
  fetchBankOfIsraelRates?: boolean;
  poalimAccounts?: PoalimCredentials[];
  discountAccounts?: DiscountCredentials[];
  isracardAccounts?: IsracardCredentials[];
  amexAccounts?: AmexCredentials[];
  calAccounts?: CalCredentials[];
  maxAccounts?: MaxCredentials[];
  mizrahiAccounts?: MizrahiCredentials[];
  isracardAltAccounts?: IsracardAltCredentials[];
  /**
   * If true, the scraper will run multiple tasks concurrently.
   * This is useful for scraping multiple accounts at once.
   * If false, the tasks will run sequentially.
   * Defaults to true.
   */
  concurrentScraping?: boolean;
};

const { Pool } = pg;
export type MainContext = {
  logger: Logger;
  scraper: Awaited<ReturnType<typeof init>>;
  pool: PgPool;
};

// SCRAPE_PROVIDERS env var restricts which scrapers run (comma-separated names, e.g. "mizrahi,isracard-alt")
function isProviderEnabled(name: string): boolean {
  const allowed = process.env.SCRAPE_PROVIDERS;
  if (!allowed) return true;
  return allowed
    .toLowerCase()
    .split(',')
    .map(s => s.trim())
    .some(p => name.toLowerCase().includes(p));
}

export async function scrape() {
  const pool = new Pool(config.database);
  const logger = new Logger();

  await runCustomMigrations(pool);

  const scraper = await init({ headless: !config.showBrowser });

  // If concurrentScraping is not defined, default to true
  // If it is defined, use its value (true or false)
  const concurrent = config.concurrentScraping == null ? true : config.concurrentScraping === true;

  // Poalim accounts must be initiated before tasks list, as they might require phone code to be entered
  const poalimContexts = await Promise.all(
    (config.poalimAccounts ?? []).filter(c => isProviderEnabled('poalim')).map(async credentials => {
      logger.log('Poalim Scraper Init');

      logger.log('Bank Poalim Login');

      if (!credentials.userCode || !credentials.password) {
        throw new Error('Missing credentials for Hapoalim');
      }

      const isBusiness = credentials.options?.isBusinessAccount === false ? false : true;

      const newPoalimInstance = await scraper.hapoalim(credentials, {
        validateSchema: true,
        isBusiness,
      });

      if (newPoalimInstance === 'Unknown Error') {
        throw new Error('Unknown Error logging into Hapoalim');
      }

      return {
        nickname: credentials.nickname,
        key: credentials.nickname ? `POALIM_${credentials.nickname}` : makeId(8),
        acceptedAccountNumbers: credentials.options?.acceptedAccountNumbers ?? [],
        acceptedBranchNumbers: credentials.options?.acceptedBranchNumbers ?? [],
        scraper: newPoalimInstance,
      } as PoalimContext;
    }),
  );

  const allTasks: ListrTask[] = [
    {
      title: 'Currency Rates',
      skip: () => {
        if (!isProviderEnabled('currency')) return 'Skipping currency rates';
        const shouldFetchCurrencyRates =
          config.fetchBankOfIsraelRates == null ? true : config.fetchBankOfIsraelRates;
        if (!shouldFetchCurrencyRates) {
          return 'Skipping currency rates';
        }
        return false;
      },
      task: async ctx => getCurrencyRates(ctx),
    },
    ...(poalimContexts.map((creds, i) => ({
      title: `Poalim Account ${creds.nickname ?? i + 1}`,
      task: async () =>
        await getPoalimData(creds).catch(e => {
          logger.error(e);
        }),
    })) ?? []),
    ...(config.discountAccounts?.filter(() => isProviderEnabled('discount')).map((creds, i) => {
      const nickname = `Discount ${creds.nickname ?? i + 1}`;
      return {
        title: nickname,
        task: async (_, task) =>
          await getDiscountData({ ...creds, nickname }, task).catch(e => {
            logger.error(e);
          }),
      } as ListrTask;
    }) ?? []),
    ...(config.isracardAccounts?.filter(() => isProviderEnabled('isracard')).map(
      (creds, i) =>
        ({
          title: `Isracard ${creds.nickname ?? i + 1}`,
          task: async (_, task) =>
            await getIsracardAmexData('ISRACARD', creds, task).catch(e => {
              logger.error(e);
            }),
        }) as ListrTask,
    ) ?? []),
    ...(config.amexAccounts?.filter(() => isProviderEnabled('amex')).map(
      (creds, i) =>
        ({
          title: `American Express ${creds.nickname ?? i + 1}`,
          task: async (_, task) =>
            await getIsracardAmexData('AMEX', creds, task).catch(e => {
              logger.error(e);
            }),
        }) as ListrTask,
    ) ?? []),
    ...(config.calAccounts?.filter(() => isProviderEnabled('cal')).map(
      (creds, i) =>
        ({
          title: `CAL ${creds.nickname ?? i + 1}`,
          task: async (_, task) =>
            await getCalData(creds, task).catch(e => {
              logger.error(e);
            }),
        }) as ListrTask,
    ) ?? []),
    ...(config.maxAccounts?.filter(() => isProviderEnabled('max')).map(
      (creds, i) =>
        ({
          title: `MAX ${creds.nickname ?? i + 1}`,
          task: async (_, task) =>
            await getMaxData(creds, task, `MAX-${creds.nickname ?? i + 1}`).catch(e => {
              logger.error(e);
            }),
        }) as ListrTask,
    ) ?? []),
    ...(config.mizrahiAccounts?.filter(() => isProviderEnabled('mizrahi')).map(
      (creds, i) =>
        ({
          title: `Mizrahi ${creds.nickname ?? i + 1}`,
          task: async (ctx: MainContext) =>
            await scrapeMizrahi(creds, ctx.pool).catch(e => {
              logger.error(e);
            }),
        }) as ListrTask,
    ) ?? []),
    ...(config.isracardAltAccounts?.filter(() => isProviderEnabled('isracard-alt')).map(
      (creds, i) =>
        ({
          title: `Isracard-alt ${creds.nickname ?? i + 1}`,
          task: async (ctx: MainContext) =>
            await scrapeIsracardAlt(creds, ctx.pool, config.showBrowser).catch(e => {
              logger.error(e);
            }),
        }) as ListrTask,
    ) ?? []),
    ...(config.priorityAccounts?.filter(() => isProviderEnabled('priority')).map(
      (creds, i) =>
        ({
          title: `Priority ${creds.nickname ?? i + 1}`,
          task: async (ctx: MainContext) =>
            await scrapePriority(creds, ctx.pool).catch(e => {
              logger.error(e);
            }),
        }) as ListrTask,
    ) ?? []),
  ];

  if (allTasks.length === 0) {
    console.log('No scraper tasks to run.');
    pool.end();
    scraper.close();
    return;
  }

  const tasksList = new Listr<MainContext>(allTasks, { concurrent });

  await tasksList.run({ logger, scraper, pool }).catch(err => {
    logger.error(err);
  });
  console.log('Tasks completed.');
  pool.end();
  scraper.close();
  await logger.reLog();
  return;
}

scrape().catch(e => {
  console.error('Fatal scraper error:', e instanceof Error ? e.message : e);
  process.exit(1);
});
