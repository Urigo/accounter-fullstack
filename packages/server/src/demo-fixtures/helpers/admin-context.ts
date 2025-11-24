import type { Client } from 'pg';
import { makeUUID } from './deterministic-uuid.js';

/**
 * Create (or fetch) the Admin Business financial entity and return its id.
 *
 * Simplified logic:
 * - Looks up existing row by id or by (type='business' AND name='Admin Business').
 * - If not found, inserts a self-owned business entity with a deterministic id.
 * - Returns the id of the Admin Business entity.
 */
export async function createAdminBusinessContext(client: Client): Promise<string> {
  const deterministicId = makeUUID('business', 'admin-business');

  // 1) Try find by deterministic id or by semantic key (type+name)
  const findResult = await client.query<{ id: string }>(
    `SELECT id
       FROM accounter_schema.financial_entities
      WHERE id = $1 OR (type = 'business' AND name = 'Admin Business')
      LIMIT 1`,
    [deterministicId],
  );

  if (findResult.rows.length > 0) {
    return findResult.rows[0].id;
  }

  // 2) Insert minimal self-owned admin business
  const adminId = deterministicId;
  await client.query(
    `INSERT INTO accounter_schema.financial_entities (id, type, name, owner_id)
     VALUES ($1, 'business', 'Admin Business', $1)`,
    [adminId],
  );

  return adminId;
}
