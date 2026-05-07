# Blueprint: Per-Tenant Provider Credentials

## High-Level Plan

The feature has five distinct vertical slices, each building on the previous:

1. **Database foundation** — encrypted-at-rest storage with RLS
2. **Server encryption layer** — pure helpers, fully unit-testable with no DB dependency
3. **Server provider + GraphQL module** — DI-wired business logic, typed schema, resolvers
4. **Existing provider migration** — wire `GreenInvoiceClientProvider` and `DeelClientProvider` to
   use the new provider instead of `ENVIRONMENT`
5. **Client UI** — hooks + components that expose the connect/disconnect flow to users

---

## Chunk Breakdown (before size-tuning)

| #   | Chunk                         | Deliverables                                                  |
| --- | ----------------------------- | ------------------------------------------------------------- |
| A   | DB migration + env key        | Migration file, `CREDENTIALS_ENCRYPTION_KEY` in environment   |
| B   | Encryption helpers            | `encryption.ts`, unit tests                                   |
| C   | Payload schemas               | `payload-schemas.ts`, unit tests                              |
| D   | `ProviderCredentialsProvider` | Provider class, unit tests, integration tests                 |
| E   | GraphQL module                | typeDefs, resolvers, `index.ts`, module registration, codegen |
| F   | Wire GreenInvoice             | Update `GreenInvoiceClientProvider`, env cleanup              |
| G   | Wire Deel                     | Update `DeelClientProvider`, env cleanup                      |
| H   | Client hooks                  | 3 mutation hooks + `ProviderCredentials` query                |
| I   | Client UI                     | `index.tsx`, `green-invoice-card.tsx`, `deel-card.tsx`        |

---

## Size-tuned Steps

After review, chunks B+C can merge (both are pure functions, no DI), and H+I must stay separate
(hooks must exist before components). F and G are independent but small enough to be one step. The
final step list:

| Step | What gets built                             | Verifiable after                                       |
| ---- | ------------------------------------------- | ------------------------------------------------------ |
| 1    | DB migration                                | `yarn local:setup` runs clean                          |
| 2    | Env key                                     | Server starts; Zod rejects missing key                 |
| 3    | Encryption + payload helpers + tests        | `yarn test` green                                      |
| 4    | `ProviderCredentialsProvider` + unit tests  | `yarn test` green                                      |
| 5    | Provider integration tests                  | `yarn test` green                                      |
| 6    | GraphQL typeDefs + resolvers + module index | `yarn generate` succeeds; module registered            |
| 7    | Wire GreenInvoice + Deel                    | Existing behavior preserved (backward-compat fallback) |
| 8    | Client hooks                                | Codegen produces typed hooks                           |
| 9    | Client UI components                        | UI renders; can connect/disconnect a provider          |

---

## Implementation Prompts

---

### Step 1 — Database Migration

```
Context
-------
This codebase is a Yarn Berry monorepo. The migrations package lives at
`packages/migrations/src/`. Every migration is a TypeScript file in `actions/` that exports a
default `MigrationExecutor` object. The file is then imported and added to the MIGRATIONS array
in `packages/migrations/src/run-pg-migrations.ts`. RLS is already in use (see
`2026-02-10T12-10-00.enable-rls-charges-pilot.ts` as a reference). The helper function
`accounter_schema.get_current_business_id()` is already defined.

Task
----
Create the file:
  packages/migrations/src/actions/2026-05-07T12-00-00.add-provider-credentials-table.ts

It must:
1. Create the enum type `accounter_schema.provider_key` with values `'green_invoice'` and `'deel'`.
2. Create the table `accounter_schema.provider_credentials` with columns:
   - `owner_id UUID NOT NULL` referencing `accounter_schema.businesses(id) ON DELETE CASCADE`
   - `provider accounter_schema.provider_key NOT NULL`
   - `payload TEXT NOT NULL`  (encrypted blob — comment this)
   - `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`
   - `updated_at TIMESTAMPTZ NOT NULL DEFAULT now()`
   - PRIMARY KEY `(owner_id, provider)`
3. Enable RLS on the table.
4. Create policy `tenant_isolation` FOR ALL using `owner_id = accounter_schema.get_current_business_id()`.
5. FORCE ROW LEVEL SECURITY.
6. Create a BEFORE UPDATE trigger named `set_updated_at` that calls
   `accounter_schema.update_updated_at_column()` (this trigger function already exists).

Then import and register this migration in `packages/migrations/src/run-pg-migrations.ts`,
following the exact same naming convention used for every other entry in that file (convert the
timestamp to snake_case variable name, add the import, and append to the MIGRATIONS array).

Do not add down-migration logic inside the `run` function — migrations are never auto-rolled back.

Verification: run `yarn local:setup` and confirm it completes without errors.
```

