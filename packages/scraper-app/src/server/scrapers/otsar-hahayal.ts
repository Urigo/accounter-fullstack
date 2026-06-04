import { z } from 'zod';
import { init } from '@accounter/modern-poalim-scraper';
import type { ServerMessage } from '../../shared/ws-protocol.js';
import type { OtsarHahayalAccountSchema } from '../vault.js';

export type OtsarHahayalCreds = z.infer<typeof OtsarHahayalAccountSchema>;

type InitResult = Awaited<ReturnType<typeof init>>;
type Scraper = Awaited<ReturnType<InitResult['otsarHahayal']>>;
type AccountsData = Awaited<ReturnType<Scraper['getAccounts']>>['data'];
type Account = Exclude<AccountsData, null>[number];
type IlsResponse = Awaited<ReturnType<Scraper['ilsTransactions']>>['data'];
type IlsTransaction = Exclude<IlsResponse, null>['transactions'][number];
export type ForeignAccountData = Awaited<ReturnType<Scraper['foreignTransactions']>>[number];
export type ForeignTransaction = ForeignAccountData['transactions'][number];
type CreditCardsData = Awaited<ReturnType<Scraper['getCreditCards']>>['data'];
type CreditCard = Exclude<CreditCardsData, null>['cards'][number];
type BillingPeriod = Awaited<ReturnType<Scraper['getCreditCardTransactions']>>['data'];
type CreditCardTransaction = Exclude<
  Exclude<BillingPeriod, null>['localDeals']['deals'],
  null
>[number];

export type OtsarHahayalIlsData = {
  account: Account;
  accountType: number;
  transactions: IlsTransaction[];
};

export type OtsarHahayalCreditCardData = {
  card: CreditCard;
  dealGroup: string;
  transactions: CreditCardTransaction[];
};

export type OtsarHahayalScraperResult = {
  ilsData: OtsarHahayalIlsData[];
  foreignData: ForeignAccountData[];
  creditCardData: OtsarHahayalCreditCardData[];
};

type TimelessDateString = Parameters<Scraper['getCreditCardTransactions']>[1];

const DEAL_GROUPS = [
  'localDeals',
  'euroDeals',
  'dollarDeals',
  'shekelMatahDeals',
  'localCurrentDebitDeals',
  'euroCurrentDebitDeals',
  'dollarCurrentDebitDeals',
  'shekelMatahCurrentDebitDeals',
] as const satisfies (keyof Exclude<BillingPeriod, null>)[];

function monthsBetween(from: Date, to: Date): TimelessDateString[] {
  const months: TimelessDateString[] = [];
  const cursor = new Date(from.getFullYear(), from.getMonth(), 1);
  const end = new Date(to.getFullYear(), to.getMonth(), 1);
  while (cursor <= end) {
    const yyyy = cursor.getFullYear();
    const mm = String(cursor.getMonth() + 1).padStart(2, '0');
    months.push(`${yyyy}-${mm}-01` as TimelessDateString);
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return months;
}

export async function scrapeOtsarHahayal(
  creds: OtsarHahayalCreds,
  dateFrom: Date,
  dateTo: Date,
  headless: boolean,
  emit: (msg: ServerMessage) => void,
): Promise<OtsarHahayalScraperResult> {
  const { otsarHahayal, close } = await init({ headless });
  const scraper = await otsarHahayal(
    { userCode: creds.userCode, password: creds.password },
    {
      fromDate: dateFrom.toISOString(),
      toDate: dateTo.toISOString(),
      headless,
    },
  );

  try {
    const { data: accounts } = await scraper.getAccounts();
    if (!accounts || accounts.length === 0) {
      return { ilsData: [], foreignData: [], creditCardData: [] };
    }

    emit({
      type: 'task-accounts-found',
      sourceId: creds.id,
      accounts: accounts.map((a: Account) => ({
        accountNumber: a.account,
        branchNumber: Number(a.branch),
        bankNumber: Number(a.bank),
      })),
    });

    // ILS transactions per account
    const ilsData: OtsarHahayalIlsData[] = [];
    for (const account of accounts) {
      const accountId = `${account.branch}-${account.account}`;
      emit({
        type: 'task-account-txns-fetching',
        sourceId: creds.id,
        accountId,
        txnType: 'ils',
      });
      const { data: ilsResponse } = await scraper.ilsTransactions({
        accountNumber: Number(account.account),
        branch: account.branch,
      });
      if (ilsResponse?.transactions?.length) {
        ilsData.push({
          account,
          accountType: ilsResponse.accountType,
          transactions: ilsResponse.transactions,
        });
      }
    }

    // Foreign transactions
    const foreignData: ForeignAccountData[] = await scraper.foreignTransactions();
    for (const foreignAccount of foreignData) {
      const accountId = `${foreignAccount.metadata.branch}-${foreignAccount.metadata.account}-${foreignAccount.metadata.subAccount}`;
      emit({
        type: 'task-account-txns-fetching',
        sourceId: creds.id,
        accountId,
        txnType: 'foreign',
      });
    }

    // Credit card transactions
    const creditCardData: OtsarHahayalCreditCardData[] = [];
    const { data: creditCardsResponse } = await scraper.getCreditCards();
    if (creditCardsResponse?.cards?.length) {
      const billingMonths = monthsBetween(dateFrom, dateTo);
      for (const card of creditCardsResponse.cards) {
        for (const month of billingMonths) {
          const { data: billingPeriod } = await scraper.getCreditCardTransactions(
            { resourceId: card.resourceId, cardType: card.cardType, debitDay: card.debitDay },
            month,
          );
          if (!billingPeriod) continue;
          for (const group of DEAL_GROUPS) {
            const dealGroup = billingPeriod[group];
            if (dealGroup?.deals?.length) {
              creditCardData.push({
                card,
                dealGroup: group,
                transactions: dealGroup.deals,
              });
            }
          }
        }
      }
    }

    return { ilsData, foreignData, creditCardData };
  } finally {
    await scraper.close();
    await close();
  }
}
