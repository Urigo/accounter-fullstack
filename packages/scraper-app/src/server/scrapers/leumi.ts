import { z } from 'zod';
import { init } from '@accounter/modern-poalim-scraper';
import type {
  LeumiCreditCardTransaction,
  LeumiForeignAccountActivity,
  LeumiIlsTransaction,
  LeumiResult,
} from '@accounter/modern-poalim-scraper';
import type { ServerMessage } from '../../shared/ws-protocol.js';
import type { LeumiAccountSchema } from '../vault.js';

export type LeumiCreds = z.infer<typeof LeumiAccountSchema>;

/** Bank Leumi's number in the Israeli banks list. */
export const LEUMI_BANK_NUMBER = 10;

/** The bank's own currency codes, as its card statements use them. */
const CURRENCY_BY_BANK_CODE: Record<string, string> = { '1': 'USD', '49': 'EUR', '80': 'ILS' };

export type LeumiIlsData = {
  /** Full account number: what the financial account in Accounter is set up with. */
  accountNumber: string;
  branchNumber: number;
  transactions: LeumiIlsTransaction[];
};

export type LeumiForeignData = {
  /** Full number of the foreign-currency account; each currency has its own. */
  accountNumber: string;
  branchNumber: number;
  activity: LeumiForeignAccountActivity;
};

/**
 * The fields of a card row that are stored. Shekel and foreign-currency rows both have
 * them; the foreign ones carry two more that are not used.
 */
export type LeumiCardRow = Pick<
  LeumiCreditCardTransaction,
  | 'CardTransactionId'
  | 'DateDealUTC'
  | 'DebitCardDebitPeriodUTC'
  | 'DebitCardFirmName'
  | 'DealDescription'
  | 'AmountDouble'
  | 'TransactionCurrency'
  | 'NextPaymentAmountDouble'
  | 'TypeOfTransaction'
>;

export type LeumiCreditCardData = {
  cardLast4: string;
  relatedAccountNumber: string;
  transactions: {
    /** ISO code of the currency the row is debited in. */
    chargeCurrency: string;
    tableId: number;
    transaction: LeumiCardRow;
  }[];
};

type LeumiAccount = { accountIndex: number; number: string; branchNumber: number };

export type LeumiScraperResult = {
  ilsData: LeumiIlsData[];
  foreignData: LeumiForeignData[];
  creditCardData: LeumiCreditCardData[];
};

/**
 * The scraper returns what the bank sent even when it does not match the schema. This
 * app stores what it reads, so a mismatch stops the run instead: the bank changed
 * something and the mapping below can no longer be trusted. Only where the mismatch is
 * and what kind it is are reported, never the values.
 */
function unwrap<T>(what: string, result: LeumiResult<T>): T {
  if (result.isValid === false) {
    const issues = [
      ...new Set(
        (result.errors ?? []).map(
          issue =>
            `${issue.path.map(part => (typeof part === 'number' ? '[]' : String(part))).join('.')}: ${issue.message}`,
        ),
      ),
    ];
    throw new Error(
      `Leumi ${what} did not match the expected shape; nothing was uploaded. ${issues.slice(0, 10).join('; ')}`,
    );
  }
  return result.data;
}

/**
 * The ID the progress view keys an account's steps by. It builds the same string from the
 * `task-accounts-found` message, so the per-account messages must use it too.
 */
export function leumiProgressId(branchNumber: number, accountNumber: string): string {
  return `${branchNumber}-${accountNumber}`;
}

