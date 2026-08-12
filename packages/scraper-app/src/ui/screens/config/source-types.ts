import type { SourceType } from '../../../shared/source-types.js';

export type PoalimSource = {
  id: string;
  type: 'poalim';
  nickname?: string;
  userCode: string;
  password: string;
  options?: {
    isBusinessAccount?: boolean;
    fetchSecurities?: boolean;
    acceptedAccountNumbers?: string[];
    acceptedBranchNumbers?: string[];
    ignoredAccountNumbers?: string[];
    ignoredBranchNumbers?: string[];
  };
};

export type DiscountSource = {
  id: string;
  type: 'discount';
  nickname?: string;
  ID: string;
  password: string;
  code?: string;
};

export type IsracardSource = {
  id: string;
  type: 'isracard';
  nickname?: string;
  ownerId: string;
  password: string;
  last6Digits: string;
  options?: {
    acceptedCardNumbers?: string[];
    ignoredCardNumbers?: string[];
    cardNumberMapping?: Record<string, string>;
  };
};

export type AmexSource = {
  id: string;
  type: 'amex';
  nickname?: string;
  ownerId: string;
  password: string;
  last6Digits: string;
  options?: {
    acceptedCardNumbers?: string[];
    ignoredCardNumbers?: string[];
    cardNumberMapping?: Record<string, string>;
  };
};

export type CalSource = {
  id: string;
  type: 'cal';
  nickname?: string;
  username: string;
  password: string;
  last4Digits: string;
  options?: { acceptedCardNumbers?: string[]; ignoredCardNumbers?: string[] };
};

export type MaxSource = {
  id: string;
  type: 'max';
  nickname?: string;
  username: string;
  password: string;
  options?: { acceptedCardNumbers?: string[]; ignoredCardNumbers?: string[] };
};

export type OtsarHahayalSource = {
  id: string;
  type: 'otsar-hahayal';
  nickname?: string;
  userCode: string;
  password: string;
};

export type SourceConfig =
  | PoalimSource
  | DiscountSource
  | IsracardSource
  | AmexSource
  | CalSource
  | MaxSource
  | OtsarHahayalSource;

export type { SourceType } from '../../../shared/source-types.js';

/**
 * Source types the user can configure directly. Excludes 'otsar-hahayal-credit-card', which is
 * not a login of its own — those cards are discovered through an Otsar HaHayal source.
 */
export type ConfigurableSourceType = SourceConfig['type'];

export const CONFIGURABLE_SOURCE_TYPES = [
  'poalim',
  'discount',
  'isracard',
  'amex',
  'cal',
  'max',
  'otsar-hahayal',
] as const satisfies readonly ConfigurableSourceType[];

export const SOURCE_LABELS: Record<SourceType, string> = {
  poalim: 'Bank Hapoalim',
  discount: 'Bank Discount',
  isracard: 'Isracard',
  amex: 'Amex',
  cal: 'CAL',
  max: 'Max',
  'otsar-hahayal': 'Otsar HaHayal',
  'otsar-hahayal-credit-card': 'Otsar HaHayal - Credit Card',
};
