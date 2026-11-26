/**
 * `yarn local:tenant`: create a tenant in a LOCAL database, ready to receive a scrape, and print
 * how to run the server and the client as its owner with dev auth. See `USAGE` in
 * `./local-tenant-options.ts`.
 *
 * Safety: the connection is resolved from this command's environment (defaulting to the docker
 * compose database) and refused unless its host is local, with no override, BEFORE any module
 * that loads `.env` is imported. `seedAdminCore` comes from the server's test helpers, which load
 * the repo `.env` as a side effect of being imported; they are imported dynamically below, after
 * the check, and the `pg` client is built from the already-resolved connection, so nothing that
 * file says can change which database this writes to.
 *
 * What it reuses:
 * - `seedAdminCore` (`yarn seed:admin-context`'s admin context: the business, its authorities and
 *   tax categories, `user_context`), named after `--name`, its id derived like
 *   `bootstrapNewClient` derives it.
 * - `seedCountries`, the full countries table, as the vitest global setup seeds it.
 * - The SQL of `AdminBusinessesProvider.insertAdminBusiness`, `BusinessUsersProvider` and
 *   `ApiKeysProvider.generateApiKey` (key format, SHA-256 hash, audit entry). Those providers need
 *   an authenticated GraphQL operation (`ApiKeysProvider` requires a business owner,
 *   `bootstrapNewClient` a super-admin and Auth0), so the script issues the same statements itself.
 *
 * Idempotent: every insert is keyed by a deterministic id or `ON CONFLICT DO NOTHING`, and an
 * active API key is reported, not replaced (its value cannot be shown again), unless
 * `--rotate-api-key` is passed.
 */
import { createHash, randomBytes } from 'node:crypto';
import pg from 'pg';
import { makeUUID } from '../packages/server/src/shared/helpers/deterministic-uuid.js';
import {
  API_KEY_NAME,
  LOCAL_TENANT_COMMAND,
  parseLocalTenantArgs,
  resolveLocalConnection,
  startCommands,
  USAGE,
  type LocalConnection,
} from './local-tenant-options.js';

type TenantResult = {
  created: boolean;
  businessId: string;
  businessName: string;
  ownerUserId: string;
  apiKey: { id: string; plaintext: string | null; createdAt: Date };
  revokedKeys: number;
};

async function assertMigrated(client: pg.Client): Promise<void> {
  const { rows } = await client.query<{ business_users: string | null; roles: number }>(
    `SELECT to_regclass('accounter_schema.business_users')::text AS business_users,
            (SELECT count(*)::int FROM accounter_schema.roles
              WHERE id IN ('business_owner', 'scraper')) AS roles`,
  );
  if (!rows[0]?.business_users || rows[0].roles !== 2) {
    throw new Error(
      'The database is not migrated (no business_users table or roles). Run the migrations first.',
    );
  }
}

