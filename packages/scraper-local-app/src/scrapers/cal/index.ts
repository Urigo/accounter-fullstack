import { addMonths, format, isBefore, subMonths } from 'date-fns';
import Listr, { type ListrTask, type ListrTaskWrapper } from 'listr';
import type { init } from '@accounter/modern-poalim-scraper';
import type { FilteredColumns } from '../../helpers/types.js';
import type { MainContext } from '../../index.js';
import { getMonthTransactions } from './cal-month.js';

export type CalCredentials = {
  nickname?: string;
  username: string;
  password: string;
  last4Digits: string;
  options?: {
    acceptedCardNumbers?: string[];
  };
};

type Scraper = Awaited<ReturnType<typeof init>>;
export type CalScraper = Awaited<ReturnType<Scraper['cal']>>;

export type CalAccountContext = {
  nickname: string;
  scraper?: CalScraper;
  options: CalCredentials['options'];
  columns?: FilteredColumns;
  processedData?: {
    transactions?: number;
    insertedTransactions?: number;
  };
};

export type CalContext = MainContext & {
  [accountKey: string]: CalAccountContext;
};

export async function getCalData(credentials: CalCredentials, parentTask: ListrTaskWrapper) {
  const accountKey = credentials.last4Digits;
  return new Listr<CalContext>([
    {
      title: 'Login',
      task: async (ctx, task) => {
        if (!credentials.username || !credentials.password || !credentials.last4Digits) {
          throw new Error('Missing credentials for CAL');
        }
        ctx[accountKey] = {
          options: credentials.options,
          nickname: credentials.nickname ?? credentials.last4Digits,
        };

        task.output = 'Scraper Init';

        const newCalInstance = await ctx.scraper.cal({
          username: credentials.username,
          password: credentials.password,
          last4Digits: credentials.last4Digits,
        });

        ctx[accountKey].scraper = newCalInstance;
        return;
      },
    },
    {
      title: 'Handle by month',
      task: async () => {
        // fetch for every month in the last 24 months
        const monthsToFetch = 24;
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
