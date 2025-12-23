/**
 * Fixture insertion logic with ordered insertion and rollback support
 *
 * Inserts fixture data into the database in the correct order to satisfy
 * foreign key constraints, with savepoint-based rollback for detailed error messages.
 *
 * @see packages/server/src/__tests__/helpers/fixture-types.ts for fixture structure
 * @see packages/server/src/__tests__/helpers/fixture-validation.ts for validation logic
 */

import type { Client, PoolClient } from 'pg';
import type { Fixture } from './fixture-types.js';
import { assertValidFixture } from './fixture-validation.js';
import { qualifyTable } from './test-db-config.js';
import { makeUUID, makeUUIDLegacy } from '../../demo-fixtures/helpers/deterministic-uuid.js';

/**
 * Custom error for fixture insertion failures
 *
 * Provides context about which section of the fixture failed to insert
 * and includes the underlying database error.
 */
export class FixtureInsertionError extends Error {
  constructor(
    public readonly section: string,
    public readonly originalError: Error,
    public readonly context?: Record<string, unknown>,
  ) {
    super(
      `Failed to insert fixture section "${section}": ${originalError.message}` +
        (context ? `\nContext: ${JSON.stringify(context, null, 2)}` : ''),
    );
    this.name = 'FixtureInsertionError';
    Error.captureStackTrace?.(this, FixtureInsertionError);
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      section: this.section,
      originalError: {
        name: this.originalError.name,
        message: this.originalError.message,
      },
      context: this.context,
    };
  }
}

/**
 * ID mapping result from fixture insertion
 *
 * Maps logical IDs from the fixture to actual database-generated IDs.
 * Currently, factories generate UUIDs directly, so this is mostly a pass-through,
 * but the infrastructure is in place for future auto-generated IDs.
 */
export type FixtureIdMapping = Map<string, string>;

/**
 * Insert a complete fixture into the database
 *
 * Performs ordered insertion of all fixture entities with savepoint-based
 * error handling for clear diagnostics. Insertion order ensures foreign key
 * constraints are satisfied:
 *
 * 1. Businesses (financial entities)
 * 2. Tax categories (financial entities)
 * 3. Financial accounts (references businesses)
 * 4. Charges (references businesses and tax categories)
 * 5. Transactions (references charges, accounts, businesses)
 * 6. Documents (references charges and businesses)
 *
 * Each section is wrapped in a SAVEPOINT so that partial failures can be
 * rolled back to a known state with clear error context.
 *
 * **Transaction Handling:**
 * - Must be called within an existing transaction (client has active BEGIN)
 * - Creates savepoints for each section (SAVEPOINT section_name)
 * - On section error, rolls back to savepoint (ROLLBACK TO SAVEPOINT section_name)
 * - Does NOT commit or rollback the outer transaction
 *
 * **Validation:**
 * - Validates fixture before any insertion (assertValidFixture)
 * - Checks referential integrity (charge IDs, business IDs, etc.)
 * - Validates required fields
 *
 * @param client - PostgreSQL client (PoolClient or standalone Client) within an active transaction
 * @param fixture - Complete fixture to insert
 * @returns Promise resolving to ID mapping (fixture ID → database ID)
 * @throws {Error} If fixture validation fails (via assertValidFixture)
 * @throws {FixtureInsertionError} If any insertion section fails
 *
 * @remarks
 * Type Safety: Accepts both PoolClient and Client to support both test transactions
 * (pool.connect()) and standalone connections (new pg.Client()) used in seed scripts.
 *
 * @example
 * ```typescript
 * import { withTestTransaction } from './test-transaction.js';
 * import { insertFixture } from './fixture-loader.js';
 * import { expenseScenarioA } from '../fixtures/expenses/expense-scenario-a.js';
 *
 * it('should insert expense scenario', () =>
 *   withTestTransaction(pool, async (client) => {
 *     const idMap = await insertFixture(client, expenseScenarioA);
 *
 *     // Verify insertion
 *     const result = await client.query(
 *       'SELECT * FROM accounter_schema.charges WHERE id = $1',
 *       [expenseScenarioA.charges!.charges[0].id!]
 *     );
 *     expect(result.rows).toHaveLength(1);
 *   })
 * );
 * ```
 */
