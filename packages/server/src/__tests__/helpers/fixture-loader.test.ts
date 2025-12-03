/**
 * Tests for fixture loader insertion logic
 *
 * Validates ordered insertion, savepoint rollback, and error handling.
 */

import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import type { Pool } from 'pg';
import { insertFixture } from './fixture-loader.js';
import { withTestTransaction } from './test-transaction.js';
import { connectTestDb, closeTestDb } from './db-connection.js';
import { qualifyTable } from './test-db-config.js';
import type { Fixture } from './fixture-types.js';
import {
  createBusiness,
  createTaxCategory,
  createFinancialAccount,
  createCharge,
  createTransaction,
  createDocument,
} from '../factories/index.js';
import { makeUUID } from '../../demo-fixtures/helpers/deterministic-uuid.js';

describe('Fixture Loader', () => {
  let pool: Pool;

  beforeAll(async () => {
    pool = await connectTestDb();
  });

  afterAll(async () => {
    await closeTestDb();
  });

  describe('insertFixture', () => {
    it('should insert a complete minimal fixture successfully', () =>
      withTestTransaction(pool, async client => {
        const businessId = makeUUID('business', 'test-business-1');
        const taxCategoryId = makeUUID('tax-category', 'test-tax-cat-1');
        const chargeId = makeUUID('charge', 'test-charge-1');

        const fixture: Fixture = {
          businesses: {
            businesses: [
              createBusiness({
                id: businessId,
                name: 'Test Business',
              }),
            ],
          },
          taxCategories: {
            taxCategories: [
              createTaxCategory({
                id: taxCategoryId,
                name: 'Test Tax Category 1',
              }),
            ],
          },
          charges: {
            charges: [
              createCharge(
                {
                  owner_id: businessId,
                  tax_category_id: taxCategoryId,
                },
                { id: chargeId },
              ),
            ],
          },
        };

        const idMap = await insertFixture(client, fixture);

        // Verify ID mapping
        expect(idMap.size).toBeGreaterThan(0);
        expect(idMap.get(businessId)).toBe(businessId);
        expect(idMap.get(taxCategoryId)).toBe(taxCategoryId);
        expect(idMap.get(chargeId)).toBe(chargeId);

        // Verify data inserted
        const businessResult = await client.query(
          `SELECT * FROM ${qualifyTable('businesses')} WHERE id = $1`,
          [businessId],
        );
        expect(businessResult.rows).toHaveLength(1);
        expect(businessResult.rows[0].id).toBe(businessId);
        expect(businessResult.rows[0].hebrew_name).toBeNull();

        const taxCatResult = await client.query(
          `SELECT * FROM ${qualifyTable('tax_categories')} WHERE id = $1`,
          [taxCategoryId],
        );
        expect(taxCatResult.rows).toHaveLength(1);
        expect(taxCatResult.rows[0].id).toBe(taxCategoryId);
        expect(taxCatResult.rows[0].hashavshevet_name).toBeNull();

        const chargeResult = await client.query(
          `SELECT * FROM ${qualifyTable('charges')} WHERE id = $1`,
          [chargeId],
        );
        expect(chargeResult.rows).toHaveLength(1);
        expect(chargeResult.rows[0].owner_id).toBe(businessId);
      }));

    it('should insert fixture with transactions and documents', () =>
      withTestTransaction(pool, async client => {
        const supplierId = makeUUID('business', 'supplier-1');
        const customerId = makeUUID('business', 'customer-1');
        const taxCategoryId = makeUUID('tax-category', 'tax-cat-1');
        const accountNumber = 'ACC-12345';
        const chargeId = makeUUID('charge', 'charge-1');
        const transactionId = makeUUID('transaction', 'tx-1');
        const documentId = makeUUID('document', 'doc-1');

        const fixture: Fixture = {
          businesses: {
            businesses: [
              createBusiness({ id: supplierId, name: 'Supplier Ltd' }),
              createBusiness({ id: customerId, name: 'Customer Inc' }),
            ],
          },
          taxCategories: {
            taxCategories: [createTaxCategory({ id: taxCategoryId, name: 'Tax Category 1' })],
          },
          accounts: {
            accounts: [
              createFinancialAccount({
                accountNumber: accountNumber,
                type: 'BANK_ACCOUNT',
                ownerId: customerId,
              }),
            ],
          },
          charges: {
            charges: [
              createCharge(
                { owner_id: customerId, tax_category_id: taxCategoryId },
                { id: chargeId },
              ),
            ],
          },
          transactions: {
            transactions: [
              createTransaction(
                {
                  charge_id: chargeId,
                  business_id: supplierId,
                  amount: '-500.00',
                  currency: 'ILS',
                  event_date: '2024-01-15',
                },
                {
                  id: transactionId,
                  account_id: accountNumber, // Will be resolved to UUID by loader
                },
              ),
            ],
          },
          documents: {
            documents: [
              createDocument(
                {
                  charge_id: chargeId,
                  creditor_id: supplierId,
                  debtor_id: customerId,
                  type: 'INVOICE',
                  total_amount: 500.0,
                  currency_code: 'ILS',
                  date: '2024-01-15',
                },
                { id: documentId },
              ),
            ],
          },
        };

        const idMap = await insertFixture(client, fixture);

        // Verify all IDs mapped
        expect(idMap.get(supplierId)).toBe(supplierId);
        expect(idMap.get(customerId)).toBe(customerId);
        expect(idMap.get(chargeId)).toBe(chargeId);
        expect(idMap.get(transactionId)).toBe(transactionId);
        expect(idMap.get(documentId)).toBe(documentId);

        // Verify transaction inserted with correct references
        const txResult = await client.query(
          `SELECT * FROM ${qualifyTable('transactions')} WHERE id = $1`,
          [transactionId],
        );
        expect(txResult.rows).toHaveLength(1);
        expect(txResult.rows[0].charge_id).toBe(chargeId);
        expect(txResult.rows[0].business_id).toBe(supplierId);
        expect(txResult.rows[0].amount).toBe('-500.00');

        // Verify document inserted with correct references
        const docResult = await client.query(
          `SELECT * FROM ${qualifyTable('documents')} WHERE id = $1`,
          [documentId],
        );
        expect(docResult.rows).toHaveLength(1);
        expect(docResult.rows[0].charge_id).toBe(chargeId);
        expect(docResult.rows[0].creditor_id).toBe(supplierId);
        expect(docResult.rows[0].debtor_id).toBe(customerId);
      }));

    it('should handle empty fixture sections gracefully', () =>
      withTestTransaction(pool, async client => {
        const fixture: Fixture = {
          businesses: { businesses: [] },
          taxCategories: { taxCategories: [] },
        };

        const idMap = await insertFixture(client, fixture);

        expect(idMap.size).toBe(0);
      }));

    it('should handle fixture with only some sections populated', () =>
      withTestTransaction(pool, async client => {
        const businessId = makeUUID('business', 'lonely-business');

        const fixture: Fixture = {
          businesses: {
            businesses: [createBusiness({ id: businessId, name: 'Lonely Business' })],
          },
          // No tax categories, accounts, charges, etc.
        };

        const idMap = await insertFixture(client, fixture);

        expect(idMap.get(businessId)).toBe(businessId);

        const result = await client.query(
          `SELECT * FROM ${qualifyTable('businesses')} WHERE id = $1`,
          [businessId],
        );
        expect(result.rows).toHaveLength(1);
      }));

    it('should throw validation error before insertion for invalid FK references', () =>
      withTestTransaction(pool, async client => {
        const businessId = makeUUID('business', 'test-biz');
        const invalidChargeId = makeUUID('charge', 'invalid-charge');

        const fixture: Fixture = {
          businesses: {
            businesses: [createBusiness({ id: businessId, name: 'Test Biz' })],
          },
          charges: {
            charges: [
              createCharge(
                {
                  owner_id: 'non-existent-owner', // Invalid FK reference
                  tax_category_id: makeUUID('tax-category', 'tax-cat'),
                },
                { id: invalidChargeId },
              ),
            ],
          },
        };

        // Validation should catch this before insertion
        await expect(insertFixture(client, fixture)).rejects.toThrow(/validation/i);
      }));

    it('should throw validation error with details for invalid fixture', () =>
      withTestTransaction(pool, async client => {
        const fixture: Fixture = {
          charges: {
            charges: [
              createCharge({
                owner_id: 'non-existent-owner',
                tax_category_id: makeUUID('tax-category', 'tax-cat'),
              }),
            ],
          },
        };

        try {
          await insertFixture(client, fixture);
          expect.fail('Should have thrown validation error');
        } catch (error) {
          expect(error).toBeInstanceOf(Error);
          const validationError = error as Error;
          expect(validationError.message).toMatch(/validation/i);
          expect(validationError.message).toMatch(/non-existent/i);
        }
      }));

    it('should validate fixture before insertion', () =>
      withTestTransaction(pool, async client => {
        const chargeId = makeUUID('charge', 'orphan-charge');

        const fixture: Fixture = {
          // Missing businesses and tax categories
          charges: {
            charges: [
              createCharge(
                {
                  owner_id: makeUUID('business', 'missing-owner'),
                  tax_category_id: makeUUID('tax-category', 'missing-tax'),
                },
                { id: chargeId },
              ),
            ],
          },
        };

        await expect(insertFixture(client, fixture)).rejects.toThrow(/validation/i);
      }));

    it('should insert multiple entities in correct order', () =>
      withTestTransaction(pool, async client => {
        const biz1 = makeUUID('business', 'biz-1');
        const biz2 = makeUUID('business', 'biz-2');
        const tax1 = makeUUID('tax-category', 'tax-1');
        const tax2 = makeUUID('tax-category', 'tax-2');
        const charge1 = makeUUID('charge', 'charge-1');
        const charge2 = makeUUID('charge', 'charge-2');

        const fixture: Fixture = {
          businesses: {
            businesses: [
              createBusiness({ id: biz1, name: 'Business 1' }),
              createBusiness({ id: biz2, name: 'Business 2' }),
            ],
          },
          taxCategories: {
            taxCategories: [
              createTaxCategory({ id: tax1, name: 'Tax 1' }),
              createTaxCategory({ id: tax2, name: 'Tax 2' }),
            ],
          },
          charges: {
            charges: [
              createCharge({ owner_id: biz1, tax_category_id: tax1 }, { id: charge1 }),
              createCharge({ owner_id: biz2, tax_category_id: tax2 }, { id: charge2 }),
            ],
          },
        };

        const idMap = await insertFixture(client, fixture);

        expect(idMap.size).toBe(6); // 2 businesses + 2 tax cats + 2 charges

        // Verify all charges reference correct businesses and tax categories
        const charge1Result = await client.query(
          `SELECT * FROM ${qualifyTable('charges')} WHERE id = $1`,
          [charge1],
        );
        expect(charge1Result.rows[0].owner_id).toBe(biz1);
        expect(charge1Result.rows[0].tax_category_id).toBe(tax1);

        const charge2Result = await client.query(
          `SELECT * FROM ${qualifyTable('charges')} WHERE id = $1`,
          [charge2],
        );
        expect(charge2Result.rows[0].owner_id).toBe(biz2);
        expect(charge2Result.rows[0].tax_category_id).toBe(tax2);
      }));

    it('should handle ON CONFLICT for idempotent insertion', () =>
      withTestTransaction(pool, async client => {
        const businessId = makeUUID('business', 'duplicate-biz');

        const fixture: Fixture = {
          businesses: {
            businesses: [createBusiness({ id: businessId, name: 'Original Name' })],
          },
        };

        // Insert once
        await insertFixture(client, fixture);

        // Insert again (should not error due to ON CONFLICT DO NOTHING)
        const fixtureModified: Fixture = {
          businesses: {
            businesses: [createBusiness({ id: businessId, name: 'Modified Name' })],
          },
        };

        const idMap = await insertFixture(client, fixtureModified);

        expect(idMap.get(businessId)).toBe(businessId);

        // Original data should be preserved (ON CONFLICT DO NOTHING)
        const result = await client.query(
          `SELECT * FROM ${qualifyTable('financial_entities')} WHERE id = $1`,
          [businessId],
        );
        expect(result.rows[0].name).toBe('Original Name');
      }));

    it('should insert transactions with generated source_id', () =>
      withTestTransaction(pool, async client => {
        const businessId = makeUUID('business', 'biz-tx');
        const taxCatId = makeUUID('tax-category', 'tax-tx');
        const chargeId = makeUUID('charge', 'charge-tx');
        const accountNumber = 'ACC-TX-001';
        const transactionId = makeUUID('transaction', 'tx-with-source');

        const fixture: Fixture = {
          businesses: {
            businesses: [createBusiness({ id: businessId, name: 'Biz Tx' })],
          },
          taxCategories: {
            taxCategories: [createTaxCategory({ id: taxCatId, name: 'Tax Tx' })],
          },
          accounts: {
            accounts: [
              createFinancialAccount({
                accountNumber: accountNumber,
                type: 'BANK_ACCOUNT',
                ownerId: businessId,
              }),
            ],
          },
          charges: {
            charges: [createCharge({ owner_id: businessId, tax_category_id: taxCatId }, { id: chargeId })],
          },
          transactions: {
            transactions: [
              createTransaction(
                {
                  charge_id: chargeId,
                  business_id: businessId,
                  amount: '100.00',
                  currency: 'USD',
                  event_date: '2024-02-01',
                },
                {
                  id: transactionId,
                  account_id: accountNumber, // Will be resolved to UUID by loader
                  source_id: undefined, // Will be auto-generated
                },
              ),
            ],
          },
        };

        await insertFixture(client, fixture);

        // Verify transaction has a source_id
        const txResult = await client.query(
          `SELECT * FROM ${qualifyTable('transactions')} WHERE id = $1`,
          [transactionId],
        );
        expect(txResult.rows).toHaveLength(1);
        expect(txResult.rows[0].source_id).toBeDefined();

        // Verify source_id references transactions_raw_list
        const sourceResult = await client.query(
          `SELECT * FROM ${qualifyTable('transactions_raw_list')} WHERE id = $1`,
          [txResult.rows[0].source_id],
        );
        expect(sourceResult.rows).toHaveLength(1);
      }));
  });
});
