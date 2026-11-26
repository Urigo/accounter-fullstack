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

/**
 * The progress row a month belongs to. Rows are keyed by this label, so when several cards
 * are read each card's month needs its own.
 */
export function calProgressLabel(month: string, card: string, severalCards: boolean): string {
  return severalCards ? `${month} · ${card}` : month;
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

    // With no card named, every card on the account is read; which of them are uploaded is
    // decided afterwards, when the discovered cards are approved or ignored.
    const requested = creds.last4Digits.trim();
    const cards = requested === '' ? scraper.getCards() : [requested];
    if (cards.length === 0) {
      throw new Error('No cards were found on this CAL account');
    }

    let fetched = 0;
    let lastError: string | undefined;
    for (const card of cards) {
      for (const month of months) {
        // delay for 2-5 seconds, so we can avoid being blocked by Cal
        await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 3000));

        const monthStr = format(month, 'yyyy-MM');
        const label = calProgressLabel(monthStr, card, cards.length > 1);
        emit({ type: 'task-month-fetching', sourceId: creds.id, month: label });
        try {
          const transactions = await scraper.getMonthTransactions(card, month);
          emit({
            type: 'task-month-fetched',
            sourceId: creds.id,
            month: label,
            transactionCount: transactions.length,
          });
          results.push({ card, month: monthStr, transactions });
          fetched++;
        } catch (err) {
          lastError = err instanceof Error ? err.message : String(err);
          emit({ type: 'task-month-error', sourceId: creds.id, month: label, error: lastError });
        }
      }
    }

    // A month can fail on its own and the rest still be worth uploading. When every one
    // failed there is nothing to upload, and reporting the task as done would hide that.
    if (fetched === 0) {
      throw new Error(lastError ?? 'No month could be read from CAL');
    }

    return validatePayload('cal', results);
  } finally {
    await close();
  }
}
