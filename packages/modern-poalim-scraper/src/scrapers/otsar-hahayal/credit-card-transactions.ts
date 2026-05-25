import { format, startOfMonth } from 'date-fns';
import { type Page } from 'playwright';
import type { $ZodIssue } from 'zod/v4/core';
import { sleep } from '../../utils/sleep.js';
import { OtsarHahayalOptions } from './index.js';
import { creditCardBillingPeriodSchema } from './schemas.js';
import type {
  CreditCardBillingPeriod,
  CreditCardTransactionsRequest,
  TimelessDateString,
} from './types.js';

const dealGroups: (keyof CreditCardBillingPeriod)[] = [
  'localDeals',
  'euroDeals',
  'dollarDeals',
  'shekelMatahDeals',
  'localCurrentDebitDeals',
  'euroCurrentDebitDeals',
  'dollarCurrentDebitDeals',
  'shekelMatahCurrentDebitDeals',
];

export async function getCreditCardTransactions(
  page: Page,
  headers: Record<string, string>,
  options: OtsarHahayalOptions,
  card: {
    resourceId: string;
    cardType: number;
    debitDay: number;
  },
  month: TimelessDateString,
) {
  // stale for random 0.5-1 second
  await sleep(Math.random() * 500 + 500);

  const date = format(startOfMonth(month), 'yyyy-MM-dd') as TimelessDateString;

  const apiData = await page.evaluate(
    async ({ headers, card, date }) => {
      const body: CreditCardTransactionsRequest = {
        ...card,
        date,
      };
      const response = await fetch(
        'https://online.bankotsar.co.il/appsng/bff-portal-creditcards/api/v1/creditCardTransactions',
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
            Referer: 'https://online.bankotsar.co.il/',
            ...headers,
          },
        },
      );

      return response.json();
    },
    { headers, card, date },
  );

  let result: {
    data: CreditCardBillingPeriod | null;
    isValid: boolean | null;
    errors: $ZodIssue[] | null;
  } = {
    data: apiData,
    isValid: null,
    errors: null,
  };

  if (options.validateSchema) {
    const validation = creditCardBillingPeriodSchema.safeParse(apiData);

    result = {
      isValid: validation.success,
      data: validation.data ?? null,
      errors: validation.success ? null : validation.error.issues,
    };
  }

  if (result.data) {
    // added index to each transaction based on the combination of its fields, to distinguish between identical transactions
    const counts = new Map<string, number>();

    for (const group of dealGroups) {
      const deals = result.data[group]?.deals;
      if (!deals) continue;
      for (const tx of deals) {
        const key = `${tx.date}|${tx.chargeDate}|${tx.name}|${tx.dealCurrency}|${tx.dealAmount}|${tx.notes}`;
        const counter = counts.get(key) ?? 0;
        tx.counter = counter;
        counts.set(key, counter + 1);
      }
    }
  }

  return result;
}
