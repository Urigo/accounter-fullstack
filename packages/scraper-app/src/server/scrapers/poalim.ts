import type { z } from 'zod';
import { init, type HapoalimOptions } from '@accounter/modern-poalim-scraper';
import type { ServerMessage } from '../../shared/ws-protocol.js';
import type { OtpManager } from '../otp-manager.js';
import type { PoalimForeignPayload } from '../payload-schemas/poalim-foreign.schema.js';
import type { PoalimIlsPayload } from '../payload-schemas/poalim-ils.schema.js';
import type { PoalimSwiftPayload } from '../payload-schemas/poalim-swift.schema.js';
import { validatePayload } from '../validate-payload.js';
import type { PoalimAccountSchema } from '../vault.js';

export type PoalimCreds = z.infer<typeof PoalimAccountSchema>;

const OTP_TIMEOUT_MS = 5 * 60 * 1000;

export async function scrapePoalim(
  creds: PoalimCreds,
  dateFrom: Date,
  dateTo: Date,
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

  // calculate duration based on dateFrom and today. return number of months between the two dates, with a minimum of 1 month
  const months = Math.max(
    1,
    (dateTo.getFullYear() - dateFrom.getFullYear()) * 12 +
      (dateTo.getMonth() - dateFrom.getMonth()) +
      1,
  );

  const options: HapoalimOptions = {
    isBusiness: creds.options?.isBusinessAccount ?? false,
    otpCallback,
    duration: months,
  };

  try {
    const scraper = await hapoalimFn(
      { userCode: creds.userCode, password: creds.password },
      options,
    );

    if (scraper === 'Unknown Error') {
      throw new Error('Hapoalim login failed: Unknown Error');
    }

    const { data: accounts } = await scraper.getAccountsData();
    if (!accounts || accounts.length === 0) {
      return { ils: [], foreign: [], swift: [] };
    }

    emit({
      type: 'task-accounts-found',
      sourceId: creds.id,
      accounts: accounts.map(a => ({
        accountNumber: String(a.accountNumber),
        branchNumber: a.branchNumber,
        bankNumber: a.bankNumber,
      })),
    });

    const ils: PoalimIlsPayload[] = [];
    const foreign: PoalimForeignPayload[] = [];
    const swift: PoalimSwiftPayload[] = [];
    const isBusiness = creds.options?.isBusinessAccount ?? false;

    for (const account of accounts) {
      const accountId = String(account.accountNumber);
      const accountRef = {
        bankNumber: account.bankNumber,
        branchNumber: account.branchNumber,
        accountNumber: account.accountNumber,
      };

      emit({ type: 'task-account-txns-fetching', sourceId: creds.id, accountId, txnType: 'ils' });
      const { data: ilsData } = await scraper.getILSTransactions(accountRef);
      if (ilsData) {
        ils.push(validatePayload('poalim-ils', ilsData));
      }

      emit({
        type: 'task-account-txns-fetching',
        sourceId: creds.id,
        accountId,
        txnType: 'foreign',
      });
      const { data: foreignData } = await scraper.getForeignTransactions(accountRef, isBusiness);
      if (foreignData) {
        foreign.push(validatePayload('poalim-foreign', foreignData));
      }

      emit({ type: 'task-account-txns-fetching', sourceId: creds.id, accountId, txnType: 'swift' });
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
