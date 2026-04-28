import { init } from '@accounter/modern-poalim-scraper';
import type { ServerMessage } from '../../shared/ws-protocol.js';
import type { AmexPayload } from '../payload-schemas/amex.schema.js';
import type { IsracardPayload } from '../payload-schemas/isracard.schema.js';
import { validatePayload } from '../validate-payload.js';

export type IsracardSourceConfig = {
  id: string;
  ownerId: string;
  password: string;
  last6Digits: string;
};

export type OtpManager = {
  waitForOtp(sourceId: string, timeoutMs: number): Promise<string>;
};

export type Emitter = (msg: ServerMessage) => void;

export type IsracardRawPayload = IsracardPayload | AmexPayload;

type ScraperCredentials = {
  ID: string;
  password: string;
  card6Digits: string;
};

export async function scrapeIsracard(
  creds: IsracardSourceConfig,
  variant: 'isracard' | 'amex',
  _dateFrom: Date,
  _dateTo: Date,
  _otpManager: OtpManager,
  _emit: Emitter,
): Promise<IsracardRawPayload> {
  const { isracard: isracardFn, amex: amexFn, close } = await init({ headless: true });

  const scraperCreds: ScraperCredentials = {
    ID: creds.ownerId,
    password: creds.password,
    card6Digits: creds.last6Digits,
  };

  const now = new Date();
  const payloadType = variant;

  try {
    const scraper =
      variant === 'isracard'
        ? await isracardFn(scraperCreds)
        : await amexFn(scraperCreds);

    const { data } = await scraper.getMonthTransactions(now);
    return validatePayload(payloadType, data) as IsracardRawPayload;
  } finally {
    await close();
  }
}
