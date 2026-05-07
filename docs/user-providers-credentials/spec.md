# Specification: Per-Tenant Provider Credentials

## 1. Background & Motivation

`GreenInvoiceClientProvider` and `DeelClientProvider` currently read API credentials from the global
`ENVIRONMENT` token (i.e. server `.env` variables `GREEN_INVOICE_ID`, `GREEN_INVOICE_SECRET`,
`DEEL_TOKEN`). This single-credential model is incompatible with the multi-tenant architecture:
every tenant (`owner_id`) needs its own set of credentials for each external provider.

This spec defines a new **`provider-credentials`** module that:

- Stores per-tenant API credentials encrypted in the database (RLS-enforced).
- Exposes GraphQL mutations for `business_owner`-only credential management.
- Exposes a read path that returns only metadata (never the raw secret) for display.
- Replaces the env-var credential lookup in `GreenInvoiceClientProvider` and `DeelClientProvider`.
- Provides the client UI ("Integrations" tab in admin context settings) for connecting and
  disconnecting providers.

---

## 2. Supported Providers (initial scope)

| Provider key    | Secret shape                     |
| --------------- | -------------------------------- |
| `green_invoice` | `{ id: string; secret: string }` |
| `deel`          | `{ apiToken: string }`           |

The design is forward-extensible: adding a new provider requires only a new enum value, a new
TypeScript payload type, and a new form section in the UI.

---

## 3. Database

### 3.1 Migration file

**File:** `packages/migrations/src/actions/<timestamp>.add-provider-credentials-table.ts`

```typescript
import { type MigrationExecutor } from '../pg-migrator.js'

export default {
  name: '<timestamp>.add-provider-credentials-table.sql',
  run: ({ sql }) => sql`
    CREATE TYPE accounter_schema.provider_key
      AS ENUM ('green_invoice', 'deel');

    CREATE TABLE accounter_schema.provider_credentials (
      owner_id    UUID        NOT NULL
        REFERENCES accounter_schema.businesses(id)
        ON DELETE CASCADE,
      provider    accounter_schema.provider_key NOT NULL,
      payload     TEXT        NOT NULL,         -- AES-256-GCM encrypted JSON blob
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (owner_id, provider)
    );

    -- RLS (mirrors the charges table pattern)
    ALTER TABLE accounter_schema.provider_credentials
      ENABLE ROW LEVEL SECURITY;

    CREATE POLICY tenant_isolation ON accounter_schema.provider_credentials
      FOR ALL
      USING  (owner_id = accounter_schema.get_current_business_id())
      WITH CHECK (owner_id = accounter_schema.get_current_business_id());

    ALTER TABLE accounter_schema.provider_credentials
      FORCE ROW LEVEL SECURITY;

    -- updated_at trigger (same pattern used across all tables)
    CREATE TRIGGER set_updated_at
      BEFORE UPDATE ON accounter_schema.provider_credentials
      FOR EACH ROW EXECUTE FUNCTION accounter_schema.update_updated_at_column();
  `
} satisfies MigrationExecutor
```

**Down migration** (for local rollback only — never run against deployed DBs):

```sql
DROP TABLE IF EXISTS accounter_schema.provider_credentials;
DROP TYPE  IF EXISTS accounter_schema.provider_key;
```

### 3.2 RLS notes

- `accounter_schema.get_current_business_id()` is already defined (see
  `2026-02-10T12-05-00.create-rls-helper-function.ts`).
- `TenantAwareDBClient` sets `app.current_business_id` before every query, so RLS is automatically
  enforced for all provider reads/writes that go through the normal DI path.
- Even if a developer accidentally bypasses the provider and calls `db.query()` directly, the RLS
  policy prevents cross-tenant data access.

---

## 4. Encryption

### 4.1 Algorithm

**AES-256-GCM** using Node's built-in `node:crypto`. This is the same algorithm used by the
scraper-app's vault (`packages/scraper-app/src/server/vault.ts`) and requires no external
dependency.

### 4.2 Key management

A single **`CREDENTIALS_ENCRYPTION_KEY`** environment variable holds a 32-byte hex-encoded symmetric
key (64 hex chars). It is set once per deployment and never stored in the database.

Add to `environment.ts`:

