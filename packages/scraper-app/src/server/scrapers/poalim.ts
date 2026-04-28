import { init } from '@accounter/modern-poalim-scraper';
import type { ServerMessage } from '../../shared/ws-protocol.js';
import type { PoalimIlsPayload } from '../payload-schemas/poalim-ils.schema.js';
import { validatePayload } from '../validate-payload.js';

const OTP_TIMEOUT_MS = 5 * 60 * 1_000;

export type PoalimSourceConfig = {
  id: string;
  userCode: string;
  password: string;
  options?: {
    isBusinessAccount?: boolean;
  };
};

export type OtpManager = {
  waitForOtp(sourceId: string, timeoutMs: number): Promise<string>;
};

export type Emitter = (msg: ServerMessage) => void;

export type PoalimRawPayload = PoalimIlsPayload;

// Local options type that extends the scraper's options with an OTP callback.
// The real hapoalim scraper uses inquirer for OTP today; otpCallback is the
// hook for WS-based OTP. The mock uses it in tests; real integration requires
// a matching change in the scraper package.
type ScraperCallOptions = {
  isBusiness?: boolean;
  otpCallback?: () => Promise<string>;
};

export async function scrapePoalim(
  creds: PoalimSourceConfig,
  _dateFrom: Date,
  _dateTo: Date,
  otpManager: OtpManager,
  _emit: Emitter,
): Promise<PoalimRawPayload> {
  const otpCallback = () => otpManager.waitForOtp(creds.id, OTP_TIMEOUT_MS);

  const { hapoalim: hapoalimFn, close } = await init({ headless: true });

  // Cast is required because HapoalimOptions doesn't expose otpCallback yet.
  // The mock in tests receives ScraperCallOptions and calls otpCallback().
  type HapoalimFn = (
    c: { userCode: string; password: string },
    o?: ScraperCallOptions,
  ) => ReturnType<typeof hapoalimFn>;

  const scrape = hapoalimFn as unknown as HapoalimFn;

  try {
    const scraper = await scrape(
      { userCode: creds.userCode, password: creds.password },
      { isBusiness: creds.options?.isBusinessAccount ?? true, otpCallback },
    );

    if (scraper === 'Unknown Error') {
      throw new Error('Hapoalim login failed');
    }

    const { data: accounts } = await scraper.getAccountsData();
    if (!accounts || accounts.length === 0) {
      throw new Error('No Hapoalim accounts found');
    }

    const account = accounts[0];
    const { data: ilsData } = await scraper.getILSTransactions({
      bankNumber: account.bankNumber,
      branchNumber: account.branchNumber,
      accountNumber: account.accountNumber,
    });

    return validatePayload('poalim-ils', ilsData);
  } finally {
    await close();
  }
}
