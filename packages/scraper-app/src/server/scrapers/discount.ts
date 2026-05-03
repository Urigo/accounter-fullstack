import { addMonths, format, startOfMonth } from 'date-fns';
import type { z } from 'zod';
import { init } from '@accounter/modern-poalim-scraper';
import type { ServerMessage } from '../../shared/ws-protocol.js';
import type { DiscountPayload } from '../payload-schemas/discount.schema.js';
import { validatePayload } from '../validate-payload.js';
import type { DiscountAccountSchema } from '../vault.js';

export type DiscountCreds = z.infer<typeof DiscountAccountSchema>;

export type Emitter = (msg: ServerMessage) => void;

function buildMonthList(dateFrom: Date, dateTo: Date): Date[] {
  const months: Date[] = [];
  let current = startOfMonth(dateFrom);
  const end = startOfMonth(dateTo);
  while (current <= end) {
    months.push(current);
    current = addMonths(current, 1);
  }
  return months;
}

export async function scrapeDiscount(
  creds: DiscountCreds,
  dateFrom: Date,
  dateTo: Date,
  emit: Emitter,
): Promise<DiscountPayload> {
  const { discount: discountFn, close } = await init({ headless: true });

  try {
    const scraper = await discountFn({
      ID: creds.ID,
      password: creds.password,
      ...(creds.code ? { code: creds.code } : {}),
    });

    const months = buildMonthList(dateFrom, dateTo);
    const results: DiscountPayload = [];

    for (const month of months) {
      emit({
        type: 'scrape-progress',
        sourceId: creds.id,
        sourceType: 'discount',
        status: 'running',
      });
      const { accountNumber, balance, transactions } = await scraper.getMonthTransactions(month);
      results.push({
        accountNumber,
        month: format(month, 'yyyy-MM'),
        balance,
        transactions,
      });
    }

    return validatePayload('discount', results);
  } finally {
    await close();
  }
}
