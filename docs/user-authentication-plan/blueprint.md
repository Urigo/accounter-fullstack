# User Authentication System - Implementation Blueprint (Auth0 Integration)

## Overview

This blueprint outlines the step-by-step implementation of a user authentication and RBAC system for
the Accounter application using **Auth0 as the external identity provider**. Auth0 handles all
authentication concerns (login, signup, password management, email verification, JWT issuance),
while the application maintains full control over business authorization, roles, and permissions.

The plan prioritizes incremental progress, strong testing, and minimal risk at each stage.

## Guiding Principles

- **Incremental Progress**: Each step builds on the previous, with no orphaned code
- **Test-Driven**: Write tests before or alongside implementation
- **Safety First**: Small, focused changes with validation at each stage
- **Database-First Security**: RLS as primary boundary, application layer as UX enhancement
- **Auth0 for Authentication, Local for Authorization**: Auth0 manages user credentials and
  sessions; local system manages business access, roles, and permissions
- **No Big Jumps**: Complexity increases gradually across phases

---

## Phase 1: Foundation & Database Schema (Weeks 1-2)

### Step 1.1: Pre-Migration Table Rename

**Goal**: Resolve naming collision by renaming existing `users` table to `legacy_business_users`

**Tasks**:

- Create migration: `2026-01-20-rename-users-to-legacy-businesses.sql`
- Rename `accounter_schema.users` to `accounter_schema.legacy_business_users`
- Verify Postgres automatically updates FK constraints
- Add tests: Verify no broken references post-rename
- Deploy to staging, validate all queries work

**Validation**:

- All existing queries using `users` table still function
- Foreign keys point to renamed table
- No application errors

**Risk**: Low (Postgres handles FK updates automatically)

---

### Step 1.2: Core User Tables Migration (Auth0 Schema)

**Goal**: Create foundational business-user mapping, roles, and permissions tables

**Tasks**:

- Create migration: `2026-01-21-create-core-user-tables.sql`
- Create tables:
  - **`business_users`** (user_id UUID PK, auth0_user_id TEXT UNIQUE NULLABLE, business_id UUID FK,
    role_id TEXT FK, created_at, updated_at)
    - `user_id` is generated on invitation creation (pre-registration)
    - `auth0_user_id` is populated on first login after Auth0 account activation
    - Composite primary key on (user_id, business_id) for M:N support
  - **`roles`** (id TEXT PK, name TEXT UNIQUE) - seed with: business_owner, accountant, employee,
    scraper
  - **`permissions`** (id TEXT PK, name TEXT UNIQUE) - seed with: manage:users, view:reports,
    issue:docs, insert:transactions (for future use, not initially enforced)
  - **`role_permissions`** (role_id TEXT FK, permission_id TEXT FK) - seed default mappings (for
    future use)
- **Note**: No `users`, `user_accounts`, `user_refresh_tokens`, or `email_verification_tokens`
  tables - these are managed by Auth0
- Add proper indexes on auth0_user_id (for login lookups), business_id foreign keys
- Add tests: Verify table creation, seed data, constraints

**Validation**:

- Tables exist with correct schema
- Seed data loaded correctly
- Unique constraints enforced (auth0_user_id uniqueness)
- Foreign keys properly configured

**Risk**: Low (standard DDL operations)

---

### Step 1.3: Invitations and API Keys Tables

**Goal**: Create invitation management and API key authentication tables

**Tasks**:

- Create migration: `2026-01-22-create-invitations-apikeys-tables.sql`
- Create tables:
  - **`invitations`** (id UUID PK, business_id UUID FK, email TEXT, role_id TEXT FK, token TEXT
    UNIQUE, auth0_user_created BOOLEAN DEFAULT FALSE, auth0_user_id TEXT NULLABLE,
    invited_by_user_id UUID FK to business_users.user_id, accepted_at TIMESTAMPTZ NULLABLE,
    expires_at TIMESTAMPTZ, created_at)
    - `auth0_user_created`: Tracks whether Auth0 Management API call succeeded
    - `auth0_user_id`: Stores Auth0 user ID for cleanup of expired invitations
    - `invited_by_user_id`: Tracks which admin created the invitation
    - `accepted_at`: Single-use token tracking (NULL until accepted)
  - **`api_keys`** (id UUID PK, business_id UUID FK, role_id TEXT FK, key_hash TEXT UNIQUE, name
    TEXT, last_used_at TIMESTAMPTZ, created_at)
- Add unique constraint on invitation token
- Add indexes on business_id, expires_at (for cleanup job)
- Add tests: Verify constraints, FK relationships

**Validation**:

- Tables support pre-registration invitation flow
- Token uniqueness enforced
- API key structure ready for programmatic access
- FK cascades configured properly

**Risk**: Low

---

### Step 1.4: Audit Logs Table

**Goal**: Create audit logging table for security and compliance

**Tasks**:

- Create migration: `2026-01-23-create-audit-logs-table.sql`
- Create table:
  - **`audit_logs`** (id UUID PK, business_id UUID FK NULLABLE, user_id UUID FK to
    business_users.user_id NULLABLE, auth0_user_id TEXT NULLABLE, action TEXT NOT NULL, entity TEXT
    NULLABLE, entity_id TEXT NULLABLE, details JSONB NULLABLE, ip_address TEXT NULLABLE, created_at
    TIMESTAMPTZ)
    - `auth0_user_id`: Stores Auth0 identity for complete audit trail
    - `user_id`: Local user_id for business context
    - Both nullable to support system actions or failed logins
- Add indexes on (business_id, created_at), action, user_id
- Add tests: Verify table structure, indexes, JSONB column functionality

**Validation**:

- Table created successfully
- Indexes exist and perform well
- JSONB column in audit_logs works correctly
- Support for both Auth0 and local user tracking

**Risk**: Low

---

### Step 1.5: Permission Override Tables (Future-Proofing)

**Goal**: Add tables for granular user/API key permission overrides (not used initially)

**Tasks**:

- Create migration: `2026-01-24-create-permission-overrides.sql`
- Create ENUM: `grant_type_enum` ('grant', 'revoke')
- Create tables:
  - **`user_permission_overrides`** (id UUID PK, user_id UUID FK to business_users.user_id,
    business_id UUID FK, permission_id TEXT FK, grant_type grant_type_enum, created_at TIMESTAMPTZ)
  - **`api_key_permission_overrides`** (id UUID PK, api_key_id UUID FK, permission_id TEXT FK,
    grant_type grant_type_enum, created_at TIMESTAMPTZ)
- Add unique constraints on (user_id, business_id, permission_id), (api_key_id, permission_id)
- Add tests: Verify ENUM enforcement, constraints

**Validation**:

- Tables exist but remain unpopulated initially
- Schema ready for future granular permissions feature (not in scope for current phase)
- Authorization will use role-based checks only (e.g., `if roleId === 'business_owner'`)

**Risk**: Very Low (tables not used yet)

---

## Phase 1 Complete - System Functional Validation

**Achievement**: New database schema created, legacy tables renamed

**Critical Validation**:

- ✅ **Existing functionality unchanged**: All application code continues to work
- ✅ **Legacy `users` table accessible**: Renamed to `legacy_business_users`, all FK constraints
  updated automatically
- ✅ **New tables ready**: `business_users`, `roles`, `permissions`, `invitations`, `api_keys`,
  `audit_logs` created
- ✅ **All existing tests pass**: No application-level changes required
- ✅ **Tables unpopulated**: New schema exists but is not yet used by application code

**Production Readiness**: Safe to deploy Phase 1 to production - pure database schema changes, zero
user impact

---

## Phase 2: Core Database Services (Week 3)

### Step 2.1: DBProvider Singleton Setup

**Goal**: Verify and enhance existing connection pool manager for system-level operations

**Tasks**:

- ✅ **Already exists**: `packages/server/src/modules/app-providers/db.provider.ts`
- ✅ Singleton DBProvider class with `@Injectable({ scope: Scope.Singleton })`
- ✅ Exposes `pool` property for direct access (migrations, background jobs)
- ✅ Has `healthCheck()` method for connection validation
- Add integration tests (if not already present):
  - Pool creation succeeds
  - Can execute system-level queries
  - Connection limits respected
  - Health check passes

**Validation**:

- Pool initializes on server start
- Health checks pass
- No connection leaks in tests
- `pool` property accessible for migrations and background jobs

**Risk**: Low (standard connection pooling pattern, already implemented)

---

### Step 2.2: Auth Plugin V2 (HTTP-Level Auth Extraction - Preparatory)

**Goal**: Create NEW lightweight plugin for future Auth0 integration WITHOUT breaking existing auth

**Tasks**:

- Create NEW file: `packages/server/src/plugins/auth-plugin-v2.ts` (do NOT modify existing
  auth-plugin.ts)
- Implement `authPluginV2()`:
  - Extract `Authorization: Bearer <token>` header
  - Extract `X-API-Key` header (for API key authentication)
  - Add `rawAuth: { authType: 'jwt' | 'apiKey' | null, token: string | null }` to Yoga context
  - **Does NOT**: Verify JWT, query database, or resolve permissions (delegated to
    `AuthContextProvider`)
- **DO NOT** update `packages/server/src/index.ts` yet - keep existing auth-plugin active
- Add flag in environment: `USE_AUTH0: boolean` (default: false)
- Add tests:
  - JWT token extracted correctly from Authorization header
  - API key extracted correctly from X-API-Key header
  - Missing auth results in `rawAuth: { authType: null, token: null }`
  - Malformed headers handled gracefully

**Code Example**:

```typescript
// packages/server/src/plugins/auth-plugin.ts
import { useExtendContext } from 'graphql-yoga'
import type { Plugin } from '@envelop/types'

export interface RawAuth {
  authType: 'jwt' | 'apiKey' | null
  token: string | null
}

export const authPlugin = (): Plugin => {
  return useExtendContext(async yogaContext => {
    let rawAuth: RawAuth = { authType: null, token: null }

    const authHeader = yogaContext.request.headers.get('authorization')
    if (authHeader?.toLowerCase().startsWith('bearer ')) {
      rawAuth = {
        authType: 'jwt',
        token: authHeader.substring(7)
      }
    } else {
      const apiKey = yogaContext.request.headers.get('x-api-key')
      if (apiKey) {
        rawAuth = { authType: 'apiKey', token: apiKey }
      }
    }

    return { rawAuth }
  })
}
```

**Validation**:

- New auth plugin created successfully
- Auth headers extracted correctly in isolation tests
- **Existing auth plugin still active and functional**
- Server starts without errors
- Existing users can still log in

**Risk**: Very Low (no changes to existing auth, purely additive)

---

### Step 2.3: TenantAwareDBClient (Request-Scoped) - Preparatory

**Goal**: Create RLS-enforcing database client for FUTURE use (infrastructure only, not yet
operational)

**Tasks**:

- Create `packages/server/src/modules/app-providers/tenant-db-client.ts`
- Implement `TenantAwareDBClient` class:
  - `@Injectable({ scope: Scope.Operation })`
  - Constructor injects `DBProvider` (singleton) and
    `@Inject(AUTH_CONTEXT) authContext: AuthContext | null`
  - Handle null auth context gracefully (throw error or return empty results for now)
  - `query()` method: wraps in transaction, sets RLS variables (when auth context exists)
  - `transaction()` method: supports nested transactions via savepoints
  - `dispose()` method: releases connection back to pool
- Implement RLS variable setting (only when authContext is not null):
  ```sql
  SET LOCAL app.current_business_id = $1;
  SET LOCAL app.current_user_id = $2;
  SET LOCAL app.auth_type = $3;
  ```
- Add unit tests:
  - Transaction reuse within single operation
  - Savepoint creation for nested transactions
  - Proper connection release on dispose
  - RLS variables set correctly (when auth context provided)
  - **Null auth context handled gracefully** (throws descriptive error)

**Validation**:

- TenantAwareDBClient compiles successfully
- Unit tests pass with mock auth context
- Null auth handling works correctly (throws error with message "Auth context not available")
- **NOT YET USED in resolvers** (infrastructure only)

**Risk**: Low (preparatory code, not integrated into request flow yet)

---

### Step 2.4: Auth Context Provider (Auth0 JWT Verification - Preparatory)

**Goal**: Create request-scoped auth context provider for FUTURE Auth0 integration (not yet active)

**Tasks**:

- Install `jose` library for JWT verification
- Create `packages/server/src/modules/auth/providers/auth-context-v2.provider.ts` (separate from
  existing auth)
- Implement AuthContext interface:
  ```typescript
  interface AuthContext {
    authType: 'user' | 'apiKey' | 'system'
    user?: {
      userId: string // Local user_id from business_users
      auth0UserId: string // Auth0 sub claim
      businessId: string
      roleId: string
    }
    tenant: {
      businessId: string
    }
  }
  ```
