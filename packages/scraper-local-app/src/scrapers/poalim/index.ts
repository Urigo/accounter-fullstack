import Listr, { type ListrTask } from 'listr';
import type { Pool } from 'pg';
import { init } from '@accounter/modern-poalim-scraper';
import { config } from '../../env.js';
import type { IGetTableColumnsResult } from '../../helpers/types.js';
import { handlePoalimAccount } from './account.js';
import { getPoalimAccounts, type ScrapedAccount } from './accounts.js';

export type PoalimCredentials = {
  nickname?: string;
  userCode: string;
  password: string;
  options?: {
    isBusinessAccount?: boolean;
    acceptedAccountNumbers?: number[];
    createDumpFile?: boolean;
  };
};

type Scraper = Awaited<ReturnType<typeof init>>;
export type PoalimScraper = Exclude<Awaited<ReturnType<Scraper['hapoalim']>>, 'Unknown Error'>;

export type PoalimContext = {
  scraper?: PoalimScraper;
  closeBrowser?: () => Promise<void>;
  acceptedAccountNumbers: number[];
  accounts?: ScrapedAccount[];
  columns?: {
    [table: string]: IGetTableColumnsResult[];
  };
  createDumpFile?: boolean;
};

export async function getPoalimData(pool: Pool, credentials: PoalimCredentials) {
  return new Listr<PoalimContext>([
    {
      title: 'Login',
      task: async (ctx, task) => {
        ctx.acceptedAccountNumbers = credentials.options?.acceptedAccountNumbers ?? [];
        ctx.createDumpFile = credentials.options?.createDumpFile ?? false;

        task.output = 'Scraper Init';
        const scraper = await init({ headless: !config.showBrowser });
        ctx.closeBrowser = scraper.close;

        task.output = 'Bank Login';

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

        ctx.scraper = newPoalimInstance;
        return;
      },
    },
    {
      title: 'Get Accounts',
      task: async ctx => await getPoalimAccounts(pool, ctx),
    },
    {
      title: 'Handle Accounts',
      skip: ctx => ctx.accounts?.length === 0,
      task: async ctx => {
        return new Listr(
          ctx.accounts!.map(
            account =>
              ({
                title: `Poalim Account ${account.branchNumber}:${account.accountNumber}`,
                task: async () => handlePoalimAccount(account, pool, ctx),
              }) as ListrTask,
          ),
          { concurrent: true },
        );
      },
    },
    {
      title: 'Close Browser',
      task: async ctx => {
        await ctx.closeBrowser?.();
        return;
      },
    },
  ]);
}
