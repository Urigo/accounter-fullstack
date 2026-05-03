import { addMonths, startOfMonth } from 'date-fns';
import type { z } from 'zod';
import { init } from '@accounter/modern-poalim-scraper';
import type { ServerMessage } from '../../shared/ws-protocol.js';
import type { IsracardPayload } from '../payload-schemas/isracard.schema.js';
import { validatePayload } from '../validate-payload.js';
import type { IsracardAmexAccountSchema } from '../vault.js';

export type IsracardCreds = z.infer<typeof IsracardAmexAccountSchema>;

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

export async function scrapeIsracard(
  creds: IsracardCreds,
  dateFrom: Date,
  dateTo: Date,
  emit: Emitter,
): Promise<IsracardPayload[]> {
  const { isracard: isracardFn, close } = await init({ headless: true });

  try {
    const scraper = await isracardFn(
      { ID: creds.ownerId, password: creds.password, card6Digits: creds.last6Digits },
      { validateSchema: true },
    );

    const months = buildMonthList(dateFrom, dateTo);
    const results: IsracardPayload[] = [];

    for (const month of months) {
      emit({
        type: 'scrape-progress',
        sourceId: creds.id,
        sourceType: 'isracard',
        status: 'running',
      });
      const { data, isValid } = await scraper.getMonthTransactions(month);

      if (!data) continue;

      if (!isValid) {
        throw new Error(`Invalid Isracard data for ${month.toISOString().slice(0, 7)}`);
      }

      if (data.Header?.Status !== '1') {
        throw new Error(
          `Isracard login/password issue (Header.Status=${data.Header?.Status}) for ${month.toISOString().slice(0, 7)}`,
        );
      }

      results.push(validatePayload('isracard', data));
    }

    return results;
  } finally {
    await close();
  }
}
