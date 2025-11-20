/**
 * Validation tests for Expense Scenario A
 *
 * These tests verify that the scenario fixture is well-formed and passes
 * validation checks before attempting database insertion.
 */

import { describe, expect, it } from 'vitest';
import { assertValidFixture, validateFixture } from '../../helpers/fixture-validation';
import { expenseScenarioA } from './expense-scenario-a';

describe('Expense Scenario A Fixture', () => {
  it('should compile and be properly typed', () => {
    // TypeScript compilation ensures this - if it compiles, types are correct
    expect(expenseScenarioA).toBeDefined();
    expect(expenseScenarioA.businesses).toBeDefined();
    expect(expenseScenarioA.charges).toBeDefined();
    expect(expenseScenarioA.transactions).toBeDefined();
    expect(expenseScenarioA.documents).toBeDefined();
  });

  it('should have expected structure', () => {
    expect(expenseScenarioA.businesses?.businesses).toHaveLength(2); // Admin + supplier
    expect(expenseScenarioA.taxCategories?.taxCategories).toHaveLength(2); // Expense + bank
    expect(expenseScenarioA.charges?.charges).toHaveLength(1);
    expect(expenseScenarioA.transactions?.transactions).toHaveLength(1);
    expect(expenseScenarioA.documents?.documents).toHaveLength(1);
  });

  it('should pass fixture validation', () => {
    const result = validateFixture(expenseScenarioA);

    if (!result.ok) {
      console.error('Validation errors:', result.errors);
    }

    expect(result.ok).toBe(true);
  });

  it('should pass assertValidFixture without throwing', () => {
    expect(() => assertValidFixture(expenseScenarioA)).not.toThrow();
  });

  it('should have matching IDs between charge and transaction', () => {
    const charge = expenseScenarioA.charges?.charges[0];
    const transaction = expenseScenarioA.transactions?.transactions[0];

    expect(charge?.id).toBeDefined();
    expect(transaction?.charge_id).toBe(charge?.id);
  });

  it('should have matching IDs between charge and document', () => {
    const charge = expenseScenarioA.charges?.charges[0];
    const document = expenseScenarioA.documents?.documents[0];

    expect(charge?.id).toBeDefined();
    expect(document?.charge_id).toBe(charge?.id);
  });

  it('should have matching business ID between transaction and business', () => {
    const supplier = expenseScenarioA.businesses?.businesses[1]; // Supplier is second business
    const transaction = expenseScenarioA.transactions?.transactions[0];

    expect(supplier?.id).toBeDefined();
    expect(transaction?.business_id).toBe(supplier?.id);
  });

  it('should have matching amounts between transaction and document', () => {
    const transaction = expenseScenarioA.transactions?.transactions[0];
    const document = expenseScenarioA.documents?.documents[0];

    // Transaction is negative (outflow), document is positive
    expect(transaction?.amount).toBe('-500.00');
    expect(document?.total_amount).toBe(500.0);
  });

  it('should have ILS currency for both transaction and document', () => {
    const transaction = expenseScenarioA.transactions?.transactions[0];
    const document = expenseScenarioA.documents?.documents[0];

    expect(transaction?.currency).toBe('ILS');
    expect(document?.currency_code).toBe('ILS');
  });

  it('should have matching dates between transaction and document', () => {
    const transaction = expenseScenarioA.transactions?.transactions[0];
    const document = expenseScenarioA.documents?.documents[0];

    expect(transaction?.event_date).toBe('2024-01-15');
    expect(document?.date).toBe('2024-01-15');
  });

  it('should have ledger expectations defined', () => {
    expect(expenseScenarioA.expectations).toBeDefined();
    expect(expenseScenarioA.expectations?.ledger).toBeDefined();
    expect(expenseScenarioA.expectations?.ledger).toHaveLength(1);

    const ledgerExpectation = expenseScenarioA.expectations?.ledger?.[0];
    expect(ledgerExpectation?.recordCount).toBe(2);
    expect(ledgerExpectation?.balanced).toBe(true);
    expect(ledgerExpectation?.totalDebitLocal).toBe(500.0);
    expect(ledgerExpectation?.totalCreditLocal).toBe(500.0);
  });
});
