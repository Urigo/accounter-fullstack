import { Page } from 'playwright';
import { $ZodIssue } from 'zod/v4/core';
import { sleep } from '../../utils/sleep.js';
import { OtsarHahayalOptions } from './index.js';
import { CreditCardsResponse, creditCardsResponseSchema } from './schemas.js';

export async function getCreditCards(
  page: Page,
  options: OtsarHahayalOptions,
  headers: Record<string, string>,
): Promise<{
  data: CreditCardsResponse | null;
  isValid: boolean | null;
  errors: $ZodIssue[] | null;
}> {
  page.goto('https://online.bankotsar.co.il/appsng/Resources/PortalNG/shell/#/creditcardCharges');

  // stale for random 0.5-1 second
  await sleep(Math.random() * 500 + 500);

  const apiData = await page.evaluate(async headers => {
    const response = await fetch(
      'https://online.bankotsar.co.il/appsng/bff-portal-creditcards/api/v1/CreditCards',
      {
        headers: {
          accept: 'application/json, text/plain, */*',
          'accept-language': 'en-US,en;q=0.9',
          priority: 'u=1, i',
          'sec-ch-ua': '"Google Chrome";v="147", "Not.A/Brand";v="8", "Chromium";v="147"',
          'sec-ch-ua-mobile': '?0',
          'sec-ch-ua-platform': '"macOS"',
          'sec-fetch-dest': 'empty',
          'sec-fetch-mode': 'cors',
          'sec-fetch-site': 'same-origin',
          'x-fibi-transaction-id': '64e6c397-31ce-4ed4-a33f-b24fade42e2a',
          Referer: 'https://online.bankotsar.co.il/',
          ...headers,
        },
        body: null,
        method: 'GET',
      },
    );
    return response.json();
  }, headers);

  if (options.validateSchema) {
    const validation = creditCardsResponseSchema.safeParse(apiData);
    return {
      data: validation.data ?? null,
      isValid: validation.success,
      errors: validation.success ? null : validation.error.issues,
    };
  }

  return {
    data: apiData ?? null,
    isValid: null,
    errors: null,
  };
}
