import type { Injector } from 'graphql-modules';
import { BusinessTripAttendeesProvider } from '@modules/business-trips/providers/business-trips-attendees.provider.js';
import { getChargeType } from '@modules/charges/helpers/charge-type.js';
import type { IGetChargesByIdsResult } from '@modules/charges/types.js';
import { UnbalancedBusinessesProvider } from '../providers/unbalanced-businesses.provider.js';
import { generateLedgerRecordsForBankDeposit } from '../resolvers/ledger-generation/bank-deposit-ledger-generation.resolver.js';
import { generateLedgerRecordsForBusinessTrip } from '../resolvers/ledger-generation/business-trip-ledger-generation.resolver.js';
import { generateLedgerRecordsForCommonCharge } from '../resolvers/ledger-generation/common-ledger-generation.resolver.js';
import { generateLedgerRecordsForConversion } from '../resolvers/ledger-generation/conversion-ledger-generation.resolver.js';
import { generateLedgerRecordsForDividend } from '../resolvers/ledger-generation/dividend-ledger-generation.resolver.js';
import { generateLedgerRecordsForInternalTransfer } from '../resolvers/ledger-generation/internal-transfer-ledger-generation.resolver.js';
import { generateLedgerRecordsForMonthlyVat } from '../resolvers/ledger-generation/monthly-vat-ledger-generation.resolver.js';
import { generateLedgerRecordsForSalary } from '../resolvers/ledger-generation/salary-ledger-generation.resolver.js';

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
    case 'MonthlyVatCharge':
      return generateLedgerRecordsForMonthlyVat;
    case 'BankDepositCharge':
      return generateLedgerRecordsForBankDeposit;
    case 'CreditcardBankCharge':
      // TODO: implement
      return generateLedgerRecordsForCommonCharge;
    default:
      throw new Error(`Unknown charge type: ${chargeType}`);
  }
}

export async function ledgerUnbalancedBusinessesByCharge(
  charge: IGetChargesByIdsResult,
  injector: Injector,
): Promise<Set<string> | undefined> {
  const chargeType = getChargeType(charge);
  switch (chargeType) {
    case 'CommonCharge': {
      const unbalancedBusinesses = await injector
        .get(UnbalancedBusinessesProvider)
        .getChargeUnbalancedBusinessesByChargeIds.load(charge.id);

      const allowedUnbalancedBusinesses = new Set(
        unbalancedBusinesses.map(({ business_id }) => business_id),
      );
      return allowedUnbalancedBusinesses;
    }
    case 'ConversionCharge':
      return undefined;
    case 'SalaryCharge': {
      const unbalancedBusinesses = await injector
        .get(UnbalancedBusinessesProvider)
        .getChargeUnbalancedBusinessesByChargeIds.load(charge.id);

      const allowedUnbalancedBusinesses = new Set(
        unbalancedBusinesses.map(({ business_id }) => business_id),
      );
      return allowedUnbalancedBusinesses;
    }
    case 'InternalTransferCharge':
      return undefined;
    case 'DividendCharge':
      ///////////
      // TODO //
      //////////
      return undefined;
    case 'BusinessTripCharge': {
      const businessTripAttendees = await injector
        .get(BusinessTripAttendeesProvider)
        .getBusinessTripsAttendeesByChargeIdLoader.load(charge.id);

      const allowedUnbalancedBusinesses = new Set(
        businessTripAttendees.map(attendee => attendee.id),
      );
      return allowedUnbalancedBusinesses;
    }
    case 'MonthlyVatCharge':
      return undefined;
    case 'BankDepositCharge':
      throw new Error('BankDepositCharge is not supported yet');
    case 'CreditcardBankCharge':
      ///////////
      // TODO //
      //////////
      throw new Error('CreditcardBankCharge is not supported yet');
    default:
      throw new Error(`Unknown charge type: ${chargeType}`);
  }
}
