/**
 * Pairing of restated Otsar Hahayal credit-card deals with the rows already stored for them.
 *
 * Until a Visa statement is charged, the bank reports its deals provisionally. About a day after
 * the charge it restates them:
 *   - `date` moves (by one day back, in every case seen so far),
 *   - `name` — truncated to 14 characters and upper-cased until then — becomes the full name,
 *   - `notes` is filled in.
 * `date`, `name` and `notes` are all in the dedup key, so a restated deal misses the stored row and
 * would be inserted a second time. This module finds the stored row each restated deal replaces,
 * so the upload can update it in place and keep the transaction's charge, business and edits.
 *
 * Safety: only stored rows that are *missing* from the latest scrape of their own statement are
 * restatement candidates. A genuine second deal with the same merchant and amount on an adjacent
 * day is still in the scrape, matches its stored row exactly, and is never touched.
 */

/** The identity-relevant fields of one deal, normalized for comparison. */
export type CreditCardDeal = {
  resourceId: string;
  cardType: number;
  /** yyyy-mm-dd */
  date: string;
  /** yyyy-mm-dd */
  chargeDate: string;
  name: string;
  dealAmount: number;
  dealCurrency: string;
  chargeAmount: number;
  chargeCurrency: string;
  notes: string;
  counter: number;
};

/** How far a restated deal's date may move from the provisional one. */
export const RESTATEMENT_DATE_TOLERANCE_DAYS = 3;

/** The shift seen on every restatement so far; preferred when several pairings are possible. */
const EXPECTED_DATE_SHIFT_DAYS = -1;

const DAY_MS = 24 * 60 * 60 * 1000;

/** The unique key of a stored deal (mirrors `otsar_hahayal_creditcard_transactions_conflict_key`). */
export function creditCardDealKey(deal: CreditCardDeal): string {
  return [
    deal.resourceId,
    deal.cardType,
    deal.date,
    deal.chargeDate,
    Number(deal.dealAmount),
    deal.dealCurrency,
    deal.name,
    deal.notes,
    deal.counter,
  ].join('|');
}

/** One card's statement for one charge date. A scrape returns each statement whole. */
function statementKey(deal: CreditCardDeal): string {
  return [deal.resourceId, deal.cardType, deal.chargeDate].join('|');
}

function dayShift(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);
}

function normalizeName(name: string): string {
  return name.trim().toUpperCase();
}

/** A provisional name is the (upper-cased) start of the restated one. */
function namesMatch(stored: string, incoming: string): boolean {
  const storedName = normalizeName(stored);
  return storedName.length > 0 && normalizeName(incoming).startsWith(storedName);
}

function sameDealAmounts(stored: CreditCardDeal, incoming: CreditCardDeal): boolean {
  return (
    stored.resourceId === incoming.resourceId &&
    stored.cardType === incoming.cardType &&
    stored.chargeDate === incoming.chargeDate &&
    Number(stored.dealAmount) === Number(incoming.dealAmount) &&
    stored.dealCurrency === incoming.dealCurrency &&
    Number(stored.chargeAmount) === Number(incoming.chargeAmount) &&
    stored.chargeCurrency === incoming.chargeCurrency
  );
}

export type RestatementPairing<S, I> = {
  /** Stored row → the incoming deal that restates it. */
  pairs: Array<{ stored: S; incoming: I }>;
  /**
   * Stored rows missing from the latest scrape of their statement that no incoming deal restates
   * (e.g. a cancelled deal, or a fee the bank split into fee + discount). Left as they are.
   */
  vanished: S[];
};

/**
 * Pairs incoming deals that match no stored row exactly with the stored rows they restate.
 *
 * A pair needs the same card, statement, amounts and currencies; the stored name must be the
 * case-insensitive start of the incoming one; and the dates may differ by at most
 * `RESTATEMENT_DATE_TOLERANCE_DAYS`. Pairing is one-to-one and greedy: the expected one-day-back
 * shift first, then the smallest shift, then an equal name — so a run of the same daily charge
 * pairs each day with its own restatement.
 */
export function pairCreditCardRestatements<S extends CreditCardDeal, I extends CreditCardDeal>(
  stored: readonly S[],
  incoming: readonly I[],
): RestatementPairing<S, I> {
  const incomingKeys = new Set(incoming.map(creditCardDealKey));
  const storedKeys = new Set(stored.map(creditCardDealKey));
  const scrapedStatements = new Set(incoming.map(statementKey));

  const candidates = stored.filter(
    row => scrapedStatements.has(statementKey(row)) && !incomingKeys.has(creditCardDealKey(row)),
  );
  const unmatched = incoming.filter(deal => !storedKeys.has(creditCardDealKey(deal)));

  const options: Array<{
    stored: S;
    incoming: I;
    shift: number;
    sameName: boolean;
    order: number;
  }> = [];
  for (const [storedIndex, row] of candidates.entries()) {
    for (const [incomingIndex, deal] of unmatched.entries()) {
      if (!sameDealAmounts(row, deal) || !namesMatch(row.name, deal.name)) continue;
      const shift = dayShift(row.date, deal.date);
      if (Math.abs(shift) > RESTATEMENT_DATE_TOLERANCE_DAYS) continue;
      options.push({
        stored: row,
        incoming: deal,
        shift,
        sameName: normalizeName(row.name) === normalizeName(deal.name),
        order: storedIndex * unmatched.length + incomingIndex,
      });
    }
  }

  options.sort(
    (a, b) =>
      Number(b.shift === EXPECTED_DATE_SHIFT_DAYS) - Number(a.shift === EXPECTED_DATE_SHIFT_DAYS) ||
      Math.abs(a.shift) - Math.abs(b.shift) ||
      Number(b.sameName) - Number(a.sameName) ||
      a.order - b.order,
  );

  const pairedStored = new Set<S>();
  const pairedIncoming = new Set<I>();
  const pairs: Array<{ stored: S; incoming: I }> = [];
  for (const option of options) {
    if (pairedStored.has(option.stored) || pairedIncoming.has(option.incoming)) continue;
    pairedStored.add(option.stored);
    pairedIncoming.add(option.incoming);
    pairs.push({ stored: option.stored, incoming: option.incoming });
  }

  return { pairs, vanished: candidates.filter(row => !pairedStored.has(row)) };
}
