import type { ReactElement } from 'react';
import {
  ArrowRightLeft,
  Coins,
  CreditCard,
  Gift,
  Globe,
  PiggyBank,
  Plane,
  Receipt,
  Scale,
  TrendingUpDown,
  Wallet,
} from 'lucide-react';
import type { ChargeType as ChargeTypeInput } from '@/gql/graphql';

export type ChargeType =
  | 'CommonCharge'
  | 'BusinessTripCharge'
  | 'DividendCharge'
  | 'ConversionCharge'
  | 'SalaryCharge'
  | 'InternalTransferCharge'
  | 'MonthlyVatCharge'
  | 'BankDepositCharge'
  | 'ForeignSecuritiesCharge'
  | 'CreditcardBankCharge'
  | 'FinancialCharge';

export const CHARGE_TYPE_NAME: Record<ChargeType, string> = {
  CommonCharge: 'Common',
  BusinessTripCharge: 'Business Trip',
  DividendCharge: 'Dividend',
  ConversionCharge: 'Conversion',
  SalaryCharge: 'Salary',
  InternalTransferCharge: 'Internal Transfer',
  MonthlyVatCharge: 'Monthly VAT',
  BankDepositCharge: 'Bank Deposit',
  ForeignSecuritiesCharge: 'Foreign Securities',
  CreditcardBankCharge: 'Credit Card Bank Charge',
  FinancialCharge: 'Financial Charge',
};

export const getChargeTypeName = (type?: ChargeType): string =>
  !type || !(type in CHARGE_TYPE_NAME) ? 'Unknown' : CHARGE_TYPE_NAME[type];

const ICON_MAP: Record<ChargeType, ReactElement> = {
  CommonCharge: <Coins />,
  BusinessTripCharge: <Plane />,
  DividendCharge: <Gift />,
  ConversionCharge: <Globe />,
  SalaryCharge: <Wallet />,
  InternalTransferCharge: <ArrowRightLeft />,
  MonthlyVatCharge: <Receipt />,
  BankDepositCharge: <PiggyBank />,
  ForeignSecuritiesCharge: <TrendingUpDown />,
  CreditcardBankCharge: <CreditCard />,
  FinancialCharge: <Scale />,
};

export const getChargeTypeIcon = (type?: ChargeType): ReactElement =>
  !type || !(type in ICON_MAP) ? <Coins /> : ICON_MAP[type];

/**
 * Hue assigned to each charge type, used by the record's type chip.
 *
 * Colour is the fastest way to pick one type out of a hundred-row list, but the charges surface
 * already spends colour on *state*: amber means "needs attention" (the needs badge, suggestion
 * underlines), emerald means "accept / positive amount", red means "error / negative amount". Those
 * three are therefore deliberately absent here — a Salary charge wearing an amber chip inches from
 * an amber needs badge would make amber stop meaning attention. `charge-indicators.test.tsx` asserts
 * that reservation so a future palette edit cannot quietly reintroduce the collision.
 */
export type ChargeTypeColor =
  | 'indigo'
  | 'violet'
  | 'teal'
  | 'cyan'
  | 'blue'
  | 'orange'
  | 'fuchsia'
  | 'slate'
  | 'purple'
  | 'sky'
  | 'pink';

export const CHARGE_TYPE_COLOR: Record<ChargeType, ChargeTypeColor> = {
  CommonCharge: 'indigo',
  CreditcardBankCharge: 'violet',
  ConversionCharge: 'teal',
  InternalTransferCharge: 'cyan',
  BusinessTripCharge: 'blue',
  BankDepositCharge: 'orange',
  ForeignSecuritiesCharge: 'fuchsia',
  FinancialCharge: 'slate',
  SalaryCharge: 'purple',
  MonthlyVatCharge: 'sky',
  DividendCharge: 'pink',
};

/** Falls back to the most neutral hue for an unrecognised `__typename`. */
export const getChargeTypeColor = (type?: ChargeType): ChargeTypeColor =>
  !type || !(type in CHARGE_TYPE_COLOR) ? 'slate' : CHARGE_TYPE_COLOR[type];

export function getChargeTypeInputValue(type: ChargeType): ChargeTypeInput {
  switch (type) {
    case 'CommonCharge':
      return 'COMMON';
    case 'BusinessTripCharge':
      return 'BUSINESS_TRIP';
    case 'DividendCharge':
      return 'DIVIDEND';
    case 'ConversionCharge':
      return 'CONVERSION';
    case 'SalaryCharge':
      return 'PAYROLL';
    case 'InternalTransferCharge':
      return 'INTERNAL';
    case 'MonthlyVatCharge':
      return 'VAT';
    case 'BankDepositCharge':
      return 'BANK_DEPOSIT';
    case 'ForeignSecuritiesCharge':
      return 'FOREIGN_SECURITIES';
    case 'CreditcardBankCharge':
      return 'CREDITCARD_BANK';
    case 'FinancialCharge':
      return 'FINANCIAL';
    default:
      throw new Error(`Unsupported charge type: ${type}`);
  }
}
