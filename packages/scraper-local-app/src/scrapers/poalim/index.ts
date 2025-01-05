import { MainContext } from 'index.js';
import Listr, { type ListrTask } from 'listr';
import { init } from '@accounter/modern-poalim-scraper';
import { config } from '../../env.js';
import { makeId } from '../../helpers/misc.js';
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
export type PoalimUserContext = MainContext & { [key: string]: PoalimContext };

export async function getPoalimData(credentials: PoalimCredentials) {
  const KEY = makeId(8);
  return new Listr<PoalimUserContext>([
    {
      title: 'Login',
      task: async (ctx, task) => {
        ctx[KEY] = {
          acceptedAccountNumbers: credentials.options?.acceptedAccountNumbers ?? [],
          createDumpFile: credentials.options?.createDumpFile ?? false,
        };

        task.output = 'Scraper Init';
        const scraper = await init({ headless: !config.showBrowser });
        ctx[KEY].closeBrowser = scraper.close;

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

        ctx[KEY].scraper = newPoalimInstance;
        return;
      },
    },
    {
      title: 'Get Accounts',
      task: async () => await getPoalimAccounts(KEY),
    },
    {
      title: 'Handle Accounts',
      skip: ctx => ctx[KEY].accounts?.length === 0,
      task: async ctx => {
        return new Listr(
          ctx[KEY].accounts!.map(
            account =>
              ({
                title: `Poalim Account ${account.branchNumber}:${account.accountNumber}`,
                task: async () => handlePoalimAccount(account, KEY),
              }) as ListrTask,
          ),
          { concurrent: true },
        );
      },
    },
    {
      title: 'Close Browser',
      task: async ctx => {
        await ctx[KEY].closeBrowser?.();
        return;
      },
    },
  ]);
}
