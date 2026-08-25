import { endOfYear, startOfQuarter, startOfYear, subDays, subYears } from 'date-fns';
import {
  ChargeFilterType,
  ChargeSortByField,
  ChargeType,
  FinancialAccountType,
} from '../../../gql/graphql.js';
import { formatTimelessDateString, type TimelessDateString } from '../../../helpers/dates.js';
import type { ChargeFilterFormValues } from './schema.js';

export const chargesTypeFilterOptions: Array<{ label: string; value: ChargeFilterType }> = [
  { label: 'All', value: ChargeFilterType.All },
  { label: 'Income', value: ChargeFilterType.Income },
  { label: 'Expense', value: ChargeFilterType.Expense },
];

export const chargeTypeNameOptions: Array<{ label: string; value: ChargeType }> = [
  { label: 'Bank Deposit', value: ChargeType.BankDeposit },
  { label: 'Business Trip', value: ChargeType.BusinessTrip },
  { label: 'Common', value: ChargeType.Common },
  { label: 'Conversion', value: ChargeType.Conversion },
  { label: 'Credit Card Bank', value: ChargeType.CreditcardBank },
  { label: 'Dividend', value: ChargeType.Dividend },
  { label: 'Financial', value: ChargeType.Financial },
  { label: 'Foreign Securities', value: ChargeType.ForeignSecurities },
  { label: 'Internal Transfer', value: ChargeType.Internal },
  { label: 'Monthly VAT', value: ChargeType.Vat },
  { label: 'Salary', value: ChargeType.Payroll },
];

export const sortFieldOptions: Array<{ label: string; value: ChargeSortByField }> = [
  { label: 'Date', value: ChargeSortByField.Date },
  { label: 'Amount', value: ChargeSortByField.Amount },
  { label: 'Abs Amount', value: ChargeSortByField.AbsAmount },
];

export const ACCOUNT_TYPE_LABELS: Record<FinancialAccountType, string> = {
  [FinancialAccountType.BankAccount]: 'Bank Accounts',
  [FinancialAccountType.CreditCard]: 'Credit Cards',
  [FinancialAccountType.CryptoWallet]: 'Crypto Wallets',
  [FinancialAccountType.BankDepositAccount]: 'Bank Deposits',
  [FinancialAccountType.ForeignSecurities]: 'Foreign Securities',
};

export const ACCOUNT_TYPE_ORDER: readonly string[] = [
  ACCOUNT_TYPE_LABELS[FinancialAccountType.BankAccount],
  ACCOUNT_TYPE_LABELS[FinancialAccountType.CreditCard],
  ACCOUNT_TYPE_LABELS[FinancialAccountType.BankDepositAccount],
  ACCOUNT_TYPE_LABELS[FinancialAccountType.ForeignSecurities],
  ACCOUNT_TYPE_LABELS[FinancialAccountType.CryptoWallet],
];

type DateRange = { fromAnyDate?: TimelessDateString; toAnyDate?: TimelessDateString };

export type DatePreset = { label: string; range: () => DateRange };

export const DATE_PRESETS: DatePreset[] = [
  {
    label: 'Last 30 days',
    range: (): DateRange => ({
      fromAnyDate: formatTimelessDateString(subDays(new Date(), 30)),
      toAnyDate: formatTimelessDateString(new Date()),
    }),
  },
  {
    label: 'This quarter',
    range: (): DateRange => ({
      fromAnyDate: formatTimelessDateString(startOfQuarter(new Date())),
      toAnyDate: formatTimelessDateString(new Date()),
    }),
  },
  {
    label: 'This year',
    range: (): DateRange => ({
      fromAnyDate: formatTimelessDateString(startOfYear(new Date())),
      toAnyDate: formatTimelessDateString(new Date()),
    }),
  },
  {
    label: 'Last year',
    range: (): DateRange => {
      const lastYear = subYears(new Date(), 1);
      return {
        fromAnyDate: formatTimelessDateString(startOfYear(lastYear)),
        toAnyDate: formatTimelessDateString(endOfYear(lastYear)),
      };
    },
  },
  {
    label: 'No range',
    range: (): DateRange => ({ fromAnyDate: undefined, toAnyDate: undefined }),
  },
];

/** Every filter key the form owns, with nothing set. */
export function buildEmptyFormValues(): ChargeFilterFormValues {
  return {
    sortBy: { field: ChargeSortByField.Date, asc: false },
    chargesType: ChargeFilterType.All,
  };
}

/**
 * The values a fresh, unfiltered visit starts from — also the target of the
 * "Reset" button, which is why this is derived in one place rather than inlined.
 */
export function buildDefaultFormValues({
  adminBusinessId,
  withDefaultDateRange,
}: {
  adminBusinessId?: string | null;
  withDefaultDateRange: boolean;
}): ChargeFilterFormValues {
  return {
    ...buildEmptyFormValues(),
    byOwners: adminBusinessId ? [adminBusinessId] : undefined,
    // Screens where the date range is optional (e.g. missing-info charges) start
    // unbounded, so old unresolved charges aren't hidden by a default "last year" window.
    ...(withDefaultDateRange
      ? {
          fromAnyDate: formatTimelessDateString(subYears(new Date(), 1)),
          toAnyDate: formatTimelessDateString(new Date()),
        }
      : {}),
  };
}
