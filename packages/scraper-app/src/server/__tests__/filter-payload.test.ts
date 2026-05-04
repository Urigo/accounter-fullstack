import { describe, expect, it } from 'vitest';
import { filterPayload } from '../filter-payload.js';
import type { CalPayload } from '../payload-schemas/cal.schema.js';
import type { MaxPayload } from '../payload-schemas/max.schema.js';
import type { PoalimIlsPayload } from '../payload-schemas/poalim-ils.schema.js';
import type { IsracardCardsTransactionsList } from '@accounter/modern-poalim-scraper';

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeIsracardPayload(cards: string[]): IsracardCardsTransactionsList {
  const bean: Record<string, unknown> = {};
  bean.cardNumberList = cards.map(c => `card ${c}`);
  cards.forEach((card, i) => {
    bean[`Index${i}`] = {
      '@AllCards': card,
      CurrentCardTransactions: [
        {
          '@cardTransactions': card,
          txnIsrael: [{ cardIndex: `${i}`, supplierName: 'Shop', dealSum: '100', fullPurchaseDate: '2024-01-01', purchaseDate: '2024-01-01', voucherNumber: '1', voucherNumberRatz: '1' }],
          txnAbroad: [],
        },
      ],
    };
  });
  return {
    Header: { Status: 'OK', Message: null },
    CardsTransactionsListBean: bean as IsracardCardsTransactionsList['CardsTransactionsListBean'],
  };
}

function getCardsInPayload(payload: IsracardCardsTransactionsList): string[] {
  const bean = payload.CardsTransactionsListBean;
  return Object.keys(bean)
    .filter(k => /^Index\d+$/.test(k))
    .flatMap(k => {
      const idx = bean[k] as { CurrentCardTransactions: Array<{ '@cardTransactions': string }> };
      return idx.CurrentCardTransactions.map(c => c['@cardTransactions']);
    });
}

function makeCalPayload(cards: string[]): CalPayload {
  return cards.map(card => ({
    card,
    month: '2024-01',
    transactions: [{ trnIntId: `${card}-1`, merchantName: 'Shop', trnPurchaseDate: '2024-01-01', trnAmt: 100, trnCurrencySymbol: 'ILS', trnType: 'normal', debCrdDate: '2024-01-05', amtBeforeConvAndIndex: 100, debCrdCurrencySymbol: 'ILS' }],
  }));
}

function makeMaxPayload(accounts: string[]): MaxPayload {
  return accounts.map(accountNumber => ({
    accountNumber,
    txns: [{ cardIndex: 1, categoryId: 1, merchantName: 'Shop', originalAmount: 100, originalCurrency: 'ILS', purchaseDate: '2024-01-01', uid: `${accountNumber}-uid`, planName: 'regular', planTypeId: 1 }],
  }));
}

function makePoalimIlsPayload(accountNumber: number, branchNumber: number): PoalimIlsPayload {
  return {
    transactions: [{ activityDescription: 'Transfer', activityTypeCode: 1, eventAmount: 100, eventDate: 20240101, serialNumber: 1, transactionType: 'REGULAR', currentBalance: 5000, referenceNumber: 1001 }],
    retrievalTransactionData: { accountNumber, branchNumber, bankNumber: 12 },
  };
}

const isracardCreds = (accepted?: string[], ignored?: string[]) => ({
  id: 'a', ownerId: '123', password: 'pw', last6Digits: '123456',
  options: { acceptedCardNumbers: accepted, ignoredCardNumbers: ignored },
});

const calCreds = (accepted?: string[], ignored?: string[]) => ({
  id: 'a', username: 'u', password: 'pw', last4Digits: '1234',
  options: { acceptedCardNumbers: accepted, ignoredCardNumbers: ignored },
});

const maxCreds = (accepted?: string[], ignored?: string[]) => ({
  id: 'a', username: 'u', password: 'pw',
  options: { acceptedCardNumbers: accepted, ignoredCardNumbers: ignored },
});

const poalimCreds = (acceptedAcc?: string[], ignoredAcc?: string[], acceptedBranch?: string[], ignoredBranch?: string[]) => ({
  id: 'a', userCode: 'u', password: 'pw',
  options: { acceptedAccountNumbers: acceptedAcc, ignoredAccountNumbers: ignoredAcc, acceptedBranchNumbers: acceptedBranch, ignoredBranchNumbers: ignoredBranch },
});

// ── Isracard ───────────────────────────────────────────────────────────────────