---

### Step 2 — Environment: Encryption Key

```
Context
-------
The server's environment is validated at startup in `packages/server/src/environment.ts` using Zod.
Each provider has its own zod model (e.g. `GreenInvoiceModel`, `DeelModel`). Valid config is parsed
and assembled into the exported `env` object, which is typed as `Environment` and injected
application-wide via the `ENVIRONMENT` token.

Task
----
1. Add a new Zod model in `packages/server/src/environment.ts`:

   const CredentialsModel = zod.object({
     CREDENTIALS_ENCRYPTION_KEY: zod.string().length(64).regex(/^[0-9a-f]+$/i),
   });

2. Parse it alongside the other models:

   credentials: CredentialsModel.safeParse(process.env),

3. Extract it:

   const credentials = extractConfig(configs.credentials);

4. Add `credentialsEncryptionKey` to the exported `env` object:

   credentialsEncryptionKey: credentials.CREDENTIALS_ENCRYPTION_KEY,

5. Add `CREDENTIALS_ENCRYPTION_KEY=<generate a real 64-char hex value>` to the repo-level `.env`
   file (for local development). Generate the value with:
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

6. Add `CREDENTIALS_ENCRYPTION_KEY=<placeholder>` with a descriptive comment to
   `packages/server/src/env.template` if one exists.

Verification: the server starts normally; deliberately remove the env var and confirm the server
exits with a Zod validation error mentioning CREDENTIALS_ENCRYPTION_KEY.
```

---

### Step 3 — Encryption Helpers + Payload Schemas + Unit Tests

```
Context
-------
The scraper-app vault (`packages/scraper-app/src/server/vault.ts`) already uses AES-256-GCM with
`node:crypto`. Follow the same pattern. The server uses `vitest` for all unit tests. Test files
live in `__tests__/` subdirectories adjacent to the source they test. All imports use `.js`
extension suffixes (ESM convention).

Task
----
Create the following files:

--- packages/server/src/modules/provider-credentials/helpers/encryption.ts ---

Export two functions using `node:crypto` (no external deps):

  export function encryptCredential(plaintext: string, keyHex: string): string
  export function decryptCredential(blob: string, keyHex: string): string

Blob format: [iv (12 bytes)][authTag (16 bytes)][ciphertext] — all base64-encoded as a single
string. Algorithm: aes-256-gcm. Key is derived from `Buffer.from(keyHex, 'hex')`.

--- packages/server/src/modules/provider-credentials/helpers/payload-schemas.ts ---

Export using zod (already a project dependency):

  export const GreenInvoicePayloadSchema = z.object({ id: z.string().min(1), secret: z.string().min(1) })
  export const DeelPayloadSchema = z.object({ apiToken: z.string().min(1) })
  export type GreenInvoicePayload = z.infer<typeof GreenInvoicePayloadSchema>
  export type DeelPayload = z.infer<typeof DeelPayloadSchema>

--- packages/server/src/modules/provider-credentials/helpers/__tests__/encryption.test.ts ---

Write vitest tests covering:
1. Round-trip: encryptCredential then decryptCredential returns original string.
2. Non-determinism: two encryptions of the same plaintext produce different blobs (random IV).
3. Tamper detection: modifying a single byte of the ciphertext section causes decryptCredential
   to throw.
4. Wrong key: decryptCredential with a different key throws.

Use a fixed 64-char hex test key. Do not use `randomBytes` in tests — generate a static key:
  const TEST_KEY = 'a'.repeat(64)

--- packages/server/src/modules/provider-credentials/helpers/__tests__/payload-schemas.test.ts ---

Write vitest tests covering:
1. GreenInvoicePayloadSchema rejects `{}`, `{ id: '' }`, `{ id: 'x' }` (missing secret).
2. DeelPayloadSchema rejects `{}`, `{ apiToken: '' }`.
3. Both schemas accept valid inputs.

Verification: `yarn test` passes for both new test files.
```

