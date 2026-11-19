import { describe, expect, it, vi } from 'vitest';
import { otsarIlsVars } from '../../graphql/mutations.js';
import { scrapeOtsarHahayal, type OtsarHahayalIlsData } from '../otsar-hahayal.js';

vi.mock('@accounter/modern-poalim-scraper', () => ({
  init: vi.fn(),
}));

const CREDS = { id: 'src-1', userCode: 'user', password: 'pass' } as Parameters<
  typeof scrapeOtsarHahayal
>[0];
const noop = () => {};

const CARD_BREAKDOWN = {
  T20C2211: { 'OUT-DATA': { 'ALL-CARDS': { 'KARTIS-DETAILS': { 'OUT-MSKART': '1234' } } } },
};

function ilsTransaction(overrides: Record<string, unknown> = {}) {
  return {
    ActionCode: 0,
    bfbSource: '77',
    closingBalance: 1000,
    comments: null,
    CorrespondentAccount: 0,
    CorrespondentAccountType: 0,
    CorrespondentBank: 0,
    CorrespondentBranch: 0,
    creditAmount: 0,
    CustomerName: ' ',
    dateOfBusinessDay: '2026-01-10T00:00:00',
    dateOfRegistration: '2026-01-10T00:00:00',
    debitAmount: 150,
    DepositorId: 0,
    description: 'CARD DEBIT',
    drillDownUrl: '/drill?SUGBAKA=211&ID=1',
    firstTransactionOfDay: true,
    lastTransactionOfDay: true,
    Name: ' ',
    openingBalance: 1150,
    OprationSource: ' ',
    reference: 42,
    SalaryInd: 0,
    transactionSource: ' ',
    TransactionReason: ' ',
    ...overrides,
  };
}

async function getInitMock() {
  const mod = await import('@accounter/modern-poalim-scraper');
  return mod.init as ReturnType<typeof vi.fn>;
}

describe('scrapeOtsarHahayal', () => {
  it('asks the scraper for the card-debit details', async () => {
    const otsarHahayal = vi.fn().mockResolvedValue({
      getAccounts: vi.fn().mockResolvedValue({ data: [] }),
      close: vi.fn().mockResolvedValue(undefined),
    });
    const initMock = await getInitMock();
    initMock.mockResolvedValue({ otsarHahayal, close: vi.fn().mockResolvedValue(undefined) });

    await scrapeOtsarHahayal(CREDS, new Date('2026-01-01'), new Date('2026-01-31'), true, noop);

    expect(otsarHahayal).toHaveBeenCalledWith(
      { userCode: 'user', password: 'pass' },
      expect.objectContaining({ fetchCardDebitDetails: true }),
    );
  });
});

describe('otsarIlsVars', () => {
  it('passes the card hint and its drill-down data on to the server', () => {
    const ilsData = [
      {
        account: { account: '123456', bank: '014', branch: '001', kinuy: '', name: '', selected: true },
        accountType: 409,
        transactions: [
          ilsTransaction({ originReference: '1234', drillDownData: CARD_BREAKDOWN }),
          ilsTransaction({ reference: 43, drillDownUrl: '' }),
        ],
      },
    ] as unknown as OtsarHahayalIlsData[];

    const { transactions } = otsarIlsVars(ilsData);
    const rows = Array.isArray(transactions) ? transactions : [transactions];

    expect(rows[0]).toMatchObject({
      originReference: '1234',
      drillDownData: JSON.stringify(CARD_BREAKDOWN),
    });
    expect(rows[1]?.originReference).toBeUndefined();
    expect(rows[1]?.drillDownData).toBeUndefined();
  });
});
