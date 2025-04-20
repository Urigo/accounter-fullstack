import { addMonths, format, isBefore, subMonths } from 'date-fns';
import Listr, { type ListrTask, type ListrTaskWrapper } from 'listr';
import type { init } from '@accounter/modern-israeli-scrapers';
import type { MainContext } from '../../index.js';
import { getMonthTransactions } from './discount-month.js';

export type DiscountCredentials = {
  ID: string;
  password: string;
  code?: string;
  nickname?: string;
};

type Scraper = Awaited<ReturnType<typeof init>>;
export type DiscountAccountContext = {
  nickname: string;
  scraper: Awaited<ReturnType<Scraper['discount']>>;
  processedData?: {
    transactions?: number;
    insertedTransactions?: number;
  };
};
export type DiscountContext = MainContext & { [accountKey: string]: DiscountAccountContext };

export async function getDiscountData(
  credentials: DiscountCredentials,
  parentTask: ListrTaskWrapper,
) {
  const accountKey = credentials.nickname!;
  return new Listr<DiscountContext>([
    {
      title: 'Login',
      task: async ctx => {
        const { ID, password, code } = credentials;
        if (!ID || !password) {
          throw new Error(`${accountKey}: Missing credentials`);
        }

        const newDiscountInstance = await ctx.scraper.discount({
          ID,
          password,
          code,
        });

        ctx[accountKey] = {
          nickname: accountKey,
          scraper: newDiscountInstance,
        };
        return;
      },
    },
    {
      title: 'Handle by month',
      task: async () => {
        // fetch for every month in the last 12 months
        const monthsToFetch = 12;
        const end = new Date();
        const start = subMonths(end, monthsToFetch);
        const allMonthsToFetch: Date[] = [];
        for (let month = start; isBefore(month, end); month = addMonths(month, 1)) {
          allMonthsToFetch.push(month);
        }

        return new Listr(
          allMonthsToFetch.map(
            month =>
              ({
                title: format(month, 'MM-yyyy'),
                task: async (_, task) =>
                  await getMonthTransactions(month, credentials.nickname!, task),
              }) as ListrTask,
          ),
          { concurrent: true },
        );
      },
    },
    {
      title: 'Status Update',
      task: async ctx => {
        if (!ctx[accountKey]) {
          ctx.logger.error('No account');
          return;
        }

        let status: string = '';
        if (ctx[accountKey].processedData) {
          if (ctx[accountKey].processedData.transactions) {
            status += `Reviewed ${ctx[accountKey].processedData.transactions} Transactions`;
          }
          if (ctx[accountKey].processedData.insertedTransactions) {
            status += `, ${ctx[accountKey].processedData.insertedTransactions} New`;
          }
        }
        if (status !== '') {
          parentTask.title = `${parentTask.title} (${status})`;
        }
        return;
      },
    },
  ]);
}
