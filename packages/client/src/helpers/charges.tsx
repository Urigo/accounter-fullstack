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
