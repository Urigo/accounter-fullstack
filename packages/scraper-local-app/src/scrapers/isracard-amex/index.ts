import { addMonths, format, isBefore, startOfMonth, subYears } from 'date-fns';
import { getTableColumns } from 'helpers/sql.js';
import Listr, { type ListrTask, type ListrTaskWrapper } from 'listr';
import type { Pool } from 'pg';
import { init } from '@accounter/modern-poalim-scraper';
import { config } from '../../env.js';
import type { FilteredColumns } from '../../helpers/types.js';
import { Logger } from '../../logger.js';
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

export type IsracardAmexContext = {
  type: CreditcardType;
  nickname: string;
  scraper?: IsracardAmexScraper;
  closeBrowser?: () => Promise<void>;
  options: IsracardAmexCreds['options'];
  pool: Pool;
  logger: Logger;
  columns?: FilteredColumns;
  processedData?: {
    transactions?: number;
    newTransactions?: number;
    insertedTransactions?: number;
  };
};

export async function getIsracardAmexData(
  type: CreditcardType,
  pool: Pool,
  credentials: IsracardCredentials,
  logger: Logger,
  parentTask: ListrTaskWrapper,
) {
  return new Listr<IsracardAmexContext>([
    {
      title: 'Login',
      task: async (ctx, task) => {
        if (!credentials.ownerId || !credentials.password || !credentials.last6Digits) {
          throw new Error('Missing credentials for isracard');
        }

        ctx.type = type;
        ctx.logger = logger;
        ctx.options = credentials.options;
        ctx.pool = pool;
        ctx.nickname = credentials.nickname ?? `ID ...${credentials.ownerId.substring(5, 9)}`;

        task.output = 'Scraper Init';
        const scraper = await init({ headless: !config.showBrowser });
        ctx.closeBrowser = scraper.close;

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

        ctx.scraper = newIsracardInstance;
        return;
      },
    },
    {
      title: 'Get metadata from DB',
      task: async ctx => {
        try {
          const tableName = getTableName(ctx.type);
          const allColumns = await getTableColumns.run({ tableName }, pool);
          ctx.columns = allColumns.filter(
            column => column.column_name && column.data_type,
          ) as FilteredColumns;
        } catch (error) {
          logger.error(error);
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
                task: async (ctx, task) => await getMonthTransactions(month, ctx, task),
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
        let status: string = '';

        // update main task status
        if (ctx.processedData) {
          if (ctx.processedData.transactions) {
            status += `Reviewed ${ctx.processedData.transactions} Transactions`;
          }
          if (ctx.processedData.newTransactions === 0) {
            status += `, Nothing New`;
          } else if (ctx.processedData.newTransactions) {
            status += `, ${ctx.processedData.newTransactions} New`;
          }
          if (ctx.processedData.insertedTransactions) {
            if (ctx.processedData.insertedTransactions === ctx.processedData.newTransactions) {
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
