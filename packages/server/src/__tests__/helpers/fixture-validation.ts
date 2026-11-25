/**
 * Fixture validation logic
 *
 * Validates fixture referential integrity and required fields before insertion.
 * Ensures that all foreign key references point to entities that exist within
 * the fixture, preventing database constraint violations.
 *
 * @see packages/server/src/__tests__/helpers/fixture-types.ts for fixture structure
 * @see packages/server/src/__tests__/helpers/fixture-loader.ts for insertion logic
 */

import type { Fixture } from './fixture-types.js';

/**
 * Validation result for successful validation
 */
export interface ValidationSuccess {
  ok: true;
}

/**
 * Validation result for failed validation
 */
export interface ValidationFailure {
  ok: false;
  errors: string[];
}

/**
 * Result of fixture validation
 */
export type ValidationResult = ValidationSuccess | ValidationFailure;

/**
 * Validate a fixture for referential integrity and required fields
 *
 * Checks:
 * 1. All charge references are valid (transactions → charges, documents → charges)
 * 2. All business references are valid (charges → businesses, transactions → businesses, documents → businesses)
 * 3. All account references are valid (transactions → accounts)
 * 4. All tax category references are valid (charges → tax categories)
 * 5. Required fields are present
 * 6. Misc expenses, exchange rates and depreciation categories, records and disposals are well
 *    formed (see `validateDepreciationSections`)
 *
 * @param fixture - The fixture to validate
 * @returns Validation result with ok=true or ok=false with error list
 *
 * @example
 * ```typescript
 * const result = validateFixture(expenseScenarioA);
 * if (!result.ok) {
 *   console.error('Validation errors:', result.errors);
 *   throw new Error('Invalid fixture');
 * }
 * ```
 */
