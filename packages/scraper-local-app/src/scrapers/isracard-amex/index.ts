import { addMonths, format, isBefore, startOfMonth, subYears } from 'date-fns';
import { getTableColumns } from 'helpers/sql.js';
import Listr, { type ListrTask, type ListrTaskWrapper } from 'listr';
import { init } from '@accounter/modern-poalim-scraper';
import { config } from '../../env.js';
import type { FilteredColumns } from '../../helpers/types.js';
import type { MainContext } from '../../index.js';
import { getMonthTransactions } from './month.js';
import { getTableName } from './utils.js';

export type CreditcardType = 'ISRACARD' | 'AMEX';

interface IsracardAmexCreds {
  nickname?: string;
  ownerId: string;
  password: string;
  last6Digits: string;
  options?: {
    acceptedCardNumbers?: string[];
    cardNumberMapping?: Record<string, string>;
  };
}
export type IsracardCredentials = IsracardAmexCreds;
export type AmexCredentials = IsracardAmexCreds;

type Scraper = Awaited<ReturnType<typeof init>>;
export type IsracardAmexScraper = Awaited<ReturnType<Scraper['isracard'] | Scraper['amex']>>;

export type IsracardAmexAccountContext = {
  type: CreditcardType;
  nickname: string;
  scraper?: IsracardAmexScraper;
  closeBrowser?: () => Promise<void>;
  options: IsracardAmexCreds['options'];
  columns?: FilteredColumns;
  processedData?: {
    transactions?: number;
    newTransactions?: number;
    insertedTransactions?: number;
  };
};

export type IsracardAmexContext = MainContext & {
  [accountKey: string]: IsracardAmexAccountContext;
};

export async function getIsracardAmexData(
  type: CreditcardType,
  credentials: IsracardCredentials,
  parentTask: ListrTaskWrapper,
) {
  const accountKey = `${type}_${credentials.ownerId.substring(5, 9)}`;
  return new Listr<IsracardAmexContext>([
    {
      title: 'Login',
      task: async (ctx, task) => {
        if (!credentials.ownerId || !credentials.password || !credentials.last6Digits) {
          throw new Error('Missing credentials for isracard');
        }
        ctx[accountKey] = {
          type,
          options: credentials.options,
          nickname: credentials.nickname ?? `ID ...${credentials.ownerId.substring(5, 9)}`,
        };

        task.output = 'Scraper Init';
        const scraper = await init({ headless: !config.showBrowser });
        ctx[accountKey].closeBrowser = scraper.close;

        let scraperLogin: typeof scraper.isracard | typeof scraper.amex | null = null;
        switch (type) {
          case 'ISRACARD': {
            scraperLogin = scraper.isracard;
            break;
          }
          case 'AMEX': {
            scraperLogin = scraper.amex;
            break;
          }
          default:
            throw new Error(`Invalid creditcard type: ${type}`);
        }

        const newIsracardInstance = await scraperLogin(
          {
            ID: credentials.ownerId,
            password: credentials.password,
            card6Digits: credentials.last6Digits,
          },
          {
            validateSchema: true,
          },
        );

        ctx[accountKey].scraper = newIsracardInstance;
        return;
      },
    },
    {
      title: 'Get metadata from DB',
      task: async ctx => {
        try {
          const tableName = getTableName(ctx[accountKey].type);
          const allColumns = await getTableColumns.run({ tableName }, ctx.pool);
          ctx[accountKey].columns = allColumns.filter(
            column => column.column_name && column.data_type,
          ) as FilteredColumns;
        } catch (error) {
          ctx.logger.error(error);
          throw new Error('Error on getting columns info');
        }
      },
    },
    {
      title: 'Handle by month',
      task: async () => {
        let monthToFetch = subYears(new Date(), 2);
        const allMonthsToFetch: Date[] = [];
        const lastMonthToFetch = addMonths(startOfMonth(new Date()), 2);

        while (isBefore(monthToFetch, lastMonthToFetch)) {
          allMonthsToFetch.push(monthToFetch);
          monthToFetch = addMonths(monthToFetch, 1);
        }

        return new Listr(
          allMonthsToFetch.map(
            month =>
              ({
                title: format(month, 'MM-yyyy'),
                task: async (_, task) => await getMonthTransactions(month, accountKey, task),
              }) as ListrTask,
          ),
          { concurrent: true },
        );
      },
    },
    {
      title: 'Status Update',
      task: async ctx => {
        await ctx[accountKey].closeBrowser?.();

        let status: string = '';
        if (ctx[accountKey].processedData) {
          if (ctx[accountKey].processedData.transactions) {
            status += `Reviewed ${ctx[accountKey].processedData.transactions} Transactions`;
          }
          if (ctx[accountKey].processedData.newTransactions === 0) {
            status += `, Nothing New`;
          } else if (ctx[accountKey].processedData.newTransactions) {
            status += `, ${ctx[accountKey].processedData.newTransactions} New`;
          }
          if (ctx[accountKey].processedData.insertedTransactions) {
            if (
              ctx[accountKey].processedData.insertedTransactions ===
              ctx[accountKey].processedData.newTransactions
            ) {
              status += `, All Inserted`;
            } else {
              status += `, Some Inserted`;
            }
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