describe('filterPayload — isracard', () => {
  it('keeps only accepted card', () => {
    const payload = makeIsracardPayload(['1234', '5678']);
    const result = filterPayload('isracard', payload, isracardCreds(['1234']));
    expect(getCardsInPayload(result as IsracardCardsTransactionsList)).toEqual(['1234']);
  });

  it('excludes ignored card when no accepted list', () => {
    const payload = makeIsracardPayload(['1234', '5678']);
    const result = filterPayload('isracard', payload, isracardCreds(undefined, ['1234']));
    expect(getCardsInPayload(result as IsracardCardsTransactionsList)).toEqual(['5678']);
  });

  it('accepted minus ignored — only 1234 survives', () => {
    const payload = makeIsracardPayload(['1234', '5678']);
    const result = filterPayload('isracard', payload, isracardCreds(['1234', '5678'], ['5678']));
    expect(getCardsInPayload(result as IsracardCardsTransactionsList)).toEqual(['1234']);
  });

  it('empty accepted + empty ignored → all cards kept', () => {
    const payload = makeIsracardPayload(['1234', '5678']);
    const result = filterPayload('isracard', payload, isracardCreds());
    expect(getCardsInPayload(result as IsracardCardsTransactionsList)).toHaveLength(2);
  });
});

// ── Cal ────────────────────────────────────────────────────────────────────────

describe('filterPayload — cal', () => {
  it('keeps only accepted card', () => {
    const payload = makeCalPayload(['1234', '5678']);
    const result = filterPayload('cal', payload, calCreds(['1234'])) as CalPayload;
    expect(result.map(e => e.card)).toEqual(['1234']);
  });

  it('excludes ignored card', () => {
    const payload = makeCalPayload(['1234', '5678']);
    const result = filterPayload('cal', payload, calCreds(undefined, ['1234'])) as CalPayload;
    expect(result.map(e => e.card)).toEqual(['5678']);
  });

  it('accepted minus ignored', () => {
    const payload = makeCalPayload(['1234', '5678']);
    const result = filterPayload('cal', payload, calCreds(['1234', '5678'], ['5678'])) as CalPayload;
    expect(result.map(e => e.card)).toEqual(['1234']);
  });

  it('empty lists → all kept', () => {
    const payload = makeCalPayload(['1234', '5678']);
    const result = filterPayload('cal', payload, calCreds()) as CalPayload;
    expect(result).toHaveLength(2);
  });
});

// ── Max ────────────────────────────────────────────────────────────────────────

describe('filterPayload — max', () => {
  it('keeps only accepted account', () => {
    const payload = makeMaxPayload(['ACC1', 'ACC2']);
    const result = filterPayload('max', payload, maxCreds(['ACC1'])) as MaxPayload;
    expect(result.map(e => e.accountNumber)).toEqual(['ACC1']);
  });

  it('excludes ignored account', () => {
    const payload = makeMaxPayload(['ACC1', 'ACC2']);
    const result = filterPayload('max', payload, maxCreds(undefined, ['ACC1'])) as MaxPayload;
    expect(result.map(e => e.accountNumber)).toEqual(['ACC2']);
  });

  it('empty lists → all kept', () => {
    const payload = makeMaxPayload(['ACC1', 'ACC2']);
    const result = filterPayload('max', payload, maxCreds()) as MaxPayload;
    expect(result).toHaveLength(2);
  });
});

// ── Poalim ILS ────────────────────────────────────────────────────────────────

describe('filterPayload — poalim', () => {
  it('keeps transactions when account is in accepted list', () => {
    const payload = makePoalimIlsPayload(100000, 600);
    const result = filterPayload('poalim', payload, poalimCreds(['100000'], undefined, ['600'])) as PoalimIlsPayload;
    expect(result.transactions).toHaveLength(1);
  });

  it('zeros transactions when account not in accepted list', () => {
    const payload = makePoalimIlsPayload(100000, 600);
    const result = filterPayload('poalim', payload, poalimCreds(['999999'])) as PoalimIlsPayload;
    expect(result.transactions).toHaveLength(0);
  });

  it('zeros transactions when account is in ignored list', () => {
    const payload = makePoalimIlsPayload(100000, 600);
    const result = filterPayload('poalim', payload, poalimCreds(undefined, ['100000'])) as PoalimIlsPayload;
    expect(result.transactions).toHaveLength(0);
  });

  it('zeros transactions when branch not in accepted list', () => {
    const payload = makePoalimIlsPayload(100000, 600);
    const result = filterPayload('poalim', payload, poalimCreds(undefined, undefined, ['999'])) as PoalimIlsPayload;
    expect(result.transactions).toHaveLength(0);
  });

  it('empty lists → all transactions kept', () => {
    const payload = makePoalimIlsPayload(100000, 600);
    const result = filterPayload('poalim', payload, poalimCreds()) as PoalimIlsPayload;
    expect(result.transactions).toHaveLength(1);
  });
});
