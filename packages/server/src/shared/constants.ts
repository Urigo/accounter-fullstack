/* regex of yyyy-mm-dd  */
export const TIMELESS_DATE_REGEX =
  /^((?:1[6-9]|[2]\d)\d{2})(-)(?:((?:0[13578]|1[02])(-31))|(?:(?:0[1,3-9]|1[0-2])(-)(?:29|30)))$|^(?:(?:(?:1[6-9]|[2]\d)(?:0[48]|[2468][048]|[13579][26])|(?:(?:16|[2468][048]|[3579][26])00)))(-02-29)$|^(?:(?:1[6-9]|[2-9]\d)\d{2})(-)(?:(?:0[1-9])|(?:1[0-2]))(-)(?:0[1-9]|1\d|2[0-8])$/;

export const UUID_REGEX =
  /^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/;

export const DECREASED_VAT_RATIO = 2 / 3;

export const AVERAGE_MONTHLY_WORK_DAYS = 21.67;
export const AVERAGE_MONTHLY_WORK_HOURS = 182;

export const EMPTY_UUID = '00000000-0000-0000-0000-000000000000';

export const DIVIDEND_WITHHOLDING_TAX_PERCENTAGE = 0.2;
