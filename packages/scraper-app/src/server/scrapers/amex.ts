import { addMonths, format, startOfMonth } from 'date-fns';
import type { z } from 'zod';
import { init, type IsracardCardsTransactionsList } from '@accounter/modern-poalim-scraper';
import type { ServerMessage } from '../../shared/ws-protocol.js';
import { validatePayload } from '../validate-payload.js';
import type { IsracardAmexAccountSchema } from '../vault.js';
import { countIsracardTransactions } from './isracard.js';

export type AmexCreds = z.infer<typeof IsracardAmexAccountSchema>;

export type Emitter = (msg: ServerMessage) => void;

export type MonthlyIsracardPayload = {
  month: string;
  data: IsracardCardsTransactionsList;
};

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

export async function scrapeAmex(
  creds: AmexCreds,
  dateFrom: Date,
  dateTo: Date,
  emit: Emitter,
  headless = true,
): Promise<MonthlyIsracardPayload[]> {
  const { amex: amexFn, close } = await init({ headless });

  try {
    const scraper = await amexFn(
      { ID: creds.ownerId, password: creds.password, card6Digits: creds.last6Digits },
      { validateSchema: true },
    );

    const months = buildMonthList(dateFrom, dateTo);
    const results: MonthlyIsracardPayload[] = [];

    for (const month of months) {
      // delay for 2-5 seconds, so we can avoid being blocked by Amex
      await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 3000));

      const monthStr = format(month, 'yyyy-MM');
      emit({ type: 'task-month-fetching', sourceId: creds.id, month: monthStr });
      try {
        const { data, isValid } = await scraper.getMonthTransactions(month);

        if (!data) continue;

        if (!isValid) {
          throw new Error(`Invalid Amex data for ${monthStr}`);
        }

        if (data.Header?.Status !== '1') {
          throw new Error(
            `Amex login/password issue (Header.Status=${data.Header?.Status}) for ${monthStr}`,
          );
        }

        const validated = validatePayload('amex', data);
        const txnCount = countIsracardTransactions(validated);
        emit({
          type: 'task-month-fetched',
          sourceId: creds.id,
          month: monthStr,
          transactionCount: txnCount,
        });
        results.push({ month: monthStr, data: validated });
      } catch (err) {
        emit({
          type: 'task-month-error',
          sourceId: creds.id,
          month: monthStr,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    if (results.length === 0) throw new Error('All months failed to scrape');
    return results;
  } finally {
    await close();
  }
}
