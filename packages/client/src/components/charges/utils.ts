import type { ChargeType } from '../../helpers/index.js';

export function shouldHaveVat(chargeType: ChargeType): boolean {
  switch (chargeType) {
    case 'BusinessTripCharge':
    case 'DividendCharge':
    case 'ConversionCharge':
    case 'SalaryCharge':
    case 'InternalTransferCharge':
    case 'BankDepositCharge':
    case 'ForeignSecuritiesCharge':
    case 'CreditcardBankCharge':
      return false;
  }
  return true;
}

export function shouldHaveCounterparty(chargeType: ChargeType): boolean {
  switch (chargeType) {
    case 'BusinessTripCharge':
    case 'DividendCharge':
    case 'ConversionCharge':
    case 'SalaryCharge':
    case 'InternalTransferCharge':
      return false;
  }
  return true;
}

export function shouldHaveTaxCategory(chargeType: ChargeType): boolean {
  switch (chargeType) {
    case 'DividendCharge':
    case 'InternalTransferCharge':
    case 'SalaryCharge':
    case 'BankDepositCharge':
    case 'ForeignSecuritiesCharge':
      return false;
  }
  return true;
}
