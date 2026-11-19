import type { TimelessDateString } from '../../../shared/types/index.js';

/**
 * Matches a bank's credit card debit to the card statement(s) it settles.
 *
 * A statement (billing cycle) is derived, not stored: the card rows of one card account, in one
 * currency, sharing one effective debit date. This module is pure — the provider loads the bank
 * transaction, its bank-specific card hints and the candidate statements around its date, and this
 * decides whether the link is confident enough to make without a person.
 */

/** Days around the bank debit date in which a statement's debit date may fall. */
export const STATEMENT_DATE_WINDOW_DAYS = 5;

/** Largest number of statements a single bank debit is assumed to combine. */
const MAX_COMBINED_STATEMENTS = 4;

/** Scoped candidates above this count are not searched for combined debits (combinatorics). */
const MAX_SUBSET_SEARCH_CANDIDATES = 24;

/** Number of suggestions returned for a bank transaction. */
const MAX_SUGGESTIONS = 5;

export type StatementKey = {
  cardAccountId: string;
  currency: string;
  debitDate: TimelessDateString;
};

export type AutoLinkMethod = 'REFERENCE' | 'AMOUNT';

export type MatcherBankTransaction = {
  id: string;
  accountId: string;
  /** Numeric string or number, signed (a debit is negative) */
  amount: string | number;
  currency: string;
  /** COALESCE(debit_date_override, debit_date, event_date) */
  effectiveDate: TimelessDateString;
  sourceReference: string | null;
  sourceDescription: string | null;
  /**
   * True when the bank row's counterparty is one of the owner's card issuer businesses. Only then
   * is a reference equal to a card number, or a card name in the description, a strong hint: on
   * any other row such a coincidence is weak evidence.
   */
  counterpartyIsCardIssuer: boolean;
};

/**
 * A card identifier found in the bank's raw data, e.g. Poalim's card-debit reference (activity
 * 491) or Otsar Hahayal's `origin_reference`. Always a strong hint.
 */
export type BankCardHint = {
  transactionId: string;
  source: string;
  hint: string;
};

export type CandidateStatement = StatementKey & {
  /** Sum of the statement's card transactions, numeric string or number */
  total: string | number;
  transactionsCount: number;
  accountNumber: string;
  accountName: string | null;
  settlementAccountId: string | null;
  /** The bank transaction this statement is already linked to, if any */
  linkedBankTransactionId: string | null;
};

export type HintStrength = 'STRONG' | 'WEAK' | 'NONE';

export type RankedSuggestion = {
  statements: CandidateStatement[];
  hint: HintStrength;
  /** Statement total (plus any already linked total) minus the bank amount, in cents */
  amountDifferenceCents: number;
  /** Largest distance, in days, between the bank date and a statement's debit date */
  dateDistanceDays: number;
  reason: string;
};

export type MatchResult =
  { links: StatementKey[]; method: AutoLinkMethod } | { suggestions: RankedSuggestion[] };

export function isConfidentMatch(
  result: MatchResult,
): result is { links: StatementKey[]; method: AutoLinkMethod } {
  return 'links' in result;
}

/** The canonical card key: the last 4 digits of the account number ("1234", "123456xxxxxx1234") */
export function cardKey(accountNumber: string | null | undefined): string | null {
  const digits = (accountNumber ?? '').replace(/\D/g, '');
  return digits.length >= 4 ? digits.slice(-4) : null;
}

/** Exact decimal string → integer cents, so amounts are never compared as floats. */
export function toCents(value: string | number): number {
  const text = typeof value === 'number' ? value.toFixed(2) : value.trim();
  const match = /^([+-])?(\d*)(?:\.(\d*))?$/.exec(text);
  if (!match) {
    return Math.round(Number(text) * 100);
  }
  const [, sign, whole, fraction = ''] = match;
  const fractionDigits = (fraction + '000').slice(0, 3);
  let cents = Number(whole || '0') * 100 + Number(fractionDigits.slice(0, 2));
  if (Number(fractionDigits[2]) >= 5) {
    cents += 1;
  }
  return sign === '-' ? -cents : cents;
}

export function statementKeyId(key: StatementKey): string {
  return `${key.cardAccountId}|${key.currency}|${key.debitDate}`;
}

