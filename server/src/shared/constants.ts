/* regex of yyyy-mm-dd  */
export const TIMELESS_DATE_REGEX =
  /^((?:1[6-9]|[2]\d)\d{2})(-)(?:((?:0[13578]|1[02])(-31))|(?:(?:0[1,3-9]|1[0-2])(-)(?:29|30)))$|^(?:(?:(?:1[6-9]|[2]\d)(?:0[48]|[2468][048]|[13579][26])|(?:(?:16|[2468][048]|[3579][26])00)))(-02-29)$|^(?:(?:1[6-9]|[2-9]\d)\d{2})(-)(?:(?:0[1-9])|(?:1[0-2]))(-)(?:0[1-9]|1\d|2[0-8])$/;

export const TAX_CATEGORIES_WITH_NOT_FULL_VAT = ['פלאפון', 'מידע', 'מחשבים'];
export const ENTITIES_WITHOUT_INVOICE_DATE = ['Uri Goldshtein', 'Poalim', 'Isracard'];
export const TAX_CATEGORIES_WITHOUT_INVOICE_DATE = ['אוריח'];
export const ENTITIES_WITHOUT_ACCOUNTING = [
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