```typescript
const CredentialsModel = zod.object({
  CREDENTIALS_ENCRYPTION_KEY: zod
    .string()
    .length(64)
    .regex(/^[0-9a-f]+$/i)
})
```

This is a **required** field — the server will refuse to start without it.

**Key generation (one-time setup):**

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 4.3 Encrypted blob format

```
[iv (12 bytes)] [authTag (16 bytes)] [ciphertext (variable)]
```

Base64-encoded for storage. The IV is random per write; the authTag provides integrity verification.

### 4.4 Encryption helper

**File:** `packages/server/src/modules/provider-credentials/helpers/encryption.ts`

```typescript
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LEN = 12
const TAG_LEN = 16

export function encryptCredential(plaintext: string, keyHex: string): string {
  const key = Buffer.from(keyHex, 'hex')
  const iv = randomBytes(IV_LEN)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return Buffer.concat([iv, authTag, encrypted]).toString('base64')
}

export function decryptCredential(blob: string, keyHex: string): string {
  const buf = Buffer.from(blob, 'base64')
  const iv = buf.subarray(0, IV_LEN)
  const authTag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN)
  const body = buf.subarray(IV_LEN + TAG_LEN)
  const key = Buffer.from(keyHex, 'hex')
  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)
  return Buffer.concat([decipher.update(body), decipher.final()]).toString('utf8')
}
```

---

## 5. Server Module: `provider-credentials`

**Location:** `packages/server/src/modules/provider-credentials/`

### 5.1 Module structure

```
provider-credentials/
  index.ts
  types.ts
  typeDefs/
    provider-credentials.graphql.ts
  resolvers/
    provider-credentials.resolvers.ts
  providers/
    provider-credentials.provider.ts
  helpers/
    encryption.ts
    payload-schemas.ts          ← Zod schemas per provider
```

### 5.2 Payload schemas

**File:** `helpers/payload-schemas.ts`

```typescript
import { z } from 'zod'

export const GreenInvoicePayloadSchema = z.object({
  id: z.string().min(1),
  secret: z.string().min(1)
})

export const DeelPayloadSchema = z.object({
  apiToken: z.string().min(1)
})

export type GreenInvoicePayload = z.infer<typeof GreenInvoicePayloadSchema>
export type DeelPayload = z.infer<typeof DeelPayloadSchema>
```

### 5.3 Provider

**File:** `providers/provider-credentials.provider.ts`

