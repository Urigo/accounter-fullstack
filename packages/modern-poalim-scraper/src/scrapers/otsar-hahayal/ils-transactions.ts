import { format } from 'date-fns';
import { z } from 'zod';
import { type Page } from 'playwright';
import { OtsarHahayalOptions } from './index.js';
import { drillDownDataSchema, ilsTransactionsResponseSchema } from './schemas.js';

type IlsTransactionsRequest = {
  initialRequest: {
    accountNumber: number;
    accountType: number;
    branch: string;
    endDate: string;
    startDate: string;
    order: number;
    language: string;
  };
};

export async function getIlsTransactions(
  page: Page,
  headers: Record<string, string>,
  options: OtsarHahayalOptions,
  account: {
    accountNumber: number;
    accountType?: number;
    branch: string;
  },
) {
  const startDate = format(
    options.fromDate
      ? new Date(options.fromDate)
      : new Date(new Date().setFullYear(new Date().getFullYear() - 1)),
    'yyyy-MM-dd',
  );
  const endDate = format(options.toDate ? new Date(options.toDate) : new Date(), 'yyyy-MM-dd');
  const apiData = await page.evaluate(
    async ({ headers, account, startDate, endDate }) => {
      const body: IlsTransactionsRequest = {
        initialRequest: {
          accountNumber: account.accountNumber,
          accountType: account.accountType ?? 409,
          branch: account.branch,
          endDate,
          startDate,
          order: 1,
          language: 'HEB',
        },
      };
      const response = await fetch(
        'https://online.bankotsar.co.il/appsng/bff-balancetransactions/api/v1/transactions/list',
        {
          method: 'POST',
          body: JSON.stringify(body),
          headers: {
            accept: 'application/json, text/plain, */*',
            'accept-language': 'en-US,en;q=0.9',
            'content-type': 'application/json',
            priority: 'u=1, i',
            'sec-ch-ua': '"Google Chrome";v="147", "Not.A/Brand";v="8", "Chromium";v="147"',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"macOS"',
            'sec-fetch-dest': 'empty',
            'sec-fetch-mode': 'cors',
            'sec-fetch-site': 'same-origin',
            ...headers,
          },
        },
      );
      return response.json();
    },
    { headers, account, startDate, endDate },
  );

  if (options.validateSchema) {
    const validation = ilsTransactionsResponseSchema.safeParse(apiData);

    // enrich drilldown data
    if (validation.success && validation.data.transactions.length > 0) {
      const drilldownDataMap = new Map<string, z.infer<typeof drillDownDataSchema>>();
      for (const transaction of validation.data.transactions) {
        if (transaction.drillDownUrl && transaction.drillDownUrl !== '') {
          if (drilldownDataMap.has(transaction.drillDownUrl)) {
            transaction.drillDownData = drilldownDataMap.get(transaction.drillDownUrl)!;
            continue;
          }
          const apiDrilldownData = await page.evaluate(
            async ({ drillDownUrl, headers }) => {
              const response = await fetch(`https://online.bankotsar.co.il${drillDownUrl}`, {
                method: 'GET',
                headers: {
                  accept: 'application/json, text/plain, */*',
                  'accept-language': 'en-US,en;q=0.9',
                  'content-type': 'application/json',
                  priority: 'u=1, i',
                  'sec-ch-ua': '"Google Chrome";v="147", "Not.A/Brand";v="8", "Chromium";v="147"',
                  'sec-ch-ua-mobile': '?0',
                  'sec-ch-ua-platform': '"macOS"',
                  'sec-fetch-dest': 'empty',
                  'sec-fetch-mode': 'cors',
                  'sec-fetch-site': 'same-origin',
                  ...headers,
                },
              });

              const text = await response.text();
              try {
                return JSON.parse(text);
              } catch {
                return text;
              }
            },
            { drillDownUrl: transaction.drillDownUrl, headers },
          );

          const parsed = drillDownDataSchema.parse(apiDrilldownData);
          drilldownDataMap.set(transaction.drillDownUrl, parsed);
          transaction.drillDownData = parsed;
        }
      }
    }
    return {
      data: validation.data ?? null,
      isValid: validation.success,
      errors: validation.success ? null : validation.error.issues,
    };
  }

  return { data: apiData, isValid: null };
}
