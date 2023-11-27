import { GraphQLError } from 'graphql';
import type { IGetFinancialAccountsByAccountIDsResult } from '@modules/financial-accounts/types';
import type { IGetTransactionsByChargeIdsResult } from '@modules/transactions/types';
import { Currency } from '@shared/enums';
import { formatCurrency } from '@shared/helpers';

export function isTransactionsOppositeSign(
  first: IGetTransactionsByChargeIdsResult,
  second: IGetTransactionsByChargeIdsResult,
) {
  const firstAmount = Number(first.amount);
  const secondAmount = Number(second.amount);
  if (Number.isNaN(firstAmount) || Number.isNaN(secondAmount)) {
    throw new Error('Transaction amount is not a number');
  }
  return Number(first.amount) > 0 !== Number(second.amount) > 0;
}

export function getTaxCategoryNameByAccountCurrency(
  account: IGetFinancialAccountsByAccountIDsResult,
  currency: Currency,
): string {
  let taxCategoryName = account.hashavshevet_account_ils;
  switch (currency) {
    case Currency.Ils:
      taxCategoryName = account.hashavshevet_account_ils;
      break;
    case Currency.Usd:
      taxCategoryName = account.hashavshevet_account_usd;
      break;
    case Currency.Eur:
      taxCategoryName = account.hashavshevet_account_eur;
      break;
    case Currency.Gbp:
      taxCategoryName = account.hashavshevet_account_gbp;
      break;
    case Currency.Usdc:
    case Currency.Grt:
    case Currency.Eth:
      taxCategoryName = account.hashavshevet_account_ils;
      break;
    default:
      console.error(`Unknown currency for account's tax category: ${currency}`);
  }
  if (!taxCategoryName) {
    throw new GraphQLError(`Account ID="${account.id}" is missing tax category name`);
  }
  return taxCategoryName;
}

export function validateTransactionBasicVariables(transaction: IGetTransactionsByChargeIdsResult) {
  const currency = formatCurrency(transaction.currency);
  if (!transaction.debit_date) {
    throw new GraphQLError(
      `Transaction ID="${transaction.id}" is missing debit date for currency ${currency}`,
    );
  }
  const valueDate = transaction.debit_timestamp
    ? new Date(transaction.debit_timestamp)
    : transaction.debit_date;

  if (!transaction.business_id) {
    throw new GraphQLError(`Transaction ID="${transaction.id}" is missing business_id`);
  }

  const transactionBusinessId = transaction.business_id;

  return {
    currency,
    valueDate,
    transactionBusinessId,
  };
}
