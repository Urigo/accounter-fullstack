import type { z } from 'zod';
import {
  HapoalimAccountData,
  HapoalimForeignTransactionsBusiness,
  HapoalimForeignTransactionsPersonal,
  HapoalimILSTransactions,
  init,
  SwiftTransaction,
  SwiftTransactions,
  type HapoalimOptions,
} from '@accounter/modern-poalim-scraper';
import type { ServerMessage } from '../../shared/ws-protocol.js';
import { registerDiscoveredAccounts } from '../account-discovery.js';
import { checkAccounts } from '../check-accounts.js';
import { effectiveSet } from '../filter-payload.js';
import type { OtpManager } from '../otp-manager.js';
import { BlockedError } from '../scrape-runner.js';
import { validatePayload } from '../validate-payload.js';
import { getVault } from '../vault-store.js';
import type { PoalimAccountSchema } from '../vault.js';

export type PoalimCreds = z.infer<typeof PoalimAccountSchema>;

export type DecoratedSwiftTransactions = Omit<SwiftTransactions, 'swiftsList'> & {
  swiftsList: (SwiftTransactions['swiftsList'][number] & { details: SwiftTransaction })[];
};

const OTP_TIMEOUT_MS = 5 * 60 * 1000;

/**
 * The modern-poalim-scraper runs Zod schema validation internally (validateSchema: true) and
 * returns `{ data, isValid, errors }`. On a validation failure `data` is `null` and `isValid` is
 * `false`. If we only read `data` we silently treat a failed validation as "no data", which makes a
 * broken run look successful. This turns the validation error into a readable message so the caller
 * can surface it to the user.
 */
function describeValidationError(errors: unknown): string {
  if (errors == null) return 'unknown validation error';
  if (typeof errors === 'string') return errors;
  if (errors instanceof Error) {
    // ZodError carries the individual issues on `.issues`; prefer those over the noisy message.
    if ('issues' in errors && Array.isArray(errors.issues)) {
      return describeValidationError(errors.issues);
    }
    return errors.message;
  }
  if (Array.isArray(errors)) {
    return errors
      .map(err => {
        if (err && typeof err === 'object' && 'message' in err) {
          const pathStr =
            'path' in err && Array.isArray(err.path) && err.path.length > 0
              ? ` at ${err.path.join('.')}`
              : '';
          return `${(err as { message: unknown }).message}${pathStr}`;
        }
        return String(err);
      })
      .join(', ');
  }
  try {
    return JSON.stringify(errors);
  } catch {
    return String(errors);
  }
}

export async function scrapePoalim(
  creds: PoalimCreds,
  dateFrom: Date,
  dateTo: Date,
  headless: boolean,
  otpManager: OtpManager,
  emit: (msg: ServerMessage) => void,
): Promise<
  {
    ils: HapoalimILSTransactions | null;
    foreign: HapoalimForeignTransactionsPersonal | HapoalimForeignTransactionsBusiness | null;
    swift: DecoratedSwiftTransactions | null;
    bankAccount: { bankNumber: number; branchNumber: number; accountNumber: number };
  }[]
