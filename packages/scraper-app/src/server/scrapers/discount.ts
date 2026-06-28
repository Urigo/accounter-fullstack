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
  headless = true,
): Promise<DiscountPayload> {
  const { discount: discountFn, close } = await init({ headless });

  try {
    const scraper = await discountFn({
      ID: creds.ID,
      password: creds.password,
      ...(creds.code ? { code: creds.code } : {}),
    });

    const months = buildMonthList(dateFrom, dateTo);
    const results: DiscountPayload = [];

    for (const month of months) {
      // stale for 2-5 seconds, so we can avoid being blocked by Amex
      await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 3000));

      const monthStr = format(month, 'yyyy-MM');
      emit({ type: 'task-month-fetching', sourceId: creds.id, month: monthStr });
      try {
        const { accountNumber, balance, transactions } = await scraper.getMonthTransactions(month);
        emit({
          type: 'task-month-fetched',
          sourceId: creds.id,
          month: monthStr,
          transactionCount: transactions.length,
        });
        results.push({ accountNumber, month: monthStr, balance, transactions });
      } catch (err) {
        emit({
          type: 'task-month-error',
          sourceId: creds.id,
          month: monthStr,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return validatePayload('discount', results);
  } finally {
    await close();
  }
}