---

### Step 4 — `ProviderCredentialsProvider` + Unit Tests

```
Context
-------
Providers in this codebase follow this pattern (see AdminContextProvider as the canonical
reference):
- `@Injectable({ scope: Scope.Operation, global: true })` decorator
- Constructor injects `TenantAwareDBClient` (not `DBProvider`) and other DI tokens
- DB queries go through `this.db.query(...)` — never raw pg
- `@Inject(ENVIRONMENT)` injects the env token for config values
- All imports end in `.js`

The `ProviderCredentialsProvider` must NOT be registered in `modules-app.ts` yet — that comes
in Step 6.

Task
----
Create:

--- packages/server/src/modules/provider-credentials/providers/provider-credentials.provider.ts ---

@Injectable({ scope: Scope.Operation, global: true })
export class ProviderCredentialsProvider

Constructor injects:
  - private db: TenantAwareDBClient
  - @Inject(ENVIRONMENT) private env: Environment

Private getter `encryptionKey` reads `this.env.credentialsEncryptionKey` and throws if missing.

Public methods:
  - async setCredentials(provider: 'green_invoice' | 'deel', payload: unknown): Promise<void>
    Validates `payload` against the appropriate Zod schema. Throws GraphQLError with
    extensions.code 'BAD_USER_INPUT' if invalid. Encrypts with encryptCredential, then upserts
    using ON CONFLICT (owner_id, provider) DO UPDATE.
    The INSERT uses the literal `accounter_schema.get_current_business_id()` as the owner_id
    value (the function is evaluated server-side at query time).

  - async deleteCredentials(provider: 'green_invoice' | 'deel'): Promise<void>
    Deletes the row for the current tenant + provider.

  - async getProviderStatuses(): Promise<Array<{ provider: string; configuredAt: string }>>
    Returns provider + updated_at (as ISO string) for all rows belonging to the current tenant.
    Never returns the payload column.

  - async getGreenInvoiceCredentials(): Promise<GreenInvoicePayload | null>
    Internal use only. Reads, decrypts, validates, returns null if no row.

  - async getDeelCredentials(): Promise<DeelPayload | null>
    Same pattern.

  Private method:
  - async _getDecrypted<T>(provider, schema): Promise<T | null>
    Shared implementation for the two credential getters. On decryption or parse failure,
    throws GraphQLError with a generic message (log the detail server-side).

--- packages/server/src/modules/provider-credentials/providers/__tests__/provider-credentials.provider.test.ts ---

Follow the exact pattern of `admin-context.provider.test.ts`:
- Mock `TenantAwareDBClient` with `vi.fn()` for the `query` method.
- Construct `ProviderCredentialsProvider` directly (no DI container needed).
- The `ENVIRONMENT` token injection is replaced with a plain object:
  `const env = { credentialsEncryptionKey: 'a'.repeat(64) } as unknown as Environment`

Tests:
1. `setCredentials('green_invoice', validPayload)` calls `db.query` once; the query string
   contains 'INSERT' and 'provider_credentials'; the payload argument to query is encrypted
   (not the plaintext).
2. `setCredentials('green_invoice', { id: '' })` throws GraphQLError with code BAD_USER_INPUT
   and does NOT call `db.query`.
3. `getProviderStatuses()` with two rows returns array of `{ provider, configuredAt }` with no
   payload field.
4. `getGreenInvoiceCredentials()` with no rows returns null.
5. `getGreenInvoiceCredentials()` with a valid encrypted row returns the decrypted payload.
6. `deleteCredentials` calls `db.query` with DELETE statement.

Verification: `yarn test` passes for the new test file.
```

