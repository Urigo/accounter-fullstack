import { addMonths, format, startOfMonth } from 'date-fns';
import type { z } from 'zod';
import { init, type IsracardCardsTransactionsList } from '@accounter/modern-poalim-scraper';
import type { ServerMessage } from '../../shared/ws-protocol.js';
import { validatePayload } from '../validate-payload.js';
import type { IsracardAmexAccountSchema } from '../vault.js';

export type IsracardCreds = z.infer<typeof IsracardAmexAccountSchema>;

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

function countIsracardTransactions(data: IsracardCardsTransactionsList): number {
  const bean = data.CardsTransactionsListBean;
  if (!bean) return 0;
  return Object.values(bean).reduce((sum, entry) => {
    if (
      entry &&
      typeof entry === 'object' &&
      !Array.isArray(entry) &&
      '@AllCards' in entry &&
      'CurrentCardTransactions' in entry
    ) {
      let txnCount = 0;
      for (const subEntry of entry.CurrentCardTransactions) {
        if (!subEntry || typeof subEntry !== 'object' || Array.isArray(subEntry)) {
          continue;
        }
        if ('txnIsrael' in subEntry) {
          txnCount += subEntry.txnIsrael?.length ?? 0;
        } else if ('txnAbroad' in subEntry) {
          txnCount += subEntry.txnAbroad?.length ?? 0;
        }
      }
      return sum + txnCount;
    }
    return sum;
  }, 0);
}

export async function scrapeIsracard(
  creds: IsracardCreds,
  dateFrom: Date,
  dateTo: Date,
  emit: Emitter,
): Promise<MonthlyIsracardPayload[]> {
  const { isracard: isracardFn, close } = await init({ headless: true });

  try {
    const scraper = await isracardFn(
      { ID: creds.ownerId, password: creds.password, card6Digits: creds.last6Digits },
      { validateSchema: true },
    );

    const months = buildMonthList(dateFrom, dateTo);
    const results: MonthlyIsracardPayload[] = [];

    for (const month of months) {
      const monthStr = format(month, 'yyyy-MM');
      emit({ type: 'task-month-fetching', sourceId: creds.id, month: monthStr });
      try {
        const { data, isValid } = await scraper.getMonthTransactions(month);

        if (!data) continue;

        if (!isValid) {
          throw new Error(`Invalid Isracard data for ${monthStr}`);
        }

        if (data.Header?.Status !== '1') {
          throw new Error(
            `Isracard login/password issue (Header.Status=${data.Header?.Status}) for ${monthStr}`,
          );
        }

        const validated = validatePayload('isracard', data);
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

export { countIsracardTransactions };
