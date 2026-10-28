export function parseIntRound(v: number): number {
  // Note: why not use Math.round?
  return parseInt((v + Math.sign(v) / 2) as unknown as string);
}

export function stringNumberRounded(number: string): number {
  return parseIntRound((parseFloat(number) + Number.EPSILON) * 100) / 100;
}

export function numberRounded(number: number): number {
  return parseIntRound((number + Number.EPSILON) * 100) / 100;
}

export const formatStringifyAmount = (rawAmount: number, digits = 2): string => {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(rawAmount);
};

/**
 * Compact, human-scale form of a large count: `30000000000` → `30B`,
 * `600000000` → `600M`, `1500000000` → `1.5B`, `250000` → `250K`, `999` → `999`.
 * Takes a bigint because contract operation limits are `BigInt` upstream; the
 * exact value belongs next to it (a `title` tooltip, a description line), since
 * the compact form drops precision past one decimal.
 */
export function formatCompactNumber(value: bigint | number): string {
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
}
