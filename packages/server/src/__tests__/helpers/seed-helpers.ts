import type { PoolClient } from 'pg';

export interface EnsureFinancialEntityParams {
  name: string;
  type: string;
  ownerId?: string;
}

export interface FinancialEntityResult {
  id: string;
}

/**
 * Ensure a financial entity exists in the database (idempotent)
 * If an entity with the same (name, type, owner_id) exists, return it
 * Otherwise, insert and return the new entity
 * 
 * @param client - PostgreSQL client (should be within a transaction)
 * @param params - Entity parameters (name, type, ownerId)
 * @returns Promise resolving to object with entity id
 */
export async function ensureFinancialEntity(
  client: PoolClient,
  params: EnsureFinancialEntityParams,
): Promise<FinancialEntityResult> {
  const { name, type, ownerId } = params;

  // Check if entity already exists
  const selectQuery = `
    SELECT id
    FROM accounter_schema.financial_entities
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
  const insertQuery = `
    INSERT INTO accounter_schema.financial_entities (name, type, owner_id)
    VALUES ($1, $2, $3)
    RETURNING id
  `;

  const insertResult = await client.query<{ id: string }>(
    insertQuery,
    [name, type, ownerId ?? null],
  );

  return { id: insertResult.rows[0].id };
}

export interface EnsureBusinessForEntityOptions {
  noInvoicesRequired?: boolean;
}

/**
 * Ensure a business row exists for a given financial entity id (idempotent)
 * If a business with the given id already exists, do nothing
 * Otherwise, insert a new business row
 * 
 * @param client - PostgreSQL client (should be within a transaction)
 * @param entityId - Financial entity id to use as business id
 * @param options - Optional business configuration
 * @returns Promise resolving when complete
 */
export async function ensureBusinessForEntity(
  client: PoolClient,
  entityId: string,
  options?: EnsureBusinessForEntityOptions,
): Promise<void> {
  // Check if business already exists
  const selectQuery = `
    SELECT 1
    FROM accounter_schema.businesses
    WHERE id = $1
    LIMIT 1
  `;

  const existingResult = await client.query(selectQuery, [entityId]);

  if (existingResult.rows.length > 0) {
    return; // Business already exists
  }

  // Insert new business
  const insertQuery = `
    INSERT INTO accounter_schema.businesses (id, no_invoices_required)
    VALUES ($1, $2)
  `;

  await client.query(insertQuery, [entityId, options?.noInvoicesRequired ?? false]);
}
