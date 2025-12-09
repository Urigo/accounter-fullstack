import { Currency } from '../../shared/enums.js';
import type { TimelessDateString } from '../../shared/types/index.js';

export * from './__generated__/types.js';

export type MonthDataProto = {
  date: TimelessDateString;
  income: number;
  expense: number;
  balance: number;
  currency: Currency;
};