```typescript
import { Inject, Injectable, Scope } from 'graphql-modules'
import { sql } from '@pgtyped/runtime'
import { GraphQLError } from 'graphql'
import { ENVIRONMENT } from '../../../shared/tokens.js'
import type { Environment } from '../../../shared/types/index.js'
import { TenantAwareDBClient } from '../../app-providers/tenant-db-client.js'
import { encryptCredential, decryptCredential } from '../helpers/encryption.js'
import {
  GreenInvoicePayloadSchema,
  DeelPayloadSchema,
  type GreenInvoicePayload,
  type DeelPayload
} from '../helpers/payload-schemas.js'

export type ProviderKey = 'green_invoice' | 'deel'

@Injectable({
  scope: Scope.Operation,
  global: true
})
export class ProviderCredentialsProvider {
  constructor(
    private db: TenantAwareDBClient,
    @Inject(ENVIRONMENT) private env: Environment
  ) {}

  private get encryptionKey(): string {
    const key = this.env.credentialsEncryptionKey
    if (!key) throw new Error('CREDENTIALS_ENCRYPTION_KEY is not configured')
    return key
  }

  /** Upsert encrypted credentials for a provider. */
  async setCredentials(provider: ProviderKey, payload: unknown): Promise<void> {
    // Validate payload shape before encrypting
    const schema = provider === 'green_invoice' ? GreenInvoicePayloadSchema : DeelPayloadSchema
    const parsed = schema.safeParse(payload)
    if (!parsed.success) {
      throw new GraphQLError(`Invalid credentials for provider "${provider}"`, {
        extensions: { code: 'BAD_USER_INPUT' }
      })
    }

    const encrypted = encryptCredential(JSON.stringify(parsed.data), this.encryptionKey)
    await this.db.query(
      `INSERT INTO accounter_schema.provider_credentials (owner_id, provider, payload)
       VALUES (accounter_schema.get_current_business_id(), $1, $2)
       ON CONFLICT (owner_id, provider) DO UPDATE
         SET payload = EXCLUDED.payload,
             updated_at = now()`,
      [provider, encrypted]
    )
  }

  /** Delete credentials for a provider (disconnect). */
  async deleteCredentials(provider: ProviderKey): Promise<void> {
    await this.db.query(
      `DELETE FROM accounter_schema.provider_credentials
       WHERE owner_id = accounter_schema.get_current_business_id()
         AND provider = $1`,
      [provider]
    )
  }

  /** Get metadata only (connected status + timestamp). Never returns the payload. */
  async getProviderStatuses(): Promise<Array<{ provider: ProviderKey; configuredAt: string }>> {
    const { rows } = await this.db.query<{ provider: ProviderKey; updated_at: Date }>(
      `SELECT provider, updated_at
       FROM accounter_schema.provider_credentials
       WHERE owner_id = accounter_schema.get_current_business_id()`
    )
    return rows.map(r => ({ provider: r.provider, configuredAt: r.updated_at.toISOString() }))
  }

  /** Decrypt and return typed payload — for internal server use only. Never expose to resolvers. */
  async getGreenInvoiceCredentials(): Promise<GreenInvoicePayload | null> {
    return this._getDecrypted('green_invoice', GreenInvoicePayloadSchema)
  }

  async getDeelCredentials(): Promise<DeelPayload | null> {
    return this._getDecrypted('deel', DeelPayloadSchema)
  }

  private async _getDecrypted<T>(
    provider: ProviderKey,
    schema: { parse: (v: unknown) => T }
  ): Promise<T | null> {
    const { rows } = await this.db.query<{ payload: string }>(
      `SELECT payload FROM accounter_schema.provider_credentials
       WHERE owner_id = accounter_schema.get_current_business_id() AND provider = $1`,
      [provider]
    )
    if (!rows[0]) return null
    try {
      return schema.parse(JSON.parse(decryptCredential(rows[0].payload, this.encryptionKey)))
    } catch {
      throw new GraphQLError(`Failed to decrypt credentials for provider "${provider}"`)
    }
  }
}
```

### 5.4 GraphQL schema

**File:** `typeDefs/provider-credentials.graphql.ts`

```graphql
enum ProviderKey {
  green_invoice
  deel
}

type ProviderCredentialStatus {
  provider: ProviderKey!
  configuredAt: DateTime!
}

type ProviderCredentialResult {
  provider: ProviderKey!
  configuredAt: DateTime!
}

type ProviderCredentialDeleteResult {
  provider: ProviderKey!
  success: Boolean!
}

type CommonError {
  message: String!
}

union SetProviderCredentialsResult = ProviderCredentialResult | CommonError
union DeleteProviderCredentialsResult = ProviderCredentialDeleteResult | CommonError

extend type Query {
  providerCredentials: [ProviderCredentialStatus!]!
    @requiresAuth
    @requiresRole(role: "business_owner")
}

extend type Mutation {
  setGreenInvoiceCredentials(id: String!, secret: String!): SetProviderCredentialsResult!
    @requiresAuth
    @requiresRole(role: "business_owner")

  setDeelCredentials(apiToken: String!): SetProviderCredentialsResult!
    @requiresAuth
    @requiresRole(role: "business_owner")

  deleteProviderCredentials(provider: ProviderKey!): DeleteProviderCredentialsResult!
    @requiresAuth
    @requiresRole(role: "business_owner")
}
```

**Design notes:**

- Separate `set` mutations per provider (not a single mutation accepting a generic JSON blob)
  because it gives type-safe, self-documenting inputs and allows GraphQL codegen to generate correct
  typed variables.
- `providerCredentials` returns only `configuredAt` — the raw credentials are never sent to the
  client through GraphQL, even in encrypted form.
- The `ProviderKey` enum lives in GraphQL schema (not as a bare `String!`) to make the
  `deleteProviderCredentials` argument safe and enumerable.

### 5.5 Resolvers

**File:** `resolvers/provider-credentials.resolvers.ts`

