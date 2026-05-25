import { format } from 'date-fns';
import { type Page } from 'playwright';
import { OtsarHahayalOptions } from './index.js';
import { drillDownDataSchema, ilsTransactionsResponseSchema } from './schemas.js';
import type {
  DrillDown523Data,
  DrillDown526Data,
  DrillDownData,
  IlsTransaction,
  IlsTransactionsRequest,
} from './types.js';

function extractT10C1523Reference(
  data: DrillDown523Data,
  count: number,
  transactionReference: number,
): string {
  const details = data['OUT-DATA']['OUT-DETAILS'];
  if (Array.isArray(details)) {
    const instanceDetails = details[count];
    if (!instanceDetails) {
      throw new Error(
        `Unexpected duplicate transaction with T10C1523 drill down and reference ${transactionReference} - drillDownData has only ${details.length} entries, cannot disambiguate instance number ${count}`,
      );
    }
    return instanceDetails['WS-DATA-2']['WS-TS-ASM'];
  }
  if (count > 1) {
    throw new Error(
      `Unexpected duplicate transaction with T10C1523 drill down and reference ${transactionReference} - drillDownData is not an array, cannot disambiguate`,
    );
  }
  return details['WS-DATA-2']['WS-TS-ASM'];
}

function extractT10C1526Reference(
  data: DrillDown526Data,
  count: number,
  transactionReference: number,
  transactionDescription: string,
): string | undefined {
  const details = data['OUT-DATA']['OUT-DETAILS'];
  if (!details) {
    if (transactionDescription.includes('מע\' זה"ב')) {
      return undefined;
    }
    throw new Error(
      `Missing details in drillDownData for transaction with T10C1526 drill down and reference ${transactionReference}`,
    );
  }
  if (Array.isArray(details)) {
    const instanceDetails = details[count];
    if (!instanceDetails) {
      throw new Error(
        `Unexpected duplicate transaction with T10C1526 drill down and reference ${transactionReference} - drillDownData has only ${details.length} entries, cannot disambiguate instance number ${count}`,
      );
    }
    return instanceDetails['WS-ASMACHTA'];
  }
  return details['WS-ASMACHTA'];
}

function getTransactionOriginReference(transaction: IlsTransaction, duplicateCount: number) {
  if (!transaction.drillDownData || typeof transaction.drillDownData === 'string') {
    return undefined;
  }
  if (transaction.CorrespondentBank === 99) {
    // Gov transactions, no origin reference available
    return undefined;
  }
  if ('T10C1523' in transaction.drillDownData) {
    return extractT10C1523Reference(
      transaction.drillDownData.T10C1523,
      duplicateCount,
      transaction.reference,
    );
  }
  if ('T10C1526' in transaction.drillDownData) {
    return extractT10C1526Reference(
      transaction.drillDownData.T10C1526,
      duplicateCount,
      transaction.reference,
      transaction.description,
    );
  }
  if ('T20C2211' in transaction.drillDownData) {
    return transaction.drillDownData.T20C2211['OUT-DATA']['ALL-CARDS']['KARTIS-DETAILS'][
      'OUT-MSKART'
    ];
  }
  throw new Error(
    `Missing or invalid drillDownData for transaction reference ${transaction.reference}`,
  );
}

function enrichTransactionWithOriginReference(transactions: IlsTransaction[]) {
  const txnKeyCounterMap = new Map<string, number>();
  for (const transaction of transactions) {
    const key = `${transaction.dateOfBusinessDay}|${transaction.dateOfRegistration}|${transaction.reference}|${transaction.description}`;
    const count = txnKeyCounterMap.get(key) || 0;
    const originReference = getTransactionOriginReference(transaction, count);
    if (originReference) {
      transaction.originReference = originReference;
    }
    txnKeyCounterMap.set(key, count + 1);
  }
}

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
      const drilldownDataMap = new Map<string, DrillDownData>();
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

      enrichTransactionWithOriginReference(validation.data.transactions);
    }

    return {
      data: validation.data ?? null,
      isValid: validation.success,
      errors: validation.success ? null : validation.error.issues,
    };
  }

  return { data: apiData, isValid: null };
}