---

### Step 5 — Provider Integration Tests

```
Context
-------
The integration test pattern for providers uses lightweight DI-less construction with mocked
dependencies (no real DB needed). See
`packages/server/src/modules/admin-context/__tests__/admin-context-integration.test.ts` for the
exact pattern: a `createProvider()` helper that wires a real provider instance to a mocked DB.

Task
----
Create:

--- packages/server/src/modules/provider-credentials/providers/__tests__/provider-credentials.integration.test.ts ---

Use the same `createProvider()` helper style as the admin-context integration test.
The helper accepts `{ businessId: string | null }` and returns `{ provider, query }`.

The mock `db.query` must be configurable per-test via `mockResolvedValueOnce` to simulate
different DB responses.

Tests:
1. Write + read round-trip: call `setCredentials` then override `db.query` to return the
   encrypted row and verify `getGreenInvoiceCredentials()` returns the original plaintext
   payload after decryption.
   (This tests that encrypt → store → retrieve → decrypt works end-to-end without a real DB.)

2. Tenant isolation: create two provider instances with different `businessId`s (simulated by
   different mock DB responses). Verify that each instance reads back only its own data when
   running in parallel (Promise.all). No cross-contamination.

3. `deleteCredentials` followed by `getGreenInvoiceCredentials` (mock returns 0 rows after delete)
   returns null.

4. `setCredentials` with an invalid payload throws BAD_USER_INPUT before any DB call.

Verification: `yarn test` passes.
```

---

### Step 6 — GraphQL Module: typeDefs, Resolvers, Index, Registration

