import { describe, expect, it } from 'vitest';
import type { AdminContext } from '../../../admin-context/types.js';
import type { IGetTransactionsByChargeIdsResult } from '../../../transactions/types.js';
import { isSupplementalFeeTransaction } from '../fee-transactions.js';
import { LedgerError } from '../utils.helper.js';

const GENERAL_SECURITIES_BUSINESS_ID = 'general-securities';
const SECURITY_BUSINESS_ID = 'security-aapl';
const SWIFT_BUSINESS_ID = 'swift';

/**
 * Only the fields the classification reads. Security businesses join `internalWalletsIds`
 * in AdminContextProvider — see admin-context-security-businesses.integration.test.ts.
 */
const financialAccounts = {
  internalWalletsIds: [GENERAL_SECURITIES_BUSINESS_ID, SECURITY_BUSINESS_ID],
  swiftBusinessId: SWIFT_BUSINESS_ID,
} as unknown as AdminContext['financialAccounts'];

const feeTransaction = (businessId: string | null) =>
  ({
    id: 't1',
    is_fee: true,
    business_id: businessId,
    source_reference: 'foreign_securities',
  }) as unknown as IGetTransactionsByChargeIdsResult;

describe('isSupplementalFeeTransaction', () => {
  it('classifies a fee against the general foreign-securities business as supplemental', () => {
    expect(isSupplementalFeeTransaction(feeTransaction(GENERAL_SECURITIES_BUSINESS_ID), financialAccounts)).toBe(
      true,
    );
  });

  it('classifies a fee against a per-security business as supplemental too', () => {
    // The counterparty of a securities movement is now the security itself; the fee side of
    // that charge must keep classifying the same way, or its ledger entry flips direction.
    expect(isSupplementalFeeTransaction(feeTransaction(SECURITY_BUSINESS_ID), financialAccounts)).toBe(true);
  });

  it('keeps a Swift fee fundamental', () => {
    expect(isSupplementalFeeTransaction(feeTransaction(SWIFT_BUSINESS_ID), financialAccounts)).toBe(
      false,
    );
  });

  it('is not a fee at all when the transaction is a main one', () => {
    const mainTransaction = {
      ...feeTransaction(SECURITY_BUSINESS_ID),
      is_fee: false,
    } as IGetTransactionsByChargeIdsResult;

    expect(isSupplementalFeeTransaction(mainTransaction, financialAccounts)).toBe(false);
  });

  it('refuses to guess for an unknown business', () => {
    expect(() => isSupplementalFeeTransaction(feeTransaction('some-supplier'), financialAccounts)).toThrow(
      LedgerError,
    );
  });

  it('refuses to guess without a counterparty', () => {
    expect(() => isSupplementalFeeTransaction(feeTransaction(null), financialAccounts)).toThrow(
      LedgerError,
    );
  });
});