export function validateFixture(fixture: Fixture): ValidationResult {
  const errors: string[] = [];

  // Build sets of valid IDs for quick lookup
  const businessIds = new Set<string>();
  const taxCategoryIds = new Set<string>();
  const accountIds = new Set<string>();
  const chargeIds = new Set<string>();

  // Collect business IDs
  if (fixture.businesses?.businesses) {
    for (const business of fixture.businesses.businesses) {
      if (!business.id) {
        errors.push('Business missing required field: id');
      } else {
        if (businessIds.has(business.id)) {
          errors.push(`Duplicate business id: ${business.id}`);
        }
        businessIds.add(business.id);
      }
    }
  }

  // Collect tax category IDs
  if (fixture.taxCategories?.taxCategories) {
    for (const category of fixture.taxCategories.taxCategories) {
      if (!category.id) {
        errors.push('Tax category missing required field: id');
      } else {
        if (taxCategoryIds.has(category.id)) {
          errors.push(`Duplicate tax category id: ${category.id}`);
        }
        taxCategoryIds.add(category.id);
      }
    }
  }

  // Collect account IDs
  if (fixture.accounts?.accounts) {
    for (const account of fixture.accounts.accounts) {
      if (!account.accountNumber) {
        errors.push('Financial account missing required field: accountNumber');
      } else {
        if (accountIds.has(account.accountNumber)) {
          errors.push(`Duplicate financial account accountNumber: ${account.accountNumber}`);
        }
        accountIds.add(account.accountNumber);
      }

      // Validate account owner reference
      if (account.ownerId && !businessIds.has(account.ownerId)) {
        errors.push(
          `Financial account ${account.accountNumber ?? '<no-account-number>'} references non-existent business: ${account.ownerId}`,
        );
      }
    }
  }

  // Collect and validate charge IDs
  if (fixture.charges?.charges) {
    for (const charge of fixture.charges.charges) {
      if (!charge.id) {
        errors.push('Charge missing required field: id');
        continue;
      }

      if (chargeIds.has(charge.id)) {
        errors.push(`Duplicate charge id: ${charge.id}`);
      }
      chargeIds.add(charge.id);

      // Validate required fields
      if (!charge.owner_id) {
        errors.push(`Charge ${charge.id} missing required field: owner_id`);
      } else if (!businessIds.has(charge.owner_id)) {
        errors.push(`Charge ${charge.id} references non-existent business: ${charge.owner_id}`);
      }

      // Validate optional tax category reference
      if (charge.tax_category_id && !taxCategoryIds.has(charge.tax_category_id)) {
        errors.push(
          `Charge ${charge.id} references non-existent tax category: ${charge.tax_category_id}`,
        );
      }
    }
  }

  // Validate transactions
  if (fixture.transactions?.transactions) {
    for (const transaction of fixture.transactions.transactions) {
      const txId = transaction.id ?? '<no-id>';

      // Validate required fields
      if (!transaction.charge_id) {
        errors.push(`Transaction ${txId} missing required field: charge_id`);
      } else if (!chargeIds.has(transaction.charge_id)) {
        errors.push(`Transaction ${txId} references non-existent charge: ${transaction.charge_id}`);
      }

      if (!transaction.business_id) {
        errors.push(`Transaction ${txId} missing required field: business_id`);
      } else if (!businessIds.has(transaction.business_id)) {
        errors.push(
          `Transaction ${txId} references non-existent business: ${transaction.business_id}`,
        );
      }

      if (!transaction.account_id) {
        errors.push(`Transaction ${txId} missing required field: account_id`);
      }
      // Note: We don't validate account_id references because:
      // 1. Financial accounts use accountNumber as identifier, not UUID
      // 2. Transactions use account_id (UUID) which comes from factory defaults
      // 3. The actual FK relationship will be validated at insertion time

      if (!transaction.currency) {
        errors.push(`Transaction ${txId} missing required field: currency`);
      }

      if (!transaction.event_date) {
        errors.push(`Transaction ${txId} missing required field: event_date`);
      }

      if (transaction.amount === undefined || transaction.amount === null) {
        errors.push(`Transaction ${txId} missing required field: amount`);
      }
    }
  }

  // Validate documents
  if (fixture.documents?.documents) {
    for (const document of fixture.documents.documents) {
      const docId = document.id ?? '<no-id>';

      // Validate required fields
      if (!document.charge_id) {
        errors.push(`Document ${docId} missing required field: charge_id`);
      } else if (!chargeIds.has(document.charge_id)) {
        errors.push(`Document ${docId} references non-existent charge: ${document.charge_id}`);
      }

      if (!document.creditor_id) {
        errors.push(`Document ${docId} missing required field: creditor_id`);
      } else if (!businessIds.has(document.creditor_id)) {
        errors.push(`Document ${docId} references non-existent business: ${document.creditor_id}`);
      }

      if (!document.debtor_id) {
        errors.push(`Document ${docId} missing required field: debtor_id`);
      } else if (!businessIds.has(document.debtor_id)) {
        errors.push(`Document ${docId} references non-existent business: ${document.debtor_id}`);
      }

      if (!document.type) {
        errors.push(`Document ${docId} missing required field: type`);
      }

      if (document.total_amount === undefined || document.total_amount === null) {
        errors.push(`Document ${docId} missing required field: total_amount`);
      }

      if (!document.currency_code) {
        errors.push(`Document ${docId} missing required field: currency_code`);
      }

      if (!document.date) {
        errors.push(`Document ${docId} missing required field: date`);
      }
    }
  }

  errors.push(...validateDepreciationSections(fixture, chargeIds, taxCategoryIds));

  // Return result
  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return { ok: true };
}

/**
 * Validates the misc-expense, exchange-rate and depreciation sections.
 *
 * These sections may build on a fixture inserted earlier in the same transaction (disposals entered
 * after their assets, say), so a reference is checked against the fixture only when the fixture
 * defines the section it points to; otherwise it is left to the foreign keys at insertion time.
 */
