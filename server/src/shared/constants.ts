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
export const TAX_CATEGORIES_WITHOUT_INVOICE_DATE = [
  'f1d58fb2-58be-4bc8-a436-860ab57c5ef3', // אוריח
  // TODO: delete next values after DB migration to business ID done
  'אוריח',
];
export const ENTITIES_WITHOUT_INVOICE_DATE = [
  '147d3415-55e3-497f-acba-352dcc37cb8d', // Uri Goldshtein
  '8fa16264-de32-4592-bffb-64a1914318ad', // Poalim
  '96dba127-90f4-4407-ae89-5a53afa42ca3', // Isracard
  // TODO: delete next values after DB migration to business ID done
  'Uri Goldshtein',
  'Poalim',
  'Isracard',
];
export const ENTITIES_WITHOUT_ACCOUNTING = [
  '96dba127-90f4-4407-ae89-5a53afa42ca3', // Isracard
  'c7fdf6f6-e075-44ee-b251-cbefea366826', // VAT
  '6d4b01dd-5a5e-4a43-8e40-e9dadfcc10fa', // Social Security Deductions
  'f1ade516-4999-4919-9d94-6b013221536d', // Tax Deductions
  '9d3a8a88-6958-4119-b509-d50a7cdc0744', // Tax
  '8f347f1f-293d-4a88-889a-8043b91f34d5', // Dividend Tax Deduction Origin
  '8fa16264-de32-4592-bffb-64a1914318ad', // Poalim
  '0117c1b0-c1f3-4564-9bc5-bdc27a8895f0', // Halman Aldubi Training Fund
  'c80775bc-1028-4836-9599-f5ebccbe5d06', // Uri Goldshtein Hoz
  'd57ff56d-08ef-454b-88e9-37c4e9d0328c', // Halman Aldubi Pension
  '147d3415-55e3-497f-acba-352dcc37cb8d', // Uri Goldshtein
  'ca9d301f-f6db-40a8-a02e-7cf4b63fa2df', // Dotan Employee
  '7843b805-3bb7-4d1c-9219-ff783100334b', // Uri Employee
  'f4b591f3-d817-4e3d-9ecb-35b38d2df7ef', // Gil Employee
  '4420accf-da13-43b0-9aaa-3b94758598e4', // Tuval Employee
  // TODO: delete next values after DB migration to business ID done
  'Isracard',
  'VAT',
  'Social Security Deductions',
  'Tax Deductions',
  'Tax',
  'Dividend Tax Deduction Origin',
  'Poalim',
  'Halman Aldubi Training Fund',
  'Halman Aldubi Pension',
  'Uri Goldshtein Hoz',
  'Uri Goldshtein',
  'Dotan Employee',
  'Uri Employee',
  'Gil Employee',
  'Tuval Employee',
];

// Tax category related
export const VAT_TAX_CATEGORY_NAME = 'מעמ';
export const EXCHANGE_RATE_CATEGORY_NAME = 'Exchange Rates';
export const DEFAULT_LOCAL_CURRENCY = Currency.Ils;
export const DEFAULT_CRYPTO_FIAT_CONVERSION_CURRENCY = Currency.Usd;