```
Context
-------
Each GraphQL module has: `typeDefs/<name>.graphql.ts` (uses `gql` from `graphql-modules`),
`resolvers/<name>.resolvers.ts`, `index.ts` (calls `createModule`), and `types.ts`.

The `CommonError` type may already exist in the schema. Check
`packages/server/src/modules/common/` before declaring it — if it exists there, do NOT redeclare
it in the new module's typeDefs; just reference it in the union.

After adding typeDefs, run `yarn generate` to produce `__generated__/types` before writing
resolver type annotations.

The module must be registered in two places:
1. Imported and listed in the `modules` array of `createGraphQLApp` in
   `packages/server/src/modules-app.ts`
2. `ProviderCredentialsProvider` added to the `providers` array in the same function

Task
----
1. Create `packages/server/src/modules/provider-credentials/typeDefs/provider-credentials.graphql.ts`

   Content (use `gql` from `graphql-modules`):
   - Enum `ProviderKey` with values `green_invoice` and `deel`
   - Type `ProviderCredentialStatus { provider: ProviderKey!, configuredAt: DateTime! }`
   - Type `ProviderCredentialResult { provider: ProviderKey!, configuredAt: DateTime! }`
   - Type `ProviderCredentialDeleteResult { provider: ProviderKey!, success: Boolean! }`
   - Union `SetProviderCredentialsResult = ProviderCredentialResult | CommonError`
   - Union `DeleteProviderCredentialsResult = ProviderCredentialDeleteResult | CommonError`
   - `extend type Query { providerCredentials: [ProviderCredentialStatus!]! @requiresAuth @requiresRole(role: "business_owner") }`
   - `extend type Mutation { setGreenInvoiceCredentials(id: String!, secret: String!): SetProviderCredentialsResult! @requiresAuth @requiresRole(role: "business_owner") }`
   - `extend type Mutation { setDeelCredentials(apiToken: String!): SetProviderCredentialsResult! @requiresAuth @requiresRole(role: "business_owner") }`
   - `extend type Mutation { deleteProviderCredentials(provider: ProviderKey!): DeleteProviderCredentialsResult! @requiresAuth @requiresRole(role: "business_owner") }`

2. Run `yarn generate` to produce types.

3. Create `packages/server/src/modules/provider-credentials/types.ts`
   Re-export from `__generated__/types.js` as needed.

4. Create `packages/server/src/modules/provider-credentials/resolvers/provider-credentials.resolvers.ts`

   Follow the resolver pattern from the graphql-server rules:
   - Query.providerCredentials: delegates to `injector.get(ProviderCredentialsProvider).getProviderStatuses()`
   - Mutation.setGreenInvoiceCredentials: calls `setCredentials('green_invoice', { id, secret })`,
     then re-reads status to return `ProviderCredentialResult`. Catches errors and returns
     `CommonError` (do NOT re-throw GraphQLErrors — wrap them in the union type).
   - Mutation.setDeelCredentials: same pattern for deel.
   - Mutation.deleteProviderCredentials: calls `deleteCredentials(provider)`, returns
     `ProviderCredentialDeleteResult` on success, `CommonError` on failure.

5. Create `packages/server/src/modules/provider-credentials/index.ts`
   Standard `createModule` registration with providers: [ProviderCredentialsProvider].

6. In `packages/server/src/modules-app.ts`:
   - Import `providerCredentialsModule` from the new module index.
   - Add it to the `modules` array (after `greenInvoiceModule` is a natural location).
   - Import `ProviderCredentialsProvider`.
   - Add `ProviderCredentialsProvider` to the `providers` array (after `GreenInvoiceClientProvider`).

Verification: `yarn generate` runs without errors. The server starts. Introspecting the schema
shows `providerCredentials`, `setGreenInvoiceCredentials`, `setDeelCredentials`,
`deleteProviderCredentials`.
```

---

### Step 7 — Wire GreenInvoice and Deel to Use DB Credentials

```
Context
-------
`GreenInvoiceClientProvider` is in `packages/server/src/modules/app-providers/green-invoice-client.ts`.
`DeelClientProvider` is in `packages/server/src/modules/app-providers/deel/deel-client.provider.ts`.
Both currently inject `@Inject(ENVIRONMENT)` and read credentials from `this.env`.

The backward-compatible fallback (DB → env fallback) is REQUIRED for this step because the env
vars have not been removed yet. This ensures zero downtime: existing deployments that have
`GREEN_INVOICE_ID` / `DEEL_TOKEN` set continue to work unchanged.

Task
----

1. Update `GreenInvoiceClientProvider`:

   a. Add `ProviderCredentialsProvider` to the constructor (keep `@Inject(ENVIRONMENT)` and
      `env` for now — they are still needed for the fallback).

   b. Replace the `init()` method body:
      - First try `credentialsProvider.getGreenInvoiceCredentials()` (DB row)
      - If null, fall back to `this.env.greenInvoice` (existing behavior)
      - If both are null, throw with message
        'Green Invoice credentials not configured for this tenant'
        and extensions.code 'PROVIDER_NOT_CONFIGURED'
      - Call `init(creds.id, creds.secret)` with whichever credentials resolved.

2. Update `DeelClientProvider`:

   a. Add `ProviderCredentialsProvider` to the constructor (keep `@Inject(ENVIRONMENT)`).

   b. Replace the `this.apiToken` field initialization with a private async method:

      private async getApiToken(): Promise<string>
        - First try `credentialsProvider.getDeelCredentials()` → `creds.apiToken`
        - Fall back to `this.env.deel?.apiToken`
        - If neither, throw GraphQLError 'Deel credentials not configured for this tenant'
          with extensions.code 'PROVIDER_NOT_CONFIGURED'

   c. Replace all `this.apiToken` usages in fetch headers with `await this.getApiToken()`.
      The existing check `if (!this.apiToken) throw ...` is replaced by the new method.

3. No changes to `modules-app.ts` are needed — both providers are already registered there, and
   `ProviderCredentialsProvider` was added in Step 6.

Verification:
- `yarn test` passes (existing tests should still pass).
- Start the dev server. If `GREEN_INVOICE_ID` / `DEEL_TOKEN` are set in `.env`, their
  functionality should be unchanged. If they are not set but a DB row exists (insert one
  manually for testing), the provider uses the DB credentials.
```

