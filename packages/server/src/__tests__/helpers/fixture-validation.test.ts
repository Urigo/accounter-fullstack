import { describe, expect, it } from 'vitest';
import { createBusiness } from '../factories/business.js';
import { createCharge } from '../factories/charge.js';
import { createDocument } from '../factories/document.js';
import { createFinancialAccount } from '../factories/financial-account.js';
import { createTaxCategory } from '../factories/tax-category.js';
import { createTransaction } from '../factories/transaction.js';
import { makeUUID } from '../../demo-fixtures/helpers/deterministic-uuid.js';
import type { Fixture } from './fixture-types.js';
import { assertValidFixture, validateFixture } from './fixture-validation.js';

describe('Fixture Validation', () => {
  describe('validateFixture', () => {
    it('should validate a complete valid fixture', () => {
      const ownerId = makeUUID('business', 'admin');
      const supplierId = makeUUID('business', 'supplier');
      const taxCatId = makeUUID('tax-category', 'tax-cat');
      const chargeId = makeUUID('charge', 'charge');
      const accountId = makeUUID('account', 'account');

      const fixture: Fixture = {
        businesses: {
          businesses: [
            createBusiness({ id: ownerId, name: 'Admin' }),
            createBusiness({ id: supplierId, name: 'Supplier' }),
          ],
        },
        taxCategories: {
          taxCategories: [createTaxCategory({ id: taxCatId, name: 'Tax Category' })],
        },
        accounts: {
          accounts: [createFinancialAccount({ accountNumber: accountId, ownerId: ownerId })],
        },
        charges: {
          charges: [
            createCharge({ owner_id: ownerId }, { id: chargeId, tax_category_id: taxCatId }),
          ],
        },
        transactions: {
          transactions: [
            createTransaction({
              charge_id: chargeId,
              business_id: supplierId,
              amount: '-100.00',
              currency: 'ILS',
              event_date: '2024-01-15',
              owner_id: ownerId,
            }),
          ],
        },
        documents: {
          documents: [
            createDocument({
              charge_id: chargeId,
              creditor_id: supplierId,
              debtor_id: ownerId,
              type: 'RECEIPT',
              total_amount: 100.0,
              currency_code: 'ILS',
              date: '2024-01-15',
              owner_id: ownerId,
            }),
          ],
        },
      };

      const result = validateFixture(fixture);
      expect(result.ok).toBe(true);
    });

    it('should validate a minimal fixture with just charges', () => {
      const ownerId = makeUUID('business', 'admin');
      const chargeId = makeUUID('charge', 'charge');
      const taxCatId = makeUUID('tax-category', 'tax-cat');

      const fixture: Fixture = {
        businesses: {
          businesses: [createBusiness({ id: ownerId, name: 'Admin' })],
        },
        taxCategories: {
          taxCategories: [createTaxCategory({ id: taxCatId, name: 'Tax Category' })],
        },
        charges: {
          charges: [
            createCharge({ owner_id: ownerId }, { id: chargeId, tax_category_id: taxCatId }),
          ],
        },
      };

      const result = validateFixture(fixture);
      expect(result.ok).toBe(true);
    });

    it('should fail when transaction references non-existent charge', () => {
      const ownerId = makeUUID('business', 'admin');
      const supplierId = makeUUID('business', 'supplier');
      const nonExistentChargeId = makeUUID('charge', 'non-existent-charge');

      const fixture: Fixture = {
        businesses: {
          businesses: [createBusiness({ id: ownerId, name: 'Admin' }), createBusiness({ id: supplierId, name: 'Supplier' })],
        },
        transactions: {
          transactions: [
            createTransaction({
              charge_id: nonExistentChargeId,
              business_id: supplierId,
              amount: '-100.00',
              currency: 'ILS',
              event_date: '2024-01-15',
              owner_id: ownerId,
            }),
          ],
        },
      };

      const result = validateFixture(fixture);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors).toContain(
          `Transaction ${fixture.transactions!.transactions[0].id} references non-existent charge: ${nonExistentChargeId}`,
        );
      }
    });

    it('should fail when document references non-existent charge', () => {
      const ownerId = makeUUID('business', 'admin');
      const supplierId = makeUUID('business', 'supplier');
      const nonExistentChargeId = makeUUID('charge', 'non-existent-charge');

      const fixture: Fixture = {
        businesses: {
          businesses: [createBusiness({ id: ownerId, name: 'Admin' }), createBusiness({ id: supplierId, name: 'Supplier' })],
        },
        documents: {
          documents: [
            createDocument({
              charge_id: nonExistentChargeId,
              creditor_id: supplierId,
              debtor_id: ownerId,
              type: 'INVOICE',
              total_amount: 100.0,
              currency_code: 'ILS',
              date: '2024-01-15',
              owner_id: ownerId,
            }),
          ],
        },
      };

      const result = validateFixture(fixture);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors).toContain(
          `Document ${fixture.documents!.documents[0].id} references non-existent charge: ${nonExistentChargeId}`,
        );
      }
    });

    it('should fail when charge references non-existent business', () => {
      const nonExistentBusinessId = makeUUID('business', 'non-existent-business');
      const chargeId = makeUUID('charge', 'charge');

      const fixture: Fixture = {
        charges: {
          charges: [
            createCharge({ owner_id: nonExistentBusinessId }, { id: chargeId }),
          ],
        },
      };

      const result = validateFixture(fixture);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors).toContain(
          `Charge ${chargeId} references non-existent business: ${nonExistentBusinessId}`,
        );
      }
    });

    it('should fail when charge references non-existent tax category', () => {
      const ownerId = makeUUID('business', 'admin');
      const chargeId = makeUUID('charge', 'charge');
      const nonExistentTaxCatId = makeUUID('tax-category', 'non-existent-tax-cat');

      const fixture: Fixture = {
        businesses: {
          businesses: [createBusiness({ id: ownerId, name: 'Admin' })],
        },
        charges: {
          charges: [
            createCharge(
              { owner_id: ownerId },
              { id: chargeId, tax_category_id: nonExistentTaxCatId },
            ),
          ],
        },
      };

      const result = validateFixture(fixture);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors).toContain(
          `Charge ${chargeId} references non-existent tax category: ${nonExistentTaxCatId}`,
        );
      }
    });

    it('should fail when transaction references non-existent business', () => {
      const ownerId = makeUUID('business', 'admin');
      const chargeId = makeUUID('charge', 'charge');
      const nonExistentBusinessId = makeUUID('business', 'non-existent-business');

      const fixture: Fixture = {
        businesses: {
          businesses: [createBusiness({ id: ownerId, name: 'Admin' })],
        },
        charges: {
          charges: [createCharge({ owner_id: ownerId }, { id: chargeId })],
        },
        transactions: {
          transactions: [
            createTransaction({
              charge_id: chargeId,
              business_id: nonExistentBusinessId,
              amount: '-100.00',
              currency: 'ILS',
              event_date: '2024-01-15',
              owner_id: ownerId,
            }),
          ],
        },
      };

      const result = validateFixture(fixture);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors).toContain(
          `Transaction ${fixture.transactions!.transactions[0].id} references non-existent business: ${nonExistentBusinessId}`,
        );
      }
    });

    it('should fail when document references non-existent creditor', () => {
      const ownerId = makeUUID('business', 'admin');
      const chargeId = makeUUID('charge', 'charge');
      const nonExistentCreditorId = makeUUID('business', 'non-existent-creditor');

      const fixture: Fixture = {
        businesses: {
          businesses: [createBusiness({ id: ownerId, name: 'Admin' })],
        },
        charges: {
          charges: [createCharge({ owner_id: ownerId }, { id: chargeId })],
        },
        documents: {
          documents: [
            createDocument({
              charge_id: chargeId,
              creditor_id: nonExistentCreditorId,
              debtor_id: ownerId,
              type: 'INVOICE',
              total_amount: 100.0,
              currency_code: 'ILS',
              date: '2024-01-15',
              owner_id: ownerId,
            }),
          ],
        },
      };

      const result = validateFixture(fixture);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors).toContain(
          `Document ${fixture.documents!.documents[0].id} references non-existent business: ${nonExistentCreditorId}`,
        );
      }
    });

    it('should fail when document references non-existent debtor', () => {
      const ownerId = makeUUID('business', 'admin');
      const supplierId = makeUUID('business', 'supplier');
      const chargeId = makeUUID('charge', 'charge');
      const nonExistentDebtorId = makeUUID('business', 'non-existent-debtor');

      const fixture: Fixture = {
        businesses: {
          businesses: [createBusiness({ id: ownerId, name: 'Admin' }), createBusiness({ id: supplierId, name: 'Supplier' })],
        },
        charges: {
          charges: [createCharge({ owner_id: ownerId }, { id: chargeId })],
        },
        documents: {
          documents: [
            createDocument({
              charge_id: chargeId,
              creditor_id: supplierId,
              debtor_id: nonExistentDebtorId,
              type: 'INVOICE',
              total_amount: 100.0,
              currency_code: 'ILS',
              date: '2024-01-15',
              owner_id: ownerId,
            }),
          ],
        },
      };

      const result = validateFixture(fixture);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors).toContain(
          `Document ${fixture.documents!.documents[0].id} references non-existent business: ${nonExistentDebtorId}`,
        );
      }
    });

    it('should fail when charge is missing owner_id', () => {
      const chargeId = makeUUID('charge', 'charge');

      const fixture: Fixture = {
        charges: {
          charges: [
            {
              id: chargeId,
              owner_id: '', // Missing
              type: null,
              accountant_status: null,
              user_description: null,
              tax_category_id: null,
              optional_vat: null,
              documents_optional_flag: null,
            },
          ],
        },
      };

      const result = validateFixture(fixture);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors).toContain(`Charge ${chargeId} missing required field: owner_id`);
      }
    });

    it('should fail when transaction is missing required fields', () => {
      const ownerId = makeUUID('business', 'admin');
      const chargeId = makeUUID('charge', 'charge');

      const fixture: Fixture = {
        businesses: {
          businesses: [createBusiness({ id: ownerId, name: 'Admin' })],
        },
        charges: {
          charges: [createCharge({ owner_id: ownerId }, { id: chargeId })],
        },
        transactions: {
          transactions: [
            {
              id: makeUUID('transaction', 'tx'),
              account_id: makeUUID('account', 'account'),
              charge_id: '', // Missing
              source_id: makeUUID('source', 'source'),
              currency: '', // Missing
              event_date: '', // Missing
              amount: '', // Will be caught as missing
              current_balance: '0',
              business_id: null, // Missing
              is_fee: false,
              owner_id: ownerId,
            },
          ],
        },
      };

      const result = validateFixture(fixture);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors.length).toBeGreaterThan(0);
        // Should have errors for missing charge_id, business_id, currency, event_date
        const errorText = result.errors.join('\n');
        expect(errorText).toContain('charge_id');
        expect(errorText).toContain('business_id');
        expect(errorText).toContain('currency');
        expect(errorText).toContain('event_date');
      }
    });

    it('should fail when document is missing required fields', () => {
      const ownerId = makeUUID('business', 'admin');
      const chargeId = makeUUID('charge', 'charge');

      const fixture: Fixture = {
        businesses: {
          businesses: [createBusiness({ id: ownerId, name: 'Admin' })],
        },
        charges: {
          charges: [createCharge({ owner_id: ownerId }, { id: chargeId })],
        },
        documents: {
          documents: [
            {
              id: makeUUID('document', 'doc'),
              charge_id: '', // Missing
              creditor_id: '', // Missing
              debtor_id: '', // Missing
              type: '', // Missing
              total_amount: 0, // Should fail as missing (0 is not valid)
              currency_code: '', // Missing
              date: '', // Missing
              image_url: null,
              file_url: null,
              serial_number: null,
              vat_amount: null,
              vat_report_date_override: null,
              no_vat_amount: null,
              allocation_number: null,
              exchange_rate_override: null,
              file_hash: null,
              owner_id: ownerId,
            },
          ],
        },
      };

      const result = validateFixture(fixture);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors.length).toBeGreaterThan(0);
        // Should have errors for multiple missing fields
        const errorText = result.errors.join('\n');
        expect(errorText).toContain('charge_id');
        expect(errorText).toContain('creditor_id');
        expect(errorText).toContain('debtor_id');
        expect(errorText).toContain('type');
        expect(errorText).toContain('currency_code');
        expect(errorText).toContain('date');
      }
    });

    it('should detect duplicate business IDs', () => {
      const duplicateId = makeUUID('business', 'duplicate-business');

      const fixture: Fixture = {
        businesses: {
          businesses: [
            createBusiness({ id: duplicateId, name: 'Duplicate Business' }),
            createBusiness({ id: duplicateId, name: 'Duplicate Business' }), // Duplicate
          ],
        },
      };

      const result = validateFixture(fixture);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors).toContain(`Duplicate business id: ${duplicateId}`);
      }
    });

    it('should detect duplicate charge IDs', () => {
      const ownerId = makeUUID('business', 'admin');
      const duplicateChargeId = makeUUID('charge', 'duplicate-charge');

      const fixture: Fixture = {
        businesses: {
          businesses: [createBusiness({ id: ownerId, name: 'Admin' })],
        },
        charges: {
          charges: [
            createCharge({ owner_id: ownerId }, { id: duplicateChargeId }),
            createCharge({ owner_id: ownerId }, { id: duplicateChargeId }), // Duplicate
          ],
        },
      };

      const result = validateFixture(fixture);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors).toContain(`Duplicate charge id: ${duplicateChargeId}`);
      }
    });

    it('should validate financial account owner reference', () => {
      const nonExistentOwnerId = makeUUID('business', 'non-existent-owner');
      const accountNumber = makeUUID('account', 'account');

      const fixture: Fixture = {
        accounts: {
          accounts: [
            createFinancialAccount({ accountNumber, ownerId: nonExistentOwnerId }),
          ],
        },
      };

      const result = validateFixture(fixture);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors).toContain(
          `Financial account ${accountNumber} references non-existent business: ${nonExistentOwnerId}`,
        );
      }
    });

    it('should allow financial account without owner', () => {
      const accountNumber = makeUUID('account', 'account');

      const fixture: Fixture = {
        accounts: {
          accounts: [createFinancialAccount({ accountNumber, ownerId: null })],
        },
      };

      const result = validateFixture(fixture);
      expect(result.ok).toBe(true);
    });
  });

  describe('misc expenses, exchange rates and depreciation', () => {
    const ownerId = makeUUID('business', 'depreciation-owner');
    const chargeId = makeUUID('charge', 'asset-purchase');
    const categoryId = makeUUID('depreciation-category', 'computers');
    const recordId = makeUUID('depreciation', 'laptop');
    const assetAccountId = makeUUID('tax-category', 'computers');

    const base = (): Fixture => ({
      businesses: { businesses: [createBusiness({ id: ownerId, name: 'Owner' })] },
      taxCategories: {
        taxCategories: [createTaxCategory({ id: assetAccountId, name: 'Computers' })],
      },
      charges: {
        charges: [createCharge({ owner_id: ownerId }, { id: chargeId, tax_category_id: null })],
      },
      exchangeRates: { rates: [{ date: '2024-01-01', usd: 3.6 }] },
      depreciationCategories: {
        categories: [{ id: categoryId, name: 'Computers', percentage: 33 }],
      },
      miscExpenses: {
        expenses: [
          {
            id: makeUUID('misc-expense', 'laptop'),
            chargeId,
            ownerId,
            amount: '1000',
            currency: 'USD',
            creditorId: ownerId,
            debtorId: assetAccountId,
            invoiceDate: '2024-01-01',
            valueDate: '2024-01-01 00:00:00',
          },
        ],
      },
      depreciationRecords: {
        records: [
          {
            id: recordId,
            chargeId,
            ownerId,
            categoryId,
            amount: '1000',
            currency: 'USD',
            activationDate: '2024-01-01',
            assetTaxCategoryId: assetAccountId,
          },
        ],
      },
      depreciationDisposals: {
        disposals: [
          {
            id: makeUUID('depreciation-disposal', 'laptop-refund'),
            ownerId,
            depreciationId: recordId,
            chargeId,
            type: 'COST_REFUND',
            refundMode: 'FROM_ACTIVATION',
            disposalDate: '2024-06-01',
            originalAmount: '100',
            originalCurrency: 'USD',
          },
        ],
      },
    });

    it('accepts well-formed sections', () => {
      expect(validateFixture(base())).toEqual({ ok: true });
    });

    it('accepts disposals of assets inserted by an earlier fixture', () => {
      const { depreciationDisposals } = base();
      expect(validateFixture({ depreciationDisposals })).toEqual({ ok: true });
    });

    it('checks references to sections the fixture defines', () => {
      const fixture = base();
      fixture.depreciationRecords!.records[0].categoryId = makeUUID('depreciation-category', 'x');
      fixture.depreciationRecords!.records[0].assetTaxCategoryId = makeUUID('tax-category', 'x');
      fixture.depreciationDisposals!.disposals[0].depreciationId = makeUUID('depreciation', 'x');
      fixture.miscExpenses!.expenses[0].chargeId = makeUUID('charge', 'x');

      const result = validateFixture(fixture);
      expect(result.ok).toBe(false);
      expect(!result.ok && result.errors).toEqual([
        `Misc expense ${makeUUID('misc-expense', 'laptop')} references non-existent charge: ${makeUUID('charge', 'x')}`,
        `Depreciation record ${recordId} references non-existent depreciation category: ${makeUUID('depreciation-category', 'x')}`,
        `Depreciation record ${recordId} references non-existent tax category: ${makeUUID('tax-category', 'x')}`,
        `Depreciation disposal ${makeUUID('depreciation-disposal', 'laptop-refund')} references non-existent depreciation record: ${makeUUID('depreciation', 'x')}`,
      ]);
    });

    it('rejects malformed disposals, categories and rates', () => {
      const fixture = base();
      const disposalId = makeUUID('depreciation-disposal', 'laptop-refund');
      fixture.depreciationDisposals!.disposals[0] = {
        ...fixture.depreciationDisposals!.disposals[0],
        type: 'SALE',
        disposedCost: '100',
        originalCurrency: null,
      };
      fixture.depreciationCategories!.categories[0].percentage = 120;
      fixture.exchangeRates!.rates.push({ date: '2024-01-01', usd: 0 });

      const result = validateFixture(fixture);
      expect(!result.ok && result.errors).toEqual([
        'Duplicate exchange rate date: 2024-01-01',
        'Exchange rate 2024-01-01 has a rate that is not positive',
        `Depreciation category ${categoryId} percentage must be between 0 and 100`,
        `Depreciation disposal ${disposalId} has a refund mode but is not a cost refund`,
        `Depreciation disposal ${disposalId} must give originalAmount and originalCurrency together`,
        `Depreciation disposal ${disposalId} has an amount in the asset's currency but is not a cost refund`,
        `Depreciation disposal ${disposalId} must give either disposedCost or originalAmount`,
      ]);
    });
  });

  describe('assertValidFixture', () => {
    it('should not throw for valid fixture', () => {
      const ownerId = makeUUID('business', 'admin');
      const chargeId = makeUUID('charge', 'charge');
      const taxCatId = makeUUID('tax-category', 'tax-cat');

      const fixture: Fixture = {
        businesses: {
          businesses: [createBusiness({ id: ownerId, name: 'Admin' })],
        },
        taxCategories: {
          taxCategories: [createTaxCategory({ id: taxCatId, name: 'Tax Category' })],
        },
        charges: {
          charges: [
            createCharge({ owner_id: ownerId }, { id: chargeId, tax_category_id: taxCatId }),
          ],
        },
      };

      expect(() => assertValidFixture(fixture)).not.toThrow();
    });

    it('should throw for invalid fixture with formatted error message', () => {
      const nonExistentBusinessId = makeUUID('business', 'non-existent-business');
      const chargeId = makeUUID('charge', 'charge');

      const fixture: Fixture = {
        charges: {
          charges: [createCharge({ owner_id: nonExistentBusinessId }, { id: chargeId })],
        },
      };

      expect(() => assertValidFixture(fixture)).toThrow('Fixture validation failed');
      expect(() => assertValidFixture(fixture)).toThrow(
        `Charge ${chargeId} references non-existent business: ${nonExistentBusinessId}`,
      );
    });
  });
});
