import type { IGetTransactionsByChargeIdsResult } from '@modules/transactions/types';

export function splitFeeTransactions(transactions: Array<IGetTransactionsByChargeIdsResult>) {
  const feeTransactions = [];
  const mainTransactions = [];
  for (const transaction of transactions) {
    if (transaction.is_fee || transaction.business_id === 'a62a631b-54b2-4bc1-bd61-6672c3c5d45a') {
      // TODO: ugly workaround to set swift as fee
      feeTransactions.push(transaction);
    } else {
      mainTransactions.push(transaction);
    }
  }
  return { feeTransactions, mainTransactions };
}

export function isSupplementalFeeTransaction(
  transaction: IGetTransactionsByChargeIdsResult,
): boolean {
  if (!transaction.is_fee) {
    return false;
  }
  if (!transaction.business_id) {
    throw new Error(
      `Transaction ID="${transaction.id}" is missing business_id, which is required to figure if fee is supplemental`,
    );
  }

  // TODO: improve this raw implementation
  const supplementalFeeBusinesses: string[] = [
    'f2ae3379-b970-45c9-a998-aced20c25b31', // etherscan
    '4ea86b9b-1c8f-46de-b25e-532f8e34001c', //etana
  ];
  if (supplementalFeeBusinesses.includes(transaction.business_id)) {
    return true;
  }

  const fundamentalFeeBusinesses: string[] = [
    'a62a631b-54b2-4bc1-bd61-6672c3c5d45a', // swift
  ];
  if (fundamentalFeeBusinesses.includes(transaction.business_id)) {
    return false;
  }
  throw new Error(
    `Unable to determine if business ID="${transaction.business_id}" is supplemental or fundamental fee`,
  );
}
