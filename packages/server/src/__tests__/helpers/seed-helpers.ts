import type { Client, PoolClient } from 'pg';
import { qualifyTable } from './test-db-config.js';
import { EntityValidationError, SeedError } from './seed-errors.js';
import { makeUUID } from '../factories/index.js';
import { UUID_REGEX } from '../../shared/constants.js';
import type {FixtureBusinesses, FixtureTaxCategories} from './fixture-types.js';

/**
 * Valid financial entity types based on database schema
 */
export type FinancialEntityType = 'business' | 'tax_category' | 'tag';

/**
 * Valid financial entity types for runtime validation
 */
const VALID_ENTITY_TYPES: readonly FinancialEntityType[] = ['business', 'tax_category', 'tag'];

export interface EnsureFinancialEntityParams {
  id?: string;
  name: string;
  type: FinancialEntityType;
  ownerId?: string;
}

export interface FinancialEntityResult {
  id: string;
}

/**
 * Ensure a financial entity exists in the database (idempotent)
 * 
 * **Idempotency Behavior:**
 * - If an entity with matching (name, type, owner_id) exists, returns existing entity ID
 * - Does NOT update existing entities - preserves all existing field values
 * - If no match found, inserts new entity and returns new ID
 * - Safe to call multiple times with same parameters
 * 
 * **NULL Handling:**
 * - `ownerId: undefined` and `ownerId: null` are treated identically (as NULL in DB)
 * - Correctly handles SQL NULL semantics in uniqueness check
 * 
 * @param client - PostgreSQL client (must be within a transaction for rollback safety)
 * @param params - Entity parameters
 * @param params.name - Entity name (required, non-empty)
 * @param params.type - Entity type (must be 'business', 'tax_category', or 'tag')
 * @param params.ownerId - Optional owner entity ID (must exist in financial_entities if provided)
 * @returns Promise resolving to object containing entity id
 * @throws {EntityValidationError} If name is empty or type is invalid
 * @throws {SeedError} If database operation fails
 * 
 * @example
 * ```typescript
 * // Create standalone business entity
 * const { id: adminId } = await ensureFinancialEntity(client, {
 *   name: 'Admin Business',
 *   type: 'business',
 * });
 * 
 * // Create owned tax category
 * const { id: taxId } = await ensureFinancialEntity(client, {
 *   name: 'VAT Category',
 *   type: 'tax_category',
 *   ownerId: adminId,
 * });
 * 
 * // Calling again returns same ID (idempotent)
 * const { id: sameId } = await ensureFinancialEntity(client, {
 *   name: 'Admin Business',
 *   type: 'business',
 * });
 * // sameId === adminId
 * ```
 */
export async function ensureFinancialEntity(
  client: PoolClient | Client,
  params: EnsureFinancialEntityParams,
): Promise<FinancialEntityResult> {
  const { name, type, ownerId, id: originId } = params;

  // Validate inputs
  const validationErrors: string[] = [];
  
  if (!name || name.trim() === '') {
    validationErrors.push('name is required and cannot be empty');
  }
  
  if (!VALID_ENTITY_TYPES.includes(type)) {
    validationErrors.push(
      `type must be one of: ${VALID_ENTITY_TYPES.join(', ')}. Got: "${type}"`,
    );
  }
  
  if (validationErrors.length > 0) {
    throw new EntityValidationError('FinancialEntity', validationErrors, { name, type, ownerId });
  }

  try {
    // Generate deterministic UUID based on type, name, and ownerId for idempotency
    // Same (type, name, ownerId) always generates same ID, ensuring multiple calls are safe
    // Include ownerId in the composite key so different owners get different IDs
    const compositeKey = ownerId ? `${name}:owner=${ownerId}` : name;
    const consistentId = originId ?? makeUUID(type, compositeKey);

    // Use atomic INSERT...ON CONFLICT on PRIMARY KEY (id) to handle concurrent inserts
    // If the deterministic ID already exists (from a previous call or concurrent insert),
    // the conflict handler will safely return the existing row
    const insertQuery = `
      INSERT INTO ${qualifyTable('financial_entities')} (id, name, type, owner_id)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (id) DO UPDATE
      SET id = EXCLUDED.id  -- No-op update, just to return the existing id
      RETURNING id
    `;

    const result = await client.query<{ id: string }>(
      insertQuery,
      [consistentId, name, type, ownerId ?? null],
    );

    const row = result.rows[0];
    if (!row) {
      throw new SeedError(
        'INSERT...ON CONFLICT returned no rows',
        { name, type, ownerId },
      );
    }

    return { id: row.id };
  } catch (error) {
    if (error instanceof EntityValidationError || error instanceof SeedError) {
      throw error;
    }
    
    throw new SeedError(
      `Failed to ensure financial entity (name="${name}", type="${type}")`,
      { name, type, ownerId },
      error as Error,
    );
  }
}

