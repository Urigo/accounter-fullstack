import { GraphQLError } from 'graphql';
import { BusinessTripAttendeesProvider } from '@modules/business-trips/providers/business-trips-attendees.provider.js';
import { getChargeType } from '@modules/charges/helpers/charge-type.js';
import { ChargeTypeEnum } from '@shared/enums';
import { Maybe, ResolverFn, ResolversParentTypes, ResolversTypes } from '@shared/gql-types';
import { LedgerProvider } from '../providers/ledger.provider.js';
import { UnbalancedBusinessesProvider } from '../providers/unbalanced-businesses.provider.js';
import { generateLedgerRecordsForBankDeposit } from '../resolvers/ledger-generation/bank-deposit-ledger-generation.resolver.js';
import { generateLedgerRecordsForBusinessTrip } from '../resolvers/ledger-generation/business-trip-ledger-generation.resolver.js';
import { generateLedgerRecordsForCommonCharge } from '../resolvers/ledger-generation/common-ledger-generation.resolver.js';
import { generateLedgerRecordsForConversion } from '../resolvers/ledger-generation/conversion-ledger-generation.resolver.js';
import { generateLedgerRecordsForDividend } from '../resolvers/ledger-generation/dividend-ledger-generation.resolver.js';
import { generateLedgerRecordsForFinancialCharge } from '../resolvers/ledger-generation/financial-ledger-generation.resolver.js';
import { generateLedgerRecordsForForeignSecurities } from '../resolvers/ledger-generation/foreign-securities-ledger-generation.resolver.js';
import { generateLedgerRecordsForInternalTransfer } from '../resolvers/ledger-generation/internal-transfer-ledger-generation.resolver.js';
import { generateLedgerRecordsForMonthlyVat } from '../resolvers/ledger-generation/monthly-vat-ledger-generation.resolver.js';
import { generateLedgerRecordsForSalary } from '../resolvers/ledger-generation/salary-ledger-generation.resolver.js';
import { isChargeLocked } from './ledger-lock.js';

const resolveLockedCharge: ResolverFn<
  Maybe<ResolversTypes['GeneratedLedgerRecords']>,
  ResolversParentTypes['Charge'],
  GraphQLModules.Context,
  object
> = async (chargeId, _, context, __) => {
  try {
    const records = await context.injector
      .get(LedgerProvider)
      .getLedgerRecordsByChargesIdLoader.load(chargeId);

    return {
      records,
      chargeId,
      balance: {
        isBalanced: true,
        unbalancedEntities: [],
        balanceSum: 0,
        financialEntities: [],
      },
      errors: [],
    };
  } catch (e) {
    console.error(e);
    throw new GraphQLError(`Error loading ledger records for charge ID="${chargeId}"`);
  }
};

export async function ledgerGenerationByCharge(chargeId: string, context: GraphQLModules.Context) {
  if (await isChargeLocked(chargeId, context.injector, context.adminContext.ledgerLock)) {
    return resolveLockedCharge;
  }
  const chargeType = await getChargeType(chargeId, context);
  switch (chargeType) {
    case ChargeTypeEnum.Common:
      return generateLedgerRecordsForCommonCharge;
    case ChargeTypeEnum.Conversion:
      return generateLedgerRecordsForConversion;
    case ChargeTypeEnum.Salary:
      return generateLedgerRecordsForSalary;
    case ChargeTypeEnum.InternalTransfer:
      return generateLedgerRecordsForInternalTransfer;
    case ChargeTypeEnum.Dividend:
      return generateLedgerRecordsForDividend;
    case ChargeTypeEnum.BusinessTrip:
      return generateLedgerRecordsForBusinessTrip;
    case ChargeTypeEnum.MonthlyVat:
      return generateLedgerRecordsForMonthlyVat;
    case ChargeTypeEnum.BankDeposit:
      return generateLedgerRecordsForBankDeposit;
    case ChargeTypeEnum.ForeignSecurities:
      return generateLedgerRecordsForForeignSecurities;
    case ChargeTypeEnum.CreditcardBankCharge:
      return generateLedgerRecordsForCommonCharge;
    case ChargeTypeEnum.Financial:
      return generateLedgerRecordsForFinancialCharge;
    default:
      throw new Error(`Unknown charge type: ${chargeType}`);
  }
}

export async function ledgerUnbalancedBusinessesByCharge(
  chargeId: string,
  context: GraphQLModules.Context,
): Promise<Set<string> | undefined> {
  const { injector } = context;
  const chargeType = await getChargeType(chargeId, context);
  switch (chargeType) {
    case 'CommonCharge': {
      const unbalancedBusinesses = await injector
        .get(UnbalancedBusinessesProvider)
        .getChargeUnbalancedBusinessesByChargeIds.load(chargeId);

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
        .getChargeUnbalancedBusinessesByChargeIds.load(chargeId);

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
        .getBusinessTripsAttendeesByChargeIdLoader.load(chargeId);

      const allowedUnbalancedBusinesses = new Set(
        businessTripAttendees.map(attendee => attendee.id),
      );
      return allowedUnbalancedBusinesses;
    }
    case 'MonthlyVatCharge':
      return undefined;
    case 'BankDepositCharge':
      throw new Error('Bank Deposit Charge is not supported yet');
    case 'ForeignSecuritiesCharge':
      throw new Error('Foreign Securities Charge is not supported yet');
    case 'CreditcardBankCharge':
      throw new Error('Credit Card Bank Charge is not supported yet');
    case 'FinancialCharge':
      throw new Error('Financial Charge is not supported yet');
    default:
      throw new Error(`Unknown charge type: ${chargeType}`);
  }
}