- Implement Auth0 JWT verification:
  - Extract JWT from `Authorization: Bearer <token>` header
  - Fetch Auth0 JWKS from `https://<tenant>.auth0.com/.well-known/jwks.json`
  - Verify RS256 signature using `jose` library
  - Validate claims: `iss` (issuer), `aud` (audience), `exp` (expiration)
  - Extract `sub` claim (Auth0 user ID like `auth0|507f1f77bcf86cd799439011`)
- Store in request-scoped injectable
- Add tests:
  - Valid Auth0 JWT parsed correctly (with real test JWT from Auth0 test tenant)
  - Expired JWT rejected
  - Invalid signature rejected
  - Missing/invalid claims rejected
  - Missing token results in null context

**Validation**:

- Auth0 JWT verification logic implemented and tested in isolation
- **Provider NOT YET registered in DI** (existing auth still active)
- Unit tests pass with mock Auth0 JWTs
- Context isolated per request (tested in isolation)
- **Existing auth system unaffected**

**Risk**: Very Low (preparatory code only, not integrated into request flow yet)

---

### Step 2.5: Provide AUTH_CONTEXT Injection Token (Preparatory)

**Goal**: Define AUTH_CONTEXT injection token for FUTURE use (not yet active)

**Tasks**:

- Update `packages/server/src/shared/tokens.ts`:
  - Add `AUTH_CONTEXT_V2` injection token:
    ```typescript
    export const AUTH_CONTEXT_V2 = new InjectionToken<AuthContext | null>('AUTH_CONTEXT_V2')
    ```
- **DO NOT** update `packages/server/src/modules-app.ts` providers yet
- **DO NOT** inject into TenantAwareDBClient yet
  ```typescript
  {
    provide: AUTH_CONTEXT,
    scope: Scope.Operation,
    useFactory: async (context: any, authProvider: AuthContextProvider) => {
      return authProvider.getAuthContext()
    },
    deps: [CONTEXT, AuthContextProvider]
  }
  ```
- Update `TenantAwareDBClient` to inject `AUTH_CONTEXT` instead of `AuthContext` directly
- Add tests:
  - AUTH_CONTEXT token resolves correctly in operation scope
  - Null auth context handled gracefully
  - Token available across all modules

**Validation**:

- Token defined and exported
- TypeScript compilation succeeds
- **Token NOT YET used in provider registration** (existing auth unaffected)
- No impact on existing system

**Risk**: Very Low (just a type definition)

---

### Step 2.6: Register TenantAwareDBClient Provider

**Goal**: Register TenantAwareDBClient as an Operation-scoped provider for dependency injection

**Tasks**:

**1. Register TenantAwareDBClient Provider** (`packages/server/src/modules-app.ts`):

- Add `TenantAwareDBClient` to the `providers` array in `createApplication()`
- Configure as `Scope.Operation` (request-scoped, one instance per GraphQL operation)
- Inject `DBProvider` (singleton) and `AUTH_CONTEXT` (not yet active, will be null)
- Example:
  ```typescript
  providers: [
    DBProvider,
    TenantAwareDBClient // Operation-scoped, available via DI
    // ... other providers
  ]
  ```

**2. Add Tests** (Provider registration validation):

- Unit tests: Verify TenantAwareDBClient can be injected into other providers
- Integration tests: Verify provider instantiation with null auth context
- Mock tests: Verify provider works with mock AuthContext

**3. TEMPORARY Fallback (Phase 3.2 → 4.8)**:

- During Phase 3-4 transition, TenantAwareDBClient includes TEMPORARY fallback to legacy auth
- Constructor injects `@Inject(CONTEXT) private context: AccounterContext` (TEMPORARY)
- Auth verification falls back to `context.currentUser?.userId` when `authContext` is null
- BusinessId fallback: `tenant?.businessId ?? context.currentUser?.userId ?? null`
- This enables providers to migrate DIRECTLY to final pattern (inject TenantAwareDBClient)
- No intermediate workaround code in providers needed
- Cleanup in Step 4.8: Remove ONLY the fallback code from TenantAwareDBClient internals

**Architecture Notes**:

