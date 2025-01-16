import { MainContext } from 'index.js';
import Listr, { type ListrTask } from 'listr';
import { init } from '@accounter/modern-poalim-scraper';
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
  };
};

type Scraper = Awaited<ReturnType<typeof init>>;
export type PoalimScraper = Exclude<Awaited<ReturnType<Scraper['hapoalim']>>, 'Unknown Error'>;

export type PoalimContext = {
  key: string;
  nickname?: string;
  scraper?: PoalimScraper;
  acceptedAccountNumbers: number[];
  accounts?: ScrapedAccount[];
  columns?: {
    [table: string]: IGetTableColumnsResult[];
  };
};
export type PoalimUserContext = MainContext & { [key: string]: PoalimContext };

export async function getPoalimData(initialContext: PoalimContext) {
  const KEY = initialContext.key;
  return new Listr<PoalimUserContext>([
    {
      title: 'Setup Context',
      task: async ctx => {
        ctx[KEY] = {
          ...initialContext,
        };
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
  ]);
}
