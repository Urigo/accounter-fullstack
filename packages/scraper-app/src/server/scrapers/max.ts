import type { z } from 'zod';
import { init } from '@accounter/modern-poalim-scraper';
import type { ServerMessage } from '../../shared/ws-protocol.js';
import type { MaxPayload } from '../payload-schemas/max.schema.js';
import { validatePayload } from '../validate-payload.js';
import type { MaxAccountSchema } from '../vault.js';

export type MaxCreds = z.infer<typeof MaxAccountSchema>;

export type Emitter = (msg: ServerMessage) => void;

export async function scrapeMax(
  creds: MaxCreds,
  dateFrom: Date,
  _dateTo: Date,
  emit: Emitter,
): Promise<MaxPayload> {
  const { max: maxFn, close } = await init({ headless: true });

  try {
    const scraper = await maxFn(
      { username: creds.username, password: creds.password },
      { startDate: dateFrom },
    );

    emit({ type: 'scrape-progress', sourceId: creds.id, sourceType: 'max', status: 'running' });
    const accounts = await scraper.getTransactions();
    return validatePayload('max', accounts);
  } finally {
    await close();
  }
}