---

### Step 8 — Client: GraphQL Hooks

```
Context
-------
Client hooks live in `packages/client/src/hooks/`. The pattern (from `use-update-admin-business.ts`
and `use-sync-green-invoice-documents.ts`) is:
1. A GraphQL operation is declared inside the file as a `/* GraphQL */` tagged template comment
   (used by codegen — NOT a real function call).
2. `useMutation` / `useQuery` from `urql` is called with the generated Document.
3. `handleCommonErrors` from `'../helpers/error-handling.js'` handles the result.
4. `toast` from `'sonner'` provides loading/success/error feedback.
5. The hook returns `{ fetching, <actionName> }`.

Run `yarn generate` after creating the hook files so codegen picks up the inline operations
and generates typed Documents.

Task
----
Create the following four files:

--- packages/client/src/hooks/use-set-green-invoice-credentials.ts ---

GraphQL mutation (inline comment):
  mutation SetGreenInvoiceCredentials($id: String!, $secret: String!) {
    setGreenInvoiceCredentials(id: $id, secret: $secret) {
      ... on ProviderCredentialResult { provider configuredAt }
      ... on CommonError { message }
    }
  }

Hook: `useSetGreenInvoiceCredentials`
Returns: `{ fetching: boolean, setCredentials: (vars) => Promise<...> }`
NOTIFICATION_ID: 'set-green-invoice-credentials'
Success toast: 'Green Invoice connected'
Error toast: 'Failed to save Green Invoice credentials'

--- packages/client/src/hooks/use-set-deel-credentials.ts ---

GraphQL mutation:
  mutation SetDeelCredentials($apiToken: String!) {
    setDeelCredentials(apiToken: $apiToken) {
      ... on ProviderCredentialResult { provider configuredAt }
      ... on CommonError { message }
    }
  }

Hook: `useSetDeelCredentials`
Returns: `{ fetching: boolean, setCredentials: (vars) => Promise<...> }`
NOTIFICATION_ID: 'set-deel-credentials'
Success toast: 'Deel connected'

--- packages/client/src/hooks/use-delete-provider-credentials.ts ---

GraphQL mutation:
  mutation DeleteProviderCredentials($provider: ProviderKey!) {
    deleteProviderCredentials(provider: $provider) {
      ... on ProviderCredentialDeleteResult { provider success }
      ... on CommonError { message }
    }
  }

Hook: `useDeleteProviderCredentials`
Returns: `{ fetching: boolean, deleteCredentials: (vars) => Promise<...> }`
NOTIFICATION_ID: 'delete-provider-credentials'
Success toast: 'Provider disconnected'

--- packages/client/src/hooks/use-provider-credentials.ts ---

GraphQL query (NOT a mutation — uses `useQuery`):
  query ProviderCredentials {
    providerCredentials {
      provider
      configuredAt
    }
  }

Hook: `useProviderCredentials`
Returns: `{ data, fetching, error, refetch }`
This hook is used by the parent UI component to know which providers are connected.

After creating the files, run `yarn generate` to produce typed Documents.

Verification: `yarn generate` succeeds with no errors. TypeScript does not report errors
in the new hook files.
```

---

### Step 9 — Client: UI Components