- **GraphQL Modules Providers** (see https://the-guild.dev/graphql/modules/docs/di/introduction):
  - Registered in `modules-app.ts` via `createApplication({ providers: [...] })`
  - `TenantAwareDBClient` is `Scope.Operation` (request-scoped)
  - Injected into providers/services via constructor dependency injection
  - **No Yoga context extension needed** - pure DI approach

- **Dependency Injection Flow**:
  ```
  HTTP Request
  → Yoga plugins (authPlugin, adminContextPlugin)
  → GraphQL Modules (useGraphQLModules plugin)
  → Operation-scoped providers instantiated
  → TenantAwareDBClient injected into providers
  → Providers injected into resolvers
  → Resolvers delegate to providers
  ```

**Usage Pattern** (after Auth0 activation in Phase 4):

```typescript
// Providers inject TenantAwareDBClient
@Injectable({ scope: Scope.Operation })
class BusinessesProvider {
  constructor(private db: TenantAwareDBClient) {}

  async getBusinesses() {
    return this.db.query('SELECT * FROM businesses')
  }
}

// Resolvers delegate to providers
@Resolver()
class BusinessesResolver {
  constructor(private businessesProvider: BusinessesProvider) {}

  @Query()
  getBusinesses() {
    return this.businessesProvider.getBusinesses()
  }
}
```

**Validation**:

- TenantAwareDBClient registered in providers array
- Provider can be injected into other providers via DI
- TenantAwareDBClient initializes without errors (even with null auth context)
- **NO MODULES USING IT YET** - providers still use `DBProvider` or `context.pool` (unchanged)
- Server starts successfully
- All existing tests still pass (no functional changes)

**Risk**: Very Low (purely additive, no breaking changes)

**Note**: This step ONLY registers the provider. TenantAwareDBClient exists but is UNUSED. Actual
provider migration happens in Phase 4 AFTER Auth0 activation (Prompt 4.7), when AuthContext is
properly populated. At this stage, TenantAwareDBClient won't function correctly without auth context
(it will gracefully throw an error if called)

### Step 2.7: AdminContext Provider Refactoring (Preparatory - Plugin Remains Active)

**Goal**: Refactor existing `AdminContextProvider` for DI integration (plugin remains active)

**CRITICAL**: This is PREPARATORY work. Refactor provider but **DO NOT remove
`adminContextPlugin`**. Existing users rely on the plugin. The switch happens in Phase 4 after Auth0
is active.

**Current Issues with AdminContextProvider**:

- `Scope.Singleton` with instance-level cache - shared across all requests (tenant leakage risk)
- Uses `DBProvider` directly - **will need TenantAwareDBClient in Phase 4** for RLS enforcement
- DataLoader cache is instance-level - cross-tenant leakage risk
- **No AUTH_CONTEXT integration** - required for Phase 4

**Refactoring Strategy**:

- **Phase 2.7** (now): Fix scope and cache issues, keep using `DBProvider`
- **Phase 4.8** (later): Switch from `DBProvider` to `TenantAwareDBClient` after Auth0 is active

**Tasks**:

- **Refactor existing**
  `packages/server/src/modules/admin-context/providers/admin-context.provider.ts`:

  **Change scope from Singleton to Operation**:

  ```typescript
  // BEFORE: Singleton with shared cache
  @Injectable({ scope: Scope.Singleton, global: true })
  export class AdminContextProvider {
    cache = getCacheInstance({ stdTTL: 60 * 5 }); // SHARED!
    public getAdminContextLoader = new DataLoader(...)
  }

  // AFTER: Operation-scoped with request-level cache
  @Injectable({ scope: Scope.Operation })
  export class AdminContextProvider {
    private cachedContext: IGetAdminContextsQuery | null = null;
    // No DataLoader needed for Operation scope
  }
  ```

  **Keep using DBProvider** (TenantAwareDBClient requires AUTH_CONTEXT, not available yet):

  ```typescript
  import { DBProvider } from '../../app-providers/db.provider.js'

  constructor(
    private dbProvider: DBProvider // Keep DBProvider for now
  ) {}

  async getAdminContext(): Promise<IGetAdminContextsQuery | null> {
    if (this.cachedContext !== null) {
      return this.cachedContext; // Safe per-request cache
    }

    // Use DBProvider directly - RLS not enforced yet
    // Phase 4.8 will switch to TenantAwareDBClient
    const contexts = await getAdminContexts.run(
      { ownerIds: [/* businessId from current auth */] },
      this.dbProvider // Still using DBProvider
    );

    this.cachedContext = contexts[0] || null;
    return this.cachedContext;
  }
  ```

  **Note**: The current implementation uses `owner_id` from `context.currentUser` (plugin-provided).
  Keep this pattern for now. Phase 4.8 will refactor to use AUTH_CONTEXT.

- **Create backup of existing implementation**:

  ```bash
  cp packages/server/src/modules/admin-context/providers/admin-context.provider.ts \
    packages/server/src/modules/admin-context/providers/admin-context.provider.backup.ts
  ```

- Add `ADMIN_CONTEXT` injection token to `packages/server/src/shared/tokens.ts`:

  ```typescript
  export const ADMIN_CONTEXT = new InjectionToken<AdminContext>('ADMIN_CONTEXT')
  ```

- **DO NOT register provider in `modules-app.ts` yet** (keeps plugin active)
- **DO NOT update resolvers yet** (continue using `context.adminContext`)
- **DO NOT remove `adminContextPlugin` from `index.ts`** (plugin stays active until Phase 4)
- Add tests (isolated provider tests **without** AUTH_CONTEXT):
  - AdminContext loads correctly (with mock DBProvider, not TenantAwareDBClient)
  - Cache works within single request (multiple getAdminContext() calls)
  - Mock verifies DBProvider.query() called
  - updateAdminContext() clears cache and uses DBProvider
  - **No AUTH_CONTEXT tests** (not available until Phase 4)

**Benefits** (when fully activated in Phase 4.8):

- ✅ Request-scoped caching (no cross-tenant leakage risk) - **ACHIEVED NOW**
- ✅ No DataLoader complexity for Operation scope - **ACHIEVED NOW**
- ⏳ Proper DI integration with AUTH_CONTEXT - **Phase 4.8**
- ⏳ Type-safe injection via ADMIN_CONTEXT token - **Phase 4.8**
- ⏳ Automatically uses TenantAwareDBClient (RLS enforced) - **Phase 4.8**

**Validation**:

- AdminContextProvider tests pass (with mock DBProvider)
- **Still uses DBProvider** (TenantAwareDBClient switch happens in Phase 4.8)
- **Existing admin context functionality unchanged**
- **Server starts normally**
- **Current users can access admin features**
- **No AUTH_CONTEXT dependency** (server functional)
- No breaking changes

**Risk**: Very Low (scope change only, keeps DBProvider, server stays functional)

---

### Step 2.8: Cache Isolation Audit

**Goal**: Identify and fix all singleton providers with instance-level caches that could leak data
between tenants

**Tasks**:

- Run audit search:

  ```bash
  # Find all @Injectable decorators with Singleton scope
  rg "@Injectable.*Singleton" packages/server/src/modules -A 5
  
  # Find all getCacheInstance() calls
  rg "getCacheInstance" packages/server/src
  ```

- **Known Providers to Audit** (from spec.md):
  - `packages/server/src/modules/financial-entities/providers/businesses.provider.ts`
  - `packages/server/src/modules/financial-entities/providers/financial-entities.provider.ts`
  - Any provider with `DataLoader` (must be `Scope.Operation`)

- For each provider with cache:
  - **Option A** (Recommended for auth/tenant data): Convert to `Scope.Operation`

    ```typescript
    @Injectable({ scope: Scope.Operation })
    export class SomeProvider {
      private cache = getCacheInstance({ stdTTL: 60 * 5 }) // Request-isolated cache
      // ...
    }
    ```

  - **Option B** (For performance-critical singletons): Add tenant-prefixed cache keys

    ```typescript
    @Injectable({ scope: Scope.Singleton })
    export class SomeProvider {
      private cache = getCacheInstance({ stdTTL: 60 * 5 })

      async getData(id: string, tenantId: string) {
        const cacheKey = `${tenantId}:${id}` // MUST prefix with tenant ID
        // ...
      }
    }
    ```

- Create integration test:

  ```typescript
  // packages/server/src/modules/__tests__/cache-isolation.integration.test.ts
  describe('Cache Isolation', () => {
    it('should not leak data between tenants', async () => {
      // Create two test contexts with different business IDs
      // Query same entity ID from both contexts
      // Verify different data returned (no cache leakage)
    })
  })
  ```

- Document safe patterns in `docs/architecture/provider-cache-patterns.md`

**Validation**:

- All singleton providers with caches use tenant-prefixed keys
- All auth/tenant providers use Operation scope
- Integration tests verify no cross-tenant leakage
- DataLoaders instantiated per request

**Risk**: High (security-critical, requires careful audit)

---

### Step 2.9: REMOVED - Moved to Phase 4

**Note**: Step 2.9 (Global Context Type Updates) has been moved to **Phase 4 (Step 4.9)** because
updating GlobalContext during Phase 2 would break the server. This step requires Auth0 activation
and plugin removal to be complete first.

See Step 4.9 for details.

---

## Phase 2 Complete - System Functional Validation

**Achievement**: All Auth0 infrastructure is built and tested in isolation

**Critical Validation**:

- ✅ **Existing authentication fully functional**: All users can log in and access their data
- ✅ **Server starts successfully**: No breaking changes introduced
- ✅ **All existing tests pass**: No regressions in current functionality
- ✅ **New infrastructure ready but inactive**:
  - `authPluginV2` created but NOT registered (existing auth plugin active)
  - `TenantAwareDBClient` registered but unused (providers still use `DBProvider` or `context.pool`)
  - `AuthContextProvider` created but NOT registered (existing auth context active)
  - `AdminContextProvider` refactored to Operation scope but plugin still active
  - No resolvers/providers use new infrastructure yet

**Production Readiness**: Safe to deploy Phase 2 to production - zero user impact

---

## Phase 3: Row-Level Security (Week 4)

### Step 3.1: RLS Helper Function

**Goal**: Create SQL function to retrieve current business context

**Tasks**:

- Create migration: `2026-01-26-create-rls-helper-function.sql`
- Implement `get_current_business_id()` function:
  ```sql
  CREATE OR REPLACE FUNCTION accounter_schema.get_current_business_id()
  RETURNS UUID LANGUAGE plpgsql STABLE SECURITY DEFINER
  AS $$
  DECLARE v_business_id UUID;
  BEGIN
    v_business_id := current_setting('app.current_business_id', true)::uuid;
    IF v_business_id IS NULL THEN
      RAISE EXCEPTION 'No business context set - authentication required';
    END IF;
    RETURN v_business_id;
  END;
  $$;
  ```
- Add tests:
  - Function returns business_id when set
  - Function raises exception when not set
  - SECURITY DEFINER works correctly

**Validation**:

- Function callable from RLS policies
- Exception raised when context missing

**Risk**: Low

---

### Step 3.2: Enable RLS on Core Tables (Pilot)

**Goal**: Enable RLS on one high-value table as pilot

**Tasks**:

- Choose pilot table: `charges` (high-value, clear business ownership)
- Create migration: `2026-01-27-enable-rls-charges.sql`
- Enable RLS: `ALTER TABLE accounter_schema.charges ENABLE ROW LEVEL SECURITY;`
- Create policy:
  ```sql
  CREATE POLICY tenant_isolation ON accounter_schema.charges
    USING (owner_id = accounter_schema.get_current_business_id());
  ```
- **Migrate Providers to TenantAwareDBClient** (direct to final pattern):
  - Update `charges.provider.ts` constructor injection:

    ```typescript
    // BEFORE:
    constructor(private dbProvider: DBProvider) {}

    // AFTER:
    constructor(private db: TenantAwareDBClient) {}
    ```

  - Replace all `this.dbProvider` references with `this.db`
  - No TEMPORARY workaround code needed (TenantAwareDBClient has built-in fallback)
  - No future cleanup needed in this provider (complete migration)

- Add integration tests:
  - User from business A cannot see charges from business B
  - Queries without SET LOCAL fail
  - TenantAwareDBClient queries succeed

**Validation**:

- RLS policy enforced
- Cross-tenant queries blocked
- Performance acceptable (< 10% overhead)
- Provider uses final pattern (no workaround code)

**Risk**: High (first RLS table, potential for access issues)

**Rollback Plan**: Disable RLS on charges if production issues occur

---

### Step 3.3: Add owner_id Columns (Phase 1 - Nullable)

**Goal**: Add owner_id to tenant tables that don't already have it (nullable initially)

**Context**: Many tables (charges, financial_entities, ledger_records, dividends,
business_tax_category_match) already have owner_id. Tables with existing business_id columns use
them for different purposes (counterparty references, etc.), so we add a separate owner_id column
for RLS.

**Tasks**:

- Create migration: `2026-02-13T10-00-00.add-owner-id-nullable.ts`
- Add `owner_id UUID` ONLY to tables that don't already have it (see spec section 3.2.2)
- Skip tables that already have owner_id: charges, financial_entities, ledger_records, dividends,
  business_tax_category_match, dynamic_report_templates, user_context
- Use pattern: `ALTER TABLE accounter_schema.{table_name} ADD COLUMN IF NOT EXISTS owner_id UUID;`
- Add tests: Verify columns added successfully, verify existing owner_id columns unchanged

**Validation**:

- All tenant tables have owner_id column (either pre-existing or newly added)
- Existing owner_id columns unchanged
- All new columns are nullable
- Minimal downtime (< 1 second per table)

**Risk**: Low (nullable columns don't break existing queries)

---

### Step 3.4: Backfill owner_id Values

**Goal**: Populate owner_id columns using deterministic backfill rules (background job, no downtime)

**Tasks**:

- Create background job script: `scripts/backfill-owner-id.ts`
- Implement batch backfill (10,000 rows at a time) with table-specific logic:
  - Tables with existing owner_id: Skip (already populated)
  - `documents.owner_id = charges.owner_id` (via charge_id FK)
  - `transactions.owner_id = charges.owner_id` (via charge_id FK)
  - `salaries.owner_id = businesses.id WHERE businesses.id = salaries.employer` (via employer FK)
  - `business_trips.owner_id = ` (derive from attendees or transactions)
  - `financial_accounts`: Rename `owner` to `owner_id` OR `owner_id = owner` (column already exists
    with different name)
  - etc. (see spec section 3.2.2 for complete backfill logic per table)
- Add 1-second sleep between batches to avoid blocking
- Add progress logging per table
- Add validation:
  `SELECT table_name, COUNT(*) FROM information_schema.columns c JOIN tables t WHERE c.column_name = 'owner_id' AND t.owner_id IS NULL GROUP BY table_name`
- Add tests: Verify backfill logic per table, verify foreign key traversal

**Validation**:

- 100% backfill completion across all tables
- No NULL owner_id values remain (except tables where NULL is valid, like
  financial_entities.owner_id for system entities)
- No downtime during backfill
- Existing owner_id values unchanged

**Risk**: Medium (long-running job, complex FK traversal, must be monitored)

---

### Step 3.5: Make owner_id NOT NULL (Phase 3)

**Goal**: Enforce owner_id NOT NULL constraint after successful backfill

**Tasks**:

- Verify backfill completion:
  `SELECT table_name, COUNT(*) as null_count FROM <tables> WHERE owner_id IS NULL` (must return 0
  for all business tables)
- Create migration: `2026-02-14T10-00-00.owner-id-not-null.ts`
- Add NOT NULL constraints to tables where all rows should have owners:
  ```sql
  ALTER TABLE accounter_schema.charges ALTER COLUMN business_id SET NOT NULL;
  ```
- Skip tables where owner_id should remain NULLABLE (e.g., financial_entities.owner_id for
  system-level entities)
- Run on appropriate tables (acquires brief ACCESS EXCLUSIVE lock per table)
- Add tests: Verify constraints added, verify no NULL values exist

**Validation**:

- NOT NULL constraints successfully added to all appropriate tables (documents, transactions,
  salaries, etc.)
- Inserts without owner_id rejected on tables with NOT NULL constraint
- Tables with nullable owner_id (by design) remain nullable (e.g., financial_entities)
- Total downtime < 10 seconds per table

**Risk**: Medium (requires ACCESS EXCLUSIVE lock, brief downtime)

**Timing**: Run during low-traffic window (3-5am)

---

### Step 3.6: Add Indexes and Foreign Keys (Phase 4)

**Goal**: Optimize RLS queries and enforce referential integrity on owner_id

**Tasks**:

- Create migration: `2026-02-15T10-00-00.add-owner-id-indexes.ts`
- Create indexes CONCURRENTLY (non-blocking) for RLS performance:
  ```sql
  -- Skip tables that already have owner_id indexes
  CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_documents_owner_id ON accounter_schema.documents(owner_id);
  CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_owner_id ON accounter_schema.transactions(owner_id);
  CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_salaries_owner_id ON accounter_schema.salaries(owner_id);
  -- ... etc (see spec for full list)
  ```
- Add foreign keys with NOT VALID (non-blocking) to enforce referential integrity:
  ```sql
  ALTER TABLE accounter_schema.documents ADD CONSTRAINT fk_documents_owner_id
    FOREIGN KEY (owner_id) REFERENCES accounter_schema.businesses(id) NOT VALID;
  ALTER TABLE accounter_schema.transactions ADD CONSTRAINT fk_transactions_owner_id
    FOREIGN KEY (owner_id) REFERENCES accounter_schema.businesses(id) NOT VALID;
  ```
- Validate foreign keys in separate transaction (can take time):
  ```sql
  ALTER TABLE accounter_schema.documents VALIDATE CONSTRAINT fk_documents_owner_id;
  ALTER TABLE accounter_schema.transactions VALIDATE CONSTRAINT fk_transactions_owner_id;
  ```
- Add tests: Verify indexes used in RLS query plans, verify FK constraints enforced

**Validation**:

- All owner_id indexes created successfully
- FK constraints enforced (invalid owner_id values rejected)
- No production downtime during concurrent index creation
- Query performance improved (RLS checks use indexes)

**Risk**: Low (concurrent operations don't block, FK validation may take time but doesn't block
writes)

---

### Step 3.7: Roll Out RLS to All Tables

**Goal**: Enable RLS on all tenant tables using owner_id column

**Context**: charges table already has RLS enabled (Step 3.2). Now roll out to all remaining tenant
tables.

**Tasks**:

- Create migration: `2026-02-16T10-00-00.enable-rls-all-tables.ts`
- Enable RLS on all tenant tables in batches (incremental rollout):
  - **Batch 1** (already done): charges (completed in Step 3.2)
  - **Batch 2**: Core tables (documents, transactions, ledger_records)
  - **Batch 3**: Financial tables (financial_entities, financial_accounts, tax_categories)
  - **Batch 4**: Business trip tables (business_trips, business_trips_transactions, etc.)
  - **Batch 5**: Supporting tables (salaries, employees, tags, etc.)
- Create RLS policies using owner_id:

  ```sql
  -- Pattern for tables with direct owner_id column:
  ALTER TABLE accounter_schema.documents ENABLE ROW LEVEL SECURITY;
  CREATE POLICY tenant_isolation ON accounter_schema.documents
    USING (owner_id = accounter_schema.get_current_business_id());

  ALTER TABLE accounter_schema.transactions ENABLE ROW LEVEL SECURITY;
  CREATE POLICY tenant_isolation ON accounter_schema.transactions
    USING (owner_id = accounter_schema.get_current_business_id());
  ```

- Add comprehensive integration tests per batch:
  - Test tenant isolation on each table
  - Verify JOIN queries work correctly (e.g., documents JOIN charges)
  - Test complex queries with multiple RLS-protected tables
  - Load test to verify performance impact

**Validation**:

- All tenant tables protected by RLS
- No cross-tenant data leaks (integration tests verify isolation)
- Performance within acceptable range (< 20% overhead vs. non-RLS queries)
- Existing application functionality unchanged

**Risk**: High (security activation across all tables, requires extensive testing)

**Rollback Plan**:

```sql
-- Script to disable RLS per table if critical issues found:
ALTER TABLE accounter_schema.documents DISABLE ROW LEVEL SECURITY;
ALTER TABLE accounter_schema.transactions DISABLE ROW LEVEL SECURITY;
-- ... etc
```

---

## Phase 3 Complete - System Functional Validation

**Achievement**: Database security hardened with RLS, ready for Auth0 integration

**Critical Validation**:

- ✅ **Existing authentication fully functional**: Users continue to access data normally
- ✅ **RLS policies active**: Database enforces tenant isolation at engine level
- ✅ **TenantAwareDBClient ready**: Can handle RLS variable setting when activated
- ✅ **Performance acceptable**: RLS overhead < 20% on tenant queries
- ✅ **All existing tests pass**: Application behavior unchanged from user perspective
- ✅ **No Auth0 activation yet**: System still uses existing authentication

**What's Different**:

- All tenant tables now have `business_id` columns (NOT NULL with indexes and FKs)
- RLS policies active on all tables (enforced when `app.current_business_id` is set)
- `get_current_business_id()` function available for policy enforcement
- Existing code unaffected (doesn't set RLS variables yet, so policies are bypassed for superuser
  queries)

**Production Readiness**: Safe to deploy Phase 3 to production - zero user impact, database security
enhanced

**Next Phase**: Auth0 activation (Phase 4) will switch to new authentication and begin using
TenantAwareDBClient

---

## Phase 4: Auth0 Integration & Authentication Migration (Week 5)

**Critical Note**: This phase activates Auth0 authentication. Steps must be executed in order with
careful validation at each stage. Existing authentication remains functional until Step 4.7.

### Step 4.1: Environment Configuration for Auth0

**Goal**: Add Auth0 configuration to server environment

**Tasks**:

- Install `jose` library for JWT verification:
  ```bash
  cd packages/server
  yarn add jose
  ```
- Update `packages/server/src/environment.ts`:

  ```typescript
  // Add Auth0 configuration section
  auth0: {
    domain: process.env.AUTH0_DOMAIN!,
    audience: process.env.AUTH0_AUDIENCE!,
    jwksUri: process.env.AUTH0_JWKS_URI!,

    // Management API (for invitations)
    mgmt: {
      clientId: process.env.AUTH0_MGMT_CLIENT_ID!,
      clientSecret: process.env.AUTH0_MGMT_CLIENT_SECRET!,
      audience: process.env.AUTH0_MGMT_AUDIENCE!,
    },
  },
  ```

- Update `packages/server/.env`:

  ```bash
  # Auth0 JWT Verification
  AUTH0_DOMAIN=accounter.auth0.com
  AUTH0_AUDIENCE=https://api.accounter.com
  AUTH0_JWKS_URI=https://accounter.auth0.com/.well-known/jwks.json

  # Auth0 Management API (M2M)
  AUTH0_MGMT_CLIENT_ID=<your_m2m_client_id>
  AUTH0_MGMT_CLIENT_SECRET=<your_m2m_client_secret>
  AUTH0_MGMT_AUDIENCE=https://accounter.auth0.com/api/v2/

  # Legacy (keep for backward compatibility during migration)
  JWT_ACCESS_SECRET=<existing_secret>
  ```

- Add tests:
  - Environment variables loaded correctly
  - Missing Auth0 config throws error on server start

**Validation**:

- Environment types compile
- Auth0 config accessible in env object
- Server starts without errors

**Risk**: Low (configuration only)

---

### Step 4.2: Auth0 Tenant Configuration

**Goal**: Set up Auth0 tenant for the application

**Tasks**:

- Create Auth0 tenant (or use existing)
- Create Auth0 Application (Regular Web Application type)
- Configure application settings:
  - Allowed Callback URLs: `http://localhost:5173/callback`, `https://app.example.com/callback`
  - Allowed Logout URLs: `http://localhost:5173`, `https://app.example.com`
  - Allowed Web Origins: `http://localhost:5173`, `https://app.example.com`
- Enable Username-Password-Authentication connection
- Configure JWT settings:
  - Algorithm: RS256
  - Access Token lifetime: 15 minutes
  - Refresh Token rotation: Enabled
  - Refresh Token expiration: 7 days (absolute)
- Create Auth0 Machine-to-Machine Application for Management API
  - Grant scopes: `create:users`, `update:users`, `delete:users`, `read:users`
- Document configuration in `docs/user-authentication-plan/auth0-setup.md`:
  - Domain
  - Client ID (application)
  - Client Secret (M2M application)
  - Audience (API identifier)

**Validation**:

- Auth0 tenant accessible
- Universal Login page works
- M2M credentials can access Management API
- Configuration documented

**Risk**: Low (Auth0 UI configuration)

---

### Step 4.3: Auth0 Management API Service

**Goal**: Create service to interact with Auth0 Management API

**Tasks**:

- Create `packages/server/src/modules/auth/services/auth0-management.service.ts`
- Implement service methods:
  - `getAccessToken()`: Use client credentials flow to obtain M2M access token (cache for 24 hours)
  - `createUser(email, password)`: Pre-register user with blocked status
  - `unblockUser(auth0UserId)`: Unblock user after invitation acceptance
  - `deleteUser(auth0UserId)`: Cleanup expired invitations
- Implement rate limit handling:
  - Detect 429 responses
  - Exponential backoff (1s, 2s, 4s, max 10s)
  - Return user-friendly error with retry-after time
- Add tests:
  - M2M token obtained successfully (integration test with real Auth0 test tenant)
  - User creation works
  - User unblocking works
  - User deletion works
  - Rate limit detection works (mock HTTP responses)

**Validation**:

- Auth0 Management API integration works
- Rate limiting handled gracefully
- Errors propagated with clear messages
- **Existing auth system still functional**

**Risk**: Low (new service, doesn't affect existing auth)

---

### Step 4.4: Parallel Authentication Testing

**Goal**: Test Auth0 authentication in parallel with existing auth (feature flag controlled)

**Tasks**:

- Update `packages/server/src/modules-app.ts`:
  - Add conditional provider registration based on `USE_AUTH0` flag:

    ```typescript
    const providers = [
      DBProvider,
      TenantAwareDBClient
      // ... existing providers
    ]

    if (env.USE_AUTH0) {
      providers.push(AuthContextV2Provider, {
        provide: AUTH_CONTEXT_V2,
        useFactory: (provider: AuthContextV2Provider) => provider.getAuthContext(),
        deps: [AuthContextV2Provider]
      })
    }
    ```

- Create test endpoint: `query testAuth0 { auth0Status { configured, working, testUser } }`
  - Only accessible when `USE_AUTH0=true`
  - Verifies Auth0 JWT verification works
  - Does NOT affect existing auth
- Add integration tests:
  - Start server with `USE_AUTH0=true`
  - Obtain test JWT from Auth0
  - Call testAuth0 query
  - Verify Auth0 authentication works
  - Start server with `USE_AUTH0=false`
  - Verify existing auth still works

**Validation**:

- Auth0 authentication works when enabled
- Existing auth works when Auth0 disabled
- Can toggle between auth systems via environment variable
- No conflicts between auth systems

**Risk**: Low (parallel systems, feature flag controlled)

---

### Step 4.5: Create Migration Test Users

**Goal**: Create test users in Auth0 and map to existing business users for migration validation

**Tasks**:

- For 2-3 existing test/staging users:
  - Create Auth0 user via Management API
  - Update `business_users.auth0_user_id` to link local user to Auth0 identity
  - Document credentials in secure location
- Create migration validation script:
  ```typescript
  // scripts/validate-auth0-migration.ts
  // 1. Login with old auth → verify works
  // 2. Login with Auth0 JWT → verify works
  // 3. Verify both auths access same business data
  ```
- Test both auth systems work for same users

**Validation**:

- Test users exist in both auth systems
- Both auth methods access same business data
- No data conflicts
- Migration script passes

**Risk**: Low (test users only, staging environment)

---

### Step 4.6: Frontend Auth0 Integration (CRITICAL - Before Backend Switch)

**Goal**: Implement Auth0 login UI BEFORE switching backend, ensuring users always have a login
method

**CRITICAL**: This step MUST be completed before Step 4.7 (backend switch). If backend switches to
Auth0 without frontend support, ALL users will be locked out.

**Tasks**:

**A. Install and Configure Auth0 React SDK**:

- Install dependencies:
  ```bash
  cd packages/client
  yarn add @auth0/auth0-react
  ```
- Update `packages/client/src/main.tsx`:

  ```typescript
  import { Auth0Provider } from '@auth0/auth0-react'

  ReactDOM.createRoot(document.getElementById('root')!).render(
    <Auth0Provider
      domain={import.meta.env.VITE_AUTH0_DOMAIN}
      clientId={import.meta.env.VITE_AUTH0_CLIENT_ID}
      authorizationParams={{
        redirect_uri: window.location.origin + '/callback',
        audience: import.meta.env.VITE_AUTH0_AUDIENCE,
      }}
    >
      <App />
    </Auth0Provider>
  )
  ```

- Add environment variables to `packages/client/.env`:
  ```bash
  VITE_AUTH0_DOMAIN=your-tenant.auth0.com
  VITE_AUTH0_CLIENT_ID=your-client-id
  VITE_AUTH0_AUDIENCE=https://api.accounter.example.com
  VITE_GRAPHQL_URL=http://localhost:4000/graphql
  ```

**B. Create Dual Login UI (Legacy + Auth0)**:

- Update `packages/client/src/pages/login-page.tsx`:

  ```typescript
  import { useAuth0 } from '@auth0/auth0-react'

  export function LoginPage() {
    const { loginWithRedirect } = useAuth0()
    const [useLegacyAuth, setUseLegacyAuth] = useState(true) // Default to legacy for now

    if (useLegacyAuth) {
      return (
        <div>
          <LegacyLoginForm /> {/* Existing email/password form */}
          <button onClick={() => setUseLegacyAuth(false)}>
            Switch to Auth0 Login
          </button>
        </div>
      )
    }

    return (
      <div>
        <h1>Log In with Auth0</h1>
        <button onClick={() => loginWithRedirect()}>
          Log In
        </button>
        <button onClick={() => setUseLegacyAuth(true)}>
          Use Legacy Login (temporary)
        </button>
      </div>
    )
  }
  ```

**C. Callback Handler**:

- Create `packages/client/src/pages/callback-page.tsx`:

  ```typescript
  import { useAuth0 } from '@auth0/auth0-react'
  import { useEffect } from 'react'
  import { useNavigate } from 'react-router-dom'

  export function CallbackPage() {
    const { isAuthenticated, isLoading, error } = useAuth0()
    const navigate = useNavigate()

    useEffect(() => {
      if (isAuthenticated) navigate('/dashboard')
      if (error) navigate('/login?error=' + error.message)
    }, [isAuthenticated, error])

    if (isLoading) return <div>Processing login...</div>
    return null
  }
  ```

- Add route: `<Route path="/callback" element={<CallbackPage />} />`

**D. Update Urql Client for Dual Auth**:

- Update `packages/client/src/lib/urql-client.ts`:

  ```typescript
  import { useAuth0 } from '@auth0/auth0-react'

  export function useUrqlClient() {
    const { getAccessTokenSilently, isAuthenticated } = useAuth0()

    return useMemo(
      () =>
        createClient({
          url: import.meta.env.VITE_GRAPHQL_URL,
          exchanges: [
            dedupExchange,
            cacheExchange,
            authExchange({
              getAuth: async () => {
                // Try Auth0 first (if authenticated via Auth0)
                if (isAuthenticated) {
                  try {
                    const token = await getAccessTokenSilently()
                    return { token, type: 'auth0' }
                  } catch (err) {
                    console.warn('Auth0 token fetch failed:', err)
                  }
                }

                // Fallback to legacy token (from localStorage or cookie)
                const legacyToken = localStorage.getItem('auth_token')
                if (legacyToken) {
                  return { token: legacyToken, type: 'legacy' }
                }

                return null
              },
              addAuthToOperation: ({ authState, operation }) => {
                if (!authState?.token) return operation

                return makeOperation(operation.kind, operation, {
                  ...operation.context,
                  fetchOptions: {
                    ...operation.context.fetchOptions,
                    headers: {
                      ...operation.context.fetchOptions?.headers,
                      Authorization: `Bearer ${authState.token}`
                    }
                  }
                })
              }
            }),
            fetchExchange
          ]
        }),
      [isAuthenticated, getAccessTokenSilently]
    )
  }
  ```

**Validation**:

- **Both login methods work**:
  - Legacy login (email/password) → old auth token → backend accepts
  - Auth0 login (Universal Login) → Auth0 JWT → backend accepts (via `USE_AUTH0=true`)
- Users can switch between login methods
- Callback page redirects correctly
- GraphQL client sends correct token type
- **Existing users can still log in via legacy method**
- **New users can test Auth0 login**

**Testing Checklist**:

- [ ] Legacy login still works (default)
- [ ] Auth0 login works (when selected)
- [ ] Callback page handles success/error
- [ ] GraphQL requests include correct auth header
- [ ] User can switch between auth methods
- [ ] No errors in browser console

**Risk**: Medium (frontend changes, but both auth methods remain functional)

**Note**: This creates a **dual-auth UI** that supports both legacy and Auth0 authentication. Step
4.7 will switch the backend to require Auth0, but users will already have the Auth0 login UI
available.

---

### Step 4.7: Activate Auth0 Authentication (The Switch)

**Goal**: Switch production backend from old auth to Auth0 auth (frontend Auth0 UI already deployed)

**Critical Prerequisites**:

- [ ] Auth0 tenant fully configured (Step 4.2)
- [ ] Auth0 Management API working (Step 4.3)
- [ ] Parallel testing successful (Step 4.4)
- [ ] Test users migrated successfully (Step 4.5)
- [ ] **Frontend Auth0 UI deployed and tested (Step 4.6)** ← CRITICAL
- [ ] All Phase 1-3 tests passing
- [ ] Staging deployment successful with Auth0 enabled
- [ ] Rollback plan documented and tested

**CRITICAL USER IMPACT**: After this step, users MUST log in via Auth0. Ensure Step 4.6 is fully
deployed first.

**Tasks**:

- **Verify frontend Auth0 UI is live in production**:
  - Test Auth0 login flow works on production frontend
  - Verify callback page accessible
  - Confirm users can see "Log in with Auth0" option
- Update `packages/server/src/index.ts`:
  - Replace old `authPlugin()` with `authPluginV2()` in plugins array:
    ```typescript
    plugins: [
      authPluginV2(), // NEW: Extracts Auth0 JWT (legacy auth removed)
      useGraphQLModules(schema),
      useDeferStream(),
      useHive(hiveConfig),
    ],
    ```
- Update `packages/server/src/modules-app.ts`:
  - Remove conditional AUTH_CONTEXT_V2 registration
  - Register as AUTH_CONTEXT (replace old auth context):
    ```typescript
    {
      provide: AUTH_CONTEXT,
      useFactory: (provider: AuthContextV2Provider) => provider.getAuthContext(),
      deps: [AuthContextV2Provider],
    }
    ```
- Update TenantAwareDBClient:
  - Inject AUTH_CONTEXT (now using Auth0 verification)
- **Coordinated Deployment**:
  - Deploy backend with Auth0-only authentication
  - **Frontend already has Auth0 UI** (from Step 4.6)
  - Users immediately see "Log in with Auth0" and can authenticate
  - Monitor error rates closely

- Deploy to staging:
  - Validate all existing functionality works with Auth0
  - Test user login via Auth0 Universal Login
  - Test API key authentication still works
  - Run full integration test suite
- Deploy to production:
  - Schedule maintenance window (15 minutes)
  - Deploy backend with `USE_AUTH0=true`
  - **Update frontend to default to Auth0 login** (make Auth0 the default, remove legacy option)
  - Monitor error rates
  - Verify user logins work
  - **Rollback immediately** if error rate > 1%

**Rollback Plan**:

```bash
# If issues occur within first hour:
1. Revert backend to old authPlugin (previous deployment)
2. Revert frontend to show legacy login as default
3. Verify old auth working
4. Investigate Auth0 issues
5. Fix and redeploy
```

**Validation**:

- Auth0 authentication active in production
- User logins work via Auth0 Universal Login
- Frontend shows Auth0 login UI by default
- API key authentication unaffected
- Error rates normal
- All integration tests pass
- **Zero downtime**: Users had Auth0 UI before backend switched

**Risk**: Medium (production auth migration, but frontend already prepared)

**Monitoring** (first 24 hours):

- Login success/failure rates
- JWT verification errors
- Auth0 API response times
- User complaints

**Communication**:

- Email users 48 hours before: "We're upgrading to a more secure login system"
- Provide Auth0 login instructions
- Support team ready for login issues

---

### Step 4.8: Pilot Provider Migration (Activate TenantAwareDBClient)

**Goal**: Migrate one pilot provider to inject TenantAwareDBClient with RLS enforcement (NOW that
Auth0 is active)

**Prerequisites**:

- Auth0 authentication active (Step 4.7 completed)
- TenantAwareDBClient registered as provider (Step 2.6 completed) - AuthContext now properly
  populated with Auth0 user data
- RLS enabled on target tables (Phase 3 completed)

**Tasks**:

**1. Create ESLint Rule** (`eslint.config.mjs`):

- Add `no-restricted-imports` rule to prevent direct `DBProvider` imports in provider/service files
- Pattern: `**/providers/**` and `**/services/**` cannot import `DBProvider`
- Exempt: `**/migrations/**`, `**/scripts/**`, and test files can import `DBProvider`
- Custom error message: "Use TenantAwareDBClient injection instead of DBProvider for RLS
  enforcement"

**2. Pilot Provider Migration** (Update one provider: `BusinessesProvider`):

- File: `packages/server/src/modules/financial-entities/providers/businesses.provider.ts`
- Change constructor injection:

  ```typescript
  // BEFORE:
  constructor(private dbProvider: DBProvider) {}

  // AFTER:
  constructor(private db: TenantAwareDBClient) {}
  ```

- Update all database queries to use `this.db` instead of `this.dbProvider`
- Remove explicit WHERE business_id clauses (RLS handles tenant filtering automatically)
- Verify TypeScript compilation succeeds
- Add integration tests:
  - Verify queries execute successfully through TenantAwareDBClient
  - Verify RLS variables are set (monitor `pg_stat_activity` during test)
  - Verify tenant isolation (provider with business A context cannot see business B data)
  - Verify transaction reuse (single connection per provider operation)

**3. Remove TEMPORARY Fallback from TenantAwareDBClient** (Phase 3.2 → 4.8 cleanup):

Now that Auth0 is active and AuthContext is properly populated, remove TEMPORARY fallback code:

- File: `packages/server/src/modules/app-providers/tenant-db-client.ts`
- **Remove CONTEXT injection** from constructor:
  - Delete `@Inject(CONTEXT) private context: AccounterContext,` parameter
  - Keep only `@Inject(AUTH_CONTEXT) private authContext: AuthContext`
- **Remove 3 fallback checks** from constructor and methods:
  - Update auth verification: `if (!this.authContext)` (remove
    `&& !this.context.currentUser?.userId`)
  - Simplify error message: "Auth context not available"
- **Remove businessId fallback** from `setRLSVariables()`:
  - Change: `tenant?.businessId ?? this.context.currentUser?.userId ?? null`
  - To: `tenant?.businessId ?? null`
- **NO provider changes needed** (providers already use final pattern)
- Verification:

  ```bash
  rg "@Inject\(CONTEXT\).*private context.*AccounterContext" packages/server/src/modules/app-providers/tenant-db-client.ts
  # Should return NO matches
  
  rg "Phase 3\.2|Phase 4\.8|TEMPORARY.*fallback" packages/server/src/modules/app-providers/tenant-db-client.ts
  # Should return NO matches
  
  rg "context\.currentUser\.userId" packages/server/src/modules/app-providers/tenant-db-client.ts
  # Should return NO matches
  ```

**4. Validation Testing**:

- Run full test suite for businesses provider
- Deploy to staging and verify functionality via GraphQL queries
- Monitor RLS enforcement in database logs
- Verify no cross-tenant data leaks
- Verify all TEMPORARY fallback code removed (TenantAwareDBClient only)

**Validation**:

- BusinessesProvider injects TenantAwareDBClient exclusively
- ESLint prevents new `DBProvider` imports in providers
- All tests pass
- RLS enforced on all queries
- No performance degradation (< 10% overhead)
- TEMPORARY fallback code removed from TenantAwareDBClient (Phase 3.2 cleanup complete)

**Risk**: Medium (first operational use of TenantAwareDBClient with Auth0 + removing fallback code)

**Rollback Plan**: Revert TenantAwareDBClient to include TEMPORARY fallback if Auth0 issues occur

---

### Step 4.9: AdminContext Switch (Plugin → Provider)

**Goal**: Complete AdminContext migration - update provider code and activate (Phase 2 of two-phase
migration)

**Prerequisites**:

- Auth0 authentication active and stable (Step 4.7 complete)
- AUTH_CONTEXT reliably populated
- BusinessesProvider successfully migrated (Step 4.8 complete)
- AdminContextProvider refactored in Phase 2.7 (Operation scope, uses DBProvider)

**CRITICAL**: This completes the two-phase AdminContext migration:

- **Phase 2.7** (Step 2.7): Refactored to Operation scope, kept DBProvider, plugin stayed active
- **Phase 4.8** (this step): Switch to TenantAwareDBClient, register provider, remove plugin

**Tasks**:

**1. Update AdminContextProvider Code**
(`packages/server/src/modules/admin-context/providers/admin-context.provider.ts`):

- Change constructor to inject AUTH_CONTEXT and TenantAwareDBClient:

  ```typescript
  // BEFORE (Phase 2.7 - Preparatory):
  import { DBProvider } from '../../app-providers/db.provider.js'

  @Injectable({ scope: Scope.Operation })
  export class AdminContextProvider {
    constructor(private dbProvider: DBProvider) {}

    async getAdminContext(): Promise<AdminContext> {
      // Uses DBProvider, gets businessId from plugin context
      const contexts = await getAdminContexts.run(
        {
          ownerIds: [
            /* from plugin */
          ]
        },
        this.dbProvider
      )
      return contexts[0]
    }
  }

  // AFTER (Phase 4.8 - Activation):
  import { Injectable, Scope, Inject } from 'graphql-modules'
  import { AUTH_CONTEXT } from '../../../shared/tokens.js'
  import { TenantAwareDBClient } from '../../app-providers/tenant-db-client.js'
  import type { AuthContext } from '../../../shared/types/auth.js'

  @Injectable({ scope: Scope.Operation })
  export class AdminContextProvider {
    private cachedContext: AdminContext | null = null

    constructor(
      @Inject(AUTH_CONTEXT) private auth: AuthContext | null,
      private db: TenantAwareDBClient // Switch to TenantAwareDBClient
    ) {}

    async getAdminContext(): Promise<AdminContext> {
      if (!this.cachedContext) {
        if (!this.auth?.tenant?.businessId) {
          throw new GraphQLError('Unauthenticated', {
            extensions: { code: 'UNAUTHENTICATED' }
          })
        }

        // Use TenantAwareDBClient - RLS enforced automatically
        const [rawContext] = await getAdminBusinessContext.run(
          { adminBusinessId: this.auth.tenant.businessId },
          this.db // TenantAwareDBClient enforces RLS
        )

        if (!rawContext) {
          throw new Error('Admin business context not found')
        }

        this.cachedContext = normalizeContext(rawContext)
      }
      return this.cachedContext
    }
  }
  ```

**2. Register Provider** in `packages/server/src/modules-app.ts`:

```typescript
providers: [
  DBProvider,
  TenantAwareDBClient,
  AdminContextProvider, // NEW
  {
    provide: ADMIN_CONTEXT,
    useFactory: async (provider: AdminContextProvider) => provider.getAdminContext(),
    deps: [AdminContextProvider],
    scope: Scope.Operation
  }
]
```

**3. Update Resolvers/Providers**:

- Find usages: `rg "context\.adminContext" packages/server/src`
- Replace with constructor injection:
  ```typescript
  @Injectable({ scope: Scope.Operation })
  class SomeProvider {
    constructor(@Inject(ADMIN_CONTEXT) private adminContext: AdminContext | null) {}
  }
  ```

**4. Remove Plugin**:

- Remove `adminContextPlugin` from `packages/server/src/index.ts` plugins array
- Delete `packages/server/src/plugins/admin-context-plugin.ts`

- Add integration tests:
  - Admin context loads via provider injection
  - Cache isolated between concurrent requests
  - RLS enforced on admin context queries
  - All admin features work correctly

**Validation**:

- Server starts successfully
- Admin context loads for authenticated requests
- Unauthenticated requests get null admin context (no errors)
- RLS enforced on business owner and financial entities queries
- Cache works within request, isolated between requests
- All business logic tests pass

**Deployment**:

1. Deploy during low-traffic window
2. Monitor logs for "adminContext" errors
3. Watch for RLS violations
4. Verify admin features work
5. Check response times

**Rollback Plan**:

If issues detected:

1. Re-add adminContextPlugin to index.ts
2. Revert resolver constructor changes
3. Redeploy previous version

**Risk**: Low (provider tested in Step 2.7, only activation changes)

---

### Step 4.10: Global Context Type Cleanup

**Goal**: Remove legacy context properties now that Auth0 migration is complete

**Prerequisites**:

- Auth0 authentication active (Step 4.7)
- All plugins removed (Steps 4.7, 4.9)
- All providers migrated to DI injection (Steps 4.8, 4.9)

**CRITICAL**: This step was originally Step 2.9 but was moved to Phase 4 because removing legacy
context properties before Auth0 activation would break the server. This is the FINAL cleanup step.

**Tasks**:

- Update `packages/server/src/modules-app.ts` global context declaration:

  ```typescript
  export interface GlobalContext {
    request: Request
    rawAuth: RawAuth // From authPluginV2 (HTTP-level)
    // Note: Do NOT add authContext or adminContext here
    // These are accessed via injection tokens (AUTH_CONTEXT, ADMIN_CONTEXT)
  }
  ```

- Update `packages/server/src/shared/types/index.ts`:

  ```typescript
  import type { RawAuth } from '@plugins/auth-plugin-v2'

  export interface GraphQLContext {
    request: Request
    rawAuth: RawAuth
  }

  // Auth context accessed via injection tokens, not context object
  ```

- **Verify no legacy context access patterns remain**:

  ```bash
  # Find all references to old context properties
  rg "context\.currentUser" packages/server/src
  rg "context\.adminContext" packages/server/src
  rg "context\.authContext" packages/server/src
  ```

  **Expected result**: No matches (all should have been migrated in Steps 4.7-4.8)

- Add tests:
  - GlobalContext types compile correctly
  - rawAuth accessible from context
  - Auth context NOT in context (accessed via injection tokens)
  - All resolvers compile with new types
  - **All existing integration tests still pass**

**Validation**:

- TypeScript compilation succeeds
- **No references to legacy context properties** (verified with rg searches)
- All auth access via injection tokens
- Context types accurate and minimal
- **All integration tests pass**

**Benefits**:

- ✅ Clear separation: HTTP context (rawAuth) vs business context (AUTH_CONTEXT)
- ✅ Type-safe injection across modules
- ✅ Consistent architecture (DI-first, not context-passing)
- ✅ Prevents accidental context property access (TypeScript errors)

**Risk**: **LOW** - Just type cleanup, all code already migrated in Steps 4.7-4.8

---

## Phase 4 Complete - Auth0 Migration Successful

**Achievement**: Auth0 authentication fully active, all infrastructure switched

**Critical Validation**:

- ✅ **Auth0 authentication live**: Users log in via Auth0 Universal Login
- ✅ **TenantAwareDBClient active**: All providers use RLS-enforced database client
- ✅ **AdminContext via DI**: Provider-based admin context with proper caching
- ✅ **Legacy auth removed**: Old auth plugin and context removed from server
- ✅ **All tests passing**: Integration tests verify Auth0 flow end-to-end
- ✅ **Production stable**: Error rates normal, users able to access their data
- ✅ **RLS enforced**: Database policies active for all tenant queries

**What Changed**:

- Users now authenticate via Auth0 (email/password managed externally)
- **Frontend has Auth0 login UI** (Universal Login integration complete)
- JWTs verified using Auth0 JWKS endpoint
- All GraphQL operations use AUTH_CONTEXT from Auth0 JWT
- TenantAwareDBClient sets RLS variables for every query
- AdminContext loaded via DI provider (Operation-scoped)
- Global context simplified (only `rawAuth`, business context via injection tokens)
- **Zero downtime migration**: Users had Auth0 UI before backend switched

**Production Status**: System fully migrated to Auth0, monitoring for 7 days before cleanup

**Next Phase**: Cleanup deprecated code after stability period

---

## Phase 5: Post-Migration Cleanup (Week 6)

### Step 5.1: Remove Old Authentication Code

**Goal**: Clean up deprecated authentication code after successful Auth0 migration

**Prerequisites**:

- [ ] Auth0 authentication stable in production for 7+ days (Step 4.7)
- [ ] No auth-related incidents
- [ ] All users successfully migrated or invited to Auth0
- [ ] Monitoring shows 100% Auth0 JWT usage (no old auth attempts)

**Tasks**:

- Delete old authentication files:
  - `packages/server/src/plugins/auth-plugin.ts` (old version)
  - `packages/server/src/modules/auth/providers/auth-context.provider.ts` (old version)
  - `packages/server/src/modules/admin-context/providers/admin-context.provider.backup.ts` (backup
    from Step 2.7)
  - Any other old auth-related files
- Rename new files to standard names:
  - `auth-plugin-v2.ts` → `auth-plugin.ts`
  - `auth-context-v2.provider.ts` → `auth-context.provider.ts`
  - `AUTH_CONTEXT_V2` token → `AUTH_CONTEXT`
- Remove `USE_AUTH0` feature flag:
  - Remove from environment configuration
  - Remove conditional logic in modules-app.ts
  - Update documentation
- Remove temporary test infrastructure:
  - Delete `testAuth0` query endpoint created in Step 4.4
  - Remove `scripts/validate-auth0-migration.ts` script (migration validation no longer needed)
  - Delete migration test users from Auth0 (created in Step 4.5) via Management API
  - Clean up test user credentials from secure storage
- Remove old auth-related database tables (if any were self-hosted):
  - **Note**: In this Auth0 design, there are no self-hosted auth tables to remove
- Update all documentation references
- Remove old auth tests
- **Audit legacy database table usage**:
  - Verify `legacy_business_users` table is no longer referenced in application code
  - Check for remaining foreign key dependencies
  - If fully unused: Create migration to drop `legacy_business_users` table
  - If still referenced: Document remaining dependencies and create follow-up task
  - Search codebase: `rg "legacy_business_users" packages/server/src`

**Validation**:

- Server starts without errors
- No references to old auth code remain
- All tests pass
- TypeScript compilation succeeds
- Clean git history (no dead code)
- `legacy_business_users` table either dropped or documented with clear retention reasoning

**Risk**: Low (Auth0 proven stable at this point)

---

## Phase 6: Role-Based Authorization (Week 6)

**Note**: Permissions infrastructure (tables, PermissionResolutionService) is out of scope for this
phase. Authorization checks use role-based logic only (e.g.,
`if (authContext.roleId === 'business_owner')`). Permission-based authorization is a future
enhancement.

### Step 6.1: GraphQL Directives (Simple Checks)

**Goal**: Implement minimal directive-based authorization

**Tasks**:

- Create `packages/server/src/modules/auth/directives/requires-auth.directive.ts`
- Implement `@requiresAuth` directive:
  - Check if `context.auth.user` exists
  - If not: throw UNAUTHENTICATED error
- Implement `@requiresRole(role: String!)` directive:
  - Check if `context.auth.user.roleId === role`
  - If not: throw FORBIDDEN error with message "Requires role: {role}"
- Add tests:
  - Each directive enforces correctly
  - Error codes correct (UNAUTHENTICATED, FORBIDDEN)
  - Directives compose correctly

**Validation**:

- Directives work as schema guards
- Error messages clear
- No permission resolution needed (role checks only)

**Risk**: Low

---

### Step 6.2: Authorization Service Pattern

**Goal**: Create service-layer authorization for complex checks

**Tasks**:

- Create `packages/server/src/modules/auth/services/authorization.service.ts`
- Implement base class:

  ```typescript
  @Injectable({ scope: Scope.Operation })
  export class AuthorizationService {
    constructor(
      protected authContext: AuthContext,
      protected db: TenantAwareDBClient
    ) {}

    protected requireAuth(): AuthUser {
      if (!this.authContext.user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' }
        })
      }
      return this.authContext.user
    }

    protected requireRole(allowedRoles: string[]): void {
      const user = this.requireAuth()
      if (!allowedRoles.includes(user.roleId)) {
        throw new GraphQLError(`Requires one of roles: ${allowedRoles.join(', ')}`, {
          extensions: { code: 'FORBIDDEN' }
        })
      }
    }

    protected async requireOwnership(resourceOwnerId: string): Promise<void> {
      const user = this.requireAuth()
      if (user.businessId !== resourceOwnerId) {
        throw new GraphQLError('Access denied: resource ownership mismatch', {
          extensions: { code: 'FORBIDDEN' }
        })
      }
    }
  }
  ```

- Add tests:
  - `requireAuth` throws when user null
  - `requireRole` throws when role not in allowed list
  - `requireOwnership` throws when business mismatch
  - Can be extended by domain services

**Validation**:

- Reusable authorization patterns established
- Role-based checks only (no permission resolution)

**Risk**: Low

---

### Step 6.3: Domain Authorization Service (Example - Charges)

**Goal**: Demonstrate service-layer authorization pattern

**Tasks**:

- Create `packages/server/src/modules/charges/services/charges-auth.service.ts`
- Extend AuthorizationService:

  ```typescript
  export class ChargesAuthService extends AuthorizationService {
    async canUpdateCharge(chargeId: string): Promise<void> {
      this.requireAuth()

      // Only business_owner and accountant can update charges
      this.requireRole(['business_owner', 'accountant'])

      // Check ownership via RLS-protected query
      const charge = await this.db.query('SELECT id FROM accounter_schema.charges WHERE id = $1', [
        chargeId
      ])

      if (!charge.rows.length) {
        throw new GraphQLError('Charge not found or access denied', {
          extensions: { code: 'FORBIDDEN' }
        })
      }
    }

    async canDeleteCharge(chargeId: string): Promise<void> {
      this.requireAuth()

      // Only business_owner can delete charges
      this.requireRole(['business_owner'])

      const charge = await this.db.query('SELECT id FROM accounter_schema.charges WHERE id = $1', [
        chargeId
      ])

      if (!charge.rows.length) {
        throw new GraphQLError('Charge not found or access denied', {
          extensions: { code: 'FORBIDDEN' }
        })
      }
    }
  }
  ```

- Update charge update/delete resolvers to call authorization methods
- Add tests:
  - business_owner can update and delete
  - accountant can update but not delete
  - employee cannot update or delete
  - RLS enforced (queries only return business-owned charges)

**Validation**:

- Pattern demonstrated clearly
- RLS + service layer work together
- Role-based authorization functional

**Risk**: Low

---

### Step 6.4: Wire Authorization into Resolvers

**Goal**: Add authorization checks to all mutations

**Tasks**:

- Audit all mutations in codebase
- Add `@requiresAuth` to protected queries/mutations
- Add role-based checks to critical mutations:
  - Document issuance: requires `business_owner` or `accountant`
  - User management (invitations): requires `business_owner`
  - Salary operations: requires `business_owner`
  - Transaction insertion: requires `scraper` (API key) or `business_owner`/`accountant` (user)
- Add service-layer checks for:
  - Resource ownership (update/delete operations) - rely on RLS
  - Complex role logic (e.g., accountant can view but not issue certain document types)
- Add integration tests:
  - Each mutation tested with different roles
  - Verify correct access granted/denied
  - Verify error messages clear

**Validation**:

- All mutations protected appropriately
- Authorization matrix documented and tested
- No permission resolution logic (future enhancement)

**Risk**: High (requires touching many resolvers, error-prone)

**Note**: Break into sub-steps per module in detailed implementation

---

## Phase 7: Invitation Flow (Auth0 Pre-Registration) (Week 7)

### Step 7.1: Invitation Creation Mutation (with Auth0 Management API)

**Goal**: Allow business owners to invite users with Auth0 pre-registration

**Tasks**:

- Add to schema:
  ```graphql
  type Mutation {
    createInvitation(email: String!, roleId: String!): InvitationPayload! @requiresAuth
  }
  type InvitationPayload {
    invitationUrl: String!
    email: String!
    expiresAt: String!
  }
  ```
- Create resolver `packages/server/src/modules/auth/resolvers/create-invitation.resolver.ts`:
  1. Verify caller has `business_owner` role (role-based check, no permission resolution)
  2. Check if email already exists in `business_users` for this business
  3. Generate cryptographically secure token (64 chars using `crypto.randomBytes`)
  4. Generate local `user_id` UUID
  5. **Call Auth0 Management API** (`auth0ManagementService.createUser(email, metadata)`):
     - Metadata includes `invitation_id`, `business_id`, `invited_by`
     - Auth0 automatically sends password setup email (no custom email service needed)
  6. Insert into `invitations` table:
     - Set `auth0_user_created: true` on success
     - Store `auth0_user_id` returned from Auth0
     - Set `invited_by_user_id` to caller's `user_id`
     - Set `expires_at` to 7 days from now
  7. Insert into `business_users` table:
     - `user_id`: generated UUID
     - `auth0_user_id`: NULL (populated on first login)
     - `business_id`, `role_id` from invitation
  8. Log to `audit_logs` (action: 'INVITATION_CREATED', include `auth0_user_id`)
  9. Return invitation URL: `https://app.example.com/accept-invitation/{token}`
- **Error Handling**:
  - Detect Auth0 rate limit (429) → return user-friendly error with retry-after time
  - Detect Auth0 user already exists → return error "User already exists in Auth0"
  - On any Auth0 error → rollback transaction, delete local invitation record
- Add tests:
  - Business owner can create invitation successfully
  - Auth0 Management API called correctly (integration test with test tenant)
  - Duplicate email for same business rejected
  - Employee cannot create invitation (FORBIDDEN)
  - Auth0 rate limit handled gracefully (mocked)
  - Token generated securely

**Validation**:

- Invitations created with Auth0 user pre-registration
- Auth0 sends password setup email automatically
- Local database tracks invitation state
- Permissions enforced (business_owner only)

**Risk**: Medium (Auth0 API integration, requires transaction management)

---

### Step 7.2: Accept Invitation Mutation (Auth0 Session Required)

**Goal**: Allow invited users to accept invitations and link Auth0 account to business

**Tasks**:

- Add to schema:
  ```graphql
  type Mutation {
    acceptInvitation(token: String!): Boolean! @requiresAuth
  }
  ```
- Create resolver:
  1. **Require authenticated session**: Verify `authContext.user` exists (user must be logged in via
     Auth0)
  2. Query `invitations` by token
  3. Verify token not expired (`expires_at > NOW()`)
  4. Verify token not already used (`accepted_at IS NULL`)
  5. Begin transaction: a. **Check if this is first acceptance** (is `authContext.user.auth0UserId`
     already linked to local user_id?):
     - If not linked yet (first invitation acceptance):
       - Call `auth0ManagementService.unblockUser(invitation.auth0_user_id)`
       - Update `business_users` SET `auth0_user_id = authContext.user.auth0UserId` WHERE
         `user_id = invitation.user_id`
     - If already linked (subsequent business invitation): \* Insert new row into `business_users`
       (user_id from existing link, new business_id/role_id) b. Mark invitation as accepted: SET
       `accepted_at = NOW()` c. Log to `audit_logs` (action: 'INVITATION_ACCEPTED', user_id,
       auth0_user_id, business_id)
  6. Commit transaction
  7. Return true
- **Error Handling**:
  - Token invalid → return error with code 'TOKEN_INVALID'
  - Token expired → return error with code 'TOKEN_EXPIRED'
  - Token already used → return error 'Invitation already accepted'
  - Auth0 unblock fails → rollback transaction, return error
- Add tests:
  - Valid invitation accepted successfully (first time - user unblocked)
  - Second invitation for same user accepted (no Auth0 unblock call)
  - Expired token rejected with TOKEN_EXPIRED code
  - Invalid token rejected with TOKEN_INVALID code
  - Already-accepted token rejected
  - User immediately gains business access (authContext updated on next request)
  - Auth0 user unblocked successfully (integration test)

**Validation**:

- New users can join via invitation after Auth0 password setup
- Auth0 account unblocked on first acceptance
- Multi-business support works (same Auth0 user, multiple business_users rows)
- Atomic transaction succeeds
- **No custom email verification needed** (Auth0 handles this during password setup)

**Risk**: Medium (multi-step transaction, Auth0 API dependency)

---

### Step 7.3: Invitation Cleanup Background Job

**Goal**: Delete expired invitations and associated unused Auth0 accounts

**Tasks**:

- Create background job script: `packages/server/src/jobs/cleanup-expired-invitations.ts`
- Implement cleanup logic:
  1. Query invitations WHERE `accepted_at IS NULL` AND `expires_at < NOW()`
  2. For each expired invitation: a. If `auth0_user_created = true` AND `auth0_user_id` exists:
     - Call `auth0ManagementService.deleteUser(auth0_user_id)`
     - Log any Auth0 API errors but continue (user might already be deleted) b. Delete invitation
       record from database c. Delete orphaned `business_users` row (WHERE
       `user_id = invitation.user_id` AND `auth0_user_id IS NULL`)
  3. Log cleanup results to audit_logs (action: 'INVITATION_CLEANUP', details: count deleted)
- Schedule job to run daily at 2am (use cron or task scheduler)
- Add tests:
  - Expired invitations deleted correctly
  - Auth0 users deleted via Management API (integration test)
  - Orphaned business_users rows cleaned up
  - Job handles Auth0 API errors gracefully

**Validation**:

- Expired invitations don't accumulate
- Unused Auth0 accounts cleaned up (avoid Auth0 user quota issues)
- Background job runs reliably

**Risk**: Low (background job, non-critical path)

---

### Step 7.4: Audit Log Service Integration

**Goal**: Centralize audit logging for security events

**Tasks**:

- Create `packages/server/src/modules/auth/services/audit.service.ts`
- Implement async logging service:

  ```typescript
  @Injectable({ scope: Scope.Operation })
  export class AuditService {
    constructor(private db: TenantAwareDBClient) {}

    async log(event: AuditEvent): Promise<void> {
      // Non-blocking insert (fire-and-forget or queue-based)
      await this.db.query(
        `
        INSERT INTO accounter_schema.audit_logs
        (business_id, user_id, auth0_user_id, action, entity, entity_id, details, ip_address)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `,
        [
          event.businessId,
          event.userId,
          event.auth0UserId,
          event.action,
          event.entity,
          event.entityId,
          JSON.stringify(event.details),
          event.ipAddress
        ]
      )
    }
  }
  ```

- Integrate into critical flows:
  - Invitation creation (action: 'INVITATION_CREATED')
  - Invitation acceptance (action: 'INVITATION_ACCEPTED')
  - API key generation (action: 'API_KEY_CREATED')
  - API key revocation (action: 'API_KEY_REVOKED')
  - Business logic events (e.g., 'INVOICE_CREATED', 'SALARY_UPDATED')
- Add tests:
  - Audit logs inserted correctly
  - Async logging doesn't block mutations
  - Both user_id and auth0_user_id logged

**Validation**:

- Complete audit trail for security events
- Logging doesn't impact mutation performance
- Compliance-ready

**Risk**: Low

---

## Phase 8: API Key Management (Week 8)

**Note**: API key authentication middleware was implemented in Phase 4, Step 4.4. This phase covers
GraphQL mutations for creating and managing API keys.

### Step 8.1: API Key Generation Mutation

**Goal**: Allow business owners to create API keys

**Tasks**:

- Add to schema:
  ```graphql
  type Mutation {
    generateApiKey(name: String!, roleId: String!): GenerateApiKeyPayload! @requiresAuth
  }
  type GenerateApiKeyPayload {
    apiKey: String! # Only shown once
    apiKeyRecord: ApiKey!
  }
  type ApiKey {
    id: ID!
    name: String!
    roleId: String!
    lastUsedAt: String
    createdAt: String!
  }
  ```
- Create resolver:
  - Verify caller has `business_owner` role (role-based check, no permission resolution)
  - Validate roleId is one of: `scraper`, `accountant`, `employee` (business_owner not allowed for
    API keys)
  - Generate cryptographically secure key (128 chars using `crypto.randomBytes`)
  - Hash key using SHA-256
  - Insert into `api_keys` table (business_id from authContext, role_id, key_hash, name)
  - Log to audit_logs (action: 'API_KEY_CREATED', entity: 'ApiKey', entity_id: key_id)
  - Return plaintext key (only time it's visible) + record
- Add tests:
  - Business owner can generate API keys
  - Employee cannot generate API keys (FORBIDDEN)
  - Key generated securely (128 random bytes)
  - Hash stored correctly (SHA-256)
  - Plaintext key returned only once
  - Audit log entry created

**Validation**:

- API keys created successfully
- Secure generation and storage
- Only business_owner can create

**Risk**: Low

---

### Step 8.2: API Key Management Mutations

**Goal**: Allow listing and revoking API keys

**Tasks**:

- Add to schema:
  ```graphql
  type Query {
    listApiKeys: [ApiKey!]! @requiresAuth
  }
  type Mutation {
    revokeApiKey(id: ID!): Boolean! @requiresAuth
  }
  ```
- Create resolvers:
  - **listApiKeys**:
    - Require `business_owner` role
    - Query `api_keys` WHERE `business_id = authContext.businessId`
    - Return all keys for business (excluding key_hash)
  - **revokeApiKey**:
    - Require `business_owner` role
    - Verify API key belongs to caller's business
    - DELETE from `api_keys` WHERE `id = $1` AND `business_id = authContext.businessId`
    - Log to audit_logs (action: 'API_KEY_REVOKED')
    - Return true
- Add tests:
  - business_owner can list keys for their business only
  - business_owner can revoke keys
  - Employee cannot list or revoke (FORBIDDEN)
  - Revoke works and logs audit trail
  - Cannot revoke API key from different business

**Validation**:

- API key lifecycle manageable
- Business isolation enforced

**Risk**: Low

---

### Step 8.3: Scraper Role Integration Test

**Goal**: Verify scraper can insert transactions via API key

**Tasks**:

- Create integration test:
  1. Generate API key with role='scraper' (as business_owner)
  2. Call `insertTransaction` mutation with `X-API-Key` header
  3. Verify transaction inserted successfully
  4. Verify RLS enforced (scraper cannot access other business data via separate query)
  5. Verify role limitations (scraper cannot call `createInvitation` or other admin mutations)
- Add end-to-end test with actual scraper service

**Validation**:

- Scraper role works as designed
- Role-based authorization enforced
- API keys provide business context correctly

**Risk**: Low

---

## Phase 9: Frontend Enhancement (Auth0 Features) (Week 9)

**Note**: Core Auth0 login integration was completed in Phase 4, Step 4.6 to ensure zero downtime
during backend migration. This phase adds enhanced auth features and user experience improvements.

### Step 9.1: Protected Routes Component

**Goal**: Restrict unauthenticated access to app routes (beyond basic login check)

**Prerequisites**:

- Auth0 SDK installed and configured (completed in Phase 4, Step 4.6)
- Login/callback flows working (completed in Phase 4, Step 4.6)

**Tasks**:

- Create `packages/client/src/components/protected-route.tsx`:

  ```typescript
  import { useAuth0 } from '@auth0/auth0-react'
  import { Navigate } from 'react-router-dom'

  export function ProtectedRoute({ children }: { children: React.ReactNode }) {
    const { isAuthenticated, isLoading } = useAuth0()

    if (isLoading) return <div>Loading...</div>

    if (!isAuthenticated) return <Navigate to="/login" replace />

    return <>{children}</>
  }
  ```

- Wrap protected routes in router:
  ```typescript
  <Route
    path="/dashboard"
    element={
      <ProtectedRoute>
        <Dashboard />
      </ProtectedRoute>
    }
  />
  ```

**Validation**:

- Unauthenticated users redirected to login
- Authenticated users access protected routes
- Loading state handled smoothly

**Risk**: Low

---

### Step 9.2: Enhanced Error Handling

**Goal**: Improve user experience with better auth error messaging

**Prerequisites**:

- Basic Auth0 login working (Phase 4, Step 4.6)

**Prerequisites**:

- Basic Auth0 login working (Phase 4, Step 4.6)

**Tasks**:

- Enhance callback page with detailed error handling:

  ```typescript
  function CallbackPage() {
    const { error, isAuthenticated, isLoading } = useAuth0()
    const navigate = useNavigate()

    useEffect(() => {
      if (!isLoading) {
        if (error) {
          // Map Auth0 errors to user-friendly messages
          const errorMessages = {
            'access_denied': 'Login was cancelled',
            'unauthorized': 'Invalid credentials',
            'consent_required': 'Additional permissions needed'
          }
          const message = errorMessages[error.error] || error.message
          navigate(`/login?error=${encodeURIComponent(message)}`)
        } else if (isAuthenticated) {
          navigate('/dashboard')
        }
      }
    }, [isLoading, error, isAuthenticated])

    return <LoadingSpinner />
  }
  ```

- Add error display on login page
- Add retry logic for network failures

**Validation**:

- Auth errors displayed clearly to users
- Network errors handled gracefully
- Users can retry failed login attempts

**Risk**: Low

---

### Step 9.3: User Profile Display

**Goal**: Display authenticated user information in UI

**Prerequisites**:

- Auth0 authentication working (Phase 4, Step 4.6)

**Tasks**:

- Create user profile component:

  ```typescript
  import { useAuth0 } from '@auth0/auth0-react'

  export function UserProfile() {
    const { user, isAuthenticated } = useAuth0()

    if (!isAuthenticated || !user) return null

    return (
      <div className="user-profile">
        <img src={user.picture} alt={user.name} />
        <div>
          <p>{user.name}</p>
          <p>{user.email}</p>
        </div>
      </div>
    )
  }
  ```

- Add to app header/navbar
- Add user menu dropdown with profile link and logout option

**Validation**:

- User information displays correctly
- Profile picture loaded from Auth0
- User menu accessible

**Risk**: Low

---

### Step 9.4: Enhanced Token Management

**Goal**: Add token refresh and error recovery to GraphQL client

**Prerequisites**:

- Basic Urql Auth0 configuration complete (Phase 4, Step 4.6)

**Prerequisites**:

- Basic Urql Auth0 configuration complete (Phase 4, Step 4.6)

**Tasks**:

- Enhance Urql client with better error handling and token refresh:

  ```typescript
  authExchange({
    getAuth: async () => {
      try {
        const token = await getAccessTokenSilently({
          cacheMode: 'off' // Force fresh token on auth error
        })
        return { token }
      } catch (error) {
        console.error('Token fetch failed:', error)
        return null
      }
    },
    addAuthToOperation: ({ authState, operation }) => {
      if (!authState?.token) return operation

      return makeOperation(operation.kind, operation, {
        ...operation.context,
        fetchOptions: {
          ...operation.context.fetchOptions,
          headers: {
            ...operation.context.fetchOptions?.headers,
            Authorization: `Bearer ${authState.token}`
          }
        }
      })
    },
    didAuthError: ({ error }) => {
      // Detect UNAUTHENTICATED errors from server
      return error.graphQLErrors.some(e => e.extensions?.code === 'UNAUTHENTICATED')
    },
    willAuthError: ({ authState }) => {
      // Check if token is expired (optional)
      return !authState || !authState.token
    }
  })
  ```

- Add automatic retry on 401/UNAUTHENTICATED
- Add user notification on persistent auth failures

**Validation**:

- Client sends Auth0 access tokens correctly
- Tokens refreshed automatically (Auth0 SDK manages this)
- UNAUTHENTICATED errors trigger re-authentication
- Error handling works

**Risk**: Medium (critical for secure API communication)

---

### Step 9.5: Logout Flow Enhancement

                return !authState || !authState.token
              }
            }),
            fetchExchange
          ]
        }),
      [getAccessTokenSilently]
    )

}

