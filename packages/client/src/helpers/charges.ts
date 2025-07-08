export function getChargeTypeName(chargeType: string): string {
  let type = 'Unknown';

  switch (chargeType) {
    case 'CommonCharge':
      type = 'Common';
      break;
    case 'BusinessTripCharge':
      type = 'Business Trip';
      break;
    case 'DividendCharge':
      type = 'Dividend';
      break;
    case 'ConversionCharge':
      type = 'Conversion';
      break;
    case 'SalaryCharge':
      type = 'Salary';
      break;
    case 'InternalTransferCharge':
      type = 'Internal Transfer';
      break;
    case 'MonthlyVatCharge':
      type = 'Monthly VAT';
      break;
    case 'BankDepositCharge':
      type = 'Bank Deposit';
      break;
    case 'CreditcardBankCharge':
      type = 'Credit Card Bank Charge';
      break;
    case 'FinancialCharge':
      type = 'Financial Charge';
      break;
  }
  return type;
}