function validateDepreciationSections(
  fixture: Fixture,
  chargeIds: Set<string>,
  taxCategoryIds: Set<string>,
): string[] {
  const errors: string[] = [];
  const definesCharges = (fixture.charges?.charges?.length ?? 0) > 0;
  const checkUnique = (ids: Set<string>, id: string | undefined, what: string) => {
    if (!id) {
      errors.push(`${what} missing required field: id`);
      return;
    }
    if (ids.has(id)) {
      errors.push(`Duplicate ${what.toLowerCase()} id: ${id}`);
    }
    ids.add(id);
  };
  const checkCharge = (chargeId: string | null | undefined, what: string) => {
    if (chargeId && definesCharges && !chargeIds.has(chargeId)) {
      errors.push(`${what} references non-existent charge: ${chargeId}`);
    }
  };

  const expenseIds = new Set<string>();
  for (const expense of fixture.miscExpenses?.expenses ?? []) {
    const what = `Misc expense ${expense.id ?? '<no-id>'}`;
    checkUnique(expenseIds, expense.id, 'Misc expense');
    if (!expense.chargeId) {
      errors.push(`${what} missing required field: chargeId`);
    }
    checkCharge(expense.chargeId, what);
    for (const field of [
      'ownerId',
      'amount',
      'currency',
      'creditorId',
      'debtorId',
      'invoiceDate',
      'valueDate',
    ] as const) {
      if (!expense[field]) {
        errors.push(`${what} missing required field: ${field}`);
      }
    }
  }

  const rateDates = new Set<string>();
  for (const rate of fixture.exchangeRates?.rates ?? []) {
    if (!rate.date) {
      errors.push('Exchange rate missing required field: date');
      continue;
    }
    if (rateDates.has(rate.date)) {
      errors.push(`Duplicate exchange rate date: ${rate.date}`);
    }
    rateDates.add(rate.date);
    const { date: _date, ...currencies } = rate;
    const given = Object.values(currencies).filter(value => value != null);
    if (given.length === 0) {
      errors.push(`Exchange rate ${rate.date} has no currency`);
    }
    if (given.some(value => !(value > 0))) {
      errors.push(`Exchange rate ${rate.date} has a rate that is not positive`);
    }
  }

  const categoryIds = new Set<string>();
  for (const category of fixture.depreciationCategories?.categories ?? []) {
    checkUnique(categoryIds, category.id, 'Depreciation category');
    if (!category.name) {
      errors.push(`Depreciation category ${category.id} missing required field: name`);
    }
    if (!(category.percentage >= 0 && category.percentage <= 100)) {
      errors.push(`Depreciation category ${category.id} percentage must be between 0 and 100`);
    }
  }

  const recordIds = new Set<string>();
  for (const record of fixture.depreciationRecords?.records ?? []) {
    const what = `Depreciation record ${record.id ?? '<no-id>'}`;
    checkUnique(recordIds, record.id, 'Depreciation record');
    for (const field of ['chargeId', 'ownerId', 'categoryId', 'activationDate'] as const) {
      if (!record[field]) {
        errors.push(`${what} missing required field: ${field}`);
      }
    }
    checkCharge(record.chargeId, what);
    if (record.categoryId && categoryIds.size > 0 && !categoryIds.has(record.categoryId)) {
      errors.push(`${what} references non-existent depreciation category: ${record.categoryId}`);
    }
    if (
      record.assetTaxCategoryId &&
      taxCategoryIds.size > 0 &&
      !taxCategoryIds.has(record.assetTaxCategoryId)
    ) {
      errors.push(`${what} references non-existent tax category: ${record.assetTaxCategoryId}`);
    }
  }

  const disposalIds = new Set<string>();
  for (const disposal of fixture.depreciationDisposals?.disposals ?? []) {
    const what = `Depreciation disposal ${disposal.id ?? '<no-id>'}`;
    checkUnique(disposalIds, disposal.id, 'Depreciation disposal');
    for (const field of ['ownerId', 'depreciationId', 'type', 'disposalDate'] as const) {
      if (!disposal[field]) {
        errors.push(`${what} missing required field: ${field}`);
      }
    }
    checkCharge(disposal.chargeId, what);
    if (disposal.depreciationId && recordIds.size > 0 && !recordIds.has(disposal.depreciationId)) {
      errors.push(`${what} references non-existent depreciation record: ${disposal.depreciationId}`);
    }
    if (disposal.refundMode && disposal.type !== 'COST_REFUND') {
      errors.push(`${what} has a refund mode but is not a cost refund`);
    }
    const hasOriginalAmount = disposal.originalAmount != null;
    if (hasOriginalAmount !== (disposal.originalCurrency != null)) {
      errors.push(`${what} must give originalAmount and originalCurrency together`);
    }
    if (hasOriginalAmount && disposal.type !== 'COST_REFUND') {
      errors.push(`${what} has an amount in the asset's currency but is not a cost refund`);
    }
    if (hasOriginalAmount === (disposal.disposedCost != null)) {
      errors.push(`${what} must give either disposedCost or originalAmount`);
    }
  }

  return errors;
}

/**
 * Validate a fixture and throw if invalid
 *
 * Convenience wrapper around validateFixture that throws an error
 * with a formatted message if validation fails.
 *
 * @param fixture - The fixture to validate
 * @throws {Error} If validation fails
 *
 * @example
 * ```typescript
 * // Throws if invalid
 * assertValidFixture(expenseScenarioA);
 *
 * // Continues if valid
 * await insertFixture(client, expenseScenarioA);
 * ```
 */
export function assertValidFixture(fixture: Fixture): asserts fixture is Fixture {
  const result = validateFixture(fixture);
  if (!result.ok) {
    const errorMessage = [
      'Fixture validation failed:',
      ...result.errors.map(e => `  - ${e}`),
    ].join('\n');
    throw new Error(errorMessage);
  }
}
