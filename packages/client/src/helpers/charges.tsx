import { ReactElement } from 'react';
import {
  Coin,
  CreditCard,
  Gift,
  PigMoney,
  Plane,
  ReceiptTax,
  Scale,
  TransferIn,
  Transform,
  Wallet,
} from 'tabler-icons-react';

type ChargeType =
  | 'CommonCharge'
  | 'BusinessTripCharge'
  | 'DividendCharge'
  | 'ConversionCharge'
  | 'SalaryCharge'
  | 'InternalTransferCharge'
  | 'MonthlyVatCharge'
  | 'BankDepositCharge'
  | 'CreditcardBankCharge'
  | 'FinancialCharge';

const CHARGE_TYPE_NAME: Record<ChargeType, string> = {
  CommonCharge: 'Common',
  BusinessTripCharge: 'Business Trip',
  DividendCharge: 'Dividend',
  ConversionCharge: 'Conversion',
  SalaryCharge: 'Salary',
  InternalTransferCharge: 'Internal Transfer',
  MonthlyVatCharge: 'Monthly VAT',
  BankDepositCharge: 'Bank Deposit',
  CreditcardBankCharge: 'Credit Card Bank Charge',
  FinancialCharge: 'Financial Charge',
};

export const getChargeTypeName = (type: ChargeType): string => CHARGE_TYPE_NAME[type] ?? 'Unknown';

const ICON_MAP: Record<ChargeType, ReactElement> = {
  CommonCharge: <Coin />,
  BusinessTripCharge: <Plane />,
  DividendCharge: <Gift />,
  ConversionCharge: <Transform />,
  SalaryCharge: <Wallet />,
  InternalTransferCharge: <TransferIn />,
  MonthlyVatCharge: <ReceiptTax />,
  BankDepositCharge: <PigMoney />,
  CreditcardBankCharge: <CreditCard />,
  FinancialCharge: <Scale />,
};

export const getChargeTypeIcon = (type: ChargeType): ReactElement => ICON_MAP[type] ?? <Coin />;
