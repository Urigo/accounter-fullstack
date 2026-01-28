# LLM Implementation Prompts - User Authentication System (Auth0 Integration)

This document contains step-by-step prompts for implementing the user authentication system using
Auth0 as the external identity provider. Each prompt is designed to be self-contained, build on
previous work, and result in fully integrated, tested code.

**Authentication Strategy**: Auth0 handles all user authentication (login, signup, password
management, email verification, JWT issuance). The local system handles business authorization,
role-based access control, and API key management.

---

## How to Use These Prompts

1. **Execute prompts sequentially** - each builds on the previous
2. **Review generated code** before moving to the next prompt
3. **Run tests** after each step to validate progress
4. **Adjust as needed** if your codebase structure differs
5. **Don't skip steps** - later prompts assume earlier work is complete
6. **Auth0 Configuration Required**: Complete Auth0 tenant setup before starting Phase 4

---

## Phase 1: Foundation & Database Schema

### Prompt 1.1: Pre-Migration Table Rename

``

CONTEXT: You are working on the Accounter application, a financial management system. The current
database has a table called`accounter_schema.users` which actually stores business information, not
user accounts. We need to rename this table to prepare for a new Auth0-based user authentication
system.

TASK: Create a PostgreSQL migration that renames the existing `users` table to
`legacy_business_users`.

REQUIREMENTS:

1. Create a new migration file in `packages/migrations/src/` following the existing naming
   convention (timestamp + descriptive name)
2. Use `ALTER TABLE accounter_schema.users RENAME TO legacy_business_users;`
3. Add a comment explaining why this rename is necessary (preparing for Auth0 integration)
4. PostgreSQL will automatically update all foreign key constraints - verify this with a comment in
   the migration
5. Create a rollback migration that reverts the change
6. Add an integration test that:
   - Runs the migration
   - Verifies the table was renamed
   - Verifies all foreign keys still reference the correct table
   - Runs the rollback and verifies the original state

EXPECTED OUTPUT:

- Migration file: `packages/migrations/src/YYYY-MM-DD-HH-MM-rename-users-to-legacy-businesses.sql`
- Rollback file:
  `packages/migrations/src/YYYY-MM-DD-HH-MM-rename-users-to-legacy-businesses-rollback.sql`
- Test file: `packages/migrations/src/__tests__/rename-users-migration.test.ts`
- All tests passing

INTEGRATION: This migration must run before creating the new user authentication tables. Ensure it's
ordered correctly in the migration sequence.

``

---

### Prompt 1.2: Core User Tables Migration (Auth0 Schema)

``

CONTEXT: You've successfully renamed the legacy users table. Now we need to create the foundational
tables for the new Auth0-integrated authentication system. This includes business-user mappings
(Auth0 users to local businesses), roles, and permissions.

**CRITICAL**: Auth0 manages user authentication data (email, password, email verification). We DO
NOT create `users`, `user_accounts`, `user_refresh_tokens`, or `email_verification_tokens` tables.
Only the business-to-user mapping is stored locally.

TASK: Create a PostgreSQL migration that defines the core user authentication schema for Auth0
integration.

REQUIREMENTS:

1. Create migration file in `packages/migrations/src/` with timestamp naming
2. Create the following tables with exact schema:

**business_users table:**

- user_id: UUID, primary key, default gen_random_uuid()
- auth0_user_id: TEXT, unique, nullable (populated on first login after Auth0 account activation)
- business_id: UUID, foreign key to businesses_admin.id, not null, ON DELETE CASCADE
- role_id: TEXT, foreign key to roles.id, not null
- created_at: TIMESTAMPTZ, not null, default NOW()
- updated_at: TIMESTAMPTZ, not null, default NOW()
- Composite primary key on (user_id, business_id) to support M:N relationships

**roles table:**

- id: TEXT, primary key
- name: TEXT, unique, not null
- description: TEXT
- created_at: TIMESTAMPTZ, not null, default NOW()

**permissions table:** (for future use, not initially enforced)

- id: TEXT, primary key
- name: TEXT, unique, not null
- description: TEXT
- created_at: TIMESTAMPTZ, not null, default NOW()

**role_permissions table:** (for future use, not initially enforced)

- role_id: TEXT, foreign key to roles.id, ON DELETE CASCADE
- permission_id: TEXT, foreign key to permissions.id, ON DELETE CASCADE
- Primary key on (role_id, permission_id)

3. Add indexes:
   - business_users.auth0_user_id (for login lookups)
   - business_users.business_id (for joins)

4. Seed data:
   - Roles: 'business_owner', 'accountant', 'employee', 'scraper'
   - Permissions: 'manage:users', 'view:reports', 'issue:docs', 'insert:transactions'
   - Default role_permissions mappings:
     - business_owner: all permissions
     - accountant: view:reports, issue:docs
     - employee: view:reports
     - scraper: insert:transactions

5. Add trigger for business_users.updated_at auto-update

6. Create rollback migration

7. Write integration tests:
   - Verify all tables created
   - Verify seed data loaded
   - Verify constraints work (auth0_user_id uniqueness, FK cascades)
   - Verify indexes exist
   - Verify composite primary key works

EXPECTED OUTPUT:

- Migration file: `packages/migrations/src/YYYY-MM-DD-HH-MM-create-core-user-tables.sql`
- Rollback file: `packages/migrations/src/YYYY-MM-DD-HH-MM-create-core-user-tables-rollback.sql`
- Test file: `packages/migrations/src/__tests__/core-user-tables.test.ts`
- All tests passing
- Seed data query results documented in test output

INTEGRATION: This migration builds on the table rename from Prompt 1.1. Ensure the migration runs
after that one. Note that `user_id` is generated on invitation creation (pre-registration), while
`auth0_user_id` is populated after the user completes Auth0 password setup and logs in for the first
time.

``

---

### Prompt 1.3: Invitations and API Keys Tables

``

CONTEXT: The core business-user mapping and roles tables are now in place. Next, we need to create
tables for invitation management (Auth0 pre-registration) and API key authentication (independent of
Auth0).

TASK: Create a PostgreSQL migration for invitations and API keys.

REQUIREMENTS:

1. Create migration file following the established pattern

2. Create the following tables:

**invitations table:**

- id: UUID, primary key, default gen_random_uuid()
- business_id: UUID, foreign key to businesses_admin.id, ON DELETE CASCADE
- email: TEXT, not null
- role_id: TEXT, foreign key to roles.id, not null
- token: TEXT, unique, not null (64-character cryptographically secure random string)
- auth0_user_created: BOOLEAN, default FALSE (tracks whether Auth0 Management API call succeeded)
- auth0_user_id: TEXT, nullable (stores Auth0 user ID from pre-registration, used for cleanup)
- invited_by_user_id: UUID, foreign key to business_users.user_id, nullable (tracks which admin
  created the invitation)
- accepted_at: TIMESTAMPTZ, nullable (single-use token tracking, NULL until accepted)
- expires_at: TIMESTAMPTZ, not null (typically 7 days from creation)
- created_at: TIMESTAMPTZ, not null, default NOW()

**api_keys table:**

- id: UUID, primary key, default gen_random_uuid()
- business_id: UUID, foreign key to businesses_admin.id, ON DELETE CASCADE
- role_id: TEXT, foreign key to roles.id, not null
- key_hash: TEXT, not null, unique (SHA-256 hash of the key)
- name: TEXT (e.g., "Production Scraper")
- last_used_at: TIMESTAMPTZ (for auditing, updated hourly to prevent write amplification)
- created_at: TIMESTAMPTZ, not null, default NOW()

3. Add indexes:
   - invitations.token (unique constraint already provides this)
   - invitations.business_id
   - invitations.expires_at (for cleanup job queries)
   - api_keys.key_hash (unique constraint already provides this)
   - api_keys.business_id

4. Add comments to clarify Auth0 integration:
   - Comment on invitations table: "Pre-registration flow: invitation created → Auth0 user created
     (blocked) → user sets password → accepts invitation → Auth0 user unblocked"
   - Comment on api_keys table: "API keys are independent of Auth0, used for programmatic access
     (e.g., scraper role)"

5. Create rollback migration

6. Write integration tests:
   - Verify tables created with correct schema
   - Verify constraints work (token uniqueness, email format, FK cascades)
   - Verify indexes exist
   - Test invitation flow fields (auth0_user_created, auth0_user_id, accepted_at)

EXPECTED OUTPUT:

- Migration file: `packages/migrations/src/YYYY-MM-DD-HH-MM-create-invitations-apikeys-tables.sql`
- Rollback file:
  `packages/migrations/src/YYYY-MM-DD-HH-MM-create-invitations-apikeys-tables-rollback.sql`
- Test file: `packages/migrations/src/__tests__/invitations-apikeys-tables.test.ts`
- All tests passing

INTEGRATION: This migration builds on the business_users and roles tables from Prompt 1.2.
Invitations will be used to trigger Auth0 Management API calls to create users with blocked status.
API keys provide authentication independent of Auth0 for automated processes.

``

---

### Prompt 1.4: Audit Logs Table

``

CONTEXT: User authentication tables are complete. Now we need to add support for API key
authentication (for automated scrapers) and audit logging for security compliance.

TASK: Create a PostgreSQL migration for API keys and audit logs.

REQUIREMENTS:

1. Create migration file following the established pattern

2. Create the following tables:

**api_keys table:**

- id: UUID, primary key, default gen_random_uuid()
- business_id: UUID, foreign key to businesses_admin.id, ON DELETE CASCADE, not null
- role_id: TEXT, foreign key to roles.id, ON DELETE RESTRICT, not null
- key_hash: TEXT, not null, unique
- name: TEXT, not null (descriptive name like "Production Scraper")
- last_used_at: TIMESTAMPTZ, nullable
- created_at: TIMESTAMPTZ, not null, default NOW()
- revoked_at: TIMESTAMPTZ, nullable

**audit_logs table:**

- id: UUID, primary key, default gen_random_uuid()
- business_id: UUID, foreign key to businesses_admin.id, ON DELETE SET NULL, nullable
- user_id: UUID, foreign key to users.id, ON DELETE SET NULL, nullable
- action: TEXT, not null (e.g., 'USER_LOGIN', 'INVOICE_UPDATE')
- entity: TEXT, nullable (e.g., 'Invoice', 'User')
- entity_id: TEXT, nullable
- details: JSONB, nullable
- ip_address: TEXT, nullable
- created_at: TIMESTAMPTZ, not null, default NOW()

3. Add indexes:
   - api_keys.business_id
   - api_keys.key_hash (for fast authentication lookups)
   - audit_logs.business_id, created_at (composite for time-range queries)
   - audit_logs.user_id
   - audit_logs.action

4. Add check constraint:
   - api_keys: revoked_at IS NULL OR revoked_at > created_at

5. Create rollback migration

6. Write integration tests:
   - Verify API key creation and lookup by hash
   - Verify audit log insertion with JSONB details
   - Verify cascade behavior (deleting business cascades to api_keys)
   - Test query performance on audit_logs with indexes
   - Verify nullable fields work (system actions with no user_id)

EXPECTED OUTPUT:

- Migration file: `packages/migrations/src/YYYY-MM-DD-HH-MM-create-apikeys-audit-tables.sql`
- Rollback file
- Test file: `packages/migrations/src/__tests__/apikeys-audit-tables.test.ts`
- All tests passing

INTEGRATION: Depends on previous migrations. Ensure migration ordering is correct.

``

---

### Prompt 1.5: Permission Override Tables

``

CONTEXT: While the initial implementation will use role-based permissions only, we need to
future-proof for granular user-level and API-key-level permission overrides. This allows special
cases like "grant this specific user the ability to delete invoices" without creating a new role.

TASK: Create a PostgreSQL migration for permission override tables.

REQUIREMENTS:

1. Create migration file following the established pattern

2. Create ENUM type:
   - grant_type_enum: ('grant', 'revoke')

3. Create the following tables:

**user_permission_overrides table:**

- id: UUID, primary key, default gen_random_uuid()
- user_id: UUID, foreign key to users.id, ON DELETE CASCADE, not null
- business_id: UUID, foreign key to businesses_admin.id, ON DELETE CASCADE, not null
- permission_id: TEXT, foreign key to permissions.id, ON DELETE CASCADE, not null
- grant_type: grant_type_enum, not null
- created_at: TIMESTAMPTZ, not null, default NOW()
- Unique constraint on (user_id, business_id, permission_id)

**api_key_permission_overrides table:**

- id: UUID, primary key, default gen_random_uuid()
- api_key_id: UUID, foreign key to api_keys.id, ON DELETE CASCADE, not null
- permission_id: TEXT, foreign key to permissions.id, ON DELETE CASCADE, not null
- grant_type: grant_type_enum, not null
- created_at: TIMESTAMPTZ, not null, default NOW()
- Unique constraint on (api_key_id, permission_id)

4. Add indexes:
   - user_permission_overrides: (user_id, business_id)
   - api_key_permission_overrides: api_key_id

5. Add comments:
   - "These tables are initially unpopulated but ready for future granular permissions feature"
   - "grant_type='grant' adds permission, 'revoke' removes it"

6. Create rollback migration

7. Write integration tests:
   - Verify tables created successfully
   - Verify ENUM values enforced
   - Verify unique constraints work
   - Insert test overrides and verify retrieval
   - Test FK cascades

EXPECTED OUTPUT:

- Migration file: `packages/migrations/src/YYYY-MM-DD-HH-MM-create-permission-overrides.sql`
- Rollback file
- Test file: `packages/migrations/src/__tests__/permission-overrides.test.ts`
- All tests passing

INTEGRATION: Depends on:

- users table (Prompt 1.2)
- permissions table (Prompt 1.2)
- business_users table (Prompt 1.3)
- api_keys table (Prompt 1.4)

These tables will be used by PermissionResolutionService in Phase 4.

``

---

## Phase 2: Core Database Services

### Prompt 2.1: DBProvider Singleton Setup (Verification & Enhancement)

``

CONTEXT: You've created all the database tables. The application already has a DBProvider singleton
at `packages/server/src/modules/app-providers/db.provider.ts`, but we need to verify it meets all
requirements and enhance it as needed. The application uses a connection pool pattern with two
access levels:

1. System-level (migrations, background jobs) - direct pool access
2. Request-level (GraphQL operations) - tenant-aware with RLS enforcement

TASK: Verify and enhance the existing DBProvider singleton to ensure it's ready for the Auth0
authentication system.

REQUIREMENTS:

1. Review existing file: `packages/server/src/modules/app-providers/db.provider.ts`

2. Verify DBProvider has:
   - `@Injectable({ scope: Scope.Singleton })` from graphql-modules
   - Accepts pg.Pool in constructor (injected from GraphQL modules setup)
   - `public pool` property for direct access (migrations, background jobs)
   - `query<T>(text: string, params?: any[]): Promise<QueryResult<T>>` method
   - `healthCheck(): Promise<boolean>` method (runs SELECT 1)

3. Add if missing:
   - Connection pool configuration validation
   - Cleanup on shutdown (if not already handled by dependency injection)
   - JSDoc comments explaining system-level vs request-level access

4. Verify/add unit tests:
   - Pool initializes correctly
   - healthCheck returns true when database available
   - healthCheck returns false when database unavailable
   - query method executes successfully
   - Public pool property accessible

