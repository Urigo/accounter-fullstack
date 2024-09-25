import { Currency } from '@shared/enums';
import type { TimelessDateString } from '@shared/types';

export * from './__generated__/types.js';

export type MonthDataProto = {
  date: TimelessDateString;
  income: number;
  expense: number;
  balance: number;
  currency: Currency;
};