```
Context
-------
Client components live in `packages/client/src/components/`. The conventions (from
`client-components.md`):
- Named function exports, `ReactElement` return type.
- shadcn/ui components from `'./ui/<component>.js'` or `'../../ui/<component>.js'` relative paths.
- Forms use `react-hook-form` + `zod` + shadcn `Form`.
- Dialogs use shadcn `Dialog` components.
- Loading state: `<Loader2 className="h-10 w-10 animate-spin" />` from `lucide-react`.
- Error state: `<Alert variant="destructive">`.
- `useQuery` for reading, custom hooks for mutations.

The parent component at `index.tsx` calls `useProviderCredentials` to get the list of connected
providers, and passes the relevant status down to each card component as a prop.

Task
----
Create the following files:

--- packages/client/src/components/admin-settings/provider-integrations/index.tsx ---

Fetches `useProviderCredentials`. Shows a loading spinner while fetching. Shows a grid of two
cards: `<GreenInvoiceCard>` and `<DeelCard>`. Passes the matching `ProviderCredentialStatus`
(or `undefined`) as a `status` prop to each card. Exports: `export function ProviderIntegrations`.

--- packages/client/src/components/admin-settings/provider-integrations/green-invoice-card.tsx ---

Props: `{ status?: { provider: string; configuredAt: string }; onSuccess: () => void }`

Disconnected state: Shows a `Card` with title "Green Invoice", description "Automated invoice
creation and document sync". A "Connect" Button that opens a `Dialog`.

The Dialog contains a `Form` (react-hook-form + zodResolver) with fields:
  - `id: z.string().min(1, 'Required')` — label "API ID", `type="text"`
  - `secret: z.string().min(1, 'Required')` — label "API Secret", `type="password"`
Form submit calls `useSetGreenInvoiceCredentials().setCredentials({ id, secret })` then calls
`onSuccess()` to trigger a refetch and closes the dialog.

Connected state: Shows a green `Badge` ("Connected"), the `configuredAt` date formatted as a
locale date string, and a "Disconnect" Button. Clicking Disconnect shows a confirmation
`AlertDialog` ("Are you sure you want to disconnect Green Invoice?"). On confirm, calls
`useDeleteProviderCredentials().deleteCredentials({ provider: 'green_invoice' })` then
calls `onSuccess()`.

Exports: `export function GreenInvoiceCard`.

--- packages/client/src/components/admin-settings/provider-integrations/deel-card.tsx ---

Same structure as `green-invoice-card.tsx` but for Deel:
  Title: "Deel"
  Description: "Payment processing and payroll integration"
  Form fields: `apiToken: z.string().min(1, 'Required')` — label "API Token", `type="password"`
  Uses `useSetDeelCredentials().setCredentials({ apiToken })`
  Disconnect: calls `deleteCredentials({ provider: 'deel' })`

Exports: `export function DeelCard`.

The `onSuccess` prop in both cards calls the `refetch` function returned from
`useProviderCredentials` (passed down from the parent index component).

Verification:
- `yarn build` (or `yarn workspace @accounter/client build`) completes with no TypeScript errors.
- Navigate to the integrations page in the running dev app and confirm:
  - Both cards render.
  - Connect dialog opens and submits correctly.
  - After connecting, the card shows "Connected" with a date.
  - Disconnect confirmation dialog appears and removes the connection on confirm.
```

---

## Cross-Cutting Notes for All Steps

- **ESM imports**: every import must end in `.js`, even for `.ts` source files.
- **`yarn generate`**: run after any change to GraphQL typeDefs or SQL schemas touched by pgtyped.
  Never edit files in `__generated__/` or `gql/` manually.
- **No direct DB access in resolvers**: resolvers only call `injector.get(Provider).method()`.
- **No `console.log` in production paths**: use `console.error` for unexpected failures only.
- **Logging redaction**: if a structured logger is added to resolver middleware in the future, the
  fields `id`, `secret`, and `apiToken` must be added to the redaction list before any logging
  middleware is introduced. Add a `TODO` comment in `provider-credentials.resolvers.ts` at the
  mutation entry points.
- **Test isolation**: each test file creates its own provider instance; no shared mutable state
  between tests.
