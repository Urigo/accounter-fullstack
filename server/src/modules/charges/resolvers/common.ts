import { TransactionDirection } from '@shared/gql-types';
import { formatFinancialAmount } from '@shared/helpers';
import { effectiveDateSupplement } from '../helpers/validate.helper.js';
import { ChargesProvider } from '../providers/charges.provider.js';
import type { ChargesModule, IGetChargesByIdsResult } from '../types.js';

export const commonTransactionFields:
  | ChargesModule.ConversionTransactionResolvers
  | ChargesModule.FeeTransactionResolvers
  | ChargesModule.WireTransactionResolvers
  | ChargesModule.CommonTransactionResolvers = {
  id: DbTransaction => DbTransaction.id,
  referenceNumber: DbTransaction => DbTransaction.bank_reference ?? 'Missing',
  createdAt: DbTransaction => DbTransaction.event_date,
  effectiveDate: DbTransaction => effectiveDateSupplement(DbTransaction),
  direction: DbTransaction =>
    parseFloat(DbTransaction.event_amount) > 0
      ? TransactionDirection.Credit
      : TransactionDirection.Debit,
  amount: DbTransaction =>
    formatFinancialAmount(DbTransaction.event_amount, DbTransaction.currency_code),
  description: DbTransaction =>
    `${DbTransaction.bank_description} ${DbTransaction.detailed_bank_description}`,
  userNote: DbTransaction => DbTransaction.user_description,
  balance: DbTransaction => formatFinancialAmount(DbTransaction.current_balance),
};

export const commonDocumentsFields: ChargesModule.DocumentResolvers = {
  charge: async (documentRoot, _, { injector }) => {
    if (!documentRoot.charge_id) {
      return null;
    }
    const charge = await injector
      .get(ChargesProvider)
      .getChargeByIdLoader.load(documentRoot.charge_id);
    return charge ?? null;
  },
};

export const commonFinancialAccountFields:
  | ChargesModule.CardFinancialAccountResolvers
  | ChargesModule.BankFinancialAccountResolvers = {
  charges: async (DbAccount, { filter }, { injector }) => {
    if (!filter || Object.keys(filter).length === 0) {
      const charges = await injector
        .get(ChargesProvider)
        .getChargeByFinancialAccountNumberLoader.load(DbAccount.account_number);
      return charges;
    }
    const charges = await injector.get(ChargesProvider).getChargesByFinancialAccountNumbers({
      financialAccountNumbers: [DbAccount.account_number],
      fromDate: filter?.fromDate,
      toDate: filter?.toDate,
    });
    return charges;
  },
};

export const commonFinancialEntityFields:
  | ChargesModule.LtdFinancialEntityResolvers
  | ChargesModule.PersonalFinancialEntityResolvers = {
  charges: async (DbBusiness, { filter, page, limit }, { injector }) => {
    const charges: IGetChargesByIdsResult[] = [];
    if (!filter || Object.keys(filter).length === 0) {
      const newCharges = await injector
        .get(ChargesProvider)
        .getChargeByFinancialEntityIdLoader.load(DbBusiness.id);
      charges.push(...newCharges);
    } else {
      const newCharges = await injector.get(ChargesProvider).getChargesByFinancialEntityIds({
        financialEntityIds: [DbBusiness.id],
        fromDate: filter?.fromDate,
        toDate: filter?.toDate,
      });
      charges.push(...newCharges);
    }
    return {
      __typename: 'PaginatedCharges',
      nodes: charges.slice(page * limit - limit, page * limit),
      pageInfo: {
        totalPages: Math.ceil(charges.length / limit),
      },
    };
  },
};
