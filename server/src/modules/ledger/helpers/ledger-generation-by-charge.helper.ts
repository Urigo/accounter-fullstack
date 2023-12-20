import { getChargeType } from '@modules/charges/helpers/charge-type.js';
import type { IGetChargesByIdsResult } from '@modules/charges/types.js';
import { generateLedgerRecordsForBusinessTrip } from '../resolvers/business-trip-ledger-generation.resolver.js';
import { generateLedgerRecordsForCommonCharge } from '../resolvers/common-ledger-generation.resolver.js';
import { generateLedgerRecordsForConversion } from '../resolvers/conversion-ledger-generation.resolver.js';
import { generateLedgerRecordsForDividend } from '../resolvers/dividend-ledger-generation.resolver.js';
import { generateLedgerRecordsForInternalTransfer } from '../resolvers/internal-transfer-ledger-generation.resolver.js';
import { generateLedgerRecordsForSalary } from '../resolvers/salary-ledger-generation.resolver.js';

export function ledgerGenerationByCharge(charge: IGetChargesByIdsResult) {
  const chargeType = getChargeType(charge);
  switch (chargeType) {
    case 'CommonCharge':
      return generateLedgerRecordsForCommonCharge;
    case 'ConversionCharge':
      return generateLedgerRecordsForConversion;
    case 'SalaryCharge':
      return generateLedgerRecordsForSalary;
    case 'InternalTransferCharge':
      return generateLedgerRecordsForInternalTransfer;
    case 'DividendCharge':
      return generateLedgerRecordsForDividend;
    case 'BusinessTripCharge':
      return generateLedgerRecordsForBusinessTrip;
    default:
      throw new Error(`Unknown charge type: ${chargeType}`);
  }
}