export type EnsureBusinessForEntityOptions = Partial<Omit<FixtureBusinesses['businesses'][number], 'id'>>

/**
 * Ensure a business row exists for a given financial entity id (idempotent)
 * 
 * **Idempotency Behavior:**
 * - If business already exists for the given entity ID, does nothing
 * - Does NOT update existing business configuration - preserves all existing values
 * - If business doesn't exist, creates new row with provided options
 * - Safe to call multiple times with same entityId
 * 
 * **Foreign Key Requirement:**
 * - The entityId MUST correspond to an existing financial_entities record
 * - Will validate entity exists before attempting insert
 * 
 * @param client - PostgreSQL client (must be within a transaction for rollback safety)
 * @param entityId - Financial entity ID to use as business ID (must exist in financial_entities)
 * @param options - Optional business configuration
 * @param options.noInvoicesRequired - Whether invoices are required (default: false)
 * @returns Promise resolving when complete
 * @throws {EntityValidationError} If entityId is invalid format
 * @throws {EntityNotFoundError} If financial entity doesn't exist
 * @throws {SeedError} If database operation fails
 * 
 * @example
 * ```typescript
 * // First create financial entity
 * const { id: entityId } = await ensureFinancialEntity(client, {
 *   name: 'My Business',
 *   type: 'business',
 * });
 * 
 * // Then create business record
 * await ensureBusinessForEntity(client, entityId, {
 *   noInvoicesRequired: true,
 * });
 * 
 * // Calling again is safe (no-op)
 * await ensureBusinessForEntity(client, entityId, {
 *   noInvoicesRequired: false, // Ignored - existing value preserved
 * });
 * ```
 */
export async function ensureBusinessForEntity(
  client: PoolClient | Client,
  entityId: string,
  options?: EnsureBusinessForEntityOptions,
): Promise<void> {
  // Validate entityId format (basic UUID check)
  if (!UUID_REGEX.test(entityId)) {
    throw new EntityValidationError(
      'Business',
      ['entityId must be a valid UUID'],
      { entityId },
    );
  }

  try {
    // Validate that financial entity exists
    const entityCheckQuery = `
      SELECT 1
      FROM ${qualifyTable('financial_entities')}
      WHERE id = $1
      LIMIT 1
    `;

    const entityExists = await client.query(entityCheckQuery, [entityId]);

    if (entityExists.rows.length === 0) {
      throw new EntityValidationError(
        'Business',
        [`Financial entity ${entityId} not found. Create it first via ensureFinancialEntity.`],
        { entityId },
      );
    }

    // Use atomic INSERT...ON CONFLICT on PRIMARY KEY (id) to handle concurrent inserts
    // If the deterministic ID already exists (from a previous call or concurrent insert),
    // the conflict handler will safely return the existing row
    const insertQuery = `
      INSERT INTO ${qualifyTable('businesses')} (
        id, hebrew_name, address, city, zip_code, email, website, phone_number, vat_number,
        exempt_dealer, suggestion_data, optional_vat, country,
        pcn874_record_type_override, can_settle_with_receipt, no_invoices_required
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      ON CONFLICT (id) DO NOTHING
    `;

    await client.query(insertQuery, [
            entityId,
            options?.hebrewName,
            options?.address,
            options?.city,
            options?.zipCode,
            options?.email,
            options?.website,
            options?.phoneNumber,
            options?.governmentId, // Maps to vat_number column
            options?.exemptDealer ?? false,
            options?.suggestions ?? null,
            options?.optionalVat ?? false,
            options?.country ?? 'ISR',
            options?.pcn874RecordTypeOverride ?? null,
            options?.isReceiptEnough ?? false,
            options?.isDocumentsOptional ?? false]);
  } catch (error) {
    if (error instanceof EntityValidationError || error instanceof SeedError) {
      throw error;
    }

    throw new SeedError(
      `Failed to ensure business for entity ${entityId}`,
      { entityId, options },
      error as Error,
    );
  }
}

