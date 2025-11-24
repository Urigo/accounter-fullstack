import { describe, it, expect } from 'vitest';
import { expenseScenarioB } from './expense-scenario-b';
import { validateFixture } from '../../helpers/fixture-validation';
import { makeUUID } from '../../factories/ids';
import { CountryCode } from '../../../modules/countries/types.js';
import { Currency } from '../../../shared/enums.js';

describe('Expense Scenario B - USD Invoice', () => {
  it('fixture should compile and be well-formed', () => {
    expect(expenseScenarioB).toBeDefined();
    expect(expenseScenarioB.businesses).toBeDefined();
    expect(expenseScenarioB.taxCategories).toBeDefined();
    expect(expenseScenarioB.accounts).toBeDefined();
    expect(expenseScenarioB.accountTaxCategories).toBeDefined();
    expect(expenseScenarioB.charges).toBeDefined();
    expect(expenseScenarioB.transactions).toBeDefined();
    expect(expenseScenarioB.documents).toBeDefined();
    expect(expenseScenarioB.expectations).toBeDefined();
  });

  it('fixture should validate successfully', () => {
    const result = validateFixture(expenseScenarioB);
    if (!result.ok) {
      console.error('Validation errors:', result.errors);
    }
    expect(result.ok).toBe(true);
  });

  it('should have correct structure counts', () => {
    expect(expenseScenarioB.businesses?.businesses).toHaveLength(2); // Admin + US Vendor
    expect(expenseScenarioB.taxCategories?.taxCategories).toHaveLength(2); // Consulting expense + USD account
    expect(expenseScenarioB.accounts?.accounts).toHaveLength(1); // USD account
    expect(expenseScenarioB.accountTaxCategories?.mappings).toHaveLength(1); // USD account → tax category
    expect(expenseScenarioB.charges?.charges).toHaveLength(1); // Consulting charge
    expect(expenseScenarioB.transactions?.transactions).toHaveLength(1); // Payment in USD
    expect(expenseScenarioB.documents?.documents).toHaveLength(1); // Invoice in USD
    expect(expenseScenarioB.expectations?.ledger).toHaveLength(1); // Ledger expectation
  });

  it('should have correct business entities', () => {
    const businesses = expenseScenarioB.businesses!.businesses;
    const admin = businesses.find(b => b.id === makeUUID('admin-business-usd'));
    const supplier = businesses.find(b => b.id === makeUUID('supplier-us-vendor-llc'));

    expect(admin).toBeDefined();
    expect(admin?.country).toBe(CountryCode.Israel);

    expect(supplier).toBeDefined();
    expect(supplier?.country).toBe(CountryCode['United States of America (the)']);
    expect(supplier?.isReceiptEnough).toBe(false); // Requires invoice
  });

  it('should have referential integrity between charge, transaction, and document', () => {
    const chargeId = makeUUID('charge-consulting-services');
    const charge = expenseScenarioB.charges!.charges[0];
    const transaction = expenseScenarioB.transactions!.transactions[0];
    const document = expenseScenarioB.documents!.documents[0];

    expect(charge.id).toBe(chargeId);
    expect(transaction.charge_id).toBe(chargeId);
    expect(document.charge_id).toBe(chargeId);
  });

  it('should use USD currency for transaction and document', () => {
    const transaction = expenseScenarioB.transactions!.transactions[0];
    const document = expenseScenarioB.documents!.documents[0];

    expect(transaction.currency).toBe(Currency.Usd);
    expect(document.currency_code).toBe(Currency.Usd);
  });

  it('should have matching USD amounts', () => {
    const transaction = expenseScenarioB.transactions!.transactions[0];
    const document = expenseScenarioB.documents!.documents[0];

    // Transaction is negative (outflow), document is positive
    expect(transaction.amount).toBe('-200.00');
    expect(document.total_amount).toBe(200.0);
  });

  it('should have matching dates', () => {
    const transaction = expenseScenarioB.transactions!.transactions[0];
    const document = expenseScenarioB.documents!.documents[0];

    expect(transaction.event_date).toBe('2024-01-20');
    expect(document.date).toBe('2024-01-20');
  });

  it('should use INVOICE document type for foreign transaction', () => {
    const document = expenseScenarioB.documents!.documents[0];
    expect(document.type).toBe('INVOICE');
  });

  it('should have ledger expectations with exchange rate', () => {
    const ledgerExpectation = expenseScenarioB.expectations!.ledger![0];

    expect(ledgerExpectation.chargeId).toBe(makeUUID('charge-consulting-services'));
    expect(ledgerExpectation.recordCount).toBe(2);
    expect(ledgerExpectation.balanced).toBe(true);
    expect(ledgerExpectation.foreignCurrency).toBe('USD');
    expect(ledgerExpectation.foreignAmount).toBe(200.0);
    expect(ledgerExpectation.exchangeRate).toBe(3.5);
  });

  it('should have correct ILS conversion in expectations', () => {
    const ledgerExpectation = expenseScenarioB.expectations!.ledger![0];

    // 200 USD × 3.5 ILS/USD = 700 ILS per entry × 2 entries = 1400 ILS total
    // Ledger processes document and transaction separately
    expect(ledgerExpectation.totalDebitLocal).toBe(1400.0);
    expect(ledgerExpectation.totalCreditLocal).toBe(1400.0);
  });

  it('should have correct tax categories', () => {
    const ledgerExpectation = expenseScenarioB.expectations!.ledger![0];
    const debitEntity = ledgerExpectation.debitEntities![0];
    const creditEntity = ledgerExpectation.creditEntities![0];

    expect(debitEntity).toBe(makeUUID('expense-consulting'));
    expect(creditEntity).toBe(makeUUID('usd-account-tax-category'));
  });

  it('should have USD account mapped to tax category', () => {
    const accountMapping = expenseScenarioB.accountTaxCategories?.mappings[0];
    expect(accountMapping?.accountNumber).toBe('USD-ACCOUNT-001');
    expect(accountMapping?.currency).toBe(Currency.Usd);
      expect(accountMapping?.taxCategoryId).toBe(makeUUID('usd-account-tax-category'));
  });
});
