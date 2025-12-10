import type {
  financial_account_type,
} from '../../modules/financial-accounts/__generated__/financial-accounts.types.js';
import { makeUUIDLegacy } from '../../demo-fixtures/helpers/deterministic-uuid.js';
import { FixtureAccounts } from '__tests__/helpers/fixture-types.js';

/**
 * Valid financial account types
 */
export const FINANCIAL_ACCOUNT_TYPES = [
  'BANK_ACCOUNT',
  'BANK_DEPOSIT_ACCOUNT',
  'CREDIT_CARD',
  'CRYPTO_WALLET',
  'FOREIGN_SECURITIES',
] as const satisfies readonly financial_account_type[];

/**
 * Financial account factory for test fixtures
 *
 * Creates a minimal financial account object ready for insertion via pgtyped.
 *
 * @param overrides - Optional overrides for any financial account field
 * @returns Financial account object matching FixtureAccounts['accounts'][0] shape
 *
 * @remarks
 * - accountNumber defaults to unique numeric string if not provided
 * - name defaults to null (account name optional)
 * - privateBusiness defaults to 'PRIVATE' (most common case)
 * - ownerId defaults to null (must be set to valid business ID before insertion)
 * - type defaults to 'BANK_ACCOUNT' (most common type)
 *
 * @example
 * ```typescript
 * // Minimal bank account
 * const account = createFinancialAccount({
 *   accountNumber: '123456',
 *   ownerId: businessId,
 * });
 *
 * // Credit card account
 * const creditCard = createFinancialAccount({
 *   accountNumber: '4580-****-****-1234',
 *   type: 'CREDIT_CARD',
 *   ownerId: businessId,
 *   name: 'Company Visa',
 * });
 *
 * // Crypto wallet
 * const wallet = createFinancialAccount({
 *   accountNumber: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
 *   type: 'CRYPTO_WALLET',
 *   ownerId: businessId,
 *   privateBusiness: 'BUSINESS',
 * });
 * ```
 */
export function createFinancialAccount(
  overrides?: Partial<FixtureAccounts['accounts'][number]>,
): FixtureAccounts['accounts'][number] {
  return {
    accountNumber: makeUUIDLegacy().slice(0, 13), // Default: unique short string
    name: null,
    privateBusiness: 'PRIVATE',
    ownerId: null,
    type: 'BANK_ACCOUNT',
    ...overrides,
  };
}
