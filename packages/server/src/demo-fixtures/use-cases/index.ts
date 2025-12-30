import type { UseCaseSpec } from '../../fixtures/fixture-spec.js';
import { shareholderDividend } from './equity/shareholder-dividend.js';
import { monthlyExpenseForeignCurrency } from './expenses/monthly-expense-foreign-currency.js';
import { clientPaymentWithRefund } from './income/client-payment-with-refund.js';

/**
 * Central registry of all demo use-cases organized by category.
 *
 * Each category contains an array of use-case specifications that will be
 * seeded into the staging environment. Use-cases are processed in the order
 * they appear in each category array.
 *
 * @example
 * ```typescript
 * // Adding a new use-case:
 * import { monthlyExpense } from './expenses/monthly-expense.js';
 *
 * export const USE_CASE_REGISTRY: Record<string, UseCaseSpec[]> = {
 *   expenses: [monthlyExpense],
 *   income: [],
 *   equity: [],
 * };
 * ```
 */
export const USE_CASE_REGISTRY: Record<string, UseCaseSpec[]> = {
  expenses: [monthlyExpenseForeignCurrency],
  equity: [shareholderDividend],
  income: [clientPaymentWithRefund],
};

/**
 * Get all registered use-cases across all categories.
 *
 * This function flattens the registry into a single array, maintaining
 * the order: expenses first, then income, then equity (based on object
 * key insertion order).
 *
 * @returns Array of all use-case specifications
 *
 * @example
 * ```typescript
 * const allUseCases = getAllUseCases();
 * console.log(`Total use-cases: ${allUseCases.length}`);
 *
 * allUseCases.forEach(useCase => {
 *   console.log(`${useCase.category}: ${useCase.name}`);
 * });
 * ```
 */
export function getAllUseCases(): UseCaseSpec[] {
  return Object.values(USE_CASE_REGISTRY).flat();
}