```typescript
import { GraphQLError } from 'graphql'
import { ProviderCredentialsProvider } from '../providers/provider-credentials.provider.js'
import type { ProviderCredentialsModule } from '../types.js'

export const providerCredentialsResolvers: ProviderCredentialsModule.Resolvers = {
  Query: {
    providerCredentials: async (_parent, _args, { injector }) =>
      injector.get(ProviderCredentialsProvider).getProviderStatuses()
  },
  Mutation: {
    setGreenInvoiceCredentials: async (_parent, { id, secret }, { injector }) => {
      try {
        await injector
          .get(ProviderCredentialsProvider)
          .setCredentials('green_invoice', { id, secret })
        const [status] = await injector
          .get(ProviderCredentialsProvider)
          .getProviderStatuses()
          .then(s => s.filter(x => x.provider === 'green_invoice'))
        return { __typename: 'ProviderCredentialResult', ...status }
      } catch (e) {
        if (e instanceof GraphQLError) throw e
        return { __typename: 'CommonError', message: String(e) }
      }
    },

    setDeelCredentials: async (_parent, { apiToken }, { injector }) => {
      try {
        await injector.get(ProviderCredentialsProvider).setCredentials('deel', { apiToken })
        const [status] = await injector
          .get(ProviderCredentialsProvider)
          .getProviderStatuses()
          .then(s => s.filter(x => x.provider === 'deel'))
        return { __typename: 'ProviderCredentialResult', ...status }
      } catch (e) {
        if (e instanceof GraphQLError) throw e
        return { __typename: 'CommonError', message: String(e) }
      }
    },

    deleteProviderCredentials: async (_parent, { provider }, { injector }) => {
      try {
        await injector.get(ProviderCredentialsProvider).deleteCredentials(provider)
        return { __typename: 'ProviderCredentialDeleteResult', provider, success: true }
      } catch (e) {
        if (e instanceof GraphQLError) throw e
        return { __typename: 'CommonError', message: String(e) }
      }
    }
  }
}
```

### 5.6 Module index

**File:** `index.ts`

```typescript
import { createModule } from 'graphql-modules'
import { ProviderCredentialsProvider } from './providers/provider-credentials.provider.js'
import { providerCredentialsResolvers } from './resolvers/provider-credentials.resolvers.js'
import providerCredentials from './typeDefs/provider-credentials.graphql.js'

const __dirname = new URL('.', import.meta.url).pathname

export const providerCredentialsModule = createModule({
  id: 'providerCredentials',
  dirname: __dirname,
  typeDefs: [providerCredentials],
  resolvers: [providerCredentialsResolvers],
  providers: [ProviderCredentialsProvider]
})
```

---

## 6. Updating Existing Providers

### 6.1 `GreenInvoiceClientProvider`

Replace the `@Inject(ENVIRONMENT)` pattern with `ProviderCredentialsProvider`:

```typescript
// Before
constructor(
  private adminContextProvider: AdminContextProvider,
  @Inject(ENVIRONMENT) private env: Environment,
) {}

private async init() {
  const id = this.env.greenInvoice?.id;
  const secret = this.env.greenInvoice?.secret;
  if (!id || !secret) throw new Error('Environment variables not found');
  return init(id, secret);
}

// After
constructor(
  private adminContextProvider: AdminContextProvider,
  private credentialsProvider: ProviderCredentialsProvider,
) {}

private async init() {
  const creds = await this.credentialsProvider.getGreenInvoiceCredentials();
  if (!creds) {
    throw new GraphQLError('Green Invoice credentials not configured for this tenant', {
      extensions: { code: 'PROVIDER_NOT_CONFIGURED' },
    });
  }
  return init(creds.id, creds.secret);
}
```

The `@Inject(ENVIRONMENT)` import and `env: Environment` field are removed entirely from this
provider.

### 6.2 `DeelClientProvider`

```typescript
// Before
constructor(@Inject(ENVIRONMENT) private env: Environment) {
  this.apiToken = this.env.deel?.apiToken ?? null;
}

// After
constructor(private credentialsProvider: ProviderCredentialsProvider) {}

// In methods that call the Deel API, replace `this.apiToken` check:
private async getApiToken(): Promise<string> {
  const creds = await this.credentialsProvider.getDeelCredentials();
  if (!creds) {
    throw new GraphQLError('Deel credentials not configured for this tenant', {
      extensions: { code: 'PROVIDER_NOT_CONFIGURED' },
    });
  }
  return creds.apiToken;
}
```