async function createTenant(
  client: pg.Client,
  { name, rotateApiKey }: { name: string; rotateApiKey: boolean },
): Promise<TenantResult> {
  // Imported here, after the target was checked: these modules load .env when imported.
  const [{ seedAdminCore }, { seedCountries }] = await Promise.all([
    import('../packages/server/scripts/seed-admin-context.js'),
    import('../packages/server/src/modules/countries/helpers/seed-countries.helper.js'),
  ]);

  const businessId = makeUUID('business', name);
  const ownerUserId = makeUUID('user', `local-tenant-owner:${businessId}`);

  await client.query('BEGIN');
  try {
    // Pin the RLS context to the new tenant before its first row exists (the
    // `allow_bootstrap_root` policy), as `bootstrapNewClient` and `scripts/seed.ts` do. Needed on
    // a non-superuser connection; harmless on the docker compose superuser.
    await client.query(
      `SELECT set_config('app.current_business_id', $1, true),
              set_config('app.current_business_scope', ARRAY[$1]::text, true)`,
      [businessId],
    );

    const existing = await client.query(
      `SELECT 1 FROM accounter_schema.user_context WHERE owner_id = $1`,
      [businessId],
    );
    const created = existing.rowCount === 0;

    await seedCountries(client);
    await seedAdminCore(client, { name });

    // AdminBusinessesProvider.insertAdminBusiness: business_users and api_keys reference it.
    await client.query(
      `INSERT INTO accounter_schema.businesses_admin (id, owner_id) VALUES ($1, $1)
       ON CONFLICT (id) DO NOTHING`,
      [businessId],
    );

    // The owner. No Auth0 user: dev auth resolves the membership by user_id alone.
    await client.query(
      `INSERT INTO accounter_schema.business_users (user_id, auth0_user_id, business_id, role_id)
       VALUES ($1, NULL, $2, 'business_owner')
       ON CONFLICT (user_id, business_id) DO NOTHING`,
      [ownerUserId, businessId],
    );

    let revokedKeys = 0;
    if (rotateApiKey) {
      const revoked = await client.query(
        `UPDATE accounter_schema.api_keys SET revoked_at = NOW()
         WHERE business_id = $1 AND name = $2 AND revoked_at IS NULL`,
        [businessId, API_KEY_NAME],
      );
      revokedKeys = revoked.rowCount ?? 0;
    }

    const active = await client.query<{ id: string; created_at: Date }>(
      `SELECT id, created_at FROM accounter_schema.api_keys
       WHERE business_id = $1 AND name = $2 AND role_id = 'scraper' AND revoked_at IS NULL
       ORDER BY created_at DESC LIMIT 1`,
      [businessId, API_KEY_NAME],
    );

    let apiKey: TenantResult['apiKey'];
    if (active.rows[0]) {
      apiKey = { id: active.rows[0].id, plaintext: null, createdAt: active.rows[0].created_at };
    } else {
      // ApiKeysProvider.generateApiKey: 64 random bytes as hex, stored as its SHA-256.
      const plaintext = randomBytes(64).toString('hex');
      const keyHash = createHash('sha256').update(plaintext).digest('hex');
      const inserted = await client.query<{ id: string; created_at: Date }>(
        `INSERT INTO accounter_schema.api_keys (business_id, role_id, key_hash, name)
         VALUES ($1, 'scraper', $2, $3)
         RETURNING id, created_at`,
        [businessId, keyHash, API_KEY_NAME],
      );
      const row = inserted.rows[0];
      await client.query(
        `INSERT INTO accounter_schema.audit_logs
           (business_id, user_id, auth0_user_id, action, entity, entity_id, details, ip_address)
         VALUES ($1, $2, NULL, 'API_KEY_CREATED', 'ApiKey', $3, $4::jsonb, NULL)`,
        [
          businessId,
          ownerUserId,
          row.id,
          JSON.stringify({ name: API_KEY_NAME, roleId: 'scraper', source: LOCAL_TENANT_COMMAND }),
        ],
      );
      apiKey = { id: row.id, plaintext, createdAt: row.created_at };
    }

    await client.query('COMMIT');
    return { created, businessId, businessName: name, ownerUserId, apiKey, revokedKeys };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

function report(result: TenantResult, connection: LocalConnection): void {
  const commands = startCommands(connection, result.ownerUserId);
  const lines = [
    '',
    result.created
      ? `✅ Created local tenant "${result.businessName}"`
      : `ℹ️  Local tenant "${result.businessName}" already exists; nothing was duplicated`,
    `   Database:       ${connection.user}@${connection.host}:${connection.port}/${connection.db}`,
    `   Business id:    ${result.businessId}`,
    `   Owner user id:  ${result.ownerUserId}  (role business_owner, no Auth0 user)`,
    `   API key id:     ${result.apiKey.id}  (role scraper, "${API_KEY_NAME}")`,
  ];
  if (result.revokedKeys > 0) {
    lines.push(`   Revoked ${result.revokedKeys} earlier local scraper key(s).`);
  }
  if (result.apiKey.plaintext) {
    lines.push(
      '',
      '🔑 Scraper API key. It is shown this once and only its hash is stored:',
      '',
      `   ${result.apiKey.plaintext}`,
      '',
      '   Send it as the X-API-Key header (the scraper app takes it as its API key).',
    );
  } else {
    lines.push(
      '',
      `🔑 An active scraper key already exists (created ${result.apiKey.createdAt.toISOString()}).`,
      '   Its value was printed when it was created and cannot be shown again.',
      `   To get a new one: ${LOCAL_TENANT_COMMAND} --name "${result.businessName}" --rotate-api-key`,
    );
  }
  lines.push(
    '',
    'Run the server and the client as this owner, with dev auth:',
    '',
    `  ${commands.build}`,
    `  ${commands.server}`,
    `  ${commands.client}`,
    '',
    'The prefix pins the server to this database; its other settings (CREDENTIALS_ENCRYPTION_KEY',
    'among them) still come from the repo .env, as listed in packages/server/.env.template.',
    '',
    `Other GraphQL clients authenticate with the header  ${commands.devAuthHeader}`,
    '(honoured only by a server started with ALLOW_DEV_AUTH=1).',
    '',
  );
  console.log(lines.join('\n'));
}

async function main(): Promise<void> {
  const args = parseLocalTenantArgs(process.argv.slice(2));
  if (args.help) {
    console.log(USAGE);
    return;
  }

  // Before anything connects or loads .env.
  const connection = resolveLocalConnection(process.env);

  const client = new pg.Client({
    host: connection.host,
    port: connection.port,
    database: connection.db,
    user: connection.user,
    password: connection.password,
    ssl: connection.ssl,
  });
  await client.connect();
  try {
    await assertMigrated(client);
    const result = await createTenant(client, args);
    report(result, connection);
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  console.error(`❌ ${LOCAL_TENANT_COMMAND} failed:\n${(error as Error).message ?? error}`);
  process.exit(1);
});