5. Verify/add integration tests:
   - Pool doesn't exceed max connections
   - Failed queries don't leak connections
   - Health check works in production environment

EXPECTED OUTPUT:

- Verified/Enhanced: `packages/server/src/modules/app-providers/db.provider.ts`
- New/Updated Tests: `packages/server/src/modules/app-providers/__tests__/db.provider.test.ts`
- All tests passing
- Documentation comments in code

INTEGRATION: This provider will be:

- Used directly by migrations and background jobs (via public `pool` property)
- Wrapped by TenantAwareDBClient for GraphQL operations (next prompt)
- Already registered as singleton in GraphQL modules

NOTES: The existing DBProvider is functional. Main task is to verify it meets all requirements, add
the `healthCheck()` method if missing, ensure the `pool` property is public, and create
comprehensive tests.

``

---

### Prompt 2.2: Auth Plugin V2 (HTTP-Level Auth Extraction - Preparatory)

``

CONTEXT: You've verified the DBProvider singleton. Now we need to create a NEW lightweight plugin
for future Auth0 integration WITHOUT breaking the existing authentication system. This plugin will
be created alongside the current auth plugin and activated later in Phase 4.

**CRITICAL**: This is a PREPARATORY step. DO NOT modify or replace the existing auth-plugin.ts.
Existing authentication must remain fully functional.

**Architecture Note**: This follows the Separation of Concerns principle where plugins handle
HTTP-level tasks and providers handle business logic.

TASK: Create NEW auth plugin (v2) that will be used for Auth0 integration, without affecting
existing authentication.

REQUIREMENTS:

1. Create NEW file: `packages/server/src/plugins/auth-plugin-v2.ts`
   - DO NOT modify existing `auth-plugin.ts`
   - Existing auth must remain active and functional

2. Implement `authPluginV2()` using `useExtendContext` from graphql-yoga:
   - Extract `Authorization: Bearer <token>` header
   - Extract `X-API-Key` header
   - Add `rawAuth` object to Yoga context:
     ```typescript
     interface RawAuth {
       authType: 'jwt' | 'apiKey' | null
       token: string | null
     }
     ```
   - **DO NOT**: Verify JWT signature, query database, or resolve permissions (delegated to
     AuthContextProvider)

3. Update `packages/server/src/index.ts`:
   - Add `authPlugin()` as FIRST plugin in array (before `useGraphQLModules`)
   - Plugin order critical: `authPlugin` → `useGraphQLModules` → `useDeferStream` → `useHive`
   - Remove old basic-auth plugin if exists

4. Handle edge cases:
   - Malformed Authorization header (e.g., missing "Bearer" prefix)
   - Both Authorization and X-API-Key present (JWT takes precedence)
   - Empty tokens
   - Multiple Authorization headers (use first)

5. Write unit tests:
   - JWT token extracted correctly from `Authorization: Bearer <token>`
   - API key extracted correctly from `X-API-Key: <key>`
   - Malformed headers handled gracefully (return null)
   - Missing auth headers result in `{ authType: null, token: null }`
   - JWT precedence when both headers present

6. Write integration tests:
   - `rawAuth` available in Yoga context
   - Plugin does NOT verify token (verification deferred to provider)
   - Plugin order correct (runs before GraphQL Modules)

**Code Example**:

```typescript
// packages/server/src/plugins/auth-plugin-v2.ts
import { useExtendContext } from 'graphql-yoga'
import type { Plugin } from '@envelop/types'

export interface RawAuth {
  authType: 'jwt' | 'apiKey' | null
  token: string | null
}

export const authPluginV2 = (): Plugin => {
  return useExtendContext(async yogaContext => {
    const request = yogaContext.request
    const authHeader = request.headers.get('authorization')
    const apiKeyHeader = request.headers.get('x-api-key')

    // JWT takes precedence
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7).trim()
      return {
        rawAuth: {
          authType: 'jwt' as const,
          token: token || null
        }
      }
    }

    // Fallback to API key
    if (apiKeyHeader) {
      return {
        rawAuth: {
          authType: 'apiKey' as const,
          token: apiKeyHeader.trim() || null
        }
      }
    }

    // Unauthenticated
    return {
      rawAuth: {
        authType: null,
        token: null
      }
    }
  })
}
```

EXPECTED OUTPUT:

- NEW file: `packages/server/src/plugins/auth-plugin-v2.ts`
- Updated: `packages/server/src/environment.ts` (USE_AUTH0 flag)
- Tests: `packages/server/src/plugins/__tests__/auth-plugin-v2.test.ts`
- All tests passing (isolated tests, not integration yet)
- **Existing `auth-plugin.ts` UNCHANGED**
- **Server still uses existing auth plugin**

INTEGRATION: This plugin will provide `rawAuth` to the Yoga context in Phase 4. For now, it's tested
in isolation. The AuthContextV2Provider (Prompt 2.4) will consume `rawAuth` to verify JWT signatures
and create structured `AuthContext`.

VALIDATION:

- New auth plugin file created successfully
- Auth headers extracted correctly in isolation tests
- Plugin does not perform verification (delegated to provider)
- **Existing auth plugin still active and functional**
- **Server starts without errors**
- **Existing users can still log in**
- USE_AUTH0 flag defaults to false

RISK: Very Low (no changes to existing auth, purely additive)

``

---

### Prompt 2.3: TenantAwareDBClient (Request-Scoped)

``

CONTEXT: The auth plugin extracts raw auth data. Now we need a request-scoped database client that
enforces Row-Level Security (RLS) by setting PostgreSQL session variables. This is the PRIMARY
security boundary of the application.

TASK: Create a TenantAwareDBClient class that wraps database access with automatic RLS context
setting.

REQUIREMENTS:

1. Create file: `packages/server/src/modules/app-providers/tenant-db-client.ts`

2. Implement TenantAwareDBClient class:
   - Use `@Injectable({ scope: Scope.Operation })` (one instance per GraphQL request)
   - Constructor dependencies:
     - DBProvider (singleton, provides pool access)
     - `@Inject(AUTH_CONTEXT) authContext: AuthContext` (request-scoped via injection token)

3. Implement transaction management:
   - Private properties:
     - activeClient: PoolClient | null
     - transactionDepth: number (for savepoint tracking)

   - query<T>(text: string, params?: any[]): Promise<QueryResult<T>>
     - If no active transaction, start one
     - Execute query using active client
     - Return result

   - transaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T>
     - If no active transaction: a. Get client from pool b. BEGIN c. SET LOCAL
       app.current_business_id = $1 d. SET LOCAL app.current_user_id = $2 e. SET LOCAL app.auth_type
       = $3 f. Execute fn(client) g. COMMIT h. Release client
     - If already in transaction (nested): a. Create savepoint (SAVEPOINT sp\_${transactionDepth})
       b. Execute fn(client) c. RELEASE SAVEPOINT d. On error: ROLLBACK TO SAVEPOINT, then rethrow

   - dispose(): Promise<void>
     - If activeClient exists: rollback and release
     - Called automatically by GraphQL context cleanup

4. RLS variable setting:
   - Extract businessId from authContext.tenant.businessId
   - Extract userId from authContext.user?.userId (or NULL for API keys)
   - Extract authType from authContext.authType
   - Handle cases where auth context is missing (throw error)

5. Write unit tests:
   - Transaction starts and commits successfully
   - RLS variables set correctly
   - Nested transactions use savepoints
   - Transaction reuse (multiple queries in same transaction)
   - Error handling rolls back transaction
   - dispose() releases connection
   - Missing auth context throws error

6. Write integration tests:
   - Verify SET LOCAL variables visible to queries in transaction
   - Verify isolation between concurrent requests
   - Verify savepoints work for nested transactions
   - Verify connection returned to pool after dispose
   - Load test: 100 concurrent requests don't leak connections

EXPECTED OUTPUT:

- Implementation: `packages/server/src/modules/app-providers/tenant-db-client.ts`
- Tests: `packages/server/src/shared/helpers/__tests__/tenant-db-client.test.ts`
- All tests passing
- Comprehensive JSDoc comments explaining RLS enforcement

INTEGRATION: This class will be:

- Instantiated per GraphQL request
- Injected into all service classes
- The ONLY way resolvers should access the database
- Enforces that all queries run with proper tenant context

Next prompts will create the AuthContextProvider (2.4) and AUTH_CONTEXT injection token (2.5) that
this depends on.

``

---

### Prompt 2.4: Auth Context Provider V2 (Auth0 JWT Verification - Preparatory)

``

CONTEXT: The authPluginV2 extracts raw JWT tokens from headers (Prompt 2.2). Now we need to create a
NEW provider that will verify Auth0 JWT signatures in the future, WITHOUT breaking existing
authentication.

**CRITICAL**: This is PREPARATORY code. DO NOT register this provider in GraphQL Modules DI yet.
Existing authentication must remain fully functional. This provider will be activated in Phase 4.

**Architecture Note**: This will be an Operation-scoped provider that processes `rawAuth` from Yoga
context and creates structured `AuthContext` for injection across all modules.

TASK: Create AuthContextV2Provider that verifies Auth0 JWTs and maps Auth0 user IDs to local
business/role data (preparatory code, not activated yet).

REQUIREMENTS:

1. Create NEW file: `packages/server/src/modules/auth/providers/auth-context-v2.provider.ts`
   - DO NOT modify existing auth context provider (if any)
   - This is preparatory code, will be activated in Phase 4

2. Define TypeScript interfaces in `packages/server/src/shared/types/auth.ts` (if not already
   present):

   ```typescript
   export type AuthType = 'jwt' | 'apiKey' | 'system'

   export interface AuthUser {
     userId: string
     email: string
     roleId: string
     permissions: string[]
     emailVerified: boolean
     permissionsVersion: number
   }

   export interface TenantContext {
     businessId: string
     businessName?: string
   }

   export interface AuthContext {
     authType: AuthType
     user?: AuthUser
     tenant: TenantContext
     accessTokenExpiresAt?: number
   }
   ```

3. Install `jose` library for Auth0 JWT verification:

   ```bash
   npm install jose
   ```

4. Implement AuthContextV2Provider:
   - Use `@Injectable({ scope: Scope.Operation })`
   - Export as named export: `export class AuthContextV2Provider`
   - Constructor dependencies:
     - `rawAuth: RawAuth` (will come from Yoga context via authPluginV2 in Phase 4)
     - `dbProvider: DBProvider` (for getting pool to create TenantAwareDBClient)
     - `env: Environment` (for Auth0 configuration)
   - **Note**: This provider is NOT registered in DI yet, so constructor won't be called until Phase
     4

5. **DO NOT** register this provider in `modules-app.ts` yet:
   - Keep existing auth provider active
   - This will be registered in Phase 4, Step 4.4 (Parallel Testing)
   - `getAuthContext(): Promise<AuthContext | null>`
     - If `rawAuth.authType === 'jwt'`: a. Verify JWT signature using `jose` library and Auth0 JWKS
       endpoint b. Validate issuer (`iss` claim matches Auth0 domain) c. Validate audience (`aud`
       claim matches API identifier) d. Check expiration (`exp` claim) e. Extract Auth0 user ID from
       `sub` claim (format: `auth0|507f1f77bcf86cd799439011`) f. Query database to map
       `auth0_user_id` to local `user_id` and business/role:
       ```sql
       SELECT bu.user_id, bu.business_id, bu.role_id
       FROM accounter_schema.business_users bu
       WHERE bu.auth0_user_id = $1
       LIMIT 1
       ```
       g. Return AuthContext with user and tenant data
     - If `rawAuth.authType === 'apiKey'`: a. Return null for now (placeholder, implement in
       Phase 7)
     - If `rawAuth.authType === null`: a. Return null (unauthenticated request)

