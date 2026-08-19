import type { z } from 'zod';
import { init } from '@accounter/modern-poalim-scraper';
import type { ServerMessage } from '../../shared/ws-protocol.js';
import type { MaxPayload } from '../payload-schemas/max.schema.js';
import { validatePayload } from '../validate-payload.js';
import type { MaxAccountSchema } from '../vault.js';

export type MaxCreds = z.infer<typeof MaxAccountSchema>;

export type Emitter = (msg: ServerMessage) => void;

/**
 * `runtimeReference.type === 0` marks a transaction that was only declared to Max and never
 * received by the credit card company. Those records are missing many of the attributes a
 * settled transaction carries (deal data, payment date, amounts), so they neither validate
 * against the payload schema nor represent real charges — drop them before validation.
 */
const UNRECEIVED_RUNTIME_REFERENCE_TYPE = 0;

function isUnreceivedTransaction(txn: unknown): boolean {
  if (typeof txn !== 'object' || txn === null) {
    return false;
  }
  const runtimeReference = (txn as { runtimeReference?: unknown }).runtimeReference;
  if (typeof runtimeReference !== 'object' || runtimeReference === null) {
    return false;
  }
  return (runtimeReference as { type?: unknown }).type === UNRECEIVED_RUNTIME_REFERENCE_TYPE;
}

/**
 * Strips unreceived (`runtimeReference.type === 0`) transactions from a raw Max payload.
 *
 * Runs on the raw scraper output, before schema validation, since those records are missing
 * required fields. Anything that is not shaped like the expected payload is passed through
 * untouched so validation can report the real problem.
 */
export function filterUnreceivedMaxTransactions(raw: unknown): unknown {
  if (!Array.isArray(raw)) {
    return raw;
  }
  return raw.map(account => {
    if (typeof account !== 'object' || account === null) {
      return account;
    }
    const txns = (account as { txns?: unknown }).txns;
    if (!Array.isArray(txns)) {
      return account;
    }
    return { ...account, txns: txns.filter(txn => !isUnreceivedTransaction(txn)) };
  });
}

export async function scrapeMax(
  creds: MaxCreds,
  dateFrom: Date,
  _dateTo: Date,
  emit: Emitter,
  headless = true,
): Promise<MaxPayload> {
  const { max: maxFn, close } = await init({ headless });

  try {
    const scraper = await maxFn(
      { username: creds.username, password: creds.password },
      { startDate: dateFrom },
    );

    const accounts = await scraper.getTransactions();
    const validated = validatePayload('max', filterUnreceivedMaxTransactions(accounts));

    for (const account of validated) {
      emit({
        type: 'task-month-fetched',
        sourceId: creds.id,
        month: account.accountNumber,
        transactionCount: account.txns.length,
      });
    }

    return validated;
  } finally {
    await close();
  }
}