````

- Add automatic token refresh handling (Auth0 SDK handles this automatically via
`getAccessTokenSilently`)
- Add tests:
- Access token sent in Authorization header
- Token automatically refreshed when expired
- UNAUTHENTICATED errors trigger re-authentication

**Validation**:

- Client sends Auth0 access tokens correctly
- Tokens refreshed automatically (Auth0 SDK manages this)
- Error handling works

**Risk**: Low

---

### Step 9.5: Logout Flow

**Goal**: Allow users to log out from Auth0

**Tasks**:

- Add logout button to app header/menu:

```typescript
import { useAuth0 } from '@auth0/auth0-react';

function Header() {
  const { logout, user } = useAuth0();

  return (
    <header>
      <span>Welcome, {user?.email}</span>
      <button onClick={() => logout({ returnTo: window.location.origin })}>
        Log Out
      </button>
    </header>
  );
}
````

- Auth0 SDK handles:
  - Clearing local tokens from localStorage
  - Redirecting to Auth0 logout endpoint
  - Redirecting back to specified `returnTo` URL
- Add tests:
  - Logout button triggers Auth0 logout
  - User redirected to home page after logout
  - Local tokens cleared

**Validation**:

- Users can log out successfully
- Auth0 session terminated
- Tokens cleared from client

**Risk**: Low

---

### Step 9.6: Invitation Acceptance UI Flow

**Goal**: Allow users to accept invitations after Auth0 setup

**Tasks**:

- Create `/accept-invitation/:token` route and page
- Implement acceptance flow:
  1. **If user NOT authenticated**:
     - Display message: "Please log in or create your account to accept this invitation"
     - Provide "Log In / Sign Up" button that calls `loginWithRedirect({ invitation_token: token })`
     - Store token in localStorage or query params to persist through Auth0 redirect
  2. **If user authenticated**:
     - Display invitation details (business name, role)
     - Provide "Accept Invitation" button
     - On click:
       - Call `acceptInvitation(token)` GraphQL mutation
       - On success: redirect to dashboard with success message
       - On error: display error (expired token, already accepted, etc.)
- Handle first-time vs. additional business scenarios:
  - For new users (first invitation): They complete Auth0 password setup → log in → redirected to
    accept invitation page → accept → access granted
  - For existing users (additional business): They log in (already have Auth0 account) → accept
    invitation → new business added to their account
- Add tests:
  - Unauthenticated user prompted to login
  - Authenticated user can accept invitation
  - Success/error states handled correctly
  - Valid invitation accepted and user redirected
  - Expired/invalid token shows error

**Validation**:

- Invitation flow complete end-to-end
- Works for both new and existing users
- Clear UX for different states

**Risk**: Low

---

## Phase 10: Production Hardening (Week 10)

### Step 10.1: Provider Scope Audit

**Goal**: Eliminate cache leakage across tenants

**Tasks**:

- Audit all `@Injectable` providers in codebase
- Identify providers with caches or tenant-specific data
- Convert to `Scope.Operation` or add tenant prefixes (see spec 3.2.1.1)
- Priority targets:
  - BusinessesProvider
  - ChargesProvider
  - DocumentsProvider
  - Any provider using DataLoaders or caches
- Add integration tests:
  - Verify cache isolation between concurrent requests
  - Load test with multiple tenants

**Validation**:

- No cross-tenant cache pollution
- Performance acceptable (may need cache tuning)

**Risk**: High (touches many providers, performance impact)

---

### Step 10.2: Connection Pool Optimization

**Goal**: Right-size pool for production load

**Tasks**:

- Set pool size to 50-100 connections (production)
- Configure query timeouts (30 seconds default)
- Add monitoring:
  - Track `pg_stat_activity` for pool saturation
  - Alert on > 80% pool utilization
  - Track slow queries via `pg_stat_statements`
- Add health check endpoint:
  - Check pool availability
  - Return 503 if unhealthy
- Load test:
  - Simulate 100 concurrent users
  - Verify no pool exhaustion
  - Measure query latency

**Validation**:

- Pool sized appropriately
- Monitoring in place
- No connection leaks under load

**Risk**: Medium (production stability critical)

---

### Step 10.3: Rate Limiting

**Goal**: Prevent brute-force and DoS attacks

**Tasks**:

- Implement rate limiting for sensitive mutations:
  - createInvitation: 10 invitations per hour per business
  - acceptInvitation: 10 attempts per hour per IP
  - generateApiKey: 5 keys per hour per business
- Use Redis for distributed rate limiting (if multi-instance deployment)
- Add tests:
  - Rate limits enforced
  - Limits reset after window
  - Error messages clear ("Rate limit exceeded, try again in X minutes")

**Validation**:

- Brute-force attacks mitigated
- Auth0 rate limits complemented by local limits

**Risk**: Low

---

### Step 10.4: Audit Log Analysis Dashboard

**Goal**: Make audit logs actionable

**Tasks**:

- Create read-only queries for audit logs:
  - Recent invitation creation/acceptance events
  - API key generation/revocation events
  - Failed authentication attempts (from Auth0 logs if available)
  - Business-sensitive actions (invoice creation, salary updates)
- Add GraphQL query:
  ```graphql
  type Query {
    auditLogs(
      businessId: ID
      userId: ID
      auth0UserId: String
      action: String
      limit: Int
      offset: Int
    ): AuditLogConnection! @requiresAuth
  }
  type AuditLogConnection {
    nodes: [AuditLog!]!
    totalCount: Int!
  }
  ```
- (Optional) Create admin dashboard page showing recent logs
- Add tests:
  - Queries return correct logs
  - RLS enforced (users see only their business logs)
  - Pagination works

**Validation**:

- Audit trail useful for compliance and investigations
- Business owners can review security events

**Risk**: Low

---

### Step 10.5: Security Hardening Checklist

**Goal**: Final security review before production

**Tasks**:

- [ ] Auth0 tenant configured correctly:
  - [ ] RS256 algorithm enforced
  - [ ] Access token lifetime: 15 minutes
  - [ ] Refresh token rotation enabled
  - [ ] Refresh token expiration: 7 days
  - [ ] Callback URLs whitelisted
  - [ ] MFA available (optional, can be enabled per-user later)
- [ ] API keys stored as SHA-256 hashes only
- [ ] Auth0 access tokens verified with JWKS (no hardcoded secrets)
- [ ] CORS configured correctly (whitelist origins, not `*`)
- [ ] Rate limiting on all invitation/API key mutations
- [ ] RLS enabled on all tenant tables
- [ ] ESLint rule prevents direct pool access in resolvers
- [ ] All GraphQL mutations have role-based authorization checks
- [ ] Audit logs capture all security events (invitation, API keys, critical actions)
- [ ] Error messages don't leak sensitive info (e.g., "Invalid credentials" not "User not found")
- [ ] SQL injection prevented (parameterized queries only)
- [ ] XSS prevented (no dangerouslySetInnerHTML, CSP headers configured)
- [ ] Dependencies audited (`npm audit`, Dependabot enabled)
- [ ] Auth0 Management API credentials stored in secure environment variables (not in code)
- [ ] Invitation cleanup job scheduled (daily)
- [ ] HTTPS enforced in production

**Validation**:

- Security checklist 100% complete
- No Auth0-specific vulnerabilities (token verification bypasses, etc.)

**Risk**: N/A (validation step)

---

### Step 10.6: Performance Baseline

**Goal**: Establish metrics for ongoing monitoring

**Tasks**:

- Run load tests:
  - 100 concurrent users
  - 1000 requests/minute
  - Measure: p50, p95, p99 latency
- Establish baselines:
  - GraphQL query latency: < 100ms (p95)
  - createInvitation mutation: < 800ms (p95) - includes Auth0 API call
  - acceptInvitation mutation: < 800ms (p95) - includes Auth0 API call
  - Database query time: < 50ms (p95)
  - RLS overhead: < 20% vs non-RLS
  - Auth0 JWT verification: < 10ms (JWKS cached)
- Set up ongoing monitoring:
  - Application metrics (Prometheus/Grafana)
  - Database metrics (pg_stat_statements)
  - Auth0 Management API latency tracking
  - Error rate tracking (Auth0 rate limits, API failures)
  - Alerts for degradation

**Validation**:

- Performance meets SLAs
- Auth0 integration doesn't introduce significant latency
- Monitoring captures issues

**Risk**: Low

---

## Summary Metrics

**Total Timeline**: 10 weeks (Auth0 integration reduces complexity vs. self-hosted auth)

**Phases**:

1. **Foundation & Database Schema** (Weeks 1-2): Auth0-compatible database schema with
   business_users mapping
2. **Core Database Services** (Week 3): RLS-enforcing DB client and connection pooling
3. **Row-Level Security** (Week 4): Multi-tenant data isolation at database level
4. **Auth0 Integration & Authentication Migration** (Week 5): Auth0 Management API, JWT
   verification, **frontend Auth0 UI integration**, backend switch, zero-downtime migration
5. **Post-Migration Cleanup** (Week 6): Remove old authentication code
6. **Role-Based Authorization** (Week 6): Authorization services and GraphQL directives (role-based,
   no permissions initially)
7. **Invitation Flow** (Week 7): Pre-registration invitations with Auth0 Management API, cleanup
   jobs, audit logging
8. **API Key Management** (Week 8): Generate/list/revoke API keys (independent of Auth0)
9. **Frontend Enhancement** (Week 9): Enhanced error handling, user profile, token management,
   invitation UI
10. **Production Hardening** (Week 10): Cache isolation, rate limiting, security review, performance
    baseline

**Steps**: 55+ individual steps across 10 phases (includes critical frontend integration before
backend switch)

**Risk Distribution**:

- Low Risk: 32 steps
- Medium Risk: 15 steps
- High Risk: 3 steps (Provider scope audit, Wire authorization into resolvers, Enable RLS on all
  tables)

**Testing Coverage**:

- Unit tests: Every service/utility function
- Integration tests: All GraphQL mutations/queries, Auth0 Management API interactions
- E2E tests: Critical user flows (Auth0 login, invitation acceptance, API key usage)
- Load tests: Production readiness validation

**Key Success Metrics**:

- Zero cross-tenant data leaks (tested via integration tests)
- < 20% RLS performance overhead (measured via load tests)
- 100% security checklist completion
- All migrations reversible with rollback plans
- Comprehensive audit trail for all security events
- Auth0 JWT verification < 10ms (p95)
- Auth0 Management API calls < 500ms (p95)

**Auth0 Benefits vs. Self-Hosted Auth**:

- **Eliminated Complexity**: No password hashing, JWT signing, email verification, refresh token
  rotation, password reset flows
- **Reduced Attack Surface**: Auth0 handles credential storage, eliminating local password breach
  risk
- **Built-in Features**: MFA, social logins, breach password detection, anomaly detection available
  via Auth0 configuration
- **Compliance**: Auth0 is SOC 2, GDPR, HIPAA compliant out-of-the-box
- **Email Delivery**: Auth0 handles transactional emails (password setup, verification, reset)
- **Reduced Timeline**: Estimated 10 weeks vs. 12 weeks for self-hosted solution

**Trade-offs**:

- **External Dependency**: Auth0 downtime affects authentication (mitigated by Auth0's 99.99% SLA)
- **Cost**: Auth0 pricing based on MAU (Monthly Active Users) - evaluate cost vs. development time
  savings
- **Limited Customization**: Email templates, login UI customizable but constrained by Auth0's
  framework

---

## Next Steps

This blueprint should be transformed into:

1. **Jira/GitHub Issues**: One issue per step (or grouped logically)
2. **Implementation Prompts**: Detailed prompts for LLM code generation (see `prompt_plan.md`)
3. **Test Plan**: Comprehensive test scenarios for QA
4. **Deployment Plan**: Staging → Production rollout strategy
5. **Auth0 Tenant Setup**: Complete Auth0 configuration before starting development
6. **Documentation**: Auth0 setup guide, troubleshooting, user onboarding flows
