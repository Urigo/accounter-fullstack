import { GraphQLError, GraphQLResolveInfo } from 'graphql';
import { BusinessTripAttendeesProvider } from '@modules/business-trips/providers/business-trips-attendees.provider.js';
import { getChargeType } from '@modules/charges/helpers/charge-type.js';
import type { IGetChargesByIdsResult } from '@modules/charges/types.js';
import { ChargeTypeEnum } from '@shared/enums';
import {
  CommonError,
  Maybe,
  ResolverFn,
  ResolversParentTypes,
  ResolversTypes,
  ResolverTypeWrapper,
} from '@shared/gql-types';
import { LedgerRecordsProto } from '@shared/types';
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
> = async (charge, _, context, __) => {
  try {
    const records = await context.injector
      .get(LedgerProvider)
      .getLedgerRecordsByChargesIdLoader.load(charge.id);

    return {
      records,
      charge,
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
    throw new GraphQLError(`Error loading ledger records for charge ID="${charge.id}"`);
  }
};

export async function ledgerGenerationByCharge(
  charge: IGetChargesByIdsResult,
  params: {
    insertLedgerRecordsIfNotExists: boolean;
  },
  context: GraphQLModules.ModuleContext,
  info: GraphQLResolveInfo,
): Promise<Maybe<ResolverTypeWrapper<CommonError | LedgerRecordsProto>>> {
  if (isChargeLocked(charge, context.adminContext.ledgerLock)) {
    return resolveLockedCharge(charge, params, context, info);
  }
  const chargeType = getChargeType(charge, context);
  switch (chargeType) {
    case ChargeTypeEnum.Common:
      return generateLedgerRecordsForCommonCharge(charge, params, context, info);
    case ChargeTypeEnum.Conversion:
      return generateLedgerRecordsForConversion(charge, params, context, info);
    case ChargeTypeEnum.Salary:
      return generateLedgerRecordsForSalary(charge, params, context, info);
    case ChargeTypeEnum.InternalTransfer:
      return generateLedgerRecordsForInternalTransfer(charge, params, context, info);
    case ChargeTypeEnum.Dividend:
      return generateLedgerRecordsForDividend(charge, params, context, info);
    case ChargeTypeEnum.BusinessTrip:
      return generateLedgerRecordsForBusinessTrip(charge, params, context, info);
    case ChargeTypeEnum.MonthlyVat:
      return generateLedgerRecordsForMonthlyVat(charge, params, context, info);
    case ChargeTypeEnum.BankDeposit:
      return generateLedgerRecordsForBankDeposit(charge, params, context, info);
    case ChargeTypeEnum.ForeignSecurities:
      return generateLedgerRecordsForForeignSecurities(charge, params, context, info);
    case ChargeTypeEnum.CreditcardBankCharge:
      return generateLedgerRecordsForCommonCharge(charge, params, context, info);
    case ChargeTypeEnum.Financial:
      return generateLedgerRecordsForFinancialCharge(charge, params, context, info);
    default:
      throw new Error(`Unknown charge type: ${chargeType}`);
  }
}

export async function ledgerUnbalancedBusinessesByCharge(
  charge: IGetChargesByIdsResult,
  context: GraphQLModules.Context,
): Promise<Set<string> | undefined> {
  const { injector } = context;
  const chargeType = getChargeType(charge, context);
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