All `this.apiToken` usages in `DeelClientProvider` are replaced with `await this.getApiToken()`.

### 6.3 Environment cleanup

Once the DB-based credentials are in place, remove from `environment.ts`:

- `GreenInvoiceModel` zod schema
- `DeelModel` zod schema
- `greenInvoice` and `deel` fields from the exported `env` object

These are **breaking for existing deployments** — coordinate with a migration runbook that moves the
values to the DB before removing the env vars.

### 6.4 Backward-compatible transition (optional)

To allow a gradual cutover without downtime, `getGreenInvoiceCredentials()` and
`getDeelCredentials()` can fall back to env vars if no DB row exists:

```typescript
async getGreenInvoiceCredentials(): Promise<GreenInvoicePayload | null> {
  const fromDb = await this._getDecrypted('green_invoice', GreenInvoicePayloadSchema);
  if (fromDb) return fromDb;
  // Fallback for existing deployments
  if (this.env.greenInvoice) return this.env.greenInvoice;
  return null;
}
```

Remove this fallback once all tenants have migrated.

---

## 7. Environment Changes

Add to `environment.ts`:

```typescript
const CredentialsModel = zod.object({
  CREDENTIALS_ENCRYPTION_KEY: zod
    .string()
    .length(64)
    .regex(/^[0-9a-f]+$/i)
})
```

Add to exported `env`:

```typescript
credentialsEncryptionKey: credentialsKey.CREDENTIALS_ENCRYPTION_KEY,
```

Add `CREDENTIALS_ENCRYPTION_KEY` to:

- `.env.template` (with a placeholder comment)
- Docker compose dev environment
- CI secrets / deployment environment config

---

## 8. Security Invariants

| Invariant                                    | How enforced                                                                                                              |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Raw credentials never stored in plaintext    | `encryptCredential()` called before every DB write in `setCredentials()`                                                  |
| Raw credentials never returned to the client | GraphQL resolvers only read/return `ProviderCredentialStatus`; `getDecrypted` is `private` and only used inside providers |
| Cross-tenant read/write blocked              | Postgres RLS `USING (owner_id = get_current_business_id())` enforced at DB layer                                          |
| Only `business_owner` can write credentials  | `@requiresRole(role: "business_owner")` on all set/delete mutations                                                       |
| Credentials in transit protected by TLS      | Auth0 JWT-protected GraphQL endpoint; credentials travel inside the TLS-encrypted request body                            |
| Resolver args not logged                     | Any structured logging middleware must redact `id`, `secret`, `apiToken` fields — add to logging redaction list           |
| Encryption key rotation                      | Re-encrypt all rows with the new key before removing the old key; no mechanism for this is automated yet (manual process) |

---

## 9. Error Handling

| Scenario                                      | Behavior                                                                                        |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Provider not configured (no DB row)           | `GraphQLError` with `extensions.code: 'PROVIDER_NOT_CONFIGURED'`                                |
| Invalid payload shape on write                | `GraphQLError` with `extensions.code: 'BAD_USER_INPUT'`                                         |
| Decryption failure (tampered blob, wrong key) | `GraphQLError` with generic message; detailed error is logged server-side only                  |
| DB error during write                         | Propagates as `GraphQLError`; transaction is automatically rolled back by `TenantAwareDBClient` |
| Missing `CREDENTIALS_ENCRYPTION_KEY`          | Server startup failure (Zod validation in `environment.ts`)                                     |

---

## 10. Client UI

### 10.1 Location

A new **"Provider Integrations"** section within the existing admin settings area. The closest
existing reference point is
`packages/client/src/components/business/client/integrations-section.tsx`, which shows a pattern of
provider cards with connect/disconnect flows.

### 10.2 New files

```
packages/client/src/
  components/
    admin-settings/
      provider-integrations/
        index.tsx                         ← Parent section (card grid)
        green-invoice-card.tsx            ← Connect/disconnect card
        deel-card.tsx                     ← Connect/disconnect card
        provider-credential-form.tsx      ← Shared form shell (dialog)
  hooks/
    use-set-green-invoice-credentials.ts
    use-set-deel-credentials.ts
    use-delete-provider-credentials.ts
```

### 10.3 GraphQL operations (in hook files, not separate `.graphql` files)

