import { addMonths, format, startOfMonth } from 'date-fns';
import type { z } from 'zod';
import { init } from '@accounter/modern-poalim-scraper';
import type { ServerMessage } from '../../shared/ws-protocol.js';
import type { CalPayload } from '../payload-schemas/cal.schema.js';
import { validatePayload } from '../validate-payload.js';
import type { CalAccountSchema } from '../vault.js';

export type CalCreds = z.infer<typeof CalAccountSchema>;

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

export async function scrapeCal(
  creds: CalCreds,
  dateFrom: Date,
  dateTo: Date,
  emit: Emitter,
  headless = true,
): Promise<CalPayload> {
  const { cal: calFn, close } = await init({ headless });

  try {
    const scraper = await calFn({
      username: creds.username,
      password: creds.password,
      last4Digits: creds.last4Digits,
    });

    const months = buildMonthList(dateFrom, dateTo);
    const results: CalPayload = [];

    for (const month of months) {
      // delay for 2-5 seconds, so we can avoid being blocked by Cal
      await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 3000));

      const monthStr = format(month, 'yyyy-MM');
      emit({ type: 'task-month-fetching', sourceId: creds.id, month: monthStr });
      try {
        const transactions = await scraper.getMonthTransactions(creds.last4Digits, month);
        emit({
          type: 'task-month-fetched',
          sourceId: creds.id,
          month: monthStr,
          transactionCount: transactions.length,
        });
        results.push({ card: creds.last4Digits, month: monthStr, transactions });
      } catch (err) {
        emit({
          type: 'task-month-error',
          sourceId: creds.id,
          month: monthStr,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return validatePayload('cal', results);
  } finally {
    await close();
  }
}