> {
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
    validateSchema: true,
  };

  try {
    const scraper = await hapoalimFn(
      { userCode: creds.userCode, password: creds.password },
      options,
    );

    if (scraper === 'Unknown Error') {
      throw new Error('Hapoalim login failed: Unknown Error');
    }

    const {
      data: accounts,
      isValid: accountsValid,
      errors: accountsErrors,
    } = await scraper.getAccountsData();
    if (accountsValid === false) {
      throw new Error(
        `Poalim accounts data failed schema validation: ${describeValidationError(accountsErrors)}`,
      );
    }
    if (!accounts || accounts.length === 0) {
      return [];
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

    const opts = creds.options;
    const filteredAccounts: HapoalimAccountData = [];
    for (const account of accounts) {
      const { accountNumber, branchNumber } = account;
      const allAccounts = [String(accountNumber)];
      const allBranches = [String(branchNumber)];
      const allowedAccounts = effectiveSet(
        opts?.acceptedAccountNumbers,
        opts?.ignoredAccountNumbers,
        allAccounts,
      );
      const allowedBranches = effectiveSet(
        opts?.acceptedBranchNumbers,
        opts?.ignoredBranchNumbers,
        allBranches,
      );
      if (
        !allowedAccounts.has(String(accountNumber)) ||
        !allowedBranches.has(String(branchNumber))
      ) {
        continue;
      }
      filteredAccounts.push(account);
    }

    // Register any newly discovered accounts as pending, then re-read to avoid stale closure
    await registerDiscoveredAccounts('poalim', creds.id, filteredAccounts);
    const currentAccountRecords = getVault().accountRecords;

    // Check for unknown accounts across all ILS payloads (ILS carries account identifiers)
    const allUnknown: string[] = [];
    for (const account of filteredAccounts) {
      const check = checkAccounts('poalim', account, currentAccountRecords);
      allUnknown.push(...check.unknown);

      // Emit vault-checked status based on whether account was excluded
      emit({
        type: 'task-account-vault-checked',
        sourceId: creds.id,
        accountId: `${account.branchNumber}-${account.accountNumber}`,
        status: 'accepted',
      });
    }
    if (allUnknown.length > 0) {
      emit({
        type: 'task-blocked',
        sourceId: creds.id,
        sourceType: 'poalim',
        unknownAccounts: [...new Set(allUnknown)],
      });
      throw new BlockedError([...new Set(allUnknown)]);
    }

    const accountsData: {
      ils: HapoalimILSTransactions | null;
      foreign: HapoalimForeignTransactionsPersonal | HapoalimForeignTransactionsBusiness | null;
      swift: DecoratedSwiftTransactions | null;
      bankAccount: { bankNumber: number; branchNumber: number; accountNumber: number };
    }[] = [];
    const isBusiness = creds.options?.isBusinessAccount ?? false;

    for (const account of filteredAccounts) {
      let ils: HapoalimILSTransactions | null = null;
      let foreign:
        HapoalimForeignTransactionsPersonal | HapoalimForeignTransactionsBusiness | null = null;
      let swift: DecoratedSwiftTransactions | null = null;
      const accountId = `${account.branchNumber}-${account.accountNumber}`;
      const accountRef = {
        bankNumber: account.bankNumber,
        branchNumber: account.branchNumber,
        accountNumber: account.accountNumber,
      };

      emit({ type: 'task-account-txns-fetching', sourceId: creds.id, accountId, txnType: 'ils' });
      const {
        data: ilsData,
        isValid: ilsValid,
        errors: ilsErrors,
      } = await scraper.getILSTransactions(accountRef);
      if (ilsValid === false) {
        throw new Error(
          `Poalim ILS transactions failed schema validation for account ${accountId}: ${describeValidationError(ilsErrors)}`,
        );
      }
      if (ilsData) {
        ils = validatePayload('poalim-ils', ilsData);
      }

      emit({
        type: 'task-account-txns-fetching',
        sourceId: creds.id,
        accountId,
        txnType: 'foreign',
      });
      const {
        data: foreignData,
        isValid: foreignValid,
        errors: foreignErrors,
      } = await scraper.getForeignTransactions(accountRef, isBusiness);
      if (foreignValid === false) {
        throw new Error(
          `Poalim foreign transactions failed schema validation for account ${accountId}: ${describeValidationError(foreignErrors)}`,
        );
      }
      if (foreignData) {
        foreign = validatePayload('poalim-foreign', foreignData);
      }

      emit({ type: 'task-account-txns-fetching', sourceId: creds.id, accountId, txnType: 'swift' });
      const {
        data: swiftData,
        isValid: swiftValid,
        errors: swiftErrors,
      } = await scraper.getForeignSwiftTransactions(accountRef);
      if (swiftValid === false) {
        throw new Error(
          `Poalim SWIFT transactions failed schema validation for account ${accountId}: ${describeValidationError(swiftErrors)}`,
        );
      }
      if (swiftData) {
        const validated = validatePayload('poalim-swift', swiftData);
        const decoratedSwiftsList: DecoratedSwiftTransactions['swiftsList'] = [];
        for (const transaction of validated.swiftsList) {
          const extendedTransaction = await scraper.getForeignSwiftTransaction(
            accountRef,
            transaction.transferCatenatedId,
            transaction.dataOriginCode,
          );
          if (!extendedTransaction.isValid || !extendedTransaction.data) {
            throw new Error(
              `Failed to fetch details for SWIFT transaction ${transaction.transferCatenatedId}`,
            );
          }
          decoratedSwiftsList.push({ ...transaction, details: extendedTransaction.data });
        }
        swift = { ...validated, swiftsList: decoratedSwiftsList };
      }
      accountsData.push({ ils, foreign, swift, bankAccount: accountRef });
    }

    return accountsData;
  } catch (error) {
    console.error('Error in scrapePoalim:', error instanceof Error ? error.stack : error);
    throw error;
  } finally {
    await close();
  }
}