6. Auth0 JWT verification (using `jose` library):
   - Fetch JWKS from Auth0: `https://{domain}/.well-known/jwks.json`
   - Use `createRemoteJWKSet` for automatic key rotation handling
   - Use `jwtVerify` with options:

     ```typescript
     import { jwtVerify, createRemoteJWKSet } from 'jose'

     const JWKS = createRemoteJWKSet(new URL(`https://${env.auth0.domain}/.well-known/jwks.json`))

     const { payload } = await jwtVerify(token, JWKS, {
       issuer: `https://${env.auth0.domain}/`,
       audience: env.auth0.audience
     })

     const auth0UserId = payload.sub // e.g., "auth0|507f1f77bcf86cd799439011"
     ```

   - Handle errors gracefully:
     - Expired token: return null (not throw)
     - Invalid signature: return null
     - Invalid issuer/audience: return null
     - Network errors fetching JWKS: log error, return null
     - User not found in local database: return null (user hasn't accepted invitation yet)

7. Write unit tests:
   - Valid JWT parsed correctly
   - Expired JWT returns null
   - Invalid signature returns null
   - Malformed token returns null
   - Missing token returns null
   - All AuthUser fields extracted from payload

8. Write integration tests:
   - AuthContext available in resolver context
   - Context isolated between concurrent requests
   - JWT refresh doesn't affect other requests

EXPECTED OUTPUT:

- Types: `packages/server/src/shared/types/auth.ts`
- Implementation: `packages/server/src/modules/app-providers/auth-context.provider.ts`
- Tests: `packages/server/src/modules/app-providers/__tests__/auth-context.test.ts`
- All tests passing

INTEGRATION: This provider will be:

- Registered in GraphQL context creation
- Injected into TenantAwareDBClient
- Available to all resolvers for authorization checks

Next prompts will register AUTH_CONTEXT injection token (2.5) and wire database client into
resolvers (2.6).

``

---

### Prompt 2.5: Define AUTH_CONTEXT_V2 Injection Token (Preparatory)

``

CONTEXT: AuthContextV2Provider is created but not yet registered in DI (Prompt 2.4). Before we can
use it, we need to define the injection token that modules will use to access auth context. This is
PREPARATORY work - the token won't be used until Phase 4.

**CRITICAL**: This step only DEFINES the token. DO NOT register it as a provider in `modules-app.ts`
yet. Existing auth system must remain fully functional.

**Architecture Note**: Injection tokens enable type-safe, cross-module access to request-scoped
context without tight coupling between modules.

TASK: Define AUTH_CONTEXT_V2 injection token for future use (not registered yet).

REQUIREMENTS:

1. Update `packages/server/src/shared/tokens.ts` to add NEW token:

1. Update `packages/server/src/shared/tokens.ts` to add NEW token:

   ```typescript
   import { InjectionToken } from 'graphql-modules'
   import type { AuthContext } from './types/auth'

   // Keep existing tokens (AUTH_CONTEXT, ENVIRONMENT, etc.) unchanged
   export const AUTH_CONTEXT_V2 = new InjectionToken<AuthContext | null>('AUTH_CONTEXT_V2')
   ```

1. **DO NOT** update `modules-app.ts` providers yet:
   - Keep existing AUTH_CONTEXT provider active
   - AUTH_CONTEXT_V2 will be registered in Phase 4, Step 4.4 (Parallel Testing)
   - This ensures existing auth remains fully functional

1. **DO NOT** inject AUTH_CONTEXT_V2 into TenantAwareDBClient yet:
   - TenantAwareDBClient should continue using existing auth context
   - This will be updated in Phase 4

1. Write unit tests (token definition only):

   ```typescript
   // packages/server/src/shared/__tests__/tokens.test.ts
   import { AUTH_CONTEXT_V2 } from '../tokens'

   describe('AUTH_CONTEXT_V2 Token', () => {
     it('should be defined', () => {
       expect(AUTH_CONTEXT_V2).toBeDefined()
       expect(AUTH_CONTEXT_V2.toString()).toContain('AUTH_CONTEXT_V2')
     })
   })
   ```

EXPECTED OUTPUT:

- Updated: `packages/server/src/shared/tokens.ts` (AUTH_CONTEXT_V2 defined)
- Tests: `packages/server/src/shared/__tests__/tokens.test.ts`
- All tests passing
- **`modules-app.ts` UNCHANGED** (existing auth still active)
- **`TenantAwareDBClient` UNCHANGED** (uses existing auth)
- **Server functionality UNCHANGED** (no integration yet)

INTEGRATION: This token will be:

- Registered as a provider in Phase 4, Step 4.4 (Parallel Testing)
- Injected into TenantAwareDBClient in Phase 4, Step 4.6 (The Switch)
- Used across all modules for auth access after cutover

VALIDATION:

- Token defined and exported correctly
- TypeScript compilation succeeds
- Token type is `InjectionToken<AuthContext | null>`
- No impact on existing authentication system
- Server starts and runs normally

RISK: Very Low (just a type definition, not used yet)

INTEGRATION: AUTH_CONTEXT token will be used by:

- TenantAwareDBClient (for RLS context)
- All service classes needing auth (via `@Inject(AUTH_CONTEXT)`)
- AdminContextProvider (next prompt)
- Authorization services

VALIDATION:

- AUTH_CONTEXT injectable in all providers
- Request-scoped isolation verified
- No singleton leakage

RISK: Low (standard DI pattern)

``

---

### Prompt 2.6: Wire TenantAwareDBClient into GraphQL Context

``

CONTEXT: You've created the DBProvider, TenantAwareDBClient, and AuthContext. Now we need to wire
them into the GraphQL server so they're available in all resolvers, and create an ESLint rule to
prevent direct pool access.

TASK: Update the GraphQL server setup to use TenantAwareDBClient for all resolver database access
and enforce this with linting.

REQUIREMENTS:

1. Update GraphQL context creation:
   - File: `packages/server/src/server.ts` (or wherever context is created)
   - Remove raw `pool` from context
   - Add:
     - dbProvider: DBProvider (singleton)
     - authContext: AuthContext (parsed from request)
     - db: TenantAwareDBClient (new instance per request with authContext)
   - Register dispose hook to call db.dispose() at end of request

2. Update one module as pilot (choose: `businesses` module):
   - Find all resolver functions
   - Change `context.pool.query(...)` to `context.db.query(...)`
   - Remove direct pool imports
   - Add integration tests:
     - Verify queries execute successfully
     - Verify RLS variables are set (check pg_stat_activity during test)
     - Verify tenant isolation (user from business A can't see business B data)

3. Create ESLint rule:
   - File: `packages/server/.eslintrc.js` or add to existing config
   - Add custom rule or use eslint-plugin-import:
     ```javascript
     'no-restricted-imports': ['error', {
       patterns: [{
         group: ['**/db.provider'],
         message: 'Use TenantAwareDBClient from context.db instead of direct DBProvider access. Only migrations and background jobs should import DBProvider directly.'
       }]
     }]
     ```
   - Apply only to `**/resolvers/**` and `**/services/**` files
   - Exempt `**/migrations/**` and `**/scripts/**`

4. Add middleware to verify auth context:
   - Create `packages/server/src/middleware/auth-context.middleware.ts`
   - On every request:
     - Parse AuthContext
     - If no auth but query requires it: throw UNAUTHENTICATED
     - Make authContext available in GraphQL context

5. Write tests:
   - ESLint catches direct DBProvider imports in resolvers
   - ESLint allows DBProvider imports in migrations
   - Businesses module queries work with new context.db
   - All tests in businesses module still pass

EXPECTED OUTPUT:

- Updated: `packages/server/src/server.ts`
- Updated: Businesses module resolvers
- New: `packages/server/.eslintrc.js` (or update existing)
- Tests: `packages/server/src/modules/businesses/__tests__/businesses.integration.test.ts`
- All tests passing
- ESLint rule active and enforced

INTEGRATION: This completes the database access layer refactoring. Future prompts will gradually
migrate other modules to use context.db. For now, we have:

- System-level access: DBProvider (migrations, scripts)
- Request-level access: TenantAwareDBClient (resolvers, services)
- RLS enforcement automatic on every query

NEXT STEPS:

- Prompt 2.7: Refactor AdminContext from plugin to provider
- Prompt 2.8: Cache isolation audit
- Phase 3: Enable RLS policies on database tables
- Remaining modules will be migrated gradually

``

---

### Prompt 2.7: AdminContext Refactoring (Plugin → Provider)

``

CONTEXT: The application currently has `adminContextPlugin` that loads admin-related context
(business owner, financial entities, etc.) into the Yoga context. This pattern causes issues:

1. **Breaks DI architecture**: Plugins can't use GraphQL Modules dependency injection
2. **Cache isolation risk**: Plugin-level caches shared across requests (tenant leakage)
3. **Circular dependency**: Needs TenantAwareDBClient but can't inject it properly

**Architecture Decision** (from spec.md Section 3.3.1): Convert AdminContext to Operation-scoped
provider for proper DI integration.

TASK: Refactor adminContextPlugin to AdminContextProvider using GraphQL Modules DI.

REQUIREMENTS:

1. Create `packages/server/src/modules/admin-context/providers/admin-context.provider.ts`:

   ```typescript
   import { Injectable, Scope, Inject } from 'graphql-modules'
   import { AUTH_CONTEXT } from '@shared/tokens'
   import type { AuthContext } from '@shared/types/auth'
   import { TenantAwareDBClient } from '@modules/app-providers/tenant-db-client'

   export interface AdminContext {
     businessOwner: BusinessOwner | null
     financialEntities: FinancialEntity[]
     // ... other admin context fields
   }

   @Injectable({ scope: Scope.Operation })
   export class AdminContextProvider {
     private cachedContext: AdminContext | null = null

     constructor(
       @Inject(AUTH_CONTEXT) private authContext: AuthContext | null,
       private db: TenantAwareDBClient
     ) {}

     async getAdminContext(): Promise<AdminContext | null> {
       // Cache within single request (safe because Operation-scoped)
       if (this.cachedContext !== null) {
         return this.cachedContext
       }

       if (!this.authContext || !this.authContext.user) {
         return null
       }

       // Load business owner
       const businessOwner = await this.loadBusinessOwner(this.authContext.tenant.businessId)

       // Load financial entities
       const financialEntities = await this.loadFinancialEntities(
         this.authContext.tenant.businessId
       )

       this.cachedContext = {
         businessOwner,
         financialEntities
       }

       return this.cachedContext
     }

     private async loadBusinessOwner(businessId: string): Promise<BusinessOwner | null> {
       // Use this.db.query() - automatically has RLS context set
       const result = await this.db.query<BusinessOwner>(
         'SELECT id, name FROM accounter_schema.legacy_business_users WHERE id = $1',
         [businessId]
       )
       return result.rows[0] || null
     }

     private async loadFinancialEntities(businessId: string): Promise<FinancialEntity[]> {
       // RLS automatically filters by business_id
       const result = await this.db.query<FinancialEntity>(
         'SELECT id, name FROM accounter_schema.financial_entities',
         []
       )
       return result.rows
     }
   }
   ```

2. Add ADMIN_CONTEXT injection token to `packages/server/src/shared/tokens.ts`:

   ```typescript
   export const ADMIN_CONTEXT = new InjectionToken<AdminContext | null>('AdminContext')
   ```

3. Update `packages/server/src/modules-app.ts`:
   - Add to providers array:
     ```typescript
     {
       provide: ADMIN_CONTEXT,
       useFactory: (provider: AdminContextProvider) => provider.getAdminContext(),
       deps: [AdminContextProvider],
     }
     ```

4. Update resolvers to inject ADMIN_CONTEXT:

   ```typescript
   @Injectable({ scope: Scope.Operation })
   export class ChargesService {
     constructor(
       @Inject(ADMIN_CONTEXT) private adminContext: AdminContext | null,
       private db: TenantAwareDBClient
     ) {}

     async getCharges() {
       if (!this.adminContext?.businessOwner) {
         throw new GraphQLError('Unauthorized')
       }
       // Use adminContext.businessOwner, adminContext.financialEntities
     }
   }
   ```

5. Update `packages/server/src/index.ts`:
   - Remove `adminContextPlugin` from plugins array

6. Delete `packages/server/src/plugins/admin-context-plugin.ts`

7. Write tests:
   - AdminContext loads correctly from auth context
   - Unauthenticated requests get null AdminContext
   - Cache works correctly within single request (multiple calls return same instance)
   - Cache isolated between concurrent requests (no cross-tenant leakage)
   - RLS enforced on admin context queries -BusinessOwner and FinancialEntities load correctly

BENEFITS:

- ✅ Proper DI integration (can inject any dependency)
- ✅ Request-scoped caching (no cross-tenant leakage risk)
- ✅ Type-safe injection via ADMIN_CONTEXT token
- ✅ Automatically uses TenantAwareDBClient (RLS enforced)
- ✅ Consistent with AuthContextProvider pattern

EXPECTED OUTPUT:

- New: `packages/server/src/modules/admin-context/providers/admin-context.provider.ts`
- Updated: `packages/server/src/shared/tokens.ts`
- Updated: `packages/server/src/modules-app.ts`
- Updated: `packages/server/src/index.ts`
- Deleted: `packages/server/src/plugins/admin-context-plugin.ts`
- Updated: All resolvers using adminContext (change from context.adminContext to injected
  ADMIN_CONTEXT)
- Tests: `packages/server/src/modules/admin-context/__tests__/admin-context.provider.test.ts`
- All tests passing

INTEGRATION:

- AdminContext available in all resolvers via injection
- No plugin-based adminContext in Yoga context
- RLS enforced on admin context queries
- No global cache leakage

VALIDATION:

- AdminContext loads correctly
- Cache works within request, isolated between requests
- RLS prevents cross-tenant data access
- All resolver tests still pass

RISK: Medium (requires updating many resolver constructors)

``

---

### Prompt 2.8: Cache Isolation Audit

``

CONTEXT: Singleton providers with instance-level caches can leak data between tenants if cache keys
don't include tenant context. This is a CRITICAL security vulnerability.

**From spec.md Section 3.2.1.1**: All providers caching tenant-specific data must either:

1. Use `Scope.Operation` (cache automatically isolated per request), OR
2. Use tenant-prefixed cache keys in Singleton providers

TASK: Audit all providers for cache isolation vulnerabilities and fix them.

REQUIREMENTS:

1. Run audit search across codebase:

   ```bash
   # Find all providers with caches
   rg "@Injectable.*Singleton" -A 30 | grep -E "(cache|Cache|DataLoader)"
   
   # Find all DataLoader usages
   rg "new DataLoader" packages/server/src
   ```

2. **Known Providers to Audit** (from spec.md):
   - `packages/server/src/modules/financial-entities/providers/businesses.provider.ts`
   - `packages/server/src/modules/financial-entities/providers/financial-entities.provider.ts`
   - Any provider with `getCacheInstance()` or similar
   - Any provider with `DataLoader`

3. For each provider with cache:

   **Option A - Convert to Operation Scope** (Recommended for auth/tenant data):

   ```typescript
   // BEFORE: Singleton with global cache (UNSAFE)
   @Injectable({ scope: Scope.Singleton })
   export class BusinessesProvider {
     cache = getCacheInstance({ stdTTL: 60 * 5 }) // Shared across all requests!

     async getBusiness(id: string) {
       return this.cache.wrap(`business:${id}`, () => this.db.query(...))
     }
   }

   // AFTER: Operation-scoped with request-isolated cache (SAFE)
   @Injectable({ scope: Scope.Operation })
   export class BusinessesProvider {
     cache = getCacheInstance({ stdTTL: 60 * 5 }) // One cache per request

     constructor(
       @Inject(AUTH_CONTEXT) private authContext: AuthContext,
       private db: TenantAwareDBClient
     ) {}

     async getBusiness(id: string) {
       // Cache isolated per request automatically
       return this.cache.wrap(`business:${id}`, () => this.db.query(...))
     }
   }
   ```

   **Option B - Tenant-Prefixed Cache Keys** (for performance-critical singletons):

   ```typescript
   @Injectable({ scope: Scope.Singleton })
   export class BusinessesProvider {
     cache = getCacheInstance({ stdTTL: 60 * 5 })

     async getBusiness(id: string, businessId: string) {
       // Tenant prefix prevents cross-tenant access
       return this.cache.wrap(`tenant:${businessId}:business:${id}`, () =>
         this.db.query(...)
       )
     }
   }
   ```

4. **DataLoader Pattern** (MUST be Operation-scoped):

   ```typescript
   // CORRECT: Provider creates DataLoader per request
   @Injectable({ scope: Scope.Operation })
   export class ChargesService {
     private chargeLoader = new DataLoader((ids: string[]) => this.batchLoadCharges(ids))

     async getCharge(id: string) {
       return this.chargeLoader.load(id)
     }
   }
   ```

5. Create integration test for cache isolation:

   ```typescript
   // packages/server/src/modules/__tests__/cache-isolation.integration.test.ts
   import { describe, it, expect } from 'vitest'
   import { createTestContext } from '../test-utils'

   describe('Cache Isolation', () => {
     it('should not leak data between tenants', async () => {
       // Request 1: Business A
       const contextA = createTestContext({ businessId: 'business-a' })
       const resultA = await contextA.injector.get(BusinessesProvider).getBusiness('business-a')

       // Request 2: Business B (different request context)
       const contextB = createTestContext({ businessId: 'business-b' })
       const resultB = await contextB.injector.get(BusinessesProvider).getBusiness('business-b')

       // Verify isolation
       expect(resultA.id).toBe('business-a')
       expect(resultB.id).toBe('business-b')

       // Attempt to access Business A's data from Business B context
       await expect(
         contextB.injector.get(BusinessesProvider).getBusiness('business-a')
       ).rejects.toThrow() // RLS should block this
     })
   })
   ```

6. Document safe patterns in `docs/architecture/provider-cache-patterns.md`:
   - When to use Operation vs Singleton scope
   - Cache key prefixing examples
   - DataLoader best practices
   - Testing cache isolation

EXPECTED OUTPUT:

- Audit report: List of all providers with caches and their fix status
- Updated: All providers with cache isolation fixes
- New: `docs/architecture/provider-cache-patterns.md`
- Tests: `packages/server/src/modules/__tests__/cache-isolation.integration.test.ts`
- All tests passing
- No cross-tenant cache leakage

VALIDATION:

- All singleton providers with caches use tenant-prefixed keys
- All auth/tenant providers use Operation scope
- Integration tests verify no cross-tenant leakage
- DataLoaders instantiated per request

RISK: High (security-critical, requires careful audit)

CRITICAL: This MUST be completed before production deployment. Cache leakage can expose sensitive
data across tenants.

``

---

### Prompt 2.9: Global Context Type Updates

``

CONTEXT: The GraphQL context structure has changed significantly with Auth0 integration and the move
from plugins to providers. We need to update global context types to reflect the new architecture.

TASK: Update GraphQL Modules global context interface and remove legacy context properties.

REQUIREMENTS:

1. Update `packages/server/src/modules-app.ts` global context declaration:

   ```typescript
   export interface GlobalContext {
     request: Request
     rawAuth: RawAuth // From authPlugin (HTTP-level)
     // Note: Do NOT add authContext or adminContext here
     // These are accessed via injection tokens (AUTH_CONTEXT, ADMIN_CONTEXT)
   }

   export async function createGraphQLApp(env: Environment, pool: pg.Pool) {
     return createApplication<GlobalContext>({
       modules: [
         // ... modules
       ],
       providers: [
         DBProvider,
         AuthContextProvider,
         TenantAwareDBClient,
         AdminContextProvider,
         {
           provide: AUTH_CONTEXT,
           useFactory: (provider: AuthContextProvider) => provider.getAuthContext(),
           deps: [AuthContextProvider]
         },
         {
           provide: ADMIN_CONTEXT,
           useFactory: (provider: AdminContextProvider) => provider.getAdminContext(),
           deps: [AdminContextProvider]
         },
         {
           provide: ENVIRONMENT,
           useValue: env
         }
       ]
     })
   }
   ```

2. Update `packages/server/src/shared/types/index.ts`:

   ```typescript
   import type { Request } from '@whatwg-node/fetch'
   import type { RawAuth } from '@plugins/auth-plugin'

   export interface GraphQLContext {
     request: Request
     rawAuth: RawAuth
   }

   // Auth context accessed via injection tokens, not context object
   // import { AUTH_CONTEXT, ADMIN_CONTEXT } from '@shared/tokens'
   ```

3. Search and replace legacy context access patterns:

   ```bash
   # Find all references to old context properties
   rg "context\.currentUser" packages/server/src
   rg "context\.adminContext" packages/server/src
   rg "context\.authContext" packages/server/src
   ```

   Replace with:

   ```typescript
   // OLD: Access from context
   const user = context.currentUser
   const adminContext = context.adminContext

   // NEW: Inject in provider constructor
   @Injectable({ scope: Scope.Operation })
   export class MyService {
     constructor(
       @Inject(AUTH_CONTEXT) private authContext: AuthContext | null,
       @Inject(ADMIN_CONTEXT) private adminContext: AdminContext | null
     ) {}

     async myMethod() {
       if (!this.authContext?.user) {
         throw new GraphQLError('Unauthorized')
       }
       const businessOwner = this.adminContext?.businessOwner
     }
   }
   ```

4. Update resolver type definitions:

   ```typescript
   import type { GraphQLContext } from '@shared/types'

   export const resolvers: Resolvers<GraphQLContext> = {
     Query: {
       // Resolvers should NOT access authContext from context
       // Instead, inject services that have @Inject(AUTH_CONTEXT)
     }
   }
   ```

5. Write tests:
   - GlobalContext types compile correctly
   - rawAuth accessible from context
   - Auth context NOT in context (accessed via injection tokens)
   - Admin context NOT in context (accessed via injection tokens)
   - Injection tokens work as expected
   - All resolvers compile with new types

EXPECTED OUTPUT:

- Updated: `packages/server/src/modules-app.ts`
- Updated: `packages/server/src/shared/types/index.ts`
- Updated: All resolvers and services using old context access patterns
- Tests: `packages/server/src/__tests__/context-types.test.ts`
- TypeScript compilation succeeds
- All tests passing

VALIDATION:

- TypeScript compilation succeeds
- No references to `context.currentUser` or `context.adminContext`
- All auth access via injection tokens
- Context types accurate and minimal

RISK: Medium (requires updating many files)

BENEFITS:

- ✅ Clear separation: HTTP context (rawAuth) vs business context (AUTH_CONTEXT)
- ✅ Type-safe injection across modules
- ✅ Consistent architecture (DI-first, not context-passing)
- ✅ Easier testing (mock injection tokens vs mocking context)

``

---

## Phase 3: Row-Level Security

### Prompt 3.1: RLS Helper Function

``

CONTEXT: The TenantAwareDBClient sets PostgreSQL session variables (app.current_business_id, etc.)
for every request. Now we need to create a SQL function that RLS policies can use to read these
variables and enforce tenant isolation.

TASK: Create a PostgreSQL function that retrieves the current business context from session
variables.

REQUIREMENTS:

1. Create migration file: `packages/migrations/src/YYYY-MM-DD-HH-MM-create-rls-helper-function.sql`

2. Create function:

   ```sql
   CREATE OR REPLACE FUNCTION accounter_schema.get_current_business_id()
   RETURNS UUID
   LANGUAGE plpgsql
   STABLE
   SECURITY DEFINER
   AS $$
   DECLARE
     v_business_id UUID;
   BEGIN
     v_business_id := current_setting('app.current_business_id', true)::uuid;
     IF v_business_id IS NULL THEN
       RAISE EXCEPTION 'No business context set - authentication required';
     END IF;
     RETURN v_business_id;
   END;
   $$;
   ```

3. Add companion functions:
   - get_current_user_id() - returns UUID from app.current_user_id (nullable for API keys)
   - get_current_auth_type() - returns TEXT from app.auth_type

4. Add comments explaining:
   - STABLE: function result won't change within transaction
   - SECURITY DEFINER: runs with creator privileges (can read session variables)
   - Why it throws exception if context not set

5. Create rollback migration (DROP FUNCTION)

6. Write integration tests:
   - Function returns business_id when variable is set
   - Function raises exception when variable not set
   - Function works inside RLS policies (test with simple policy)
   - SECURITY DEFINER allows restricted users to call it

EXPECTED OUTPUT:

- Migration: `packages/migrations/src/YYYY-MM-DD-HH-MM-create-rls-helper-function.sql`
- Rollback: migration rollback file
- Tests: `packages/migrations/src/__tests__/rls-helper-function.test.ts`
- All tests passing

INTEGRATION: This function will be used by RLS policies in the next prompts. It's the bridge between
application-level auth and database-level security.

``

---

### Prompt 3.2: Enable RLS on Pilot Table (charges)

``

CONTEXT: The RLS helper function is ready. Now we'll enable Row-Level Security on ONE high-value
table as a pilot to validate the approach before rolling out to all tables. We're starting with
`charges` because it's critical and has clear business ownership.

TASK: Enable RLS on the charges table and create a tenant isolation policy.

REQUIREMENTS:

1. Create migration: `packages/migrations/src/YYYY-MM-DD-HH-MM-enable-rls-charges-pilot.sql`

2. Enable RLS:

   ```sql
   ALTER TABLE accounter_schema.charges ENABLE ROW LEVEL SECURITY;
   ```

3. Create policy:

   ```sql
   CREATE POLICY tenant_isolation ON accounter_schema.charges
     FOR ALL
     USING (owner_id = accounter_schema.get_current_business_id())
     WITH CHECK (owner_id = accounter_schema.get_current_business_id());
   ```

4. Add comments:

- FOR ALL: applies to SELECT, INSERT, UPDATE, DELETE
- USING: filter for SELECT and UPDATE
- WITH CHECK: validation for INSERT and UPDATE
- Why owner_id is used (will be replaced with business_id in later migration)

5. Grant superuser bypass (for migrations):

```sql
ALTER TABLE accounter_schema.charges FORCE ROW LEVEL SECURITY;
-- Comment: Even superuser must respect RLS (except in single-user mode)
```

6. Create rollback:

   ```sql
   DROP POLICY tenant_isolation ON accounter_schema.charges;
   ALTER TABLE accounter_schema.charges DISABLE ROW LEVEL SECURITY;
   ```

7. Write integration tests:
   - Setup: Create two test businesses and charges for each
   - Test 1: SET LOCAL app.current_business_id to business A
     - Query charges → only business A charges returned
     - Try to INSERT charge for business B → rejected
     - Try to UPDATE business B charge → no rows affected
   - Test 2: SET LOCAL app.current_business_id to business B
     - Query charges → only business B charges returned
   - Test 3: No SET LOCAL → query raises exception
   - Performance test:
     - Measure query time with and without RLS
     - Verify overhead < 10%
     - Check query plan uses index on owner_id

EXPECTED OUTPUT:

- Migration file
- Rollback file
- Tests: `packages/migrations/src/__tests__/rls-charges-pilot.test.ts`
- All tests passing
- Query plan analysis showing index usage

INTEGRATION: This is the FIRST table with RLS enabled. It validates:

- The RLS enforcement mechanism works
- TenantAwareDBClient sets variables correctly
- Performance is acceptable
- Policies written correctly

If successful, we'll roll out to all tables in later prompts.

ROLLBACK PLAN: If production issues occur, run rollback migration to disable RLS on charges.

``

---

### Prompt 3.3: Add business_id Columns (Nullable)

``

CONTEXT: The RLS pilot on charges was successful. However, charges uses owner_id as the tenant
field. We need a consistent business_id column across all tables. This is a multi-phase migration to
avoid downtime.

TASK: Add business_id column to all tenant tables as nullable (Phase 1 of 4).

REQUIREMENTS:

1. Create migration: `packages/migrations/src/YYYY-MM-DD-HH-MM-add-business-id-nullable.sql`

2. Add business_id to tables (from spec section 3.2.2):
   - Use pattern: `ALTER TABLE accounter_schema.{table_name} ADD COLUMN business_id UUID;`
   - Tables (partial list, see spec for complete):
     - charges
     - documents
     - transactions
     - ledger_records
     - salaries
     - financial_accounts
     - ...etc (see spec section 3.2.2 for full list)

3. Add comments:
   - Explain this is phase 1 (nullable)
   - Reference backfill job (phase 2)
   - Will be made NOT NULL in phase 3

4. Lock strategy:
   - Each ALTER TABLE acquires ACCESS EXCLUSIVE lock briefly (< 1 second)
   - Run on low-traffic tables first to test
   - Monitor lock waits during deployment

5. Create rollback:
   - DROP COLUMN business_id for each table
   - Note: Postgres makes this fast (no data rewrite)

6. Write tests:
   - Verify business_id column added to all tables
   - Verify column is nullable
   - Verify column is UUID type
   - Verify existing data unaffected (row count same)

EXPECTED OUTPUT:

- Migration file with ~40 ALTER TABLE statements
- Rollback file
- Tests: `packages/migrations/src/__tests__/add-business-id-nullable.test.ts`
- Deployment notes: Expected downtime < 10 seconds total

INTEGRATION: This prepares for:

- Phase 2: Backfill business_id (next prompt)
- Phase 3: Make NOT NULL
- Phase 4: Add indexes and foreign keys
- Phase 5: Update RLS policies to use business_id

``

---

### Prompt 3.4: Backfill business_id Values

``

CONTEXT: All tables now have a nullable business_id column. Now we need to populate it using
deterministic rules based on foreign key relationships.

TASK: Create a background job script to backfill business_id columns in batches.

REQUIREMENTS:

1. Create script: `packages/server/src/scripts/backfill-business-id.ts`

2. Implement backfill logic per table (from spec section 6):
   - charges: business_id = owner_id
   - documents: business_id = (SELECT business_id FROM charges WHERE id = documents.charge_id)
   - transactions: business_id = (SELECT business_id FROM charges WHERE id = transactions.charge_id)
   - ledger_records: business_id = (SELECT business_id FROM charges WHERE id =
     ledger_records.charge_id)
   - financial_accounts: business_id = owner
   - salaries: business_id = employer
   - ...etc (see spec for full mapping)

3. Batch processing:
   - Update 10,000 rows at a time
   - Sleep 1 second between batches (avoid blocking production)
   - Log progress every batch:
     - Table name
     - Rows processed
     - Total rows
     - Percentage complete
   - Abort on error (don't skip rows)

4. Validation:
   - After each table:
     ```sql
     SELECT COUNT(*) FROM {table} WHERE business_id IS NULL;
     ```
   - If count > 0: log warning (quarantine case)
   - Final report:
     - Total rows processed
     - Tables fully backfilled
     - Tables with NULL values (quarantine)

5. Run as standalone script:
   - Connect using DBProvider (system-level access, bypass RLS)
   - Use transactions for each batch (commit after each 10k)
   - Handle Ctrl+C gracefully (finish current batch first)

6. Write tests:
   - Unit tests: Verify SQL UPDATE logic per table
   - Integration test:
     - Create test data
     - Run backfill
     - Verify business_id populated correctly
     - Verify FK relationships used correctly

EXPECTED OUTPUT:

- Script: `packages/server/src/scripts/backfill-business-id.ts`
- Tests: `packages/server/src/scripts/__tests__/backfill-business-id.test.ts`
- Documentation: How to run script (`npm run backfill-business-id`)
- All tests passing

INTEGRATION: Run this script AFTER deploying the nullable column migration (Prompt 3.3) and BEFORE
deploying the NOT NULL migration (next prompt).

Estimated runtime: 1-3 hours depending on database size.

MONITORING: Watch for:

- Long-running transactions blocking other queries
- Database CPU/memory usage
- Replication lag (if using replicas)

``

---

### Prompt 3.5: Make business_id NOT NULL

``

CONTEXT: The backfill job has completed successfully and all business_id columns are populated. Now
we need to enforce the NOT NULL constraint to prevent future invalid data.

TASK: Create a migration to add NOT NULL constraints to all business_id columns.

REQUIREMENTS:

1. BEFORE running this migration:
   - Manually verify backfill completion:
     ```sql
     -- Run this query for each table
     SELECT '{table_name}' as table_name, COUNT(*) as null_count
     FROM {table_name}
     WHERE business_id IS NULL;
     ```
   - All null_count values MUST be 0

2. Create migration: `packages/migrations/src/YYYY-MM-DD-HH-MM-business-id-not-null.sql`

3. Add NOT NULL constraints:

   ```sql
   ALTER TABLE accounter_schema.charges ALTER COLUMN business_id SET NOT NULL;
   -- Repeat for all tables
   ```

4. Lock impact:
   - Each ALTER acquires ACCESS EXCLUSIVE lock
   - Lock held while Postgres verifies no NULL values exist
   - Estimated time per table: 1-5 seconds
   - Total estimated downtime: 1-2 minutes

5. Deployment window:
   - Schedule during low-traffic period (e.g., 3-5am)
   - Notify team of maintenance window
   - Have rollback ready

6. Create rollback:

   ```sql
   ALTER TABLE accounter_schema.charges ALTER COLUMN business_id DROP NOT NULL;
   -- Repeat for all tables
   ```

7. Write tests:
   - Verify NOT NULL constraint enforced
   - Attempt to INSERT row with NULL business_id → rejected
   - Attempt to UPDATE business_id to NULL → rejected

EXPECTED OUTPUT:

- Migration file
- Rollback file
- Deployment checklist (verification steps)
- Tests: `packages/migrations/src/__tests__/business-id-not-null.test.ts`
- All tests passing

INTEGRATION: After this migration:

- All tables have business_id NOT NULL
- Ready for indexes and foreign keys (next prompt)
- Cannot insert data without business_id

``

---

### Prompt 3.6: Add Indexes and Foreign Keys

``

CONTEXT: All business_id columns are now NOT NULL. We need to add indexes for RLS query performance
and foreign keys for referential integrity.

TASK: Create a migration to add indexes and foreign keys to business_id columns.

REQUIREMENTS:

1. Create migration: `packages/migrations/src/YYYY-MM-DD-HH-MM-add-business-id-indexes.sql`

2. Create indexes CONCURRENTLY (non-blocking):

   ```sql
   CREATE INDEX CONCURRENTLY idx_charges_business_id
   ON accounter_schema.charges(business_id);

   CREATE INDEX CONCURRENTLY idx_documents_business_id
   ON accounter_schema.documents(business_id);

   -- Repeat for all tables
   ```

3. Why CONCURRENTLY:
   - Doesn't block reads or writes
   - Takes longer than regular index creation
   - Can fail partway (need to detect and retry)
   - Estimated time: 2-10 minutes per large table

4. Add foreign keys with NOT VALID (fast, non-blocking):

   ```sql
   ALTER TABLE accounter_schema.charges
   ADD CONSTRAINT fk_charges_business
   FOREIGN KEY (business_id) REFERENCES accounter_schema.businesses_admin(id)
   NOT VALID;

   -- Repeat for all tables
   ```

5. Validate foreign keys in separate step:

   ```sql
   ALTER TABLE accounter_schema.charges
   VALIDATE CONSTRAINT fk_charges_business;

   -- Repeat for all tables
   ```

6. Why NOT VALID + VALIDATE:
   - NOT VALID: adds constraint without checking existing data (instant)
   - VALIDATE: checks existing data with ShareUpdateExclusiveLock (allows reads/writes)
   - Total downtime: near zero

7. Create rollback:
   - DROP INDEX CONCURRENTLY for each index
   - ALTER TABLE DROP CONSTRAINT for each FK

8. Write tests:
   - Verify all indexes created
   - Verify indexes used in query plans (EXPLAIN)
   - Verify FK constraints enforced
   - Test query performance improvement:
     - Before index: table scan
     - After index: index scan
     - Speedup: > 10x for filtered queries

EXPECTED OUTPUT:

- Migration file
- Rollback file
- Performance comparison report
- Tests: `packages/migrations/src/__tests__/business-id-indexes.test.ts`
- All tests passing

INTEGRATION: After this migration:

- RLS policies will use indexed business_id (fast)
- Cannot delete business if rows reference it (FK protection)
- Ready to roll out RLS to all tables (next prompt)

DEPLOYMENT: Can run during business hours (non-blocking). Monitor:

- pg_stat_progress_create_index for progress
- Lock waits (should be minimal)

``

---

### Prompt 3.7: Roll Out RLS to All Tables

``

CONTEXT: The pilot RLS on charges was successful, and all tables now have indexed business_id
columns. Time to enable RLS across the entire database.

TASK: Enable RLS on all tenant tables with comprehensive policies.

REQUIREMENTS:

1. Create migration: `packages/migrations/src/YYYY-MM-DD-HH-MM-enable-rls-all-tables.sql`

2. Enable RLS in batches for safety:

   **Batch 1: Core transaction tables**

   ```sql
   ALTER TABLE accounter_schema.charges ENABLE ROW LEVEL SECURITY;
   ALTER TABLE accounter_schema.documents ENABLE ROW LEVEL SECURITY;
   ALTER TABLE accounter_schema.transactions ENABLE ROW LEVEL SECURITY;
   ALTER TABLE accounter_schema.ledger_records ENABLE ROW LEVEL SECURITY;
   ```

   **Batch 2: Financial tables**

   ```sql
   ALTER TABLE accounter_schema.salaries ENABLE ROW LEVEL SECURITY;
   ALTER TABLE accounter_schema.financial_accounts ENABLE ROW LEVEL SECURITY;
   ALTER TABLE accounter_schema.dividends ENABLE ROW LEVEL SECURITY;
   ```

   **Batch 3: Supporting tables**

   ```sql
   ALTER TABLE accounter_schema.clients ENABLE ROW LEVEL SECURITY;
   ALTER TABLE accounter_schema.employees ENABLE ROW LEVEL SECURITY;
   -- ...etc
   ```

3. Create policies for each table:

   **Simple policy (direct business_id)**:

   ```sql
   CREATE POLICY tenant_isolation ON accounter_schema.{table}
     FOR ALL
     USING (business_id = accounter_schema.get_current_business_id())
     WITH CHECK (business_id = accounter_schema.get_current_business_id());
   ```

   **FK-derived policy (e.g., documents via charge_id)**:

   ```sql
   CREATE POLICY tenant_isolation ON accounter_schema.documents
     FOR ALL
     USING (
       EXISTS (
         SELECT 1 FROM accounter_schema.charges
         WHERE charges.id = documents.charge_id
         AND charges.business_id = accounter_schema.get_current_business_id()
       )
     )
     WITH CHECK (
       EXISTS (
         SELECT 1 FROM accounter_schema.charges
         WHERE charges.id = documents.charge_id
         AND charges.business_id = accounter_schema.get_current_business_id()
       )
     );
   ```

4. Force RLS for all users:

   ```sql
   ALTER TABLE accounter_schema.{table} FORCE ROW LEVEL SECURITY;
   ```

5. Create rollback (disable RLS per table):

   ```sql
   DROP POLICY tenant_isolation ON accounter_schema.{table};
   ALTER TABLE accounter_schema.{table} DISABLE ROW LEVEL SECURITY;
   ```

6. Write comprehensive integration tests:
   - For each table:
     - Create data for business A and B
     - Set context to business A
     - SELECT → only A's data returned
     - INSERT for business B → rejected or filtered
     - UPDATE business B data → 0 rows affected
     - DELETE business B data → 0 rows affected
   - Test JOIN queries:
     - charges JOIN documents → both filtered correctly
     - Verify FK-derived policies work
   - Performance tests:
     - Measure query time with RLS
     - Verify < 20% overhead
     - Check EXPLAIN plans use indexes

7. Deployment strategy:
   - Deploy batch 1, monitor for 24 hours
   - If stable, deploy batch 2, monitor 24 hours
   - If stable, deploy batch 3
   - At each stage: run integration tests in production (read-only)

EXPECTED OUTPUT:

- Migration file (large, ~500 lines)
- Rollback file
- Tests: `packages/migrations/src/__tests__/rls-all-tables.test.ts`
- Test coverage: All tenant tables tested
- Performance report: Overhead per table
- All tests passing

INTEGRATION: This completes the RLS rollout. After this:

- ALL tenant data protected by RLS
- No cross-tenant queries possible
- Database is primary security boundary
- Application auth is UX layer

CRITICAL: This is HIGH RISK. Extensive testing required before production.

ROLLBACK PLAN: Script ready to disable RLS per table if issues found:

```bash
npm run disable-rls-table -- --table=charges
```

``

---

## Phase 4: Auth0 Integration & GraphQL Context Enrichment (Week 5)

### Architecture Context

**Auth0 Responsibility**: Auth0 manages ALL authentication concerns:

- User credentials (email/password storage, hashing)
- JWT token issuance and signature (RS256 asymmetric signing)
- Universal Login UI (login, signup, password reset, email verification)
- Session management and refresh tokens
- Email verification workflow

**Local System Responsibility**: The server handles authorization and business context:

- JWT signature verification (using Auth0's public JWKS endpoint)
- Mapping Auth0 user IDs to local business/role data
- Permission resolution and RBAC
- API key authentication (independent of Auth0)

**No Self-Hosted Auth**: This system does NOT implement password hashing, user registration, or
login mutations. All authentication is delegated to Auth0.

---

### Prompt 4.1: Environment Configuration for Auth0

``

CONTEXT: The database and RLS are fully configured. Auth0 will handle authentication, but the server
needs configuration to verify Auth0 JWTs and interact with the Auth0 Management API.

TASK: Add Auth0 configuration to server environment and install required dependencies.

REQUIREMENTS:

1. Install `jose` library for Auth0 JWT verification:

   ```bash
   cd packages/server
   npm install jose
   ```

2. Update `packages/server/src/environment.ts`:

   ```typescript
   import { z } from 'zod'

   const environmentSchema = z.object({
     // ... existing config
     auth0: z.object({
       domain: z.string(), // e.g., 'your-tenant.us.auth0.com'
       audience: z.string(), // API identifier, e.g., 'https://api.accounter.com'
       clientId: z.string(), // M2M application client ID (for Management API)
       clientSecret: z.string(), // M2M application client secret
       managementAudience: z.string() // 'https://your-tenant.us.auth0.com/api/v2/'
     })
   })

   export type Environment = z.infer<typeof environmentSchema>

   export function loadEnvironment(): Environment {
     return environmentSchema.parse({
       auth0: {
         domain: process.env.AUTH0_DOMAIN!,
         audience: process.env.AUTH0_AUDIENCE!,
         clientId: process.env.AUTH0_CLIENT_ID!,
         clientSecret: process.env.AUTH0_CLIENT_SECRET!,
         managementAudience: process.env.AUTH0_MANAGEMENT_AUDIENCE!
       }
     })
   }
   ```

3. Update `packages/server/.env` and `.env.example`:

   ```bash
   # Auth0 Configuration (JWT Verification)
   AUTH0_DOMAIN=your-tenant.us.auth0.com
   AUTH0_AUDIENCE=https://api.accounter.com
   
   # Auth0 Management API (M2M Application)
   AUTH0_CLIENT_ID=your_m2m_client_id
   AUTH0_CLIENT_SECRET=your_m2m_client_secret
   AUTH0_MANAGEMENT_AUDIENCE=https://your-tenant.us.auth0.com/api/v2/
   
   # Note: No JWT secrets needed - Auth0 uses RS256 asymmetric signing
   # Public keys fetched from: https://{domain}/.well-known/jwks.json
   ```

4. Add validation on server startup:

   ```typescript
   // In server entry point
   const env = loadEnvironment()
   console.log(`Auth0 configured: ${env.auth0.domain}`)
   ```

5. Write tests:
   - Environment variables loaded correctly
   - Missing Auth0 config throws error on server start
   - All Auth0 fields validated (non-empty strings)

EXPECTED OUTPUT:

- Updated: `packages/server/src/environment.ts`
- Updated: `packages/server/.env.example`
- Created: `packages/server/.env` (local development, gitignored)
- Package: `jose` installed in `packages/server/package.json`
- Tests: `packages/server/src/__tests__/environment.test.ts`
- All tests passing

INTEGRATION: Environment configuration will be used by:

- AuthContextProvider (JWT verification)
- Auth0ManagementService (user pre-registration during invitations)

VALIDATION:

- Environment types compile
- Auth0 config accessible in env object
- Server starts without errors

RISK: Low (configuration only)

**Note**: You'll need to create an Auth0 tenant and configure it (next prompt) to get actual values
for these environment variables.

``

---

### Prompt 4.2: Auth0 Tenant Configuration

``

CONTEXT: Environment configuration is ready. Now you need to configure Auth0 tenant to enable JWT
authentication and Management API access.

**Note**: This prompt involves Auth0 dashboard configuration, not code changes.

TASK: Set up Auth0 tenant, application, and Management API credentials.

REQUIREMENTS:

1. **Create Auth0 Tenant** (or use existing):
   - Sign up at https://auth0.com
   - Create tenant (e.g., `accounter-dev.us.auth0.com`)
   - Note your domain for AUTH0_DOMAIN env var

2. **Create Auth0 Application** (Regular Web Application):
   - Navigate to Applications → Create Application
   - Name: "Accounter Web App"
   - Type: Regular Web Application
   - Configure application settings:
     - Allowed Callback URLs: `http://localhost:5173/callback`, `https://app.example.com/callback`
     - Allowed Logout URLs: `http://localhost:5173`, `https://app.example.com`
     - Allowed Web Origins: `http://localhost:5173`, `https://app.example.com`
     - Token Endpoint Authentication Method: Post
   - Save changes

3. **Create Auth0 API** (for JWT audience):
   - Navigate to Applications → APIs → Create API
   - Name: "Accounter API"
   - Identifier: `https://api.accounter.com` (use as AUTH0_AUDIENCE)
   - Signing Algorithm: RS256 (asymmetric, Auth0 default)
   - Save

4. **Configure JWT Settings**:
   - In API settings → Token Settings:
     - Token Expiration: 900 seconds (15 minutes)
     - Allow Offline Access: Yes (enables refresh tokens)
   - In API settings → RBAC Settings:
     - Enable RBAC: Yes
     - Add Permissions in the Access Token: Yes (for future permission claims)

5. **Enable Username-Password-Authentication**:
   - Navigate to Authentication → Database → Create DB Connection
   - Name: Username-Password-Authentication
   - Enable for "Accounter Web App" application
   - Configure password policy:
     - Minimum length: 8 characters
     - Require uppercase, lowercase, number, special character

6. **Create Machine-to-Machine Application** (for Management API):
   - Navigate to Applications → Create Application
   - Name: "Accounter M2M"
   - Type: Machine to Machine Applications
   - Authorize for: Auth0 Management API
   - Grant scopes:
     - `create:users` (pre-register users during invitations)
     - `update:users` (unblock users after invitation acceptance)
     - `delete:users` (cleanup expired invitations)
     - `read:users` (verify user status)
   - Save
   - Note Client ID and Client Secret for AUTH0_CLIENT_ID and AUTH0_CLIENT_SECRET

7. **Test Configuration**:
   - Navigate to Applications → APIs → Accounter API → Test
   - Use "Test" tab to get a test access token
   - Decode token at jwt.io to verify:
     - `iss` claim: `https://your-tenant.us.auth0.com/`
     - `aud` claim: `https://api.accounter.com`
     - `sub` claim: Auth0 user ID (format: `auth0|...`)

8. **Document Configuration**:
   - Create `docs/user-authentication-plan/auth0-setup.md`:
     - Domain
     - Application Client ID (for frontend)
     - API Identifier (audience)
     - M2M Client ID and Secret (for server)
     - JWKS endpoint: `https://{domain}/.well-known/jwks.json`

EXPECTED OUTPUT:

- Auth0 tenant configured
- Regular Web Application created
- API configured with RS256 signing
- M2M application created with Management API scopes
- Configuration documented in `docs/user-authentication-plan/auth0-setup.md`
- Test JWT obtained and verified

INTEGRATION: Configuration will be used by:

- Frontend: Auth0 SDK with Client ID for Universal Login
- Backend: JWT verification using JWKS endpoint
- Backend: Auth0ManagementService using M2M credentials

VALIDATION:

- Auth0 tenant accessible
- Universal Login page works (test by navigating to application login URL)
- M2M credentials can access Management API (test with curl or Postman)
- Configuration documented

RISK: Low (Auth0 UI configuration)

``

---

### Prompt 4.3: Auth0 Management API Service

``

CONTEXT: Auth0 tenant is configured (Prompt 4.2). Now we need a service that interacts with Auth0's
Management API to create blocked user accounts during the invitation flow.

**Flow**: When an admin invites a user:

1. Create invitation record in local database
2. Call Auth0 Management API to create user with `blocked: true`
3. Store Auth0 user ID in invitation record
4. Send invitation email with magic link
5. When user accepts, unblock Auth0 account and map to local user_id

TASK: Create Auth0ManagementService for user pre-registration and management.

REQUIREMENTS:

1. Install Auth0 Management API SDK:

   ```bash
   cd packages/server
   npm install auth0
   ```

2. Create service: `packages/server/src/modules/auth/services/auth0-management.service.ts`

   ```typescript
   import { ManagementClient } from 'auth0'
   import { Injectable, Scope, Inject } from 'graphql-modules'
   import { ENVIRONMENT } from '@shared/tokens'
   import type { Environment } from '@shared/types'

   @Injectable({ scope: Scope.Singleton })
   export class Auth0ManagementService {
     private client: ManagementClient

     constructor(@Inject(ENVIRONMENT) private env: Environment) {
       this.client = new ManagementClient({
         domain: env.auth0.domain,
         clientId: env.auth0.clientId,
         clientSecret: env.auth0.clientSecret
       })
     }

     async createBlockedUser(email: string): Promise<string> {
       // Create user with blocked status (prevents login until invitation accepted)
       const user = await this.client.users.create({
         email,
         connection: 'Username-Password-Authentication',
         email_verified: false,
         blocked: true,
         password: this.generateTemporaryPassword() // User will reset via invitation
       })
       return user.data.user_id! // Returns Auth0 user ID (e.g., "auth0|507f...")
     }

     async unblockUser(auth0UserId: string): Promise<void> {
       await this.client.users.update({ id: auth0UserId }, { blocked: false })
     }

     async deleteUser(auth0UserId: string): Promise<void> {
       // Cleanup for expired invitations
       await this.client.users.delete({ id: auth0UserId })
     }

     async sendPasswordResetEmail(auth0UserId: string): Promise<void> {
       await this.client.users.update(
         { id: auth0UserId },
         { email_verified: true } // Must be verified to receive password reset
       )
       // Trigger password change email via Auth0
       await this.client.tickets.changePassword({
         user_id: auth0UserId,
         result_url: `${this.env.frontendUrl}/login`
       })
     }

     private generateTemporaryPassword(): string {
       // Temporary password (user will reset via invitation link)
       // Meets Auth0 password requirements (8+ chars, upper, lower, number, special)
       const crypto = require('crypto')
       return crypto.randomBytes(16).toString('hex') + 'A1!'
     }
   }
   ```

3. Register service in `packages/server/src/modules/auth/index.ts`:

   ```typescript
   import { createModule } from 'graphql-modules'
   import { Auth0ManagementService } from './services/auth0-management.service'

   export const authModule = createModule({
     id: 'auth',
     providers: [Auth0ManagementService]
   })
   ```

4. Write unit tests:
   - Mock Auth0 Management API client
   - Test createBlockedUser creates user with blocked: true
   - Test unblockUser updates blocked status
   - Test deleteUser calls Management API correctly
   - Test temporary password meets requirements

5. Write integration tests (requires Auth0 test tenant):
   - Create blocked user via Management API
   - Verify user exists in Auth0 with blocked: true
   - Unblock user
   - Verify blocked: false
   - Delete user
   - Verify user deleted

EXPECTED OUTPUT:

- Service: `packages/server/src/modules/auth/services/auth0-management.service.ts`
- Module: `packages/server/src/modules/auth/index.ts`
- Tests: `packages/server/src/modules/auth/services/__tests__/auth0-management.test.ts`
- Package: `auth0` SDK installed
- All tests passing

INTEGRATION: This service will be used by:

- InvitationService (Prompt 5.1) to create blocked Auth0 users when invitations are sent
- Invitation acceptance flow to unblock users after password setup
- Cleanup job to delete expired invitation accounts

VALIDATION:

- Service creates blocked users successfully
- Users cannot log in until unblocked
- Management API calls authenticated correctly with M2M credentials

RISK: Low (standard Auth0 Management API usage)

``

---

### Prompt 4.4: Parallel Authentication Testing (Feature Flag)

``

CONTEXT: All Auth0 infrastructure is built (authPluginV2, AuthContextV2Provider, AUTH_CONTEXT_V2
token) but NOT yet active. Now we need to test the new Auth0 authentication IN PARALLEL with
existing auth to validate it works correctly before the production cutover.

**CRITICAL**: This step enables controlled testing WITHOUT affecting existing users. Both auth
systems run simultaneously during this phase.

TASK: Register Auth0 providers in DI with feature flag control, enabling parallel testing while
keeping existing auth as the default.

REQUIREMENTS:

1. Update `packages/server/src/modules-app.ts` to register Auth0 providers:

   ```typescript
   import { AuthContextV2Provider } from './modules/auth/providers/auth-context-v2.provider'
   import { AUTH_CONTEXT_V2 } from './shared/tokens'

   export const application = createApplication({
     modules: [
       /* existing modules */
     ],
     providers: [
       DBProvider,
       TenantAwareDBClient,
       // Keep existing auth providers active (don't remove)

       // NEW: Register Auth0 providers (feature-flag controlled)
       AuthContextV2Provider,
       {
         provide: AUTH_CONTEXT_V2,
         useFactory: async (provider: AuthContextV2Provider) => {
           return await provider.getAuthContext()
         },
         deps: [AuthContextV2Provider]
       }
     ]
   })
   ```

2. Create parallel testing script: `packages/server/src/scripts/test-auth0-parallel.ts`

   ```typescript
   import { DBProvider } from '@modules/app-providers/db.provider'
   import { AuthContextV2Provider } from '@modules/auth/providers/auth-context-v2.provider'

   async function testAuth0Parallel() {
     console.log('🧪 Testing Auth0 authentication in parallel...')

     // Get test JWT from Auth0 test user
     const testJWT = process.env.AUTH0_TEST_JWT
     if (!testJWT) {
       throw new Error('AUTH0_TEST_JWT environment variable required')
     }

     // Test JWT verification
     const rawAuth = { authType: 'jwt' as const, token: testJWT }
     const dbProvider = new DBProvider(/* config */)
     const authProvider = new AuthContextV2Provider(rawAuth, dbProvider, env)

     const authContext = await authProvider.getAuthContext()

     console.log('✅ Auth0 JWT verified successfully')
     console.log('  User ID:', authContext?.user?.userId)
     console.log('  Email:', authContext?.user?.email)
     console.log('  Business:', authContext?.tenant?.businessId)
     console.log('  Role:', authContext?.user?.roleId)

     // Test database query with Auth0 context
     const client = new TenantAwareDBClient(dbProvider, authContext)
     const result = await client.query('SELECT COUNT(*) as count FROM accounter_schema.charges')
     console.log('✅ Database query with Auth0 context successful')
     console.log('  Charges count:', result.rows[0].count)

     await client.dispose()
     console.log('✅ All parallel tests passed!')
   }

   testAuth0Parallel().catch(console.error)
   ```

3. Add npm script to `packages/server/package.json`:

   ```json
   {
     "scripts": {
       "test:auth0-parallel": "tsx src/scripts/test-auth0-parallel.ts"
     }
   }
   ```

4. Create test user in Auth0:
   - Navigate to Auth0 dashboard → Users → Create User
   - Email: `test-auth0@example.com`
   - Password: `TestAuth0Pass123!`
   - Connection: Username-Password-Authentication
   - Blocked: No (for testing)
   - Map to existing business_users record:
     ```sql
     UPDATE accounter_schema.business_users
     SET auth0_user_id = 'auth0|...'  -- From Auth0 dashboard
     WHERE email = 'test-auth0@example.com';
     ```

5. Obtain test JWT:

   ```bash
   curl --request POST \
     --url https://YOUR_DOMAIN.auth0.com/oauth/token \
     --header 'content-type: application/json' \
     --data '{
       "client_id":"YOUR_CLIENT_ID",
       "client_secret":"YOUR_CLIENT_SECRET",
       "audience":"https://api.accounter.com",
       "grant_type":"client_credentials"
     }'
   ```

   - Save access_token to `AUTH0_TEST_JWT` env var

6. Run parallel tests:

   ```bash
   AUTH0_TEST_JWT="eyJ..." npm run test:auth0-parallel
   ```

7. Validate both auth systems work:
   - Test existing auth still works (e.g., login with existing user)
   - Test Auth0 works (parallel test script)
   - Both should pass simultaneously

8. Add monitoring metrics:
   - Log which auth system used per request
   - Track success/failure rates for both
   - Alert if Auth0 error rate > 1%

EXPECTED OUTPUT:

- Updated: `packages/server/src/modules-app.ts` (Auth0 providers registered)
- Script: `packages/server/src/scripts/test-auth0-parallel.ts`
- Auth0 test user created and mapped
- Parallel testing succeeds
- **Both auth systems functional simultaneously**
- Monitoring in place

INTEGRATION: After this step:

- Auth0 providers registered in DI (but not used by default)
- Can test Auth0 flow with specific test users
- Existing users continue using old auth
- Ready for safe cutover (Prompt 4.6)

VALIDATION:

- AUTH_CONTEXT_V2 resolves correctly for Auth0 JWT
- Database queries work with Auth0 context
- RLS variables set correctly
- No impact on existing auth users
- Test script passes consistently

RISK: Low (parallel testing, no production impact)

``

---

### Prompt 4.5: Create Migration Test Users

``

CONTEXT: Parallel testing infrastructure is in place (Prompt 4.4). Before cutover, we need to create
a set of test users representing different roles and scenarios to validate the migration in staging.

TASK: Create comprehensive test dataset for Auth0 migration validation.

REQUIREMENTS:

1. Create test data script: `packages/server/src/scripts/create-migration-test-users.ts`

   ```typescript
   import { DBProvider } from '@modules/app-providers/db.provider'
   import { Auth0ManagementService } from '@modules/auth/services/auth0-management.service'

   const testUsers = [
     { email: 'owner-test@example.com', roleId: 'business_owner' },
     { email: 'accountant-test@example.com', roleId: 'accountant' },
     { email: 'employee-test@example.com', roleId: 'employee' },
     { email: 'scraper-test@example.com', roleId: 'scraper' }
   ]

   async function createMigrationTestUsers() {
     const dbProvider = new DBProvider(/* config */)
     const auth0Service = new Auth0ManagementService(env)
     const client = await dbProvider.pool.connect()

     try {
       for (const testUser of testUsers) {
         console.log(`Creating test user: ${testUser.email}`)

         // 1. Create Auth0 user (unblocked for testing)
         const auth0UserId = await auth0Service.createBlockedUser(testUser.email)
         await auth0Service.unblockUser(auth0UserId)

         // 2. Create local business_users record
         await client.query(
           `INSERT INTO accounter_schema.business_users 
            (user_id, auth0_user_id, business_id, role_id)
            VALUES (gen_random_uuid(), $1, $2, $3)`,
           [auth0UserId, TEST_BUSINESS_ID, testUser.roleId]
         )

         console.log(`✅ Created ${testUser.email} (${testUser.roleId})`)
       }

       console.log('✅ All migration test users created')
     } finally {
       client.release()
     }
   }
   ```

2. Create test validation queries:

   ```sql
   -- Verify test users created correctly
   SELECT
     bu.user_id,
     bu.auth0_user_id,
     bu.role_id,
     'Test user ready' as status
   FROM accounter_schema.business_users bu
   WHERE bu.auth0_user_id LIKE 'auth0|%'
     AND business_id = 'TEST_BUSINESS_ID';
   ```

3. Create test scenarios document: `docs/user-authentication-plan/migration-test-scenarios.md`

   ```markdown
   ## Auth0 Migration Test Scenarios

   ### Test User Matrix

   | Email                       | Role           | Auth0 Status | Test Scenarios               |
   | --------------------------- | -------------- | ------------ | ---------------------------- |
   | owner-test@example.com      | business_owner | Active       | Full access, user management |
   | accountant-test@example.com | accountant     | Active       | Financial data access        |
   | employee-test@example.com   | employee       | Active       | Limited access               |
   | scraper-test@example.com    | scraper        | Blocked      | API key auth only            |

   ### Critical Test Scenarios

   1. **Login Flow**:
      - [ ] User logs in via Auth0 Universal Login
      - [ ] JWT token issued and verified
      - [ ] Auth context populated correctly
      - [ ] Business/role data mapped correctly

   2. **Authorization**:
      - [ ] Business owner can access all features
      - [ ] Accountant restricted from user management
      - [ ] Employee cannot view salary data
      - [ ] API key authentication works independently

   3. **Multi-Tenant Isolation**:
      - [ ] User from business A cannot access business B data
      - [ ] RLS policies enforced correctly
      - [ ] Cross-business queries blocked

   4. **Edge Cases**:
      - [ ] Expired JWT rejected
      - [ ] Invalid JWT signature rejected
      - [ ] User not in local database returns null context
      - [ ] Concurrent requests isolated correctly

   ### Rollback Test

   - [ ] Toggle USE_AUTH0=false
   - [ ] Restart server
   - [ ] Verify old auth works
   - [ ] Confirm < 1 minute downtime
   ```

4. Run test user creation:

   ```bash
   npm run create-migration-test-users
   ```

5. Validate test users:
   - Login with each test user via Auth0 Universal Login
   - Obtain JWT tokens
   - Test GraphQL queries with each role
   - Verify RLS enforcement

6. Document test credentials:
   - Store in secure location (1Password, HashiCorp Vault, etc.)
   - Never commit to git
   - Share with QA team for staging validation

EXPECTED OUTPUT:

- Script: `packages/server/src/scripts/create-migration-test-users.ts`
- Test users created in Auth0 and local database
- Documentation: `docs/user-authentication-plan/migration-test-scenarios.md`
- Test credentials documented securely
- All test scenarios validated

INTEGRATION: These test users will be used to:

- Validate Auth0 authentication in staging
- Test role-based authorization
- Verify RLS enforcement
- Practice rollback procedure
- Train support team

VALIDATION:

- All test users can log in via Auth0
- Role-based access control works correctly
- Multi-tenant isolation verified
- Rollback procedure tested and documented

RISK: Very Low (test users only, staging environment)

``

---

### Prompt 4.6: Activate Auth0 Authentication (The Switch)

``

CONTEXT: All preparation complete:

- Auth0 infrastructure built and tested (Prompts 2.2-2.5, 4.1-4.3)
- Parallel testing validated (Prompt 4.4)
- Migration test users created and validated (Prompt 4.5)

Now we perform the controlled cutover to activate Auth0 as the primary authentication system.

**CRITICAL**: This is the high-risk step. Follow prerequisites checklist carefully. Have rollback
plan ready. Schedule during maintenance window.

TASK: Activate Auth0 authentication by replacing auth plugin and AUTH_CONTEXT provider, with
immediate rollback capability.

REQUIREMENTS:

**PREREQUISITES CHECKLIST** (Must ALL be complete):

- [ ] Auth0 tenant fully configured (Prompt 4.2)
- [ ] AuthPluginV2 and AuthContextV2Provider tested in isolation (Prompts 2.2, 2.4)
- [ ] Parallel testing passed (Prompt 4.4)
- [ ] Migration test users validated in staging (Prompt 4.5)
- [ ] Staging environment tested end-to-end with Auth0
- [ ] Rollback procedure tested and documented
- [ ] Team trained on rollback process
- [ ] Maintenance window scheduled (recommend 15 minutes during low traffic)
- [ ] Monitoring dashboards ready
- [ ] Support team on standby

**CUTOVER PROCESS**:

1. **Update server entry point** (`packages/server/src/index.ts`):

   ```typescript
   // BEFORE (existing auth):
   const yoga = createYoga({
     plugins: [
       authPlugin(), // OLD: Remove this line
       useGraphQLModules(application)
       // ... other plugins
     ]
   })

   // AFTER (Auth0):
   const yoga = createYoga({
     plugins: [
       authPluginV2(), // NEW: Auth0 plugin
       useGraphQLModules(application)
       // ... other plugins
     ]
   })
   ```

2. **Update GraphQL Modules providers** (`packages/server/src/modules-app.ts`):

   ```typescript
   export const application = createApplication({
     modules: [
       /* existing modules */
     ],
     providers: [
       DBProvider,
       TenantAwareDBClient,

       // REMOVE old auth providers (comment out, don't delete yet):
       // OldAuthContextProvider,
       // { provide: AUTH_CONTEXT, ... },

       // ACTIVATE Auth0 providers:
       AuthContextV2Provider,
       {
         provide: AUTH_CONTEXT, // Switch AUTH_CONTEXT to use V2
         useFactory: async (provider: AuthContextV2Provider) => {
           return await provider.getAuthContext()
         },
         deps: [AuthContextV2Provider]
       }
     ]
   })
   ```

3. **Deploy to staging**:

   ```bash
   git checkout -b auth0-cutover
   git add packages/server/src/index.ts packages/server/src/modules-app.ts
   git commit -m "feat: activate Auth0 authentication (cutover)"
   git push origin auth0-cutover
   
   # Deploy to staging
   npm run deploy:staging
   ```

4. **Staging validation** (30-minute soak test):
   - [ ] Existing test users can log in via Auth0
   - [ ] New user invitation flow works
   - [ ] All GraphQL queries execute successfully
   - [ ] RLS enforcement verified
   - [ ] No authentication errors in logs
   - [ ] Performance acceptable (< 10% latency increase)

5. **Production deployment**:

   ```bash
   # Announce maintenance window
   # Deploy to production
   npm run deploy:production
   
   # Monitor for 24 hours
   ```

6. **Post-deployment monitoring** (first 24 hours):
   - [ ] Authentication success rate > 99%
   - [ ] No increase in 401/403 errors
   - [ ] JWT verification errors < 0.1%
   - [ ] Database query performance stable
   - [ ] No RLS policy violations

**ROLLBACK PLAN** (if issues detected):

1. **Immediate rollback** (< 2 minutes):

   ```bash
   # Set environment flag
   export USE_AUTH0=false
   
   # Revert index.ts and modules-app.ts changes
   git revert HEAD
   
   # Redeploy
   npm run deploy:production
   
   # Verify old auth works
   curl -H "Authorization: Bearer OLD_JWT" https://api.example.com/graphql
   ```

2. **Alternative: Environment flag rollback**:
   - If USE_AUTH0 flag implemented, toggle to false
   - Restart server
   - Old auth system activates immediately

3. **Communication**:
   - Notify users of brief interruption
   - Estimated downtime: < 1 minute
   - Send status update every 5 minutes during rollback

**RISK MITIGATION**:

- Maintenance window during low traffic (e.g., 3-5am)
- Gradual rollout: staging → production
- Feature flag for quick disable if needed
- Monitoring alerts for authentication failures
- Support team briefed and available

EXPECTED OUTPUT:

- Updated: `packages/server/src/index.ts` (authPluginV2 active)
- Updated: `packages/server/src/modules-app.ts` (AUTH_CONTEXT uses V2)
- Git branch: `auth0-cutover`
- Deployment to staging successful
- Staging validation passed
- Production deployment successful
- Post-deployment monitoring for 24 hours
- **Auth0 is now the PRIMARY authentication system**

INTEGRATION: After this step:

- All new logins use Auth0
- Existing sessions continue working (JWTs valid until expiration)
- Invitation flow uses Auth0 Management API
- Old auth code disabled but not deleted (kept for 7 days)

VALIDATION:

- Users can log in via Auth0 Universal Login
- JWT verification works correctly
- Authorization checks pass
- RLS enforcement intact
- No degradation in performance or security
- Zero data leakage or cross-tenant access

RISK: **HIGH** - This is the production cutover

**SUCCESS CRITERIA**:

- Authentication success rate > 99% (first 24 hours)
- No security incidents
- User feedback positive or neutral
- Support tickets < 5 related to auth
- Rollback not needed

**NEXT PHASE**: After 7 days of stability, proceed to Phase 5 (cleanup) to remove old auth code and
rename v2 files.

``

---

## Phase 5: Post-Migration Cleanup (After 7 Days Stability)

### Prompt 5.1: Remove Deprecated Authentication Code

``

CONTEXT: Auth0 authentication has been running successfully in production for 7 days with no
incidents. The old authentication code is no longer needed and can be safely removed.

**CRITICAL**: Only proceed if:

- 7+ days since Auth0 cutover (Prompt 4.6)
- Zero authentication-related incidents
- No rollbacks performed
- Team confidence high

TASK: Remove old authentication code and cleanup deprecated files.

REQUIREMENTS:

1. **Audit deprecated code**:

   ```bash
   # Find all old auth-related files
   find packages/server/src -name "*auth*" -not -name "*v2*" | grep -E "(plugin|provider|service)"
   ```

2. **Remove old auth plugin**:

   ```bash
   # Delete old auth plugin file
   rm packages/server/src/plugins/auth-plugin.ts # If different from auth-plugin-v2.ts
   
   # Remove from git history note (keep for reference)
   git rm packages/server/src/plugins/auth-plugin.ts
   ```

3. **Remove old AUTH_CONTEXT provider** (if separate from V2):
   - Delete old AuthContextProvider file
   - Remove from modules-app.ts providers (already done in 4.6)

4. **Remove USE_AUTH0 feature flag**:

   ```typescript
   // packages/server/src/environment.ts
   // REMOVE:
   USE_AUTH0: z.boolean().default(false),
   ```

5. **Remove test scripts**:

   ```bash
   rm packages/server/src/scripts/test-auth0-parallel.ts
   rm packages/server/src/scripts/create-migration-test-users.ts
   ```

6. **Update documentation**:
   - Remove migration-specific docs
   - Update README to reflect Auth0 as primary auth
   - Archive migration plan to `docs/archive/user-authentication-plan/`

7. **Git cleanup**:

   ```bash
   git checkout -b cleanup-old-auth
   git add -A
   git commit -m "chore: remove deprecated auth code after successful Auth0 migration"
   git push origin cleanup-old-auth
   # Create PR, get team review, merge
   ```

8. **Database cleanup** (optional, low priority):
   - Archive audit logs from migration test users
   - Remove migration-specific test data if desired
   - Keep for historical record if storage not an issue

EXPECTED OUTPUT:

- Old auth plugin files removed
- Feature flag removed
- Test scripts removed
- Documentation updated
- Git history clean
- All tests still passing with Auth0

VALIDATION:

- Server starts successfully
- Authentication works (Auth0 only)
- No references to old auth code
- Tests pass
- Production stable

RISK: Low (old code already disabled for 7 days)

``

---

### Prompt 5.2: Rename V2 Files to Standard Names

``

CONTEXT: Old auth code removed (Prompt 5.1). Now we can rename v2 files to standard names since
there's no longer a naming conflict.

TASK: Rename auth-plugin-v2.ts, AuthContextV2Provider, and AUTH_CONTEXT_V2 to remove v2 suffix.

REQUIREMENTS:

1. **Rename auth plugin file**:

   ```bash
   git mv packages/server/src/plugins/auth-plugin-v2.ts \
     packages/server/src/plugins/auth-plugin.ts
   ```

2. **Rename AuthContextV2Provider**:

   ```typescript
   // packages/server/src/modules/auth/providers/auth-context-v2.provider.ts
   // Rename file:
   git mv auth-context-v2.provider.ts auth-context.provider.ts

   // Update class name:
   export class AuthContextProvider {  // Was: AuthContextV2Provider
     // ... implementation unchanged
   }
   ```

3. **Rename AUTH_CONTEXT_V2 token**:

   ```typescript
   // packages/server/src/shared/tokens.ts
   export const AUTH_CONTEXT = new InjectionToken<AuthContext | null>('AuthContext')
   // Remove: export const AUTH_CONTEXT_V2 = ...
   ```

4. **Update all imports**:

   ```bash
   # Find all references to V2 names
   grep -r "AuthContextV2Provider" packages/server/src
   grep -r "AUTH_CONTEXT_V2" packages/server/src
   grep -r "authPluginV2" packages/server/src
   
   # Update to standard names (manual or sed)
   ```

5. **Update index.ts**:

   ```typescript
   // packages/server/src/index.ts
   const yoga = createYoga({
     plugins: [
       authPlugin(), // Was: authPluginV2()
       useGraphQLModules(application)
     ]
   })
   ```

6. **Update modules-app.ts**:

   ```typescript
   // packages/server/src/modules-app.ts
   import { AuthContextProvider } from './modules/auth/providers/auth-context.provider'
   import { AUTH_CONTEXT } from './shared/tokens'

   providers: [
     AuthContextProvider, // Was: AuthContextV2Provider
     {
       provide: AUTH_CONTEXT, // Was: AUTH_CONTEXT_V2
       useFactory: async (provider: AuthContextProvider) => {
         return await provider.getAuthContext()
       },
       deps: [AuthContextProvider]
     }
   ]
   ```

7. **Run all tests**:

   ```bash
   npm test
   ```

8. **TypeScript compilation**:

   ```bash
   npm run type-check
   ```

9. **Commit changes**:
   ```bash
   git add -A
   git commit -m "refactor: rename v2 auth files to standard names"
   git push origin cleanup-old-auth
   ```

EXPECTED OUTPUT:

- All v2 files renamed to standard names
- All imports updated
- TypeScript compilation succeeds
- All tests pass
- Code cleaner and more maintainable

VALIDATION:

- No references to "v2" in auth code
- Server starts successfully
- Authentication works correctly
- Tests pass

RISK: Very Low (just renaming, no logic changes)

``

---

### Prompt 5.3: Final Migration Documentation

``

CONTEXT: Auth0 migration complete and code cleanup finished. Now we need comprehensive documentation
for the team.

TASK: Create final documentation summarizing the migration, architecture, and operational
procedures.

REQUIREMENTS:

1. **Create Architecture Documentation**: `docs/architecture/authentication.md`

   ```markdown
   # Authentication Architecture

   ## Overview

   Accounter uses **Auth0** as the external identity provider for all user authentication. Auth0
   handles credentials, JWT issuance, and session management. The local system handles business
   authorization, roles, and permissions.

   ## Authentication Flow

   1. User navigates to login page
   2. Frontend redirects to Auth0 Universal Login
   3. User enters credentials
   4. Auth0 verifies credentials and issues JWT
   5. Frontend receives JWT and stores securely
   6. Frontend includes JWT in Authorization header for GraphQL requests
   7. Server verifies JWT signature using Auth0 JWKS endpoint
   8. Server maps Auth0 user ID to local business/role data
   9. Server enforces RLS using business_id from auth context

   ## Components

   - **authPlugin**: Extracts JWT from Authorization header
   - **AuthContextProvider**: Verifies JWT and maps to local user data
   - **TenantAwareDBClient**: Enforces RLS using auth context
   - **Auth0ManagementService**: Creates/manages Auth0 users via Management API

   ## Security Boundaries

   - **Primary**: Row-Level Security (RLS) at database level
   - **Secondary**: Application-level authorization checks
   - **JWT Verification**: RS256 asymmetric signing, verified against Auth0 JWKS
   - **Multi-Tenant Isolation**: Enforced by RLS policies on all tenant tables

   ## Configuration

   See `packages/server/.env.example` for required Auth0 environment variables.
   ```

2. **Create Operational Runbook**: `docs/operations/auth0-runbook.md`

   ```markdown
   # Auth0 Operations Runbook

   ## Common Tasks

   ### Invite New User

   1. Admin creates invitation via GraphQL mutation
   2. System calls Auth0 Management API to create blocked user
   3. Invitation email sent with magic link
   4. User clicks link, sets password, account unblocked
   5. User can now log in via Auth0 Universal Login

   ### Reset User Password

   Users can self-serve password resets via Auth0 Universal Login:

   - Click "Forgot Password" on login page
   - Auth0 sends password reset email
   - User sets new password

   ### Revoke User Access

   1. Admin removes user from business via GraphQL mutation
   2. User record marked as inactive in local database
   3. RLS policies prevent data access
   4. Optional: Block user in Auth0 to prevent login

   ### Troubleshooting

   #### User Cannot Log In

   - Check Auth0 dashboard: User → View → Blocked status
   - Check local database: business_users table, auth0_user_id mapping
   - Check Auth0 logs: Dashboard → Monitoring → Logs
   - Verify email verified in Auth0

   #### JWT Verification Failing

   - Check server logs for specific error
   - Verify AUTH0_DOMAIN and AUTH0_AUDIENCE config
   - Test JWKS endpoint: `curl https://{domain}/.well-known/jwks.json`
   - Decode JWT at jwt.io and verify claims

   #### Performance Issues

   - Check Auth0 status: https://status.auth0.com
   - Monitor JWT verification latency (should be < 50ms)
   - Check JWKS caching (should cache for 10+ minutes)
   - Verify database connection pool not exhausted
   ```

3. **Update README.md**:

   ```markdown
   ## Authentication

   Accounter uses Auth0 for user authentication. See:

   - [Architecture Documentation](docs/architecture/authentication.md)
   - [Operations Runbook](docs/operations/auth0-runbook.md)
   - [Auth0 Setup Guide](docs/user-authentication-plan/auth0-setup.md)
   ```

4. **Archive migration documentation**:

   ```bash
   mkdir -p docs/archive/user-authentication-plan
   mv docs/user-authentication-plan/*.md docs/archive/user-authentication-plan/
   # Keep only: auth0-setup.md, migration-summary.md
   ```

5. **Create migration summary**: `docs/user-authentication-plan/migration-summary.md`

   ```markdown
   # Auth0 Migration Summary

   **Migration Date**: [Date of Phase 4.6 cutover] **Duration**: [Total time from start to cleanup]
   **Downtime**: [Actual downtime during cutover]

   ## Phases Completed

   - [x] Phase 1: Database schema (business_users, roles, etc.)
   - [x] Phase 2: Core services (DBProvider, TenantAwareDBClient, AuthContext)
   - [x] Phase 3: Row-Level Security (RLS policies on all tables)
   - [x] Phase 4: Auth0 integration and cutover
   - [x] Phase 5: Post-migration cleanup

   ## Metrics

   - Users migrated: [count]
   - Authentication success rate: [percentage]
   - Incidents during migration: [count]
   - Rollbacks performed: [count]

   ## Lessons Learned

   - [Key learnings from migration]
   - [Challenges encountered]
   - [Best practices discovered]
   ```

EXPECTED OUTPUT:

- Architecture documentation created
- Operations runbook created
- README updated
- Migration plan archived
- Migration summary documented
- Team trained on new authentication system

VALIDATION:

- Documentation accurate and comprehensive
- Team can operate Auth0 independently
- Runbook tested with real scenarios

RISK: None (documentation only)

**MIGRATION COMPLETE! 🎉**

``

---

## Phases 6-10: Additional Features (Out of Current Scope)

**Note**: The following phases (invitation flow, API keys, frontend integration, production
hardening, legacy migration) are documented in the original blueprint.md but are NOT yet updated for
Auth0 integration in this prompt plan.

These phases will need comprehensive revision to align with Auth0 architecture:

- **Phase 6**: Invitation system using Auth0 Management API for pre-registration
- **Phase 7**: API key authentication (independent of Auth0)
- **Phase 8**: Frontend integration with Auth0 Universal Login SDK
- **Phase 9**: Production hardening (monitoring, rate limiting, security headers)
- **Phase 10**: Legacy data migration (mapping existing users to Auth0)

Refer to blueprint.md for detailed implementation steps for these phases. Prompts 5.1+ will be added
in a future update once Phases 1-5 are validated in production.

---

## Summary

This prompt plan provides a step-by-step implementation guide for the Auth0-based authentication
system. Key principles:

1. **Self-Contained Steps**: Each prompt is complete and leaves the server stable
2. **Non-Breaking Migration**: V2 files created alongside existing auth until Phase 4 cutover
3. **Incremental Progress**: Build → Test → Validate → Deploy → Monitor
4. **Safety First**: Parallel testing, feature flags, rollback plans at every stage
5. **Documentation**: Comprehensive docs for team handoff

**Migration Strategy Summary**:

- **Phase 1-2**: Build database schema and core services
- **Phase 3**: Enable RLS for security
- **Phase 4**: Integrate Auth0 (preparatory → parallel testing → safe cutover)
- **Phase 5**: Cleanup after 7 days stability

Follow prompts sequentially, review code before proceeding, and run tests after each step. Good
luck! 🚀 ```

- Generate secrets: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

5. Write unit tests:
   - Access token signs correctly
   - Access token verifies correctly
   - Access token expires after 15 minutes
   - Refresh token signs correctly
   - Refresh token verifies correctly
   - Refresh token expires after 7 days
   - Expired tokens return null from verify
   - Invalid tokens return null from verify
   - Payload round-trip preserves all fields

6. Write integration tests:
   - Tokens work in actual GraphQL requests
   - Expired token rejected
   - Invalid signature rejected

EXPECTED OUTPUT:

- Config: `packages/server/src/modules/auth/config/jwt.config.ts`
- Service: `packages/server/src/modules/auth/services/token.service.ts`
- Tests: `packages/server/src/modules/auth/services/__tests__/token.service.test.ts`
- Updated: `.env.example`
- Documentation: How to generate JWT secrets
- All tests passing

INTEGRATION: TokenService will be used by:

- Login mutation (issue tokens)
- Refresh mutation (rotate tokens)
- AuthContext (verify tokens)

``

---

### Prompt 4.3: PermissionResolutionService

``

CONTEXT: JWT tokens need to include permissions for authorization. We need a service that resolves
permissions from roles and (in the future) user/API key overrides.

TASK: Create PermissionResolutionService that unifies permission resolution for users and API keys.

REQUIREMENTS:

1. Create file: `packages/server/src/modules/auth/services/permission-resolution.service.ts`

2. Define types:

   ```typescript
   type AuthSubject =
     | { type: 'user'; userId: string; businessId: string; roleId: string }
     | { type: 'apiKey'; apiKeyId: string; businessId: string; roleId: string }

   interface PermissionOverride {
     permission_id: string
     grant_type: 'grant' | 'revoke'
   }
   ```

3. Implement service:

   ```typescript
   @Injectable({ scope: Scope.Operation })
   export class PermissionResolutionService {
     constructor(private db: TenantAwareDBClient) {}

     async resolvePermissions(subject: AuthSubject): Promise<string[]> {
       // 1. Get base permissions from role
       const basePermissions = await this.getRolePermissions(subject.roleId)

       // 2. Get overrides (empty initially, ready for future)
       const overrides = await this.getPermissionOverrides(subject)

       // 3. Merge: apply grants and revokes
       return this.mergePermissions(basePermissions, overrides)
     }

     private async getRolePermissions(roleId: string): Promise<string[]> {
       const result = await this.db.query<{ permission_id: string }>(
         `SELECT permission_id FROM accounter_schema.role_permissions WHERE role_id = $1`,
         [roleId]
       )
       return result.rows.map(row => row.permission_id)
     }

     private async getPermissionOverrides(subject: AuthSubject): Promise<PermissionOverride[]> {
       if (subject.type === 'user') {
         const result = await this.db.query<PermissionOverride>(
           `SELECT permission_id, grant_type
            FROM accounter_schema.user_permission_overrides
            WHERE user_id = $1 AND business_id = $2`,
           [subject.userId, subject.businessId]
         )
         return result.rows
       } else {
         const result = await this.db.query<PermissionOverride>(
           `SELECT permission_id, grant_type
            FROM accounter_schema.api_key_permission_overrides
            WHERE api_key_id = $1`,
           [subject.apiKeyId]
         )
         return result.rows
       }
     }

     private mergePermissions(base: string[], overrides: PermissionOverride[]): string[] {
       const result = new Set(base)

       for (const override of overrides) {
         if (override.grant_type === 'grant') {
           result.add(override.permission_id)
         } else {
           result.delete(override.permission_id)
         }
       }

       return Array.from(result)
     }
   }
   ```

4. Write unit tests (with mocked DB):
   - getRolePermissions returns correct permissions for role
   - getPermissionOverrides returns empty array initially
   - mergePermissions adds granted permissions
   - mergePermissions removes revoked permissions
   - resolvePermissions combines base + overrides correctly

5. Write integration tests (with real DB):
   - Resolve permissions for business_owner role
   - Resolve permissions for employee role
   - Add user override (grant), verify permission added
   - Add user override (revoke), verify permission removed
   - Resolve for API key subject
   - Add API key override, verify it works

EXPECTED OUTPUT:

- Implementation: `packages/server/src/modules/auth/services/permission-resolution.service.ts`
- Tests: `packages/server/src/modules/auth/services/__tests__/permission-resolution.service.test.ts`
- All tests passing
- Documentation on future override usage

INTEGRATION: This service will be called by:

- Login mutation (resolve user permissions for JWT)
- API key validation (resolve API key permissions)
- Future: admin UI for managing overrides

``

---

### Prompt 4.4: Login Mutation

``

CONTEXT: All authentication components are ready: password hashing, JWT tokens, permission
resolution. Now we implement the core login flow.

TASK: Create the login GraphQL mutation with full authentication logic.

REQUIREMENTS:

1. Create GraphQL schema: `packages/server/src/modules/auth/schema.graphql`

   ```graphql
   type Mutation {
     login(email: String!, password: String!): AuthPayload!
   }

   type AuthPayload {
     accessToken: String!
     user: User!
   }

   type User {
     id: ID!
     name: String!
     email: String!
     emailVerified: Boolean!
     createdAt: String!
   }
   ```

2. Create resolver: `packages/server/src/modules/auth/resolvers/login.resolver.ts`

   ```typescript
   export const loginResolver: MutationResolvers['login'] = async (
     _,
     { email, password },
     context
   ) => {
     // 1. Find user by email
     const userResult = await context.db.query<{
       id: string
       name: string
       email: string
       email_verified_at: string | null
     }>('SELECT id, name, email, email_verified_at FROM accounter_schema.users WHERE email = $1', [
       email
     ])

     if (userResult.rows.length === 0) {
       throw new GraphQLError('Invalid credentials', {
         extensions: { code: 'UNAUTHENTICATED' }
       })
     }

     const user = userResult.rows[0]

     // 2. Get password hash
     const accountResult = await context.db.query<{ password_hash: string }>(
       `SELECT password_hash FROM accounter_schema.user_accounts
        WHERE user_id = $1 AND provider = 'email'`,
       [user.id]
     )

     if (accountResult.rows.length === 0 || !accountResult.rows[0].password_hash) {
       throw new GraphQLError('Invalid credentials', {
         extensions: { code: 'UNAUTHENTICATED' }
       })
     }

     // 3. Verify password
     const passwordService = context.injector.get(PasswordService)
     const isValid = await passwordService.verify(password, accountResult.rows[0].password_hash)

     if (!isValid) {
       throw new GraphQLError('Invalid credentials', {
         extensions: { code: 'UNAUTHENTICATED' }
       })
     }

     // 4. Check email verification
     if (!user.email_verified_at) {
       throw new GraphQLError('Email not verified', {
         extensions: { code: 'EMAIL_NOT_VERIFIED' }
       })
     }

     // 5. Get business and role
     const businessResult = await context.db.query<{
       business_id: string
       role_id: string
     }>(
       `SELECT business_id, role_id FROM accounter_schema.business_users WHERE user_id = $1 LIMIT 1`,
       [user.id]
     )

     if (businessResult.rows.length === 0) {
       throw new GraphQLError('No business associated with user', {
         extensions: { code: 'FORBIDDEN' }
       })
     }

     const { business_id, role_id } = businessResult.rows[0]

     // 6. Resolve permissions
     const permissionService = context.injector.get(PermissionResolutionService)
     const permissions = await permissionService.resolvePermissions({
       type: 'user',
       userId: user.id,
       businessId: business_id,
       roleId: role_id
     })

     // 7. Generate refresh token
     const refreshTokenService = context.injector.get(RefreshTokenService)
     const { token: refreshToken, tokenId } = await refreshTokenService.generateRefreshToken(
       user.id
     )

     // 8. Generate access token
     const tokenService = context.injector.get(TokenService)
     const accessToken = tokenService.signAccessToken({
       userId: user.id,
       email: user.email,
       businessId: business_id,
       roleId: role_id,
       permissions,
       emailVerified: true,
       permissionsVersion: 1
     })

     // 9. Set refresh token cookie
     context.response.cookies.set('refreshToken', refreshToken, {
       httpOnly: true,
       secure: process.env.NODE_ENV === 'production',
       sameSite: 'strict',
       maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
       path: '/'
     })

     // 10. Audit log
     const auditService = context.injector.get(AuditService)
     await auditService.log({
       businessId: business_id,
       userId: user.id,
       action: 'USER_LOGIN',
       ipAddress: context.request.headers.get('x-forwarded-for')
     })

     // 11. Return payload
     return {
       accessToken,
       user: {
         id: user.id,
         name: user.name,
         email: user.email,
         emailVerified: true,
         createdAt: user.created_at
       }
     }
   }
   ```

3. Create AuditService stub (implement fully in later prompt):

   ```typescript
   @Injectable({ scope: Scope.Operation })
   export class AuditService {
     constructor(private db: TenantAwareDBClient) {}

     async log(entry: {
       businessId?: string
       userId?: string
       action: string
       entity?: string
       entityId?: string
       details?: object
       ipAddress?: string
     }): Promise<void> {
       await this.db.query(
         `INSERT INTO accounter_schema.audit_logs
          (business_id, user_id, action, entity, entity_id, details, ip_address)
          VALUES ($1, $2, $3, $4, $5, $6, $7)`,
         [
           entry.businessId || null,
           entry.userId || null,
           entry.action,
           entry.entity || null,
           entry.entityId || null,
           entry.details ? JSON.stringify(entry.details) : null,
           entry.ipAddress || null
         ]
       )
     }
   }
   ```

4. Add rate limiting (simple in-memory for now):

   ```typescript
   const loginAttempts = new Map<string, { count: number; resetAt: number }>()

   function checkRateLimit(email: string): void {
     const now = Date.now()
     const attempt = loginAttempts.get(email)

     if (attempt && attempt.resetAt > now) {
       if (attempt.count >= 5) {
         throw new GraphQLError('Too many login attempts. Try again later.', {
           extensions: { code: 'RATE_LIMITED' }
         })
       }
       attempt.count++
     } else {
       loginAttempts.set(email, { count: 1, resetAt: now + 15 * 60 * 1000 })
     }
   }
   ```

5. Write comprehensive tests:
   - Successful login with correct credentials
   - Failed login with wrong password
   - Failed login for non-existent user
   - Failed login for unverified email
   - Failed login for user with no business
   - Rate limiting after 5 failed attempts
   - Access token contains correct payload
   - Refresh token set in HttpOnly cookie
   - Audit log entry created
   - Permissions resolved correctly

EXPECTED OUTPUT:

- Schema: `packages/server/src/modules/auth/schema.graphql`
- Resolver: `packages/server/src/modules/auth/resolvers/login.resolver.ts`
- Service: `packages/server/src/modules/auth/services/audit.service.ts`
- Tests: `packages/server/src/modules/auth/resolvers/__tests__/login.resolver.test.ts`
- All tests passing

INTEGRATION: This is the core authentication flow. After this:

- Users can log in and get tokens
- Tokens can be used for authenticated requests
- Next: token refresh, logout

``

(Due to length limits, I'll continue with the remaining prompts in a summary format)

---

## Remaining Prompts (Summarized)

**Prompt 4.5: RefreshTokenService with Rotation**

- Implement token rotation and reuse detection
- Store token hashes in user_refresh_tokens table
- Track rotation chain via replaced_by_token_id
- Revoke entire family on reuse detection

**Prompt 4.6: Refresh Token Mutation**

- Read refresh token from cookie
- Validate and rotate
- Issue new access + refresh tokens
- Handle reuse detection errors

**Prompt 4.7: Logout Mutation**

- Revoke current refresh token
- Clear cookies
- Audit log

**Prompt 5.1-5.4: RBAC Implementation**

- GraphQL directives (@requiresAuth, @requiresVerifiedEmail, @requiresRole)
- AuthorizationService base class
- Domain-specific authorization services (ChargesAuthService example)
- Wire authorization into all mutations

**Prompt 6.1-6.5: Invitation & Email Verification**

- inviteUser mutation
- acceptInvitation mutation
- requestEmailVerification mutation
- verifyEmail mutation
- Enforce email verification on critical operations

**Prompt 7.1-7.4: API Key Authentication**

- generateApiKey mutation
- API key validation middleware
- API key management (list, revoke)
- Scraper role integration test

**Prompt 8.1-8.6: Frontend Integration**

- Update login page component
- Auth context provider (React)
- Protected route component
- Urql client configuration
- Email verification banner
- Invitation acceptance flow

**Prompt 9.1-9.6: Production Hardening**

- Provider scope audit (fix cache leakage)
- Connection pool optimization
- Rate limiting
- Audit log dashboard
- Security checklist
- Performance baseline

**Prompt 10.1-10.3: Legacy Migration**

- Dual-write period
- Data reconciliation
- Legacy deprecation

---

## Summary

This prompt plan provides **60+ detailed implementation prompts** covering:

- Database migrations (12 prompts)
- Backend services (25 prompts)
- GraphQL API (15 prompts)
- Frontend (6 prompts)
- Production hardening (6 prompts)
- Migration from legacy (3 prompts)

Each prompt:

- Builds on previous work
- Includes full code examples
- Specifies testing requirements
- Defines integration points
- Provides expected output

**Total implementation time**: 10-12 weeks with 2-3 developers working in parallel.
