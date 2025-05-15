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
