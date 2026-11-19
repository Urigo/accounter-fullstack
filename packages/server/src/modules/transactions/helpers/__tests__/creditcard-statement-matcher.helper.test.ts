import { describe, expect, it } from 'vitest';
import type { TimelessDateString } from '../../../../shared/types/index.js';
import {
  cardKey,
  isConfidentMatch,
  matchCreditCardStatements,
  suggestCreditCardStatements,
  toCents,
  type BankCardHint,
  type CandidateStatement,
  type MatcherBankTransaction,
} from '../creditcard-statement-matcher.helper.js';

const BANK_ACCOUNT = 'bank-account-1';
const OTHER_BANK_ACCOUNT = 'bank-account-2';

function bank(overrides: Partial<MatcherBankTransaction> = {}): MatcherBankTransaction {
  return {
    id: 'bank-tx-1',
    accountId: BANK_ACCOUNT,
    amount: '-1500.00',
    currency: 'ILS',
    effectiveDate: '2026-03-10',
    sourceReference: '000111',
    sourceDescription: 'Card debit',
    counterpartyIsCardIssuer: false,
    ...overrides,
  };
}

function statement(
  cardAccountId: string,
  overrides: Partial<CandidateStatement> = {},
): CandidateStatement {
  return {
    cardAccountId,
    currency: 'ILS',
    debitDate: '2026-03-10',
    total: '-1500.00',
    transactionsCount: 3,
    accountNumber: '9999',
    accountName: null,
    settlementAccountId: null,
    linkedBankTransactionId: null,
    ...overrides,
  };
}

function linkedCards(result: ReturnType<typeof matchCreditCardStatements>) {
  if (!isConfidentMatch(result)) {
    throw new Error(`expected a confident match, got ${JSON.stringify(result)}`);
  }
  return {
    method: result.method,
    keys: result.links.map(link => `${link.cardAccountId}@${link.debitDate}`).sort(),
  };
}

describe('cardKey', () => {
  it('takes the last 4 digits of short and masked card numbers', () => {
    expect(cardKey('1234')).toBe('1234');
    expect(cardKey('123456xxxxxx4321')).toBe('4321');
    expect(cardKey('12')).toBeNull();
    expect(cardKey(null)).toBeNull();
  });
});

describe('toCents', () => {
  it('converts decimal strings and numbers to integer cents', () => {
    expect(toCents('-1500.00')).toBe(-150_000);
    expect(toCents('0.1')).toBe(10);
    expect(toCents('-0.29')).toBe(-29);
    expect(toCents(12.345)).toBe(1235);
    expect(toCents('7')).toBe(700);
  });
});