/** First-of-month cycle dates from `from` through the month after `to`, newest last. */
export function leumiCycleDates(from: Date, to: Date): string[] {
  const cycles: string[] = [];
  const cursor = new Date(from.getFullYear(), from.getMonth(), 1);
  // A cycle is named by the month it is debited in, so this month's purchases sit in the
  // next month's cycle.
  const end = new Date(to.getFullYear(), to.getMonth() + 1, 1);
  while (cursor <= end) {
    const yyyy = cursor.getFullYear();
    const mm = String(cursor.getMonth() + 1).padStart(2, '0');
    cycles.push(`${yyyy}-${mm}-01T00:00:00`);
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return cycles;
}

export function leumiChargeCurrency(bankCode: string): string {
  const currency = CURRENCY_BY_BANK_CODE[String(Number(bankCode))];
  if (!currency) {
    throw new Error(`Leumi card statement uses an unknown currency code: ${bankCode}`);
  }
  return currency;
}

export async function scrapeLeumi(
  creds: LeumiCreds,
  dateFrom: Date,
  dateTo: Date,
  headless: boolean,
  emit: (msg: ServerMessage) => void,
): Promise<LeumiScraperResult> {
  const { leumi, close } = await init({ headless });

  try {
    const scraper = await leumi({ username: creds.username, password: creds.password });

    const groups = unwrap('accounts', await scraper.getAllAccounts()).RequestsItems;
    const accountsOf = (group: string): LeumiAccount[] =>
      (groups.find(item => item.requestDescription === group)?.AccountsItems ?? []).map(account => {
        // Both are there for real accounts; the bank leaves them empty only on the
        // client-number entries, which are not asked for here.
        if (!account.number || !account.maskedNumber) {
          throw new Error(`Leumi reported an account without a number in ${group}`);
        }
        return {
          accountIndex: account.accountIndex,
          number: account.number,
          branchNumber: Number(account.maskedNumber.split('-')[0]),
        };
      });
    const checking = accountsOf('CheckingAccounts');
    const foreign = accountsOf('ForeignAccounts');

    emit({
      type: 'task-accounts-found',
      sourceId: creds.id,
      accounts: [...checking, ...foreign].map(account => ({
        accountNumber: account.number,
        branchNumber: account.branchNumber,
        bankNumber: LEUMI_BANK_NUMBER,
      })),
    });

    const ilsData: LeumiIlsData[] = [];
    const creditCardData: LeumiCreditCardData[] = [];

    for (const account of checking) {
      emit({
        type: 'task-account-txns-fetching',
        sourceId: creds.id,
        accountId: leumiProgressId(account.branchNumber, account.number),
        txnType: 'ils',
      });
      const ils = unwrap(
        'shekel transactions',
        await scraper.getIlsTransactions(account.accountIndex, {
          fromDate: dateFrom,
          toDate: dateTo,
        }),
      );
      // Booked transactions only: today's are not final and have no stable identity yet.
      ilsData.push({
        accountNumber: account.number,
        branchNumber: account.branchNumber,
        transactions: ils.HistoryTransactionsItems ?? [],
      });

      const cards = unwrap('credit cards', await scraper.getCreditCards(account.accountIndex));
      // Cards of other issuers only debit this account; the bank has no transactions for them.
      for (const card of cards.CreditCardsItems) {
        const data: LeumiCreditCardData = {
          cardLast4: card.CardLast4Digits,
          relatedAccountNumber: card.RelatedAccountNumber,
          transactions: [],
        };
        for (const cycleDate of leumiCycleDates(dateFrom, dateTo)) {
          const cycle = unwrap(
            `card cycle ${cycleDate.slice(0, 7)}`,
            await scraper.getCreditCardTransactions(
              { accountIndex: account.accountIndex, cardIndex: card.CardIndex },
              cycleDate,
            ),
          );
          // A cycle with nothing in it comes back without activity.
          if (!cycle.Activity) continue;
          for (const table of cycle.Activity.TabNisTransactionItems) {
            for (const transaction of table.NisTransactionItems) {
              data.transactions.push({
                chargeCurrency: 'ILS',
                tableId: table.TableID,
                transaction,
              });
            }
          }
          for (const table of cycle.Activity.TabForeignTransactionItems) {
            const chargeCurrency = leumiChargeCurrency(table.Currency);
            for (const transaction of table.ForeignTransactionItems) {
              data.transactions.push({ chargeCurrency, tableId: table.TableID, transaction });
            }
          }
        }
        creditCardData.push(data);
      }
    }

    // Last: reading foreign-currency accounts navigates the page away from the account home.
    const foreignData: LeumiForeignData[] = [];
    for (const option of await scraper.getForeignAccounts()) {
      const account = foreign.find(item => String(item.accountIndex) === option.value);
      if (!account) {
        throw new Error(
          'Leumi lists a foreign-currency account on its activity page that is not among the accounts it reported',
        );
      }
      emit({
        type: 'task-account-txns-fetching',
        sourceId: creds.id,
        accountId: leumiProgressId(account.branchNumber, account.number),
        txnType: 'foreign',
      });
      const activity = unwrap(
        'foreign-currency transactions',
        await scraper.getForeignTransactions(option, { fromDate: dateFrom, toDate: dateTo }),
      );
      foreignData.push({
        accountNumber: account.number,
        branchNumber: account.branchNumber,
        activity,
      });
    }

    return { ilsData, foreignData, creditCardData };
  } finally {
    await close();
  }
}