```graphql
# in use-set-green-invoice-credentials.ts
mutation SetGreenInvoiceCredentials($id: String!, $secret: String!) {
  setGreenInvoiceCredentials(id: $id, secret: $secret) {
    ... on ProviderCredentialResult {
      provider
      configuredAt
    }
    ... on CommonError {
      message
    }
  }
}

# in use-set-deel-credentials.ts
mutation SetDeelCredentials($apiToken: String!) {
  setDeelCredentials(apiToken: $apiToken) {
    ... on ProviderCredentialResult {
      provider
      configuredAt
    }
    ... on CommonError {
      message
    }
  }
}

# in use-delete-provider-credentials.ts
mutation DeleteProviderCredentials($provider: ProviderKey!) {
  deleteProviderCredentials(provider: $provider) {
    ... on ProviderCredentialDeleteResult {
      provider
      success
    }
    ... on CommonError {
      message
    }
  }
}

# in index.tsx
query ProviderCredentials {
  providerCredentials {
    provider
    configuredAt
  }
}
```

### 10.4 UI component behaviour

**`index.tsx`** — fetches `providerCredentials`, renders a card per known provider (even if not yet
connected).

**Provider card (example: `green-invoice-card.tsx`)**:

- **Disconnected**: shows provider name, description, a "Connect" button that opens a `Dialog`.
- **Connected**: shows a green badge, the `configuredAt` date, and a "Disconnect" button (with
  confirmation).
- Dialog contains a `Form` (react-hook-form + zod) with the credential fields for that provider.
- On submit: calls the hook, shows `toast.loading → toast.success / toast.error`.

**Form validation (Zod, client-side)**:

```typescript
// green-invoice
const schema = z.object({ id: z.string().min(1), secret: z.string().min(1) })
// deel
const schema = z.object({ apiToken: z.string().min(1) })
```

**Secret fields**: use `type="password"` on the input so the value is obscured. Do not disable
autocomplete via `autoComplete="off"` — password managers are fine here.

### 10.5 Hook pattern (follows existing conventions)

```typescript
// packages/client/src/hooks/use-set-green-invoice-credentials.ts
export const useSetGreenInvoiceCredentials = () => {
  const [{ fetching }, mutate] = useMutation(SetGreenInvoiceCredentialsDocument)
  const setCredentials = useCallback(
    async (variables: SetGreenInvoiceCredentialsMutationVariables) => {
      const NOTIFICATION_ID = 'set-green-invoice-credentials'
      toast.loading('Saving credentials...', { id: NOTIFICATION_ID })
      try {
        const res = await mutate(variables)
        const data = handleCommonErrors(
          res,
          'Error saving Green Invoice credentials',
          NOTIFICATION_ID
        )
        if (data) {
          toast.success('Green Invoice connected', { id: NOTIFICATION_ID })
          return data.setGreenInvoiceCredentials
        }
      } catch (e) {
        toast.error('Failed to save credentials', { id: NOTIFICATION_ID })
      }
    },
    [mutate]
  )
  return { fetching, setCredentials }
}
```

---

## 11. Module Registration

Register the new module in the server application:

**File:** `packages/server/src/modules-app.ts` (or equivalent application composition file)

```typescript
import { providerCredentialsModule } from './modules/provider-credentials/index.js'
// Add to the modules array:
// providerCredentialsModule,
```

---

## 12. Testing Plan

### 12.1 Unit tests — encryption helpers

**File:** `packages/server/src/modules/provider-credentials/helpers/__tests__/encryption.test.ts`

| Test                                                                 | Assertion                                              |
| -------------------------------------------------------------------- | ------------------------------------------------------ |
| `encryptCredential` + `decryptCredential` round-trips a string       | Decrypted output equals original                       |
| Different calls produce different IVs (non-deterministic ciphertext) | Two encryptions of same string produce different blobs |
| Tampered ciphertext fails decryption                                 | Throws on modified blob                                |
| Wrong key fails decryption                                           | Throws on key mismatch                                 |

### 12.2 Unit tests — payload schemas

**File:** `helpers/__tests__/payload-schemas.test.ts`

| Test                                                         |
| ------------------------------------------------------------ |
| `GreenInvoicePayloadSchema` rejects missing `id` or `secret` |
| `DeelPayloadSchema` rejects missing `apiToken`               |
| Valid payloads parse correctly                               |