describe('matchCreditCardStatements', () => {
  it('links by reference when the bank reference equals the card number (Poalim)', () => {
    const result = matchCreditCardStatements(bank({ sourceReference: '1111', counterpartyIsCardIssuer: true }), [], [
      statement('card-a', { accountNumber: '1111', total: '-1499.00' }),
      statement('card-b', { accountNumber: '2222', total: '-1500.00' }),
    ]);
    // the reference wins even though another card has the exact amount
    expect(linkedCards(result)).toEqual({ method: 'REFERENCE', keys: ['card-a@2026-03-10'] });
  });

  it('links an Otsar masked PAN card through the raw last-4 hint', () => {
    const hints: BankCardHint[] = [
      { transactionId: 'bank-tx-1', source: 'OTSAR_HAHAYAL_ILS', hint: '4321' },
    ];
    const result = matchCreditCardStatements(bank(), hints, [
      statement('otsar-card', { accountNumber: '123456xxxxxx4321', total: '-1500.00' }),
      statement('other-card', { accountNumber: '123456xxxxxx8765', total: '-1500.00' }),
    ]);
    expect(linkedCards(result)).toEqual({ method: 'REFERENCE', keys: ['otsar-card@2026-03-10'] });
  });

  it('links a Discount debit with the last 4 digits only in the description, on exact amount', () => {
    const result = matchCreditCardStatements(
      bank({ sourceReference: '55501', sourceDescription: 'CAL 5678 DEBIT' }),
      [],
      [
        statement('cal-card', { accountNumber: '5678', total: '-1500.00' }),
        statement('other-card', { accountNumber: '1357', total: '-1500.00' }),
      ],
    );
    expect(linkedCards(result)).toEqual({ method: 'REFERENCE', keys: ['cal-card@2026-03-10'] });
  });

  it('links on amount alone when the card is configured as paid from the bank account', () => {
    const result = matchCreditCardStatements(bank(), [], [
      statement('card-a', { settlementAccountId: BANK_ACCOUNT, debitDate: '2026-03-09' }),
      statement('card-b', { total: '-80.00' }),
    ]);
    expect(linkedCards(result)).toEqual({ method: 'AMOUNT', keys: ['card-a@2026-03-09'] });
  });

  it('only suggests an amount-only match without a settlement account or hint', () => {
    const result = matchCreditCardStatements(bank(), [], [statement('card-a')]);
    expect(isConfidentMatch(result)).toBe(false);
    if (!isConfidentMatch(result)) {
      expect(result.suggestions).toHaveLength(1);
      expect(result.suggestions[0].statements[0].cardAccountId).toBe('card-a');
      expect(result.suggestions[0].amountDifferenceCents).toBe(0);
    }
  });

  it('ignores cards configured as paid from a different bank account', () => {
    const result = matchCreditCardStatements(bank({ sourceReference: '1111' }), [], [
      statement('card-a', { accountNumber: '1111', settlementAccountId: OTHER_BANK_ACCOUNT }),
    ]);
    expect(result).toEqual({ suggestions: [] });
  });

  it('tells apart two cards debited on the same day', () => {
    const candidates = [
      statement('card-a', { accountNumber: '1111', total: '-700.00' }),
      statement('card-b', { accountNumber: '2222', total: '-800.00' }),
    ];
    expect(
      linkedCards(
        matchCreditCardStatements(
          bank({ amount: '-700.00', sourceReference: '1111', counterpartyIsCardIssuer: true }),
          [],
          candidates,
        ),
      ),
    ).toEqual({ method: 'REFERENCE', keys: ['card-a@2026-03-10'] });
    expect(
      linkedCards(
        matchCreditCardStatements(
          bank({
            id: 'bank-tx-2',
            amount: '-800.00',
            sourceReference: '2222',
            counterpartyIsCardIssuer: true,
          }),
          [],
          candidates,
        ),
      ),
    ).toEqual({ method: 'REFERENCE', keys: ['card-b@2026-03-10'] });
  });

  it('links a combined debit to the only subset of statements summing to the amount', () => {
    const result = matchCreditCardStatements(bank(), [], [
      statement('card-a', { total: '-1000.00', settlementAccountId: BANK_ACCOUNT }),
      statement('card-b', { total: '-500.00', settlementAccountId: BANK_ACCOUNT }),
      statement('card-c', { total: '-320.00', settlementAccountId: BANK_ACCOUNT }),
    ]);
    expect(linkedCards(result)).toEqual({
      method: 'AMOUNT',
      keys: ['card-a@2026-03-10', 'card-b@2026-03-10'],
    });
  });

  it('accepts a one-day shift between the bank and issuer dates', () => {
    const result = matchCreditCardStatements(
      bank({ effectiveDate: '2026-03-02', sourceReference: '1111', counterpartyIsCardIssuer: true }),
      [],
      [
        statement('card-a', { accountNumber: '1111', debitDate: '2026-03-01' }),
        statement('card-a', { accountNumber: '1111', debitDate: '2026-02-01' }),
      ],
    );
    expect(linkedCards(result)).toEqual({ method: 'REFERENCE', keys: ['card-a@2026-03-01'] });
  });

  it('never matches statements outside the date window', () => {
    const result = matchCreditCardStatements(bank({ sourceReference: '1111' }), [], [
      statement('card-a', { accountNumber: '1111', debitDate: '2026-03-20' }),
    ]);
    expect(result).toEqual({ suggestions: [] });
  });

  it('excludes a statement already linked to a different bank transaction', () => {
    const result = matchCreditCardStatements(bank({ sourceReference: '1111', counterpartyIsCardIssuer: true }), [], [
      statement('card-a', {
        accountNumber: '1111',
        linkedBankTransactionId: 'another-bank-tx',
      }),
      statement('card-a', {
        accountNumber: '1111',
        debitDate: '2026-03-12' as TimelessDateString,
      }),
    ]);
    expect(linkedCards(result)).toEqual({ method: 'REFERENCE', keys: ['card-a@2026-03-12'] });
  });

  it('returns ranked suggestions when the amount is ambiguous', () => {
    const result = matchCreditCardStatements(bank(), [], [
      statement('card-a', { settlementAccountId: BANK_ACCOUNT, debitDate: '2026-03-12' }),
      statement('card-b', { settlementAccountId: BANK_ACCOUNT }),
      statement('card-c', { total: '-20.00' }),
    ]);
    expect(isConfidentMatch(result)).toBe(false);
    if (!isConfidentMatch(result)) {
      expect(result.suggestions.map(s => s.statements[0].cardAccountId)).toEqual([
        'card-b',
        'card-a',
        'card-c',
      ]);
      expect(result.suggestions[0].reason).toBe('Amount matches, same debit date');
    }
  });

  it('ranks hinted statements first among suggestions', () => {
    const result = matchCreditCardStatements(
      bank({ sourceDescription: 'CARD 2222 DEBIT' }),
      [],
      [statement('card-a', { accountNumber: '1111' }), statement('card-b', { accountNumber: '2222', total: '-90.00' })],
    );
    expect(isConfidentMatch(result)).toBe(false);
    if (!isConfidentMatch(result)) {
      expect(result.suggestions[0].statements[0].cardAccountId).toBe('card-b');
      expect(result.suggestions[0].hint).toBe('WEAK');
    }
  });

  describe('scoping of reference clues', () => {
    it('does not link a non-card bank row whose reference collides with a card number', () => {
      const result = matchCreditCardStatements(bank({ sourceReference: '1111', amount: '-42.00' }), [], [
        statement('card-a', { accountNumber: '1111', total: '-1500.00' }),
      ]);
      expect(isConfidentMatch(result)).toBe(false);
    });

    it('treats such a collision as a weak hint, linking only on the exact amount', () => {
      const result = matchCreditCardStatements(bank({ sourceReference: '1111' }), [], [
        statement('card-a', { accountNumber: '1111', total: '-1500.00' }),
      ]);
      expect(linkedCards(result)).toEqual({ method: 'REFERENCE', keys: ['card-a@2026-03-10'] });
    });

    it('links a Poalim 491 raw hint even without the issuer counterparty', () => {
      const result = matchCreditCardStatements(
        bank(),
        [{ transactionId: 'bank-tx-1', source: 'POALIM_491', hint: '1111' }],
        [statement('card-a', { accountNumber: '1111', total: '-1490.00' })],
      );
      expect(linkedCards(result)).toEqual({ method: 'REFERENCE', keys: ['card-a@2026-03-10'] });
    });
  });

  describe('rule (a): strong hints', () => {
    const issuerBank = (overrides: Partial<MatcherBankTransaction> = {}) =>
      bank({ counterpartyIsCardIssuer: true, sourceDescription: 'GOLD BLUE', ...overrides });

    it('links the only statement of a hinted card even when the amount differs', () => {
      const result = matchCreditCardStatements(issuerBank({ sourceReference: '1111' }), [], [
        statement('card-a', { accountNumber: '1111', total: '-1400.00' }),
      ]);
      expect(linkedCards(result)).toEqual({ method: 'REFERENCE', keys: ['card-a@2026-03-10'] });
    });

    it('picks the exact-amount statement of a hinted card with two statements in the window', () => {
      const result = matchCreditCardStatements(issuerBank({ sourceReference: '1111' }), [], [
        statement('card-a', { accountNumber: '1111', total: '-200.00' }),
        statement('card-a', { accountNumber: '1111', total: '-1500.00', debitDate: '2026-03-13' }),
      ]);
      expect(linkedCards(result)).toEqual({ method: 'REFERENCE', keys: ['card-a@2026-03-13'] });
    });

    it('links all statements of a hinted card when together they make the debit', () => {
      const result = matchCreditCardStatements(issuerBank({ sourceReference: '1111' }), [], [
        statement('card-a', { accountNumber: '1111', total: '-1000.00' }),
        statement('card-a', { accountNumber: '1111', total: '-500.00', debitDate: '2026-03-12' }),
      ]);
      expect(linkedCards(result)).toEqual({
        method: 'REFERENCE',
        keys: ['card-a@2026-03-10', 'card-a@2026-03-12'],
      });
    });

    it('returns suggestions when a hinted card has several statements and none fits', () => {
      const result = matchCreditCardStatements(issuerBank({ sourceReference: '1111' }), [], [
        statement('card-a', { accountNumber: '1111', total: '-100.00' }),
        statement('card-a', { accountNumber: '1111', total: '-200.00', debitDate: '2026-03-12' }),
        // an unhinted card with the exact amount, paid from this account: never linked instead
        statement('card-b', { accountNumber: '2222', settlementAccountId: BANK_ACCOUNT }),
      ]);
      expect(isConfidentMatch(result)).toBe(false);
    });

    it('links the single hinted card resolved to the exact amount among several', () => {
      const result = matchCreditCardStatements(
        issuerBank({ sourceDescription: 'GOLD and BLUE cards' }),
        [],
        [
          statement('card-gold', { accountNumber: '1111', accountName: 'GOLD', total: '-1500.00' }),
          statement('card-blue', { accountNumber: '2222', accountName: 'BLUE', total: '-300.00' }),
        ],
      );
      expect(linkedCards(result)).toEqual({ method: 'REFERENCE', keys: ['card-gold@2026-03-10'] });
    });

    it('links several hinted cards when their statements add up to the debit', () => {
      const result = matchCreditCardStatements(
        issuerBank({ sourceDescription: 'GOLD and BLUE cards' }),
        [],
        [
          statement('card-gold', { accountNumber: '1111', accountName: 'GOLD', total: '-1200.00' }),
          statement('card-blue', { accountNumber: '2222', accountName: 'BLUE', total: '-300.00' }),
        ],
      );
      expect(linkedCards(result)).toEqual({
        method: 'REFERENCE',
        keys: ['card-blue@2026-03-10', 'card-gold@2026-03-10'],
      });
    });

    it('returns suggestions when several hinted cards do not resolve', () => {
      const result = matchCreditCardStatements(
        issuerBank({ sourceDescription: 'GOLD and BLUE cards' }),
        [],
        [
          statement('card-gold', { accountNumber: '1111', accountName: 'GOLD', total: '-1000.00' }),
          statement('card-blue', { accountNumber: '2222', accountName: 'BLUE', total: '-300.00' }),
        ],
      );
      expect(isConfidentMatch(result)).toBe(false);
      if (!isConfidentMatch(result)) {
        expect(result.suggestions.length).toBeGreaterThan(0);
      }
    });
  });

  it('rule (c): requires the exact amount to be unique among all candidates', () => {
    const result = matchCreditCardStatements(bank(), [], [
      statement('card-a', { settlementAccountId: BANK_ACCOUNT }),
      // unscoped, but has the same amount: the scoped one is no longer unique
      statement('card-b'),
    ]);
    expect(isConfidentMatch(result)).toBe(false);
  });

  it('never proposes a rejected statement for that bank transaction', () => {
    const rejected = statement('card-a', { accountNumber: '1111' });
    const result = matchCreditCardStatements(
      bank({ sourceReference: '1111', counterpartyIsCardIssuer: true }),
      [],
      [rejected, statement('card-b')],
      { rejectedKeys: [rejected] },
    );
    expect(isConfidentMatch(result)).toBe(false);
    if (!isConfidentMatch(result)) {
      expect(result.suggestions.map(s => s.statements[0].cardAccountId)).toEqual(['card-b']);
    }
  });

  describe('suggestCreditCardStatements', () => {
    it('ranks the statement closing the gap first, excluding those already shown', () => {
      const linked = statement('card-a', { total: '-1000.00' });
      const suggestions = suggestCreditCardStatements(
        bank(),
        [],
        [linked, statement('card-b', { total: '-80.00' }), statement('card-c', { total: '-500.00' })],
        { excludeKeys: [linked], linkedCents: -100_000 },
      );
      expect(suggestions.map(s => s.statements[0].cardAccountId)).toEqual(['card-c', 'card-b']);
      expect(suggestions[0].amountDifferenceCents).toBe(0);
    });
  });
});
