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

/** Number of suggestions returned when nothing can be linked automatically. */
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
};

/** A card identifier found in the bank's raw data, e.g. Otsar Hahayal's `origin_reference`. */
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
  /** Statement total minus the bank amount, in cents */
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
  bankTransaction: Pick<MatcherBankTransaction, 'sourceReference' | 'sourceDescription'>,
  rawHints: readonly Pick<BankCardHint, 'hint'>[],
  card: CardHintInput,
): HintStrength {
  const reference = bankTransaction.sourceReference?.trim();
  const accountNumber = card.accountNumber?.trim();
  if (reference && accountNumber && reference === accountNumber) {
    return 'STRONG';
  }
  const accountName = card.accountName?.trim();
  if (accountName && bankTransaction.sourceDescription?.includes(accountName)) {
    return 'STRONG';
  }
  const key = cardKey(card.accountNumber);
  if (!key) {
    return 'NONE';
  }
  if (rawHints.some(({ hint }) => cardKey(hint) === key)) {
    return 'STRONG';
  }
  if (fourDigitGroups(bankTransaction.sourceDescription).has(key)) {
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
    parts.push('card digits in the description');
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

/**
 * Decides which statement(s) a bank card debit settles.
 *
 * Decision order:
 * a. a strong hint (reference = card number, card name in the description, a raw bank hint
 *    matching the card's last 4 digits) → that card's statement closest to the bank date
 *    (REFERENCE), even if the amount differs;
 * b. a weak hint (the card's last 4 digits in the description) with an exact amount → REFERENCE;
 * c. an exact amount that is unique among the scoped candidates (the card is configured as paid
 *    from this bank account, or is hinted) → AMOUNT;
 * d. exactly one combination of 2–4 scoped candidates summing to the amount → AMOUNT;
 * e. otherwise ranked suggestions, nothing linked.
 *
 * Candidates already linked to another bank transaction, in another currency, outside the date
 * window, or configured as paid from a different bank account are never considered.
 */
export function matchCreditCardStatements(
  bankTransaction: MatcherBankTransaction,
  rawHints: readonly BankCardHint[],
  candidates: readonly CandidateStatement[],
): MatchResult {
  const bankCents = toCents(bankTransaction.amount);
  const hintsOfTransaction = rawHints.filter(hint => hint.transactionId === bankTransaction.id);

  const available = candidates.filter(
    candidate =>
      candidate.currency === bankTransaction.currency &&
      (!candidate.linkedBankTransactionId ||
        candidate.linkedBankTransactionId === bankTransaction.id) &&
      (!candidate.settlementAccountId ||
        candidate.settlementAccountId === bankTransaction.accountId) &&
      daysBetween(candidate.debitDate, bankTransaction.effectiveDate) <= STATEMENT_DATE_WINDOW_DAYS,
  );

  const enriched = available.map(statement => ({
    statement,
    hint: cardHintStrength(bankTransaction, hintsOfTransaction, statement),
    cents: toCents(statement.total),
    distance: daysBetween(statement.debitDate, bankTransaction.effectiveDate),
  }));
  type Enriched = (typeof enriched)[number];

  const closest = (items: Enriched[]): Enriched | undefined =>
    [...items].sort(
      (a, b) =>
        a.distance - b.distance ||
        Math.abs(a.cents - bankCents) - Math.abs(b.cents - bankCents) ||
        a.statement.debitDate.localeCompare(b.statement.debitDate),
    )[0];

  // a. strong hint
  const strongCards = new Set(
    enriched.filter(item => item.hint === 'STRONG').map(item => item.statement.cardAccountId),
  );
  if (strongCards.size > 0) {
    const perCard = [...strongCards]
      .map(cardId => closest(enriched.filter(item => item.statement.cardAccountId === cardId)))
      .filter((item): item is Enriched => !!item);
    if (perCard.length === 1) {
      return { links: [toKey(perCard[0].statement)], method: 'REFERENCE' };
    }
    const exact = perCard.filter(item => item.cents === bankCents);
    if (exact.length === 1) {
      return { links: [toKey(exact[0].statement)], method: 'REFERENCE' };
    }
    if (
      exact.length === 0 &&
      perCard.length <= MAX_COMBINED_STATEMENTS &&
      perCard.reduce((sum, item) => sum + item.cents, 0) === bankCents
    ) {
      return { links: perCard.map(item => toKey(item.statement)), method: 'REFERENCE' };
    }
  }

  // b. weak hint + exact amount
  const weakExact = enriched.filter(item => item.hint === 'WEAK' && item.cents === bankCents);
  if (weakExact.length === 1) {
    return { links: [toKey(weakExact[0].statement)], method: 'REFERENCE' };
  }

  // c. exact amount, unique among the scoped candidates
  const scoped = enriched.filter(
    item =>
      item.hint !== 'NONE' || item.statement.settlementAccountId === bankTransaction.accountId,
  );
  const scopedExact = scoped.filter(item => item.cents === bankCents);
  if (scopedExact.length === 1) {
    return { links: [toKey(scopedExact[0].statement)], method: 'AMOUNT' };
  }

  // d. exactly one combination of scoped candidates summing to the amount
  const subsetMatches: Enriched[][] = [];
  if (scopedExact.length === 0 && scoped.length <= MAX_SUBSET_SEARCH_CANDIDATES) {
    for (let size = 2; size <= Math.min(MAX_COMBINED_STATEMENTS, scoped.length); size++) {
      for (const subset of combinations(scoped, size)) {
        if (subset.reduce((sum, item) => sum + item.cents, 0) === bankCents) {
          subsetMatches.push(subset);
        }
      }
    }
    if (subsetMatches.length === 1) {
      return { links: subsetMatches[0].map(item => toKey(item.statement)), method: 'AMOUNT' };
    }
  }

  // e. ranked suggestions
  const suggestionSets: Enriched[][] = [...enriched.map(item => [item]), ...subsetMatches];
  const suggestions = suggestionSets
    .map(set => {
      const hint = set.reduce<HintStrength>(
        (best, item) => (HINT_RANK[item.hint] > HINT_RANK[best] ? item.hint : best),
        'NONE',
      );
      const base = {
        statements: set.map(item => item.statement),
        hint,
        amountDifferenceCents: set.reduce((sum, item) => sum + item.cents, 0) - bankCents,
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

  return { suggestions };
}