export async function insertFixture(
  client: PoolClient | Client,
  fixture: Fixture,
): Promise<FixtureIdMapping> {
  // Validate fixture before insertion
  assertValidFixture(fixture);

  const idMapping: FixtureIdMapping = new Map();

  // Helper to execute a section with savepoint protection
  async function executeSavepointSection<T>(
    sectionName: string,
    fn: () => Promise<T>,
  ): Promise<T> {
    // Savepoint names must be valid PostgreSQL identifiers (no spaces, start with letter)
    const savepointName = `sp_${sectionName.replace(/[^a-zA-Z0-9_]/g, '_')}`;

    try {
      await client.query(`SAVEPOINT ${savepointName}`);
      const result = await fn();
      await client.query(`RELEASE SAVEPOINT ${savepointName}`);
      return result;
    } catch (error) {
      await client.query(`ROLLBACK TO SAVEPOINT ${savepointName}`);
      throw new FixtureInsertionError(
        sectionName,
        error instanceof Error ? error : new Error(String(error)),
        { savepointName },
      );
    }
  }

  // 1. Insert businesses (financial entities of type 'business')
  if (fixture.businesses?.businesses && fixture.businesses.businesses.length > 0) {
    await executeSavepointSection('businesses', async () => {
      for (const business of fixture.businesses!.businesses) {
        // Insert financial entity first (type='business')
        // Field mapping: business.name used for display (required); hebrewName is legacy/optional
        const entityResult = await client.query(
          `INSERT INTO ${qualifyTable('financial_entities')} (id, name, type)
           VALUES ($1, $2, 'business')
           ON CONFLICT (id) DO NOTHING
           RETURNING id`,
          [business.id, business.name || business.id],
        );

        // Insert business details - note: vat_number column maps to governmentId field
        await client.query(
          `INSERT INTO ${qualifyTable('businesses')} (
            id, hebrew_name, address, city, zip_code, email, website, phone_number, vat_number,
            exempt_dealer, suggestion_data, optional_vat, country,
            pcn874_record_type_override, can_settle_with_receipt, no_invoices_required
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
          ON CONFLICT (id) DO NOTHING`,
          [
            business.id,
            business.hebrewName,
            business.address,
            business.city,
            business.zipCode,
            business.email,
            business.website,
            business.phoneNumber,
            business.governmentId, // Maps to vat_number column
            business.exemptDealer ?? false,
            business.suggestions ?? null,
            business.optionalVat ?? false,
            business.country ?? 'ISR',
            business.pcn874RecordTypeOverride ?? null,
            business.isReceiptEnough ?? false,
            business.isDocumentsOptional ?? false,
          ],
        );

        if (entityResult.rows.length > 0) {
          idMapping.set(business.id!, entityResult.rows[0].id);
        } else {
          // Entity already existed, map to itself
          idMapping.set(business.id!, business.id!);
        }
      }
    });
  }

  // 2. Insert tax categories (financial entities of type 'tax_category')
  if (fixture.taxCategories?.taxCategories && fixture.taxCategories.taxCategories.length > 0) {
    await executeSavepointSection('tax_categories', async () => {
      for (const taxCategory of fixture.taxCategories!.taxCategories) {
        // Insert financial entity first
        const entityResult = await client.query(
          `INSERT INTO ${qualifyTable('financial_entities')} (id, name, type)
           VALUES ($1, $2, 'tax_category')
           ON CONFLICT (id) DO NOTHING
           RETURNING id`,
          [taxCategory.id, taxCategory.hashavshevetName || taxCategory.id],
        );

        // Insert tax category details
        await client.query(
          `INSERT INTO ${qualifyTable('tax_categories')} (
            id, hashavshevet_name, tax_excluded
          )
          VALUES ($1, $2, $3)
          ON CONFLICT (id) DO NOTHING`,
          [taxCategory.id, taxCategory.hashavshevetName, taxCategory.taxExcluded ?? false],
        );

        if (entityResult.rows.length > 0) {
          idMapping.set(taxCategory.id!, entityResult.rows[0].id);
        } else {
          idMapping.set(taxCategory.id!, taxCategory.id!);
        }
      }
    });
  }

  // 3. Insert financial accounts
  if (fixture.accounts?.accounts && fixture.accounts.accounts.length > 0) {
    await executeSavepointSection('financial_accounts', async () => {
      for (const account of fixture.accounts!.accounts) {
        const result = await client.query(
          `INSERT INTO ${qualifyTable('financial_accounts')} (
            account_number, account_name, private_business, owner, type
          )
          VALUES ($1, $2, $3, $4, $5)
          RETURNING id, account_number`,
          [
            account.accountNumber,
            account.name,
            account.privateBusiness,
            account.ownerId,
            account.type,
          ],
        );

        // Store both the account_number and the auto-generated UUID id
        // Transactions reference the id field, not account_number
        if (result.rows.length > 0) {
          // Store account_number mapping for reference
          idMapping.set(account.accountNumber!, result.rows[0].account_number);
          // Also store the UUID id for transaction references
          if (account.accountNumber) {
            idMapping.set(`${account.accountNumber}_id`, result.rows[0].id);
          }
        }
      }
    });
  }

  // 3b. Insert financial account tax category mappings
  if (fixture.accountTaxCategories?.mappings && fixture.accountTaxCategories.mappings.length > 0) {
    await executeSavepointSection('account_tax_categories', async () => {
      for (const mapping of fixture.accountTaxCategories!.mappings) {
        // Look up the account UUID by account_number
        const accountResult = await client.query(
          `SELECT id FROM ${qualifyTable('financial_accounts')} WHERE account_number = $1`,
          [mapping.accountNumber],
        );
        if (accountResult.rows.length === 0) {
          throw new Error(`Financial account with account_number '${mapping.accountNumber}' not found`);
        }
        const accountId = accountResult.rows[0].id;

        await client.query(
          `INSERT INTO ${qualifyTable('financial_accounts_tax_categories')} (
            financial_account_id, currency, tax_category_id
          )
          VALUES ($1, $2, $3)
          ON CONFLICT (financial_account_id, currency) DO UPDATE
            SET tax_category_id = EXCLUDED.tax_category_id`,
          [accountId, mapping.currency, mapping.taxCategoryId],
        );
      }
    });
  }

  // 4. Insert charges
  if (fixture.charges?.charges && fixture.charges.charges.length > 0) {
    await executeSavepointSection('charges', async () => {
      for (const charge of fixture.charges!.charges) {
        await client.query(
          `INSERT INTO ${qualifyTable('charges')} (
            id, owner_id, type, accountant_status, user_description,
            tax_category_id, optional_vat, documents_optional_flag,
            is_property, created_at, updated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
          ON CONFLICT (id) DO NOTHING`,
          [
            charge.id,
            charge.owner_id,
            charge.type ?? null,
            charge.accountant_status ?? 'PENDING',
            charge.user_description,
            charge.tax_category_id ?? null,
            charge.optional_vat ?? false,
            charge.documents_optional_flag ?? false,
            charge.is_property ?? false,
          ],
        );

        idMapping.set(charge.id!, charge.id!);
      }
    });
  }

  // 5. Insert transactions
  if (fixture.transactions?.transactions && fixture.transactions.transactions.length > 0) {
    await executeSavepointSection('transactions', async () => {
      for (const transaction of fixture.transactions!.transactions) {
        // If account_id looks like an account_number (not a UUID), look up the actual UUID
        let accountId = transaction.account_id;
        if (accountId && !accountId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
          // account_id is actually an account_number, look up the UUID
          const accountResult = await client.query(
            `SELECT id FROM ${qualifyTable('financial_accounts')} WHERE account_number = $1`,
            [accountId],
          );
          if (accountResult.rows.length === 0) {
            throw new Error(`Financial account with account_number '${accountId}' not found`);
          }
          accountId = accountResult.rows[0].id;
        }

        // Insert directly into transactions_raw_list with etherscan_id to satisfy check constraint
        // This avoids triggering any creditcard/bank transaction handlers which would auto-create charges
        // etherscan_id is used because it has no INSERT trigger and is a simple UUID reference
        const dummyEtherscanId = transaction.id ? makeUUID('raw-transaction', `etherscan-${transaction.id}`) : makeUUIDLegacy();
        const rawListResult = await client.query(
          `INSERT INTO ${qualifyTable('transactions_raw_list')} (etherscan_id)
           VALUES ($1)
           RETURNING id`,
          [dummyEtherscanId],
        );
        // Always use the newly created raw list ID as source_id
        const sourceId = rawListResult.rows[0].id;

        await client.query(
          `INSERT INTO ${qualifyTable('transactions')} (
            id, account_id, charge_id, source_id, source_description,
            currency, event_date, debit_date, amount, current_balance,
            business_id, is_fee, source_reference, source_origin, origin_key,
            currency_rate, created_at, updated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, NOW(), NOW())
          ON CONFLICT (id) DO NOTHING`,
          [
            transaction.id,
            accountId,
            transaction.charge_id,
            sourceId,
            transaction.source_description,
            transaction.currency,
            transaction.event_date,
            transaction.debit_date,
            transaction.amount,
            transaction.current_balance ?? '0',
            transaction.business_id,
            transaction.is_fee ?? false,
            'TEST-REF', // source_reference (NOT NULL)
            'TEST', // source_origin (NOT NULL)
            dummyEtherscanId, // origin_key (NOT NULL) - must match etherscan_id in raw list
            transaction.currency_rate ?? 1,
          ],
        );

        idMapping.set(transaction.id!, transaction.id!);
      }
    });
  }

  // 6. Insert documents
  if (fixture.documents?.documents && fixture.documents.documents.length > 0) {
    await executeSavepointSection('documents', async () => {
      for (const document of fixture.documents!.documents) {
        await client.query(
          `INSERT INTO ${qualifyTable('documents')} (
            id, image_url, file_url, type, serial_number, date,
            total_amount, currency_code, vat_amount, charge_id,
            debtor_id, creditor_id, vat_report_date_override,
            no_vat_amount, allocation_number, exchange_rate_override, file_hash
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
          ON CONFLICT (id) DO NOTHING`,
          [
            document.id,
            document.image_url,
            document.file_url,
            document.type,
            document.serial_number,
            document.date,
            document.total_amount,
            document.currency_code,
            document.vat_amount,
            document.charge_id,
            document.debtor_id,
            document.creditor_id,
            document.vat_report_date_override,
            document.no_vat_amount,
            document.allocation_number,
            document.exchange_rate_override,
            document.file_hash,
          ],
        );

        idMapping.set(document.id!, document.id!);
      }
    });
  }

  return idMapping;
}
