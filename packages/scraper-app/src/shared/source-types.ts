export const SOURCE_TYPES = [
  'poalim',
  'discount',
  'isracard',
  'amex',
  'cal',
  'max',
  'otsar-hahayal',
  'otsar-hahayal-credit-card',
] as const satisfies [string, ...string[]];

export type SourceType = (typeof SOURCE_TYPES)[number];
