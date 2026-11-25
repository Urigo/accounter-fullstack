export function identifyInterestTransactionIds<T>(
  transactions: readonly T[],
  opts: {
    getId: (row: T) => string;
    getChargeId: (row: T) => string | null | undefined;
    getAmount: (row: T) => number;
  },
): Set<string> {
  const { getId, getChargeId, getAmount } = opts;

  const chargeGroups = new Map<string, T[]>();
  for (const row of transactions) {
    const chargeId = getChargeId(row);
    if (!chargeId) continue;
    const arr = chargeGroups.get(chargeId) ?? [];
    arr.push(row);
    if (!chargeGroups.has(chargeId)) chargeGroups.set(chargeId, arr);
  }

  const interestIds = new Set<string>();
  for (const [, txs] of chargeGroups) {
    if (txs.length > 1) {
      const sorted = [...txs].sort((a, b) => Math.abs(getAmount(b)) - Math.abs(getAmount(a)));
      for (let i = 1; i < sorted.length; i++) {
        interestIds.add(getId(sorted[i]));
      }
    }
  }

  return interestIds;
}
