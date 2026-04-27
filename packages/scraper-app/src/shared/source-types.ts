export const SOURCE_TYPES = [
  'poalim',
  'discount',
  'isracard',
  'amex',
  'cal',
  'max',
] as const satisfies [string, ...string[]];

export type SourceType = (typeof SOURCE_TYPES)[number];
