export type SourceType = 'bank' | 'creditcard';

export interface Source {
  id: string;
  name: string;
  type: SourceType;
  icon: string;
}

export interface BaseAccountConfig {
  id: string;
  sourceId: string;
  nickname: string;
  password: string;
}

// Hapoalim: userCode + password
export interface HapoalimCredentials {
  userCode: string;
}

// Discount: id + password + code
export interface DiscountCredentials {
  idNumber: string;
  code: string;
}

// Isracard & Amex: id + password + last6Digits
export interface IsracardAmexCredentials {
  idNumber: string;
  last6Digits: string;
}

// CAL: username + password + 4digits
export interface CalCredentials {
  username: string;
  fourDigits: string;
}

// MAX: username + password
export interface MaxCredentials {
  username: string;
}

export interface HapoalimAccountConfig extends BaseAccountConfig, HapoalimCredentials {
  isBusinessAccount: boolean;
  accountsToInclude: string[];
  accountsToExclude: string[];
  branchNumbersToInclude: string[];
  branchNumbersToExclude: string[];
}

export interface DiscountAccountConfig extends BaseAccountConfig, DiscountCredentials {
  isBusinessAccount: boolean;
  accountsToInclude: string[];
  accountsToExclude: string[];
  branchNumbersToInclude: string[];
  branchNumbersToExclude: string[];
}

export type BankAccountConfig = HapoalimAccountConfig | DiscountAccountConfig;

export interface BaseCreditCardConfig extends BaseAccountConfig {
  cardNumbersToInclude: string[];
  cardNumbersToExclude: string[];
}

export interface IsracardAccountConfig extends BaseCreditCardConfig, IsracardAmexCredentials {
  monthsToScrape?: number; // Number of months back from today to fetch (default: 3)
}

export interface AmexAccountConfig extends BaseCreditCardConfig, IsracardAmexCredentials {}

export interface CalAccountConfig extends BaseCreditCardConfig, CalCredentials {}

export interface MaxAccountConfig extends BaseCreditCardConfig, MaxCredentials {}

export type CreditCardAccountConfig =
  | IsracardAccountConfig
  | AmexAccountConfig
  | CalAccountConfig
  | MaxAccountConfig;

export type AccountConfig =
  | HapoalimAccountConfig
  | DiscountAccountConfig
  | IsracardAccountConfig
  | AmexAccountConfig
  | CalAccountConfig
  | MaxAccountConfig;

export function isIsracardAccount(account: AccountConfig): account is IsracardAccountConfig {
  return account.sourceId === 'isracard';
}

export interface ScraperConfig {
  serverUrl: string;
  apiKey: string;
  databaseConnectionString: string;
  accounts: AccountConfig[];
}

export const AVAILABLE_SOURCES: Source[] = [
  { id: 'discount', name: 'Discount Bank', type: 'bank', icon: '🏦' },
  { id: 'hapoalim', name: 'Hapoalim Bank', type: 'bank', icon: '🏦' },
  { id: 'amex', name: 'American Express', type: 'creditcard', icon: '💳' },
  { id: 'cal', name: 'CAL Credit Card', type: 'creditcard', icon: '💳' },
  { id: 'isracard', name: 'Isracard', type: 'creditcard', icon: '💳' },
  { id: 'max', name: 'MAX Credit Card', type: 'creditcard', icon: '💳' },
];

export function isBankAccount(account: AccountConfig): account is BankAccountConfig {
  const source = AVAILABLE_SOURCES.find(s => s.id === account.sourceId);
  return source?.type === 'bank';
}

export function isCreditCardAccount(account: AccountConfig): account is CreditCardAccountConfig {
  const source = AVAILABLE_SOURCES.find(s => s.id === account.sourceId);
  return source?.type === 'creditcard';
}

export function createEmptyHapoalimAccount(): HapoalimAccountConfig {
  return {
    id: crypto.randomUUID(),
    sourceId: 'hapoalim',
    nickname: '',
    password: '',
    userCode: '',
    isBusinessAccount: false,
    accountsToInclude: [],
    accountsToExclude: [],
    branchNumbersToInclude: [],
    branchNumbersToExclude: [],
  };
}

export function createEmptyDiscountAccount(): DiscountAccountConfig {
  return {
    id: crypto.randomUUID(),
    sourceId: 'discount',
    nickname: '',
    password: '',
    idNumber: '',
    code: '',
    isBusinessAccount: false,
    accountsToInclude: [],
    accountsToExclude: [],
    branchNumbersToInclude: [],
    branchNumbersToExclude: [],
  };
}

export function createEmptyIsracardAccount(): IsracardAccountConfig {
  return {
    id: crypto.randomUUID(),
    sourceId: 'isracard',
    nickname: '',
    password: '',
    idNumber: '',
    last6Digits: '',
    cardNumbersToInclude: [],
    cardNumbersToExclude: [],
    monthsToScrape: 3,
  };
}

export function createEmptyAmexAccount(): AmexAccountConfig {
  return {
    id: crypto.randomUUID(),
    sourceId: 'amex',
    nickname: '',
    password: '',
    idNumber: '',
    last6Digits: '',
    cardNumbersToInclude: [],
    cardNumbersToExclude: [],
  };
}

export function createEmptyCalAccount(): CalAccountConfig {
  return {
    id: crypto.randomUUID(),
    sourceId: 'cal',
    nickname: '',
    password: '',
    username: '',
    fourDigits: '',
    cardNumbersToInclude: [],
    cardNumbersToExclude: [],
  };
}

export function createEmptyMaxAccount(): MaxAccountConfig {
  return {
    id: crypto.randomUUID(),
    sourceId: 'max',
    nickname: '',
    password: '',
    username: '',
    cardNumbersToInclude: [],
    cardNumbersToExclude: [],
  };
}

export function createEmptyAccount(sourceId: string): AccountConfig {
  switch (sourceId) {
    case 'hapoalim':
      return createEmptyHapoalimAccount();
    case 'discount':
      return createEmptyDiscountAccount();
    case 'isracard':
      return createEmptyIsracardAccount();
    case 'amex':
      return createEmptyAmexAccount();
    case 'cal':
      return createEmptyCalAccount();
    case 'max':
      return createEmptyMaxAccount();
    default:
      throw new Error(`Unknown source: ${sourceId}`);
  }
}