function daysBetween(a: TimelessDateString, b: TimelessDateString): number {
  const ms = Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`);
  return Math.abs(Math.round(ms / 86_400_000));
}

/** Standalone 4-digit groups of a description (not part of a longer number). */
function fourDigitGroups(description: string | null): Set<string> {
  return new Set((description ?? '').match(/(?<!\d)\d{4}(?!\d)/g) ?? []);
}

type CardHintInput = Pick<CandidateStatement, 'accountNumber' | 'accountName'>;

/** How strongly the bank row points at this card. */
export function cardHintStrength(
  bankTransaction: Pick<
    MatcherBankTransaction,
    'sourceReference' | 'sourceDescription' | 'counterpartyIsCardIssuer'
  >,
  rawHints: readonly Pick<BankCardHint, 'hint'>[],
  card: CardHintInput,
): HintStrength {
  const key = cardKey(card.accountNumber);
  if (key && rawHints.some(({ hint }) => cardKey(hint.trim().padStart(4, '0')) === key)) {
    return 'STRONG';
  }

  const reference = bankTransaction.sourceReference?.trim();
  const accountNumber = card.accountNumber?.trim();
  const accountName = card.accountName?.trim();
  const referencesCard =
    (!!reference && !!accountNumber && reference === accountNumber) ||
    (!!accountName && !!bankTransaction.sourceDescription?.includes(accountName));
  if (referencesCard) {
    return bankTransaction.counterpartyIsCardIssuer ? 'STRONG' : 'WEAK';
  }

  if (key && fourDigitGroups(bankTransaction.sourceDescription).has(key)) {
    return 'WEAK';
  }
  return 'NONE';
}

function toKey(statement: CandidateStatement): StatementKey {
  return {
    cardAccountId: statement.cardAccountId,
    currency: statement.currency,
    debitDate: statement.debitDate,
  };
}

/** Every subset of `size` items, in a stable order. */
function* combinations<T>(items: readonly T[], size: number, start = 0): Generator<T[]> {
  if (size === 0) {
    yield [];
    return;
  }
  for (let i = start; i <= items.length - size; i++) {
    for (const rest of combinations(items, size - 1, i + 1)) {
      yield [items[i], ...rest];
    }
  }
}

const HINT_RANK: Record<HintStrength, number> = { STRONG: 2, WEAK: 1, NONE: 0 };

function describeSuggestion(suggestion: Omit<RankedSuggestion, 'reason'>): string {
  const parts: string[] = [];
  if (suggestion.hint === 'STRONG') {
    parts.push('card referenced by the bank');
  } else if (suggestion.hint === 'WEAK') {
    parts.push('card mentioned by the bank row');
  }
  if (suggestion.statements.length > 1) {
    parts.push(`combined debit of ${suggestion.statements.length} statements`);
  }
  parts.push(
    suggestion.amountDifferenceCents === 0
      ? 'amount matches'
      : `amount differs by ${(Math.abs(suggestion.amountDifferenceCents) / 100).toFixed(2)}`,
  );
  parts.push(
    suggestion.dateDistanceDays === 0
      ? 'same debit date'
      : `${suggestion.dateDistanceDays} day${suggestion.dateDistanceDays === 1 ? '' : 's'} apart`,
  );
  const text = parts.join(', ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export type MatcherOptions = {
  /** Statements a user unlinked from this bank transaction: never proposed again for it */
  rejectedKeys?: readonly StatementKey[];
};

type Enriched = {
  statement: CandidateStatement;
  hint: HintStrength;
  cents: number;
  distance: number;
};

/** The candidates this bank transaction may settle, with their hint, total and date distance. */
function prepareCandidates(
  bankTransaction: MatcherBankTransaction,
  rawHints: readonly BankCardHint[],
  candidates: readonly CandidateStatement[],
  options: MatcherOptions,
): Enriched[] {
  const hintsOfTransaction = rawHints.filter(hint => hint.transactionId === bankTransaction.id);
  const rejected = new Set((options.rejectedKeys ?? []).map(statementKeyId));
  return candidates
    .filter(
      candidate =>
        candidate.currency === bankTransaction.currency &&
        !rejected.has(statementKeyId(candidate)) &&
        (!candidate.linkedBankTransactionId ||
          candidate.linkedBankTransactionId === bankTransaction.id) &&
        (!candidate.settlementAccountId ||
          candidate.settlementAccountId === bankTransaction.accountId) &&
        daysBetween(candidate.debitDate, bankTransaction.effectiveDate) <=
          STATEMENT_DATE_WINDOW_DAYS,
    )
    .map(statement => ({
      statement,
      hint: cardHintStrength(bankTransaction, hintsOfTransaction, statement),
      cents: toCents(statement.total),
      distance: daysBetween(statement.debitDate, bankTransaction.effectiveDate),
    }));
}

function rankSuggestions(sets: Enriched[][], bankCents: number, baseCents = 0): RankedSuggestion[] {
  return sets
    .map(set => {
      const hint = set.reduce<HintStrength>(
        (best, item) => (HINT_RANK[item.hint] > HINT_RANK[best] ? item.hint : best),
        'NONE',
      );
      const base = {
        statements: set.map(item => item.statement),
        hint,
        amountDifferenceCents:
          baseCents + set.reduce((sum, item) => sum + item.cents, 0) - bankCents,
        dateDistanceDays: Math.max(...set.map(item => item.distance)),
      };
      return { ...base, reason: describeSuggestion(base) };
    })
    .sort(
      (a, b) =>
        HINT_RANK[b.hint] - HINT_RANK[a.hint] ||
        Math.abs(a.amountDifferenceCents) - Math.abs(b.amountDifferenceCents) ||
        a.dateDistanceDays - b.dateDistanceDays ||
        a.statements.length - b.statements.length,
    )
    .slice(0, MAX_SUGGESTIONS);
}

const sumCents = (items: readonly Enriched[]) => items.reduce((sum, item) => sum + item.cents, 0);

/**
 * Rule (a) for one strongly hinted card: its only statement in the window; else its only statement
 * with the exact amount; else all its statements in the window, when they add up to the debit.
 * Null when none of these holds.
 */
function resolveStrongCard(items: readonly Enriched[], bankCents: number): Enriched[] | null {
  if (items.length === 1) {
    return [...items];
  }
  const exact = items.filter(item => item.cents === bankCents);
  if (exact.length === 1) {
    return exact;
  }
  if (items.length > 1 && sumCents(items) === bankCents) {
    return [...items];
  }
  return null;
}

/**
 * Decides which statement(s) a bank card debit settles.
 *
 * Hints: a raw bank hint matching the card's last 4 digits is strong. A reference equal to the
 * card number, or the card's name in the description, is strong only when the bank row's
 * counterparty is a card issuer, and weak otherwise. The card's last 4 digits as a standalone group
 * in the description are weak.
 *
 * Decision order:
 * a. strong hints → per hinted card: its only statement in the window, else its only exact-amount
 *    statement, else all its statements when they add up to the debit (REFERENCE, even if the
 *    amount differs). With several hinted cards: the single card resolved to the exact amount, or
 *    all resolved cards when they add up to the debit (at most 4 statements). When a strong hint
 *    exists but nothing resolves, only suggestions are returned: a card the bank row did not
 *    mention is never linked on amount alone.
 * b. a weak hint with the exact amount, on a single statement → REFERENCE;
 * c. a statement with the exact amount, unique among ALL available candidates, that is scoped
 *    (its card is configured as paid from this bank account, or is hinted) → AMOUNT;
 * d. exactly one combination of 2–4 scoped candidates summing to the amount, when no single
 *    candidate has the exact amount, and only when the bank row mentions a card (any hint) or its
 *    counterparty is a card issuer → AMOUNT. A row whose only link to the cards is a settlement
 *    account needs a unique exact amount (rule c);
 * e. otherwise ranked suggestions, nothing linked.
 *
 * Candidates already linked to another bank transaction, rejected for this one, in another
 * currency, outside the date window, or configured as paid from a different bank account are
 * never considered.
 */
export function matchCreditCardStatements(
  bankTransaction: MatcherBankTransaction,
  rawHints: readonly BankCardHint[],
  candidates: readonly CandidateStatement[],
  options: MatcherOptions = {},
): MatchResult {
  const bankCents = toCents(bankTransaction.amount);
  const enriched = prepareCandidates(bankTransaction, rawHints, candidates, options);
  const singles = enriched.map(item => [item]);

  // a. strong hints
  const strongCards = Array.from(
    new Set(
      enriched.filter(item => item.hint === 'STRONG').map(item => item.statement.cardAccountId),
    ),
  );
  if (strongCards.length > 0) {
    const resolved = strongCards
      .map(cardId =>
        resolveStrongCard(
          enriched.filter(item => item.statement.cardAccountId === cardId),
          bankCents,
        ),
      )
      .filter((items): items is Enriched[] => !!items);

    if (strongCards.length === 1 && resolved.length === 1) {
      return { links: resolved[0].map(item => toKey(item.statement)), method: 'REFERENCE' };
    }
    if (strongCards.length > 1 && resolved.length > 0) {
      const exact = resolved.filter(items => sumCents(items) === bankCents);
      if (exact.length === 1) {
        return { links: exact[0].map(item => toKey(item.statement)), method: 'REFERENCE' };
      }
      const all = resolved.flat();
      if (all.length <= MAX_COMBINED_STATEMENTS && sumCents(all) === bankCents) {
        return { links: all.map(item => toKey(item.statement)), method: 'REFERENCE' };
      }
    }
    return {
      suggestions: rankSuggestions([...singles, ...resolved.filter(r => r.length > 1)], bankCents),
    };
  }

  // b. weak hint + exact amount
  const weakExact = enriched.filter(item => item.hint === 'WEAK' && item.cents === bankCents);
  if (weakExact.length === 1) {
    return { links: [toKey(weakExact[0].statement)], method: 'REFERENCE' };
  }

  // c. exact amount, unique among all candidates, on a scoped statement
  const isScoped = (item: Enriched) =>
    item.hint !== 'NONE' || item.statement.settlementAccountId === bankTransaction.accountId;
  const exact = enriched.filter(item => item.cents === bankCents);
  if (exact.length === 1 && isScoped(exact[0])) {
    return { links: [toKey(exact[0].statement)], method: 'AMOUNT' };
  }

  // d. exactly one combination of scoped candidates summing to the amount, on a card debit
  const scoped = enriched.filter(isScoped);
  const isCardDebit =
    bankTransaction.counterpartyIsCardIssuer || enriched.some(item => item.hint !== 'NONE');
  const subsetMatches: Enriched[][] = [];
  if (exact.length === 0 && scoped.length <= MAX_SUBSET_SEARCH_CANDIDATES) {
    for (let size = 2; size <= Math.min(MAX_COMBINED_STATEMENTS, scoped.length); size++) {
      for (const subset of combinations(scoped, size)) {
        if (sumCents(subset) === bankCents) {
          subsetMatches.push(subset);
        }
      }
    }
    // without a card clue a combination is only suggested, never linked
    if (isCardDebit && subsetMatches.length === 1) {
      return { links: subsetMatches[0].map(item => toKey(item.statement)), method: 'AMOUNT' };
    }
  }

  // e. ranked suggestions
  return { suggestions: rankSuggestions([...singles, ...subsetMatches], bankCents) };
}

/**
 * Ranked single statements a person may add to a bank transaction that already shows statements
 * (stored links, or a match computed on read): `excludeKeys` are those already shown, and
 * `linkedCents` their total, so a statement that closes the gap to the debit ranks first.
 */
export function suggestCreditCardStatements(
  bankTransaction: MatcherBankTransaction,
  rawHints: readonly BankCardHint[],
  candidates: readonly CandidateStatement[],
  options: MatcherOptions & { excludeKeys?: readonly StatementKey[]; linkedCents?: number } = {},
): RankedSuggestion[] {
  const excluded = new Set((options.excludeKeys ?? []).map(statementKeyId));
  const enriched = prepareCandidates(bankTransaction, rawHints, candidates, options).filter(
    item => !excluded.has(statementKeyId(item.statement)),
  );
  return rankSuggestions(
    enriched.map(item => [item]),
    toCents(bankTransaction.amount),
    options.linkedCents ?? 0,
  );
}

/**
 * Statements a user unlinked from (or dismissed for) this bank transaction, ranked like
 * suggestions, so they can be linked again by hand. Never used for a confident match.
 */
export function suggestRejectedCreditCardStatements(
  bankTransaction: MatcherBankTransaction,
  rawHints: readonly BankCardHint[],
  candidates: readonly CandidateStatement[],
  options: { rejectedKeys: readonly StatementKey[]; linkedCents?: number },
): RankedSuggestion[] {
  const rejected = new Set(options.rejectedKeys.map(statementKeyId));
  if (rejected.size === 0) {
    return [];
  }
  const enriched = prepareCandidates(bankTransaction, rawHints, candidates, {}).filter(item =>
    rejected.has(statementKeyId(item.statement)),
  );
  return rankSuggestions(
    enriched.map(item => [item]),
    toCents(bankTransaction.amount),
    options.linkedCents ?? 0,
  );
}
