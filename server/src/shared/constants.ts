import { Currency } from './enums.js';

/* regex of yyyy-mm-dd  */
export const TIMELESS_DATE_REGEX =
  /^((?:1[6-9]|[2]\d)\d{2})(-)(?:((?:0[13578]|1[02])(-31))|(?:(?:0[1,3-9]|1[0-2])(-)(?:29|30)))$|^(?:(?:(?:1[6-9]|[2]\d)(?:0[48]|[2468][048]|[13579][26])|(?:(?:16|[2468][048]|[3579][26])00)))(-02-29)$|^(?:(?:1[6-9]|[2-9]\d)\d{2})(-)(?:(?:0[1-9])|(?:1[0-2]))(-)(?:0[1-9]|1\d|2[0-8])$/;

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
export const VAT_TAX_CATEGORY_NAME = 'מעמ';
export const EXCHANGE_RATE_CATEGORY_NAME = 'Exchange Rates';
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
  SOCIAL_SECURITY_BUSINESS_ID,
  TAX_DEDUCTIONS_BUSINESS_ID,
  BATCHED_PENSION_BUSINESS_ID,
  BATCHED_EMPLOYEE_BUSINESS_ID,
];
