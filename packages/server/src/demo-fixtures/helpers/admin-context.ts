import type { Client } from 'pg';
import { makeUUID } from './deterministic-uuid.js';

/**
 * Create (or fetch) the Accounter Admin Business financial entity and return its id.
 *
 * Simplified logic:
 * - Looks up existing row by id or by (type='business' AND name='Accounter Admin Business').
 * - If not found, inserts a self-owned business entity with a deterministic id.
 * - Returns the id of the Accounter Admin Business entity.
 */
export async function createAdminBusinessContext(client: Client): Promise<string> {
  const deterministicId = makeUUID('business', 'admin-business');

  // 1) Try find by deterministic id or by semantic key (type+name)
  const findResult = await client.query<{ id: string }>(
    `SELECT id
       FROM accounter_schema.financial_entities
      WHERE id = $1 OR (type = 'business' AND name = 'Accounter Admin Business')
      LIMIT 1`,
    [deterministicId],
  );

  if (findResult.rows.length > 0) {
    return findResult.rows[0].id;
  }

  // 2) Handle circular FK: financial_entities.owner_id → businesses.id ← businesses.id → financial_entities.id
  //    Resolution strategy:
  //    a) Insert financial_entity with NULL owner_id (breaks circular dependency temporarily)
  //    b) Insert business row (now has valid financial_entity reference)
  //    c) Update financial_entity to set owner_id = self (closes the circle)
  //
  //    This 3-step process is necessary because PostgreSQL doesn't support DEFERRABLE
  //    constraints on our foreign keys, and we need both tables to reference each other.
  const adminId = deterministicId;
  await client.query(
    `INSERT INTO accounter_schema.financial_entities (id, type, name, owner_id)
     VALUES ($1, 'business', 'Accounter Admin Business', NULL)`,
    [adminId],
  );

  // 3) Insert business row (references financial_entity)
  await client.query(
    `INSERT INTO accounter_schema.businesses (id)
     VALUES ($1)`,
    [adminId],
  );

  // 4) Update financial_entity to set owner_id (self-reference)
  await client.query(
    `UPDATE accounter_schema.financial_entities
     SET owner_id = $1
     WHERE id = $1`,
    [adminId],
  );

  return adminId;
}
