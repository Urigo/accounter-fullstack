import type { Client } from 'pg';
import { makeUUID } from './deterministic-uuid.js';

export type SeedDemoUsersResult = {
  adminUserId: string;
  accountantUserId: string;
};

export type SeedDemoUsersDBConnection = Pick<Client, 'query'>;

export async function seedDemoUsers(
  dbConnection: SeedDemoUsersDBConnection,
  businessId: string,
): Promise<SeedDemoUsersResult> {
  const adminUserId = makeUUID('user', 'demo-admin');
  const accountantUserId = makeUUID('user', 'demo-accountant');

  await dbConnection.query(
    `INSERT INTO accounter_schema.business_users (user_id, business_id, role_id, auth0_user_id)
     VALUES
       ($1, $2, 'business_owner', $3),
       ($4, $2, 'accountant', NULL)
     ON CONFLICT (user_id, business_id) DO NOTHING`,
    [adminUserId, businessId, process.env.DEMO_AUTH0_USER_ID ?? null, accountantUserId],
  );

  return {
    adminUserId,
    accountantUserId,
  };
}
