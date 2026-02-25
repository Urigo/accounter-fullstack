import pg from 'pg';
import { env } from '../environment.js';
import { DBProvider } from '../modules/app-providers/db.provider.js';
import { Auth0ManagementService } from '../modules/auth/services/auth0-management.service.js';

const { Pool } = pg;

// Default Business ID for test users - ensuring it matches the one in .env or a known existing one
// Fallback to the one in .env or the common default
const TEST_BUSINESS_ID = env.authorization.adminBusinessId;

if (!TEST_BUSINESS_ID) {
  console.error(
    '[X] adminBusinessId (env.authorization.adminBusinessId) is not defined in environment.',
  );
  process.exit(1);
}

const testUsers = [
  { email: 'owner-test@example.com', roleId: 'business_owner', blocked: false },
  { email: 'accountant-test@example.com', roleId: 'accountant', blocked: false },
  { email: 'employee-test@example.com', roleId: 'employee', blocked: false },
  { email: 'scraper-test@example.com', roleId: 'scraper', blocked: true },
];

const TEST_PASSWORD = '[ENTER_SOME_PASSWORD_HERE]'; // Set a default password for all test users

async function createMigrationTestUsers() {
  console.log(`[i] Starting migration test users creation for Business ID: ${TEST_BUSINESS_ID}`);
  console.log(`[i] Test User Password will be set to: ${TEST_PASSWORD}`);

  const pool = new Pool({
    user: env.postgres.user,
    password: env.postgres.password,
    host: env.postgres.host,
    port: Number(env.postgres.port),
    database: env.postgres.db,
    ssl: env.postgres.ssl ? { rejectUnauthorized: false } : false,
    max: 1,
  });

  const dbProvider = new DBProvider(pool);
  const auth0Service = new Auth0ManagementService(env);
  const client = await dbProvider.pool.connect();

  // Verify/Fetch Business ID
  let businessId = TEST_BUSINESS_ID;
  const businessCheck = await client.query(
    'SELECT id FROM accounter_schema.businesses_admin WHERE id = $1',
    [businessId],
  );
  if (businessCheck.rowCount === 0) {
    console.warn(
      `[!] Business ID ${businessId} not found in DB. Fetching first available business...`,
    );
    const anyBusiness = await client.query(
      'SELECT id FROM accounter_schema.businesses_admin LIMIT 1',
    );
    if (anyBusiness.rowCount && anyBusiness.rowCount > 0) {
      businessId = anyBusiness.rows[0].id; // Assign to the let variable
      console.log(`[i] Using Business ID: ${businessId}`);
    } else {
      console.error('[X] No businesses found in DB. Cannot create users.');
      process.exit(1);
    }
  }

  try {
    for (const testUser of testUsers) {
      console.log(`[i] Processing test user: ${testUser.email} (${testUser.roleId})`);

      try {
        // 1. Check if user already exists in Auth0
        let auth0UserId: string | null = null;
        try {
          auth0UserId = await auth0Service.getUserByEmail(testUser.email);
        } catch (e) {
          console.warn(`   Warning: Could not look up user by email: ${(e as Error).message}`);
        }

        if (auth0UserId) {
          console.log(`   User already exists in Auth0: ${auth0UserId}. Checking blocked status.`);
          try {
            if (testUser.blocked) {
              await auth0Service.blockUser(auth0UserId);
              console.log(`   Existing Auth0 user ensured blocked.`);
            } else {
              await auth0Service.unblockUser(auth0UserId);
              console.log(`   Existing Auth0 user ensured unblocked.`);
            }
          } catch (e) {
            console.warn(
              `   Warning: Could not update block status for existing user: ${(e as Error).message}`,
            );
          }
        } else {
          // 2. Create Auth0 user (blocked by default in our service)
          try {
            auth0UserId = await auth0Service.createBlockedUser(testUser.email, TEST_PASSWORD);
            console.log(`   Auth0 user created: ${auth0UserId}`);

            // 3. Update block status based on test user config
            if (testUser.blocked) {
              console.log(`   Auth0 user kept blocked (as requested).`);
            } else {
              await auth0Service.unblockUser(auth0UserId);
              console.log(`   Auth0 user unblocked.`);
            }
          } catch (error) {
            const msg = (error as Error).message || '';
            if (
              msg.includes('Connection must be enabled') ||
              (error as { body?: { message?: string } }).body?.message?.includes(
                'Connection must be enabled',
              )
            ) {
              console.warn(
                `   [!] WARNING: Could not create Auth0 user automatically because the M2M Application is not enabled for the 'Username-Password-Authentication' connection.`,
              );
              console.warn(
                `       Please enable the client '${env.auth0?.clientId}' for the connection in Auth0 Dashboard -> Authentication -> Database -> Username-Password-Authentication -> Applications.`,
              );
              console.warn(
                `   [!] Proceeding with local record creation using a placeholder Auth0 ID. Note that login will fail until you map a real user.`,
              );
              auth0UserId = `placeholder|${testUser.email}`;
            } else {
              console.error(`Error creating Auth0 user:`, error);
              throw error;
            }
          }
        }

        // 4. Update the auth0_user_id in business_users if we found an ID
        if (auth0UserId) {
          try {
            const existingByAuth0 = await client.query(
              `SELECT user_id FROM accounter_schema.business_users WHERE auth0_user_id = $1 AND business_id = $2`,
              [auth0UserId, businessId],
            );

            if (existingByAuth0.rowCount === 0) {
              // Create new mapping
              await client.query(
                `INSERT INTO accounter_schema.business_users (user_id, auth0_user_id, business_id, role_id)
                    VALUES (gen_random_uuid(), $1, $2, $3)`,
                [auth0UserId, businessId, testUser.roleId],
              );
              console.log(`   Local record created (mapped via Auth0 ID).`);
            } else {
              console.log(`   Local record already exists for this Auth0 ID.`);
            }
          } catch (error) {
            console.error(`Error confirming/creating local record`, error);
          }
        }

        console.log(`[V] Ready: ${testUser.email}`);
      } catch (error) {
        console.error(`[X] Failed processing ${testUser.email}:`, error);
      }
    }

    console.log('[V] Migration test users process completed.');
  } finally {
    client.release();
    await pool.end();
  }
}

createMigrationTestUsers().catch(err => {
  console.error(err);
  process.exit(1);
});
