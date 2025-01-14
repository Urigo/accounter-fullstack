import { Currency } from './enums.js';

/* regex of yyyy-mm-dd  */
export const TIMELESS_DATE_REGEX =
  /^((?:1[6-9]|[2]\d)\d{2})(-)(?:((?:0[13578]|1[02])(-31))|(?:(?:0[1,3-9]|1[0-2])(-)(?:29|30)))$|^(?:(?:(?:1[6-9]|[2]\d)(?:0[48]|[2468][048]|[13579][26])|(?:(?:16|[2468][048]|[3579][26])00)))(-02-29)$|^(?:(?:1[6-9]|[2-9]\d)\d{2})(-)(?:(?:0[1-9])|(?:1[0-2]))(-)(?:0[1-9]|1\d|2[0-8])$/;

export const UUID_REGEX =
  /^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/;

export const DECREASED_VAT_RATIO = 2 / 3;

export const AVERAGE_MONTHLY_WORK_DAYS = 21.67;
export const AVERAGE_MONTHLY_WORK_HOURS = 182;

export const EMPTY_UUID = '00000000-0000-0000-0000-000000000000';

//////////////////////////////////////////////////////
// TODO: replace all further with context variables //
//////////////////////////////////////////////////////

// Tax category related
export const INPUT_VAT_TAX_CATEGORY_ID = 'b022d08b-62d8-48f7-9203-7c175646dbac';
export const OUTPUT_VAT_TAX_CATEGORY_ID = '7a798add-800d-4a06-87df-d0b85682be19';
export const EXCHANGE_RATE_TAX_CATEGORY_ID = 'a8a80cf2-fca5-4fa6-a944-cfcc0a59a9bf';
export const INCOME_EXCHANGE_RATE_TAX_CATEGORY_ID = '424b7209-1d14-4fb0-96eb-b487ad4f6f91';
export const FEE_TAX_CATEGORY_ID = 'd840ff4d-5713-4e22-b1dd-9c700ff7e8b0';
export const GENERAL_FEE_TAX_CATEGORY_ID = '260b4633-396c-4efa-82e1-2269ce572d75';
export const EXCHANGE_REVALUATION_TAX_CATEGORY_ID = '6156ac60-a0cd-4dee-9208-5439da9d4cd2';
export const TAX_EXPENSES_TAX_CATEGORY_ID = 'c86899cb-d91b-48ed-a6e2-9575f16dd2db';
export const BALANCE_CANCELLATION_TAX_CATEGORY_ID = 'fe4b3698-ee5a-4764-a1dc-0c133239fa2b';
export const BUSINESS_TRIP_TAX_CATEGORY_ID = 'd311c118-a4a3-4b79-8f0c-628d5957a3c6';
export const DEFAULT_TAX_CATEGORY = '0a593022-5d9c-4529-b154-fedefde05bb7';
export const RECOVERY_RESERVE_EXPENSES_TAX_CATEGORY_ID = '2a594abe-c7d4-4890-83f4-884d8e01e54c';
export const RECOVERY_RESERVE_TAX_CATEGORY_ID = '680e9c61-657d-433c-8316-64fc2d008d50';
export const VACATION_RESERVE_EXPENSES_TAX_CATEGORY_ID = '06b0c010-20a4-41e8-8069-7638b6ed2894';
export const VACATION_RESERVE_TAX_CATEGORY_ID = 'b895f83c-2c3a-4a71-9b15-0967fb594a0f';
export const DEVELOPMENT_FOREIGN_TAX_CATEGORY_ID = '54bf7ae2-ac3a-478f-83c3-249379d9b8fd';
export const DEVELOPMENT_LOCAL_TAX_CATEGORY_ID = '1b536125-6788-4038-96f3-d1d86622386c';
export const UNTAXABLE_GIFTS_TAX_CATEGORY_ID = 'ddc6295e-5b12-4402-aeed-4c947e61b0a9';
export const FINE_TAX_CATEGORY_ID = 'd43a53bd-49a4-4955-b12d-82c337b08759';
export const BANK_DEPOSIT_INTEREST_INCOME_TAX_CATEGORY_ID = 'e25e4297-4253-4ce7-80f7-3158c839b141';
export const ACCUMULATED_DEPRECIATION_TAX_CATEGORY_ID = '7df602c4-c472-4159-adde-b7a08a094679';
export const RND_DEPRECIATION_EXPENSES_TAX_CATEGORY_ID = '112525e1-86cf-47f5-a0ec-e756e7b815d2';
export const GNM_DEPRECIATION_EXPENSES_TAX_CATEGORY_ID = '2d398109-4600-4a53-9511-bd610b70e336';
export const MARKETING_DEPRECIATION_EXPENSES_TAX_CATEGORY_ID =
  '3c4be250-5037-43c9-a215-8805f2fd9925';

// cross year tax categories
export const EXPENSES_TO_PAY_TAX_CATEGORY = '4c8f76c5-9eaa-49fa-945e-0652c0f80c20';
export const EXPENSES_IN_ADVANCE_TAX_CATEGORY = 'b334bcd0-ccd5-440c-bf6d-9d05b9dc2e2e';
export const INCOME_TO_COLLECT_TAX_CATEGORY = '7a0e9c28-949d-4b8a-a2fd-c775a3407d01';
export const INCOME_IN_ADVANCE_TAX_CATEGORY = 'ce5f14bb-484b-46f5-ad1a-a6fadcdbea47';

