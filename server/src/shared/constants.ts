import { Currency } from './enums.js';

/* regex of yyyy-mm-dd  */
export const TIMELESS_DATE_REGEX =
  /^((?:1[6-9]|[2]\d)\d{2})(-)(?:((?:0[13578]|1[02])(-31))|(?:(?:0[1,3-9]|1[0-2])(-)(?:29|30)))$|^(?:(?:(?:1[6-9]|[2]\d)(?:0[48]|[2468][048]|[13579][26])|(?:(?:16|[2468][048]|[3579][26])00)))(-02-29)$|^(?:(?:1[6-9]|[2-9]\d)\d{2})(-)(?:(?:0[1-9])|(?:1[0-2]))(-)(?:0[1-9]|1\d|2[0-8])$/;

export const UUID_REGEX =
  /^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/;

export const TAX_CATEGORIES_WITH_NOT_FULL_VAT = [
  '7d250948-8506-4e60-a61b-7d3a3d8390d9', // פלאפון
  'd4e1400d-3abd-4059-a4bb-a25ad1ec87f8', // מידע
  'd913c34c-a741-4f5a-9d1d-60300184463f', // מחשבים
  // TODO: delete next values after DB migration to business ID done
  'פלאפון',
  'מידע',
  'מחשבים',
];

// Tax category related
export const INPUT_VAT_TAX_CATEGORY_ID = 'b022d08b-62d8-48f7-9203-7c175646dbac';
export const OUTPUT_VAT_TAX_CATEGORY_ID = '7a798add-800d-4a06-87df-d0b85682be19';
export const EXCHANGE_RATE_CATEGORY_NAME = 'Exchange Rates';
export const FEE_CATEGORY_NAME = 'Fee';
export const DEFAULT_LOCAL_CURRENCY = Currency.Ils;
export const DEFAULT_CRYPTO_FIAT_CONVERSION_CURRENCY = Currency.Usd;

export const DEFAULT_FINANCIAL_ENTITY_ID = '6a20aa69-57ff-446e-8d6a-1e96d095e988'; // TODO: replace with context variable
export const BATCHED_EMPLOYEE_BUSINESS_ID = 'd60321ef-9b91-4907-8bd2-9cfd87c83c0a'; // TODO: replace with context variable // Batched Employee
export const BATCHED_PENSION_BUSINESS_ID = '95815c30-0ed1-4ac1-8367-e63829345070'; // TODO: replace with context variable // Batched Employee
export const PENSION_BUSINESS_IDS = [
  BATCHED_PENSION_BUSINESS_ID, // Pension Group
  'af386033-a577-4c9a-880a-d49acd15141d', // מנורה פנסיה
  'fc2ea992-a2be-4f8a-a639-542a81276beb', // מגדל פנסיה
  '6606735b-49ce-4f6f-8d8e-3416fe27528f', // הלמן פנסיה
  '340c3552-0a15-4e22-ba03-19ae9322859c', // איילון פנסיה
];
export const TAX_DEDUCTIONS_BUSINESS_ID = 'f1ade516-4999-4919-9d94-6b013221536d'; // TODO: replace with context variable // מהני
export const SOCIAL_SECURITY_BUSINESS_ID = '6d4b01dd-5a5e-4a43-8e40-e9dadfcc10fa'; // TODO: replace with context variable // בלני
export const SALARY_BATCHED_BUSINESSES = [
  BATCHED_PENSION_BUSINESS_ID,
  BATCHED_EMPLOYEE_BUSINESS_ID,
];

export const ETANA_BUSINESS_ID = '4ea86b9b-1c8f-46de-b25e-532f8e34001c'; // TODO: replace with context variable
export const KRAKEN_BUSINESS_ID = '4d2dd0f9-38ea-4546-9cdf-296ed5b0aef4'; // TODO: replace with context variable
export const ETHERSCAN_BUSINESS_ID = 'f2ae3379-b970-45c9-a998-aced20c25b31'; // TODO: replace with context variable
export const POALIM_BUSINESS_ID = '8fa16264-de32-4592-bffb-64a1914318ad'; // TODO: replace with context variable
export const ISRACARD_BUSINESS_ID = '96dba127-90f4-4407-ae89-5a53afa42ca3'; // TODO: replace with context variable

export const SWIFT_BUSINESS_ID = 'a62a631b-54b2-4bc1-bd61-6672c3c5d45a'; // TODO: replace with context variable

export const INTERNAL_WALLETS_IDS = [
  // TODO: replace with context variable
  KRAKEN_BUSINESS_ID,
  ETHERSCAN_BUSINESS_ID, // etherscan
  ETANA_BUSINESS_ID,
  POALIM_BUSINESS_ID, // poalim
  ISRACARD_BUSINESS_ID, // isracard
];

export const DIVIDEND_WITHHOLDING_TAX_BUSINESS_ID = '8f347f1f-293d-4a88-889a-8043b91f34d5'; // Dividend Withholding Tax // TODO: replace with context variable
export const DIVIDEND_WITHHOLDING_TAX_PERCENTAGE = 0.2;
export const DIVIDEND_TAX_CATEGORY_ID = '4270b157-145e-4b11-ba67-919ab465d4d9'; // Dividend
export const DIVIDEND_PAYMENT_BUSINESS_IDS = [
  '4bcca705-5b47-41c5-ba26-1e42c69cbf0d', // Uri Dividend
  '909fbe3c-0419-44ed-817d-ab774e93748a', // Dotan Dividend
];

export const DIVIDEND_BUSINESS_IDS = [
  // TODO: replace with context variable
  DIVIDEND_WITHHOLDING_TAX_BUSINESS_ID, // Dividend Tax Deduction Origin
  ...DIVIDEND_PAYMENT_BUSINESS_IDS,
];

// salary tax categories
// TODO: replace with context variable
export const ZKUFOT_EXPENSES_TAX_CATEGORY_ID = '01879041-461f-4b92-b0a6-3f868308c832';
export const SOCIAL_SECURITY_EXPENSES_TAX_CATEGORY_ID = 'fb603f38-40ac-49a8-a35f-10178bf638e7';
export const SALARY_EXPENSES_TAX_CATEGORY_ID = '073f703f-d001-4a17-8d9b-94d736f95162';
export const TRAINING_FUND_EXPENSES_TAX_CATEGORY_ID = '40a0cff8-b1f9-4d45-8c00-7c772dc944b6';
export const PENSION_EXPENSES_TAX_CATEGORY_ID = '0baf87a0-e52a-4b5d-aa37-d4cafb0f24d1';
export const COMPENSATION_FUND_EXPENSES_TAX_CATEGORY_ID = '34191f12-c0f2-4d4b-abd5-16c83c461d25';
export const ZKUFOT_INCOME_TAX_CATEGORY_ID = '52d4309c-f26f-4bbb-8413-971160067fb9';

export const BALANCE_CANCELLATION_TAX_CATEGORY_ID = 'fe4b3698-ee5a-4764-a1dc-0c133239fa2b';

export const VAT_BUSINESS_ID = 'c7fdf6f6-e075-44ee-b251-cbefea366826';

// TODO(Gil): implement this in a better way, maybe DB flag
export const VAT_REPORT_EXCLUDED_BUSINESS_NAMES = [
  SOCIAL_SECURITY_BUSINESS_ID, // Social Security Deductions
  '9d3a8a88-6958-4119-b509-d50a7cdc0744', // Tax
  VAT_BUSINESS_ID,
];
