import type { PoolClient } from 'pg';
import { qualifyTable } from './test-db-config.js';
import { EntityValidationError, SeedError } from './seed-errors.js';
import { makeUUID } from '../factories/index.js';

/**
 * Valid financial entity types based on database schema
 */
export type FinancialEntityType = 'business' | 'tax_category' | 'tag';

/**
 * Valid financial entity types for runtime validation
 */
const VALID_ENTITY_TYPES: readonly FinancialEntityType[] = ['business', 'tax_category', 'tag'];

export interface EnsureFinancialEntityParams {
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
  client: PoolClient,
  params: EnsureFinancialEntityParams,
): Promise<FinancialEntityResult> {
  const { name, type, ownerId } = params;

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
    // Check if entity already exists
    const selectQuery = `
      SELECT id
      FROM ${qualifyTable('financial_entities')}
      WHERE name = $1
        AND type = $2
        AND (owner_id = $3 OR (owner_id IS NULL AND $3 IS NULL))
      LIMIT 1
    `;

    const existingResult = await client.query<{ id: string }>(
      selectQuery,
      [name, type, ownerId ?? null],
    );

    if (existingResult.rows.length > 0) {
      return { id: existingResult.rows[0].id };
    }

    // Insert new entity
    const newAdminId = makeUUID(type, name);

    const insertQuery = `
      INSERT INTO ${qualifyTable('financial_entities')} (id, name, type, owner_id)
      VALUES ($1, $2, $3, $4)
      RETURNING id
    `;

    const insertResult = await client.query<{ id: string }>(
      insertQuery,
      [newAdminId, name, type, ownerId ?? null],
    );

    const row = insertResult.rows[0];
    if (!row) {
      throw new SeedError(
        'INSERT returned no rows',
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

export interface EnsureBusinessForEntityOptions {
  noInvoicesRequired?: boolean;
}

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
  client: PoolClient,
  entityId: string,
  options?: EnsureBusinessForEntityOptions,
): Promise<void> {
  // Validate entityId format (basic UUID check)
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidPattern.test(entityId)) {
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

    // Check if business already exists
    const selectQuery = `
      SELECT 1
      FROM ${qualifyTable('businesses')}
      WHERE id = $1
      LIMIT 1
    `;

    const existingResult = await client.query(selectQuery, [entityId]);

    if (existingResult.rows.length > 0) {
      return; // Business already exists, preserve existing values
    }

    // Insert new business
    const insertQuery = `
      INSERT INTO ${qualifyTable('businesses')} (id, no_invoices_required)
      VALUES ($1, $2)
    `;

    await client.query(insertQuery, [entityId, options?.noInvoicesRequired ?? false]);
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

export interface EnsureTaxCategoryForEntityOptions {
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
  client: PoolClient,
  entityId: string,
  options?: EnsureTaxCategoryForEntityOptions,
): Promise<void> {
  // Validate entityId format (basic UUID check)
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidPattern.test(entityId)) {
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

    // Check if tax category already exists
    const selectQuery = `
      SELECT 1
      FROM ${qualifyTable('tax_categories')}
      WHERE id = $1
      LIMIT 1
    `;

    const existingResult = await client.query(selectQuery, [entityId]);

    if (existingResult.rows.length > 0) {
      return; // Tax category already exists, preserve existing values
    }

    // Insert new tax category
    const insertQuery = `
      INSERT INTO ${qualifyTable('tax_categories')} (id)
      VALUES ($1)
    `;

    await client.query(insertQuery, [entityId]);
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
