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
      const adminId = makeUUID('business', 'admin');
      const supplierId = makeUUID('business', 'supplier');
      const taxCatId = makeUUID('tax-category', 'tax-cat');
      const chargeId = makeUUID('charge', 'charge');
      const accountId = makeUUID('account', 'account');

      const fixture: Fixture = {
        businesses: {
          businesses: [
            createBusiness({ id: adminId }),
            createBusiness({ id: supplierId }),
          ],
        },
        taxCategories: {
          taxCategories: [createTaxCategory({ id: taxCatId })],
        },
        accounts: {
          accounts: [createFinancialAccount({ accountNumber: accountId, ownerId: adminId })],
        },
        charges: {
          charges: [
            createCharge({ owner_id: adminId }, { id: chargeId, tax_category_id: taxCatId }),
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
            }),
          ],
        },
        documents: {
          documents: [
            createDocument({
              charge_id: chargeId,
              creditor_id: supplierId,
              debtor_id: adminId,
              type: 'RECEIPT',
              total_amount: 100.0,
              currency_code: 'ILS',
              date: '2024-01-15',
            }),
          ],
        },
      };

      const result = validateFixture(fixture);
      expect(result.ok).toBe(true);
    });

    it('should validate a minimal fixture with just charges', () => {
      const adminId = makeUUID('business', 'admin');
      const chargeId = makeUUID('charge', 'charge');
      const taxCatId = makeUUID('tax-category', 'tax-cat');

      const fixture: Fixture = {
        businesses: {
          businesses: [createBusiness({ id: adminId })],
        },
        taxCategories: {
          taxCategories: [createTaxCategory({ id: taxCatId })],
        },
        charges: {
          charges: [
            createCharge({ owner_id: adminId }, { id: chargeId, tax_category_id: taxCatId }),
          ],
        },
      };

      const result = validateFixture(fixture);
      expect(result.ok).toBe(true);
    });

    it('should fail when transaction references non-existent charge', () => {
      const adminId = makeUUID('business', 'admin');
      const supplierId = makeUUID('business', 'supplier');
      const nonExistentChargeId = makeUUID('charge', 'non-existent-charge');

      const fixture: Fixture = {
        businesses: {
          businesses: [createBusiness({ id: adminId }), createBusiness({ id: supplierId })],
        },
        transactions: {
          transactions: [
            createTransaction({
              charge_id: nonExistentChargeId,
              business_id: supplierId,
              amount: '-100.00',
              currency: 'ILS',
              event_date: '2024-01-15',
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
      const adminId = makeUUID('business', 'admin');
      const supplierId = makeUUID('business', 'supplier');
      const nonExistentChargeId = makeUUID('charge', 'non-existent-charge');

      const fixture: Fixture = {
        businesses: {
          businesses: [createBusiness({ id: adminId }), createBusiness({ id: supplierId })],
        },
        documents: {
          documents: [
            createDocument({
              charge_id: nonExistentChargeId,
              creditor_id: supplierId,
              debtor_id: adminId,
              type: 'INVOICE',
              total_amount: 100.0,
              currency_code: 'ILS',
              date: '2024-01-15',
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
      const adminId = makeUUID('business', 'admin');
      const chargeId = makeUUID('charge', 'charge');
      const nonExistentTaxCatId = makeUUID('tax-category', 'non-existent-tax-cat');

      const fixture: Fixture = {
        businesses: {
          businesses: [createBusiness({ id: adminId })],
        },
        charges: {
          charges: [
            createCharge(
              { owner_id: adminId },
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
      const adminId = makeUUID('business', 'admin');
      const chargeId = makeUUID('charge', 'charge');
      const nonExistentBusinessId = makeUUID('business', 'non-existent-business');

      const fixture: Fixture = {
        businesses: {
          businesses: [createBusiness({ id: adminId })],
        },
        charges: {
          charges: [createCharge({ owner_id: adminId }, { id: chargeId })],
        },
        transactions: {
          transactions: [
            createTransaction({
              charge_id: chargeId,
              business_id: nonExistentBusinessId,
              amount: '-100.00',
              currency: 'ILS',
              event_date: '2024-01-15',
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
      const adminId = makeUUID('business', 'admin');
      const chargeId = makeUUID('charge', 'charge');
      const nonExistentCreditorId = makeUUID('business', 'non-existent-creditor');

      const fixture: Fixture = {
        businesses: {
          businesses: [createBusiness({ id: adminId })],
        },
        charges: {
          charges: [createCharge({ owner_id: adminId }, { id: chargeId })],
        },
        documents: {
          documents: [
            createDocument({
              charge_id: chargeId,
              creditor_id: nonExistentCreditorId,
              debtor_id: adminId,
              type: 'INVOICE',
              total_amount: 100.0,
              currency_code: 'ILS',
              date: '2024-01-15',
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
      const adminId = makeUUID('business', 'admin');
      const supplierId = makeUUID('business', 'supplier');
      const chargeId = makeUUID('charge', 'charge');
      const nonExistentDebtorId = makeUUID('business', 'non-existent-debtor');

      const fixture: Fixture = {
        businesses: {
          businesses: [createBusiness({ id: adminId }), createBusiness({ id: supplierId })],
        },
        charges: {
          charges: [createCharge({ owner_id: adminId }, { id: chargeId })],
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
      const adminId = makeUUID('business', 'admin');
      const chargeId = makeUUID('charge', 'charge');

      const fixture: Fixture = {
        businesses: {
          businesses: [createBusiness({ id: adminId })],
        },
        charges: {
          charges: [createCharge({ owner_id: adminId }, { id: chargeId })],
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
      const adminId = makeUUID('business', 'admin');
      const chargeId = makeUUID('charge', 'charge');

      const fixture: Fixture = {
        businesses: {
          businesses: [createBusiness({ id: adminId })],
        },
        charges: {
          charges: [createCharge({ owner_id: adminId }, { id: chargeId })],
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
            createBusiness({ id: duplicateId }),
            createBusiness({ id: duplicateId }), // Duplicate
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
      const adminId = makeUUID('business', 'admin');
      const duplicateChargeId = makeUUID('charge', 'duplicate-charge');

      const fixture: Fixture = {
        businesses: {
          businesses: [createBusiness({ id: adminId })],
        },
        charges: {
          charges: [
            createCharge({ owner_id: adminId }, { id: duplicateChargeId }),
            createCharge({ owner_id: adminId }, { id: duplicateChargeId }), // Duplicate
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

  describe('assertValidFixture', () => {
    it('should not throw for valid fixture', () => {
      const adminId = makeUUID('business', 'admin');
      const chargeId = makeUUID('charge', 'charge');
      const taxCatId = makeUUID('tax-category', 'tax-cat');

      const fixture: Fixture = {
        businesses: {
          businesses: [createBusiness({ id: adminId })],
        },
        taxCategories: {
          taxCategories: [createTaxCategory({ id: taxCatId })],
        },
        charges: {
          charges: [
            createCharge({ owner_id: adminId }, { id: chargeId, tax_category_id: taxCatId }),
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
