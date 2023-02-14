import { IGetChargesByIdsResult } from '../../../__generated__/charges.types.js';
import { TransactionDirection } from '../../../__generated__/types.js';
import { formatFinancialAmount } from '../../../helpers/amount.js';
import { effectiveDateSupplement } from '../../../helpers/misc.js';
import {
  getChargeByFinancialAccountNumberLoader,
  getChargeByFinancialEntityIdLoader,
  getChargeByIdLoader,
  getChargesByFinancialAccountNumbers,
  getChargesByFinancialEntityIds,
} from '../../../providers/charges.js';
import { pool } from '../../../providers/db.js';
import type { ChargesModule } from '../__generated__/types.js';

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
  charge: async documentRoot => {
    if (!documentRoot.charge_id) {
      return null;
    }
    const charge = await getChargeByIdLoader.load(documentRoot.charge_id);
    return charge ?? null;
  },
};

export const commonFinancialAccountFields:
  | ChargesModule.CardFinancialAccountResolvers
  | ChargesModule.BankFinancialAccountResolvers = {
  charges: async (DbAccount, { filter }) => {
    if (!filter || Object.keys(filter).length === 0) {
      const charges = await getChargeByFinancialAccountNumberLoader.load(DbAccount.account_number);
      return charges;
    }
    const charges = await getChargesByFinancialAccountNumbers.run(
      {
        financialAccountNumbers: [DbAccount.account_number],
        fromDate: filter?.fromDate,
        toDate: filter?.toDate,
      },
      pool,
    );
    return charges;
  },
};

export const commonFinancialEntityFields:
  | ChargesModule.LtdFinancialEntityResolvers
  | ChargesModule.PersonalFinancialEntityResolvers = {
  charges: async (DbBusiness, { filter, page, limit }) => {
    const charges: IGetChargesByIdsResult[] = [];
    if (!filter || Object.keys(filter).length === 0) {
      const newCharges = await getChargeByFinancialEntityIdLoader.load(DbBusiness.id);
      charges.push(...newCharges);
    } else {
      const newCharges = await getChargesByFinancialEntityIds.run(
        {
          financialEntityIds: [DbBusiness.id],
          fromDate: filter?.fromDate,
          toDate: filter?.toDate,
        },
        pool,
      );
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