### 12.3 Unit tests — provider

**File:** `providers/__tests__/provider-credentials.provider.test.ts`

Mirror the `admin-context.provider.test.ts` pattern: mock `TenantAwareDBClient` and assert:

| Test                                                                     |
| ------------------------------------------------------------------------ |
| `setCredentials` calls `db.query` with encrypted (not plaintext) payload |
| `getProviderStatuses` returns only metadata rows                         |
| `getGreenInvoiceCredentials` decrypts and validates against schema       |
| `getGreenInvoiceCredentials` returns `null` when no row exists           |
| `setCredentials` with invalid payload throws `BAD_USER_INPUT`            |
| `_getDecrypted` rethrows on decryption failure                           |

### 12.4 Integration tests — provider

**File:** `providers/__tests__/provider-credentials.integration.test.ts`

Use the `createProvider()`-style helper (see `admin-context-integration.test.ts`):

| Test                                                                 |
| -------------------------------------------------------------------- |
| Write + read round-trip returns correct payload                      |
| Two providers instantiated with different `businessId`s are isolated |
| `deleteCredentials` removes the row (subsequent read returns `null`) |

### 12.5 GraphQL resolver tests

**File:** `resolvers/__tests__/provider-credentials.resolvers.test.ts`

| Test                                                                       |
| -------------------------------------------------------------------------- |
| `providerCredentials` query returns status array                           |
| `setGreenInvoiceCredentials` returns `ProviderCredentialResult` on success |
| `setGreenInvoiceCredentials` returns `CommonError` when provider throws    |
| `deleteProviderCredentials` returns success                                |
| All mutations/queries require `business_owner` role (403 for other roles)  |

### 12.6 Client hook tests

**File:** `packages/client/src/hooks/__tests__/use-set-green-invoice-credentials.test.ts`

| Test                                                                  |
| --------------------------------------------------------------------- |
| Calls mutation with correct variables                                 |
| Shows loading toast, then success toast on `ProviderCredentialResult` |
| Shows error toast on `CommonError` union branch                       |

### 12.7 Client component tests

**File:**
`packages/client/src/components/admin-settings/provider-integrations/__tests__/green-invoice-card.test.tsx`

| Test                                                        |
| ----------------------------------------------------------- |
| Shows "Connect" button when not configured                  |
| Opens dialog on "Connect" click                             |
| Submit calls hook with form values                          |
| Shows "Disconnect" button and `configuredAt` when connected |
| "Disconnect" shows confirmation before calling delete hook  |

---

## 13. Implementation Order

1. **Migration** — create the `provider_credentials` table with RLS
2. **Environment** — add `CREDENTIALS_ENCRYPTION_KEY` to `environment.ts`; generate a key for dev
3. **Encryption helpers** + unit tests
4. **`ProviderCredentialsProvider`** + unit and integration tests
5. **GraphQL typeDefs + resolvers + module index** — run `yarn generate`
6. **Register module** in application
7. **Update `GreenInvoiceClientProvider`** to use `ProviderCredentialsProvider` (backward-compat
   fallback optional)
8. **Update `DeelClientProvider`** similarly
9. **Client hooks** + tests
10. **Client UI components** + tests
11. **E2E manual smoke test**: connect Green Invoice in UI → trigger a sync mutation → verify
    documents are fetched
12. **Env var cleanup** (coordinate with deployment): remove `GREEN_INVOICE_ID`,
    `GREEN_INVOICE_SECRET`, `DEEL_TOKEN` from `.env` and `environment.ts` after all tenants have
    migrated their credentials via the UI

---

## 14. Open Questions

- **Key rotation**: When the `CREDENTIALS_ENCRYPTION_KEY` is rotated, all existing blobs must be
  re-encrypted. This should be a one-off script (not automated yet); add as a follow-up task.
- **Audit log**: Should credential writes be logged (provider + timestamp, not the payload) in an
  audit table? Recommend yes for compliance, but out of scope for initial implementation.
- **Accountant visibility**: The current spec gives `business_owner`-only access. Should
  `accountant` role be able to see the connected/disconnected status (read-only)? Trivial to add
  (`@requiresAnyRole`) but needs product decision.