export type EnsureTaxCategoryForEntityOptions = Partial<Omit<FixtureTaxCategories['taxCategories'][number], 'id'>> & {
  sortCode?: number;
}

/**
 * Ensure a tax_categories row exists for a given financial entity id (idempotent)
 * 
 * **Idempotency Behavior:**
 * - If tax category already exists for the given entity ID, does nothing
 * - Does NOT update existing tax category - preserves all existing values
 * - If tax category doesn't exist, creates new row
 * - Safe to call multiple times with same entityId
 * 
 * **Foreign Key Requirement:**
 * - The entityId MUST correspond to an existing financial_entities record
 * - Will validate entity exists before attempting insert
 * 
 * **Name Handling:**
 * - Tax category names live on the financial_entities table
 * - This table only ensures the linkage row exists
 * 
 * @param client - PostgreSQL client (must be within a transaction for rollback safety)
 * @param entityId - Financial entity ID to use as tax category ID (must exist in financial_entities)
 * @param options - Optional tax category configuration
 * @param options.sortCode - Optional sort code for accounting systems
 * @returns Promise resolving when complete
 * @throws {EntityValidationError} If entityId is invalid format
 * @throws {EntityNotFoundError} If financial entity doesn't exist
 * @throws {SeedError} If database operation fails
 * 
 * @example
 * ```typescript
 * // First create financial entity
 * const { id: entityId } = await ensureFinancialEntity(client, {
 *   name: 'VAT Category',
 *   type: 'tax_category',
 * });
 * 
 * // Then create tax category record
 * await ensureTaxCategoryForEntity(client, entityId, {
 *   sortCode: 1000,
 * });
 * 
 * // Calling again is safe (no-op)
 * await ensureTaxCategoryForEntity(client, entityId, {
 *   sortCode: 2000, // Ignored - existing value preserved
 * });
 * ```
 */
export async function ensureTaxCategoryForEntity(
  client: PoolClient | Client,
  entityId: string,
  options?: EnsureTaxCategoryForEntityOptions,
): Promise<void> {
  // Validate entityId format (basic UUID check)
  if (!UUID_REGEX.test(entityId)) {
    throw new EntityValidationError(
      'TaxCategory',
      ['entityId must be a valid UUID'],
      { entityId },
    );
  }

  try {
    // Validate that financial entity exists
    const entityCheckQuery = `
      SELECT 1
      FROM ${qualifyTable('financial_entities')}
      WHERE id = $1
      LIMIT 1
    `;

    const entityExists = await client.query(entityCheckQuery, [entityId]);

    if (entityExists.rows.length === 0) {
      throw new EntityValidationError(
        'TaxCategory',
        [`Financial entity ${entityId} not found. Create it first via ensureFinancialEntity.`],
        { entityId },
      );
    }

    // Use atomic INSERT...ON CONFLICT on PRIMARY KEY (id) to handle concurrent inserts
    // If the deterministic ID already exists (from a previous call or concurrent insert),
    // the conflict handler will safely return the existing row
    const insertQuery = `
      INSERT INTO ${qualifyTable('tax_categories')} (
        id, hashavshevet_name, tax_excluded
      )
      VALUES ($1, $2, $3)
      ON CONFLICT (id) DO NOTHING
    `;

    await client.query(insertQuery, [entityId, options?.hashavshevetName, options?.taxExcluded ?? false]);
  } catch (error) {
    if (error instanceof EntityValidationError || error instanceof SeedError) {
      throw error;
    }

    throw new SeedError(
      `Failed to ensure tax category for entity ${entityId}`,
      { entityId, options },
      error as Error,
    );
  }
}