// salary tax categories
export const ZKUFOT_EXPENSES_TAX_CATEGORY_ID = '01879041-461f-4b92-b0a6-3f868308c832';
export const SOCIAL_SECURITY_EXPENSES_TAX_CATEGORY_ID = 'fb603f38-40ac-49a8-a35f-10178bf638e7';
export const SALARY_EXPENSES_TAX_CATEGORY_ID = '073f703f-d001-4a17-8d9b-94d736f95162';
export const TRAINING_FUND_EXPENSES_TAX_CATEGORY_ID = '40a0cff8-b1f9-4d45-8c00-7c772dc944b6';
export const PENSION_EXPENSES_TAX_CATEGORY_ID = '0baf87a0-e52a-4b5d-aa37-d4cafb0f24d1';
export const COMPENSATION_FUND_EXPENSES_TAX_CATEGORY_ID = '34191f12-c0f2-4d4b-abd5-16c83c461d25';
export const ZKUFOT_INCOME_TAX_CATEGORY_ID = '52d4309c-f26f-4bbb-8413-971160067fb9';

export const DEFAULT_LOCAL_CURRENCY = Currency.Ils;
export const DEFAULT_CRYPTO_FIAT_CONVERSION_CURRENCY = Currency.Usd;

export const DEFAULT_FINANCIAL_ENTITY_ID =
  process.env['DEFAULT_FINANCIAL_ENTITY_ID'] ?? '6a20aa69-57ff-446e-8d6a-1e96d095e988';
export const BATCHED_EMPLOYEE_BUSINESS_ID = 'd60321ef-9b91-4907-8bd2-9cfd87c83c0a'; // Batched Employee
export const BATCHED_PENSION_BUSINESS_ID = '95815c30-0ed1-4ac1-8367-e63829345070'; // Batched pension

export const TAX_DEDUCTIONS_BUSINESS_ID = 'f1ade516-4999-4919-9d94-6b013221536d';
export const SOCIAL_SECURITY_BUSINESS_ID = '6d4b01dd-5a5e-4a43-8e40-e9dadfcc10fa';
export const TAX_BUSINESS_ID = '9d3a8a88-6958-4119-b509-d50a7cdc0744';
export const SALARY_BATCHED_BUSINESSES = [
  BATCHED_PENSION_BUSINESS_ID,
  BATCHED_EMPLOYEE_BUSINESS_ID,
];

export const ETANA_BUSINESS_ID = '4ea86b9b-1c8f-46de-b25e-532f8e34001c';
export const KRAKEN_BUSINESS_ID = '4d2dd0f9-38ea-4546-9cdf-296ed5b0aef4';
export const ETHERSCAN_BUSINESS_ID = 'f2ae3379-b970-45c9-a998-aced20c25b31';
export const POALIM_BUSINESS_ID = '8fa16264-de32-4592-bffb-64a1914318ad';
export const ISRACARD_BUSINESS_ID = '96dba127-90f4-4407-ae89-5a53afa42ca3';

export const BANK_DEPOSIT_BUSINESS_ID = '1dedde76-d705-4903-8e40-cfc25bc6e321';

export const SWIFT_BUSINESS_ID = 'a62a631b-54b2-4bc1-bd61-6672c3c5d45a';

export const INTERNAL_WALLETS_IDS = [
  KRAKEN_BUSINESS_ID,
  ETHERSCAN_BUSINESS_ID, // etherscan
  ETANA_BUSINESS_ID, // etana
  POALIM_BUSINESS_ID, // poalim
  ISRACARD_BUSINESS_ID, // isracard
];

export const DIVIDEND_WITHHOLDING_TAX_BUSINESS_ID = '8f347f1f-293d-4a88-889a-8043b91f34d5'; // Dividend Withholding Tax
export const DIVIDEND_WITHHOLDING_TAX_PERCENTAGE = 0.2;
export const DIVIDEND_TAX_CATEGORY_ID = '4270b157-145e-4b11-ba67-919ab465d4d9'; // Dividend
export const DIVIDEND_PAYMENT_BUSINESS_IDS = [
  '4bcca705-5b47-41c5-ba26-1e42c69cbf0d', // Uri Dividend
  '909fbe3c-0419-44ed-817d-ab774e93748a', // Dotan Dividend
];

export const DIVIDEND_BUSINESS_IDS = [
  DIVIDEND_WITHHOLDING_TAX_BUSINESS_ID,
  ...DIVIDEND_PAYMENT_BUSINESS_IDS,
];

export const VAT_BUSINESS_ID = 'c7fdf6f6-e075-44ee-b251-cbefea366826';

export const VAT_REPORT_EXCLUDED_BUSINESS_NAMES = [
  SOCIAL_SECURITY_BUSINESS_ID, // Social Security Deductions
  TAX_BUSINESS_ID, // Tax
  VAT_BUSINESS_ID,
];

export const BUSINESS_TRIP_TAG_ID = '4e73371b-e432-4044-8013-3d61bb269321';
