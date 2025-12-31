/**
 * Integration test for factory exports
 *
 * Verifies that all factories can be imported and used together
 * to create a complete data scenario.
 */

import { describe, expect, it } from 'vitest';
import {
  createBusiness,
  createCharge,
  createDocument,
  createFinancialAccount,
  createTaxCategory,
  createTransaction,
  makeUUID,
  formatNumeric,
  isoToday,
  FINANCIAL_ACCOUNT_TYPES,
} from './index.js';
import { UUID_REGEX } from '../../shared/constants.js';

describe('Factory Integration', () => {
  it('should import all factories from index', () => {
    expect(createBusiness).toBeDefined();
    expect(createTaxCategory).toBeDefined();
    expect(createFinancialAccount).toBeDefined();
    expect(createCharge).toBeDefined();
    expect(createTransaction).toBeDefined();
    expect(createDocument).toBeDefined();
    expect(makeUUID).toBeDefined();
    expect(formatNumeric).toBeDefined();
    expect(isoToday).toBeDefined();
    expect(FINANCIAL_ACCOUNT_TYPES).toBeDefined();
  });

  it('should create a complete expense scenario using factories', () => {
    // Setup: Create supporting entities
    const supplierId = makeUUID('business', 'supplier-local');
    const supplier = createBusiness({
      id: supplierId,
      name: 'Local Supplier',
    });

    const taxCategoryId = makeUUID('tax-category', 'tax-expense');
    const taxCategory = createTaxCategory({
      id: taxCategoryId,
      name: 'Expense Tax',
    });

    const accountId = makeUUID('financial-account', 'bank-account');
    const account = createFinancialAccount({
      accountNumber: accountId,
      type: 'BANK_ACCOUNT',
      ownerId: supplierId,
    });

    // Act: Create charge with transaction and document
    const chargeId = makeUUID('charge', 'expense-charge');
    const charge = createCharge(
      {
        owner_id: supplierId,
        tax_category_id: taxCategoryId,
        user_description: 'Office supplies',
      },
      {
        id: chargeId,
      },
    );

    const transaction = createTransaction({
      charge_id: chargeId,
      business_id: supplierId,
      amount: formatNumeric(-500),
      currency: 'ILS',
      event_date: isoToday(),
    });

    const document = createDocument({
      charge_id: chargeId,
      creditor_id: supplierId,
      debtor_id: supplierId,
      type: 'INVOICE',
      total_amount: 500.0,
      currency_code: 'ILS',
      date: isoToday(),
    });

    // Assert: All entities created with correct relationships
    expect(supplier.id).toBe(supplierId);
    expect(taxCategory.id).toBe(taxCategoryId);
    expect(account.accountNumber).toBe(accountId);
    expect(charge.id).toBe(chargeId);
    expect(charge.owner_id).toBe(supplierId);
    expect(charge.tax_category_id).toBe(taxCategoryId);
    expect(transaction.charge_id).toBe(chargeId);
    expect(transaction.business_id).toBe(supplierId);
    expect(document.charge_id).toBe(chargeId);

    // Verify UUID format
    expect(supplier.id).toMatch(UUID_REGEX);
    expect(taxCategory.id).toMatch(UUID_REGEX);
    expect(charge.id).toMatch(UUID_REGEX);
    expect(transaction.id).toMatch(UUID_REGEX);
    expect(document.id).toMatch(UUID_REGEX);
  });

  it('should create deterministic UUIDs with seeds', () => {
    // Create same entities twice with same seeds
    const business1 = createBusiness({ id: makeUUID('business', 'biz-1'), name: 'Business 1' });
    const business2 = createBusiness({ id: makeUUID('business', 'biz-1'), name: 'Business 1' });

    expect(business1.id).toBe(business2.id);
  });

  it('should handle all financial account types', () => {
    const types = FINANCIAL_ACCOUNT_TYPES;

    types.forEach((type, index) => {
      const account = createFinancialAccount({
        type,
        ownerId: makeUUID('business', `owner-${index}`),
      });

      expect(account.type).toBe(type);
      expect(account.accountNumber).toBeDefined();
    });
  });

  it('should handle numeric conversions correctly', () => {
    const transaction = createTransaction({
      charge_id: makeUUID('charge', 'charge-1'),
      business_id: makeUUID('business', 'business-1'),
      amount: -123.45, // Number input
      currency: 'USD',
      event_date: '2024-01-15',
    });

    expect(transaction.amount).toBe('-123.45'); // String output for PostgreSQL
    expect(typeof transaction.amount).toBe('string');
  });

  it('should create documents with different types', () => {
    const chargeId = makeUUID('charge', 'charge-doc');
    const creditorId = makeUUID('business', 'creditor');
    const debtorId = makeUUID('business', 'debtor');

    const invoice = createDocument({
      charge_id: chargeId,
      creditor_id: creditorId,
      debtor_id: debtorId,
      type: 'INVOICE',
      total_amount: 1000.0,
      currency_code: 'ILS',
      date: '2024-01-01',
    });

    const receipt = createDocument({
      charge_id: chargeId,
      creditor_id: creditorId,
      debtor_id: debtorId,
      type: 'RECEIPT',
      total_amount: 1000.0,
      currency_code: 'ILS',
      date: '2024-01-02',
    });

    expect(invoice.type).toBe('INVOICE');
    expect(receipt.type).toBe('RECEIPT');
    expect(invoice.id).not.toBe(receipt.id);
  });

  it('should support partial overrides across all factories', () => {
    const business = createBusiness({
      name: 'Business',
    });

    const taxCategory = createTaxCategory({
      name: 'Category 1',
    });

    const account = createFinancialAccount({
      accountNumber: '123456',
    });

    expect(business.name).toBe('Business');
    expect(business.id).toBeDefined();

    expect(taxCategory.name).toBe('Category 1');
    expect(taxCategory.id).toBeDefined();

    expect(account.accountNumber).toBe('123456');
    expect(account.type).toBeDefined();
  });
});
