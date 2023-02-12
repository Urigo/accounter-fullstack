import {
  BankFinancialAccountResolvers,
  CardFinancialAccountResolvers,
  CommonTransactionResolvers,
  ConversionTransactionResolvers,
  FeeTransactionResolvers,
  TransactionDirection,
  WireTransactionResolvers,
} from '../__generated__/types.mjs';
import { formatFinancialAmount } from '../helpers/amount.mjs';
import { effectiveDateSuplement } from '../helpers/misc.mjs';
import {
  getChargeByFinancialAccountNumberLoader,
  getChargesByFinancialAccountNumbers,
} from '../providers/charges.mjs';
import { pool } from '../providers/db.mjs';
import { getFinancialAccountByAccountNumberLoader } from '../providers/financial-accounts.mjs';

export const commonFinancialAccountFields:
  | CardFinancialAccountResolvers
  | BankFinancialAccountResolvers = {
  id: DbAccount => DbAccount.id,
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

export const commonTransactionFields:
  | ConversionTransactionResolvers
  | FeeTransactionResolvers
  | WireTransactionResolvers
  | CommonTransactionResolvers = {
  id: DbTransaction => DbTransaction.id,
  referenceNumber: DbTransaction => DbTransaction.bank_reference ?? 'Missing',
  createdAt: DbTransaction => DbTransaction.event_date,
  effectiveDate: DbTransaction => effectiveDateSuplement(DbTransaction),
  direction: DbTransaction =>
    parseFloat(DbTransaction.event_amount) > 0
      ? TransactionDirection.Credit
      : TransactionDirection.Debit,
  amount: DbTransaction =>
    formatFinancialAmount(DbTransaction.event_amount, DbTransaction.currency_code),
  description: DbTransaction =>
    `${DbTransaction.bank_description} ${DbTransaction.detailed_bank_description}`,
  userNote: DbTransaction => DbTransaction.user_description,
  account: async DbTransaction => {
    // TODO: enhance logic to be based on ID instead of account_number
    if (!DbTransaction.account_number) {
      throw new Error(`Transaction ID="${DbTransaction.id}" is missing account_number`);
    }
    const account = await getFinancialAccountByAccountNumberLoader.load(
      DbTransaction.account_number,
    );
    if (!account) {
      throw new Error(`Account number "${DbTransaction.account_number}" is missing`);
    }
    return account;
  },
  balance: DbTransaction => formatFinancialAmount(DbTransaction.current_balance),
  accountantApproval: DbTransaction => ({
    approved: DbTransaction.reviewed ?? false,
    remark: 'Missing', // TODO: missing in DB
  }),
  hashavshevetId: DbTransaction => DbTransaction.hashavshevet_id,
};
