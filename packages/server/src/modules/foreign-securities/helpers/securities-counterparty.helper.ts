export type NettableTransaction = {
  business_id: string | null;
  is_fee: boolean | null;
  amount: string | number;
  currency: string;
};

/**
 * Net amount per currency of the given non-fee transactions. Fees are left out: a security's
 * commission is booked separately and is not part of its cash leg.
 */
export function netAmountsByCurrency(
  transactions: readonly Pick<NettableTransaction, 'is_fee' | 'amount' | 'currency'>[],
): Map<string, number> {
  const nets = new Map<string, number>();
  for (const transaction of transactions) {
    if (transaction.is_fee) {
      continue;
    }
    nets.set(
      transaction.currency,
      (nets.get(transaction.currency) ?? 0) + Number(transaction.amount),
    );
  }
  // Amounts are stored to the cent, but summing their float representations can leave a
  // sub-cent residue — round it off, and turn a -0 into 0 so it never reads as negative.
  for (const [currency, net] of nets) {
    nets.set(currency, Math.round(net * 100) / 100 || 0);
  }
  return nets;
}

/**
 * True when the transactions are non-empty and cancel out in every currency they move in — a
 * buy reversed by a sell of the same amount, as when a trade is rebooked to another series.
 */
export function isNetZero(
  transactions: readonly Pick<NettableTransaction, 'is_fee' | 'amount' | 'currency'>[],
): boolean {
  return areNetZero(netAmountsByCurrency(transactions));
}

/** `isNetZero` over amounts already netted by `netAmountsByCurrency`. */
export function areNetZero(nets: ReadonlyMap<string, number>): boolean {
  if (nets.size === 0) {
    return false;
  }
  return [...nets.values()].every(net => net === 0);
}

/**
 * Narrows a charge's main-counterparty candidates by dropping the securities whose trades cancel
 * out within the charge. A security bought and sold back for the same amount carries no exposure,
 * so it should not compete with the security the charge actually moved money into.
 *
 * Only securities businesses are pruned — a non-securities candidate (say, a bank fee row not
 * flagged as a fee) is a real ambiguity and stays visible. When every candidate cancels out there
 * is nothing to prefer, so the candidates are returned as they are.
 */
export function pruneOffsettingSecurityCandidates(
  candidateIds: readonly string[],
  transactions: readonly NettableTransaction[],
  securitiesBusinessIds: ReadonlySet<string>,
): string[] {
  if (candidateIds.length <= 1) {
    return [...candidateIds];
  }

  const remaining = candidateIds.filter(
    businessId =>
      !securitiesBusinessIds.has(businessId) ||
      !isNetZero(transactions.filter(transaction => transaction.business_id === businessId)),
  );

  return remaining.length > 0 ? remaining : [...candidateIds];
}
