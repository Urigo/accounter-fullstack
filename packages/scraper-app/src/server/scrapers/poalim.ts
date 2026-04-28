import type { z } from 'zod';
import { init } from '@accounter/modern-poalim-scraper';
import type { ServerMessage } from '../../shared/ws-protocol.js';
import type { OtpManager } from '../otp-manager.js';
import type { PoalimForeignPayload } from '../payload-schemas/poalim-foreign.schema.js';
import type { PoalimIlsPayload } from '../payload-schemas/poalim-ils.schema.js';
import type { PoalimSwiftPayload } from '../payload-schemas/poalim-swift.schema.js';
import { validatePayload } from '../validate-payload.js';
import type { PoalimAccountSchema } from '../vault.js';

export type PoalimCreds = z.infer<typeof PoalimAccountSchema>;

const OTP_TIMEOUT_MS = 5 * 60 * 1000;

// Local options type that extends the scraper's options with an OTP callback.
// The hapoalim scraper uses inquirer for OTP today; otpCallback is the hook
// for WS-based OTP flow. The cast below is required until the scraper package
// exposes otpCallback in its public HapoalimOptions type.
type ScraperCallOptions = {
  isBusiness?: boolean;
  otpCallback?: () => Promise<string>;
};

export async function scrapePoalim(
  creds: PoalimCreds,
  _dateFrom: Date,
  _dateTo: Date,
  headless: boolean,
  otpManager: OtpManager,
  emit: (msg: ServerMessage) => void,
): Promise<{
  ils: PoalimIlsPayload[];
  foreign: PoalimForeignPayload[];
  swift: PoalimSwiftPayload[];
}> {
  const otpCallback = () => otpManager.waitForOtp(creds.id, emit, OTP_TIMEOUT_MS);

  const { hapoalim: hapoalimFn, close } = await init({ headless });

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
      throw new Error('Hapoalim login failed: Unknown Error');
    }

    const { data: accounts } = await scraper.getAccountsData();
    if (!accounts || accounts.length === 0) {
      return { ils: [], foreign: [], swift: [] };
    }

    const ils: PoalimIlsPayload[] = [];
    const foreign: PoalimForeignPayload[] = [];
    const swift: PoalimSwiftPayload[] = [];
    const isBusiness = creds.options?.isBusinessAccount ?? true;

    for (const account of accounts) {
      const accountRef = {
        bankNumber: account.bankNumber,
        branchNumber: account.branchNumber,
        accountNumber: account.accountNumber,
      };

      const { data: ilsData } = await scraper.getILSTransactions(accountRef);
      if (ilsData) {
        ils.push(validatePayload('poalim-ils', ilsData));
      }

      const { data: foreignData } = await scraper.getForeignTransactions(accountRef, isBusiness);
      if (foreignData) {
        foreign.push(validatePayload('poalim-foreign', foreignData));
      }

      const { data: swiftData } = await scraper.getForeignSwiftTransactions(accountRef);
      if (swiftData) {
        swift.push(validatePayload('poalim-swift', swiftData));
      }
    }

    return { ils, foreign, swift };
  } finally {
    await close();
  }
}
