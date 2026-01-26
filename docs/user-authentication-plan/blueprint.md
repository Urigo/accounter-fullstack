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

## **Risk**: Very Low (tables not used yet)

## Phase 2: Core Database Services (Week 3)

### Step 2.1: DBProvider Singleton Setup

**Goal**: Create connection pool manager for system-level operations

**Tasks**:

- Create `packages/server/src/shared/providers/db.provider.ts`
- Implement singleton DBProvider class
  - Initialize pg.Pool with config from environment
  - Expose `pool` property for direct access (migrations, background jobs)
  - Add health check method
- Add integration tests:
  - Pool creation succeeds
  - Can execute system-level queries
  - Connection limits respected
- Wire into GraphQL context as singleton

**Validation**:

- Pool initializes on server start
- Health checks pass
- No connection leaks in tests

**Risk**: Low (standard connection pooling pattern)

---

### Step 2.2: TenantAwareDBClient (Request-Scoped)

**Goal**: Create RLS-enforcing database client for all GraphQL operations

**Tasks**:

- Create `packages/server/src/shared/helpers/tenant-db-client.ts`
- Implement `TenantAwareDBClient` class:
  - `@Injectable({ scope: Scope.Operation })`
  - Constructor injects DBProvider (singleton) and AuthContext (request-scoped)
  - `query()` method: wraps in transaction, sets RLS variables
  - `transaction()` method: supports nested transactions via savepoints
  - `dispose()` method: releases connection back to pool
- Implement RLS variable setting:
  ```sql
  SET LOCAL app.current_business_id = $1;
  SET LOCAL app.current_user_id = $2;
  SET LOCAL app.auth_type = $3;
  ```
- Add unit tests:
  - Transaction reuse within single operation
  - Savepoint creation for nested transactions
  - Proper connection release on dispose
  - RLS variables set correctly
- Integration tests:
  - Verify isolation between concurrent requests

**Validation**:

- One transaction per GraphQL operation
- RLS variables visible to all queries in transaction
- No connection leaks

**Risk**: Medium (critical for security, needs careful testing)

---

### Step 2.3: Auth Context Provider (Auth0 JWT Verification)

**Goal**: Create request-scoped auth context from Auth0 JWT or API key

**Tasks**:

- Install `jose` library for JWT verification
- Create `packages/server/src/modules/auth/providers/auth-context.provider.ts`
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

- Auth0 JWT verification works correctly
- AuthContext available in all resolvers
- Context isolated per request

**Risk**: Medium (foundational security component, requires Auth0 configuration)

---

### Step 2.4: Wire TenantAwareDBClient into GraphQL Context

**Goal**: Replace raw pool access with tenant-aware client in all resolvers

**Tasks**:

- Update GraphQL context creation:
  - Inject TenantAwareDBClient instead of raw pool
  - Pass AuthContext to client constructor
- Create ESLint rule:
  - Prevent direct `DBProvider` imports in resolver files
  - Allow only in migrations and background jobs
- Update existing resolvers (gradual migration):
  - Phase 1: Update one module (e.g., businesses)
  - Add tests: Verify RLS variables set
  - Phase 2: Update remaining modules incrementally
- Add integration tests:
  - Multi-tenant isolation verified
  - Queries use active transaction

**Validation**:

- All resolver DB access goes through TenantAwareDBClient
- ESLint catches violations
- No direct pool.query() calls in resolvers

**Risk**: High (requires touching many files, must be gradual)

**Note**: This step will be broken into sub-steps per module in detailed implementation

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
- Add integration tests:
  - User from business A cannot see charges from business B
  - Queries without SET LOCAL fail
  - TenantAwareDBClient queries succeed

**Validation**:

- RLS policy enforced
- Cross-tenant queries blocked
- Performance acceptable (< 10% overhead)

**Risk**: High (first RLS table, potential for access issues)

**Rollback Plan**: Disable RLS on charges if production issues occur

---

### Step 3.3: Add business_id Columns (Phase 1 - Nullable)

**Goal**: Add business_id to all tenant tables as nullable columns

**Tasks**:

- Create migration: `2026-01-28-add-business-id-nullable.sql`
- Add `business_id UUID` to all tables listed in spec section 3.2.2
- Use `ALTER TABLE ... ADD COLUMN business_id UUID;` (acquires brief lock)
- Add tests: Verify columns added successfully

**Validation**:

- All target tables have business_id column
- Columns are nullable
- Minimal downtime (< 1 second per table)

**Risk**: Low (nullable columns don't break existing queries)

---

### Step 3.4: Backfill business_id (Phase 2 - Background Job)

**Goal**: Populate business_id columns using deterministic rules

**Tasks**:

- Create background job script: `scripts/backfill-business-id.ts`
- Implement batch backfill (10,000 rows at a time):
  - `charges.business_id = charges.owner_id`
  - `documents.business_id = charges.business_id` (via FK)
  - `transactions.business_id = charges.business_id` (via FK)
  - etc. (see spec section 6 for full rules)
- Add 1-second sleep between batches to avoid blocking
- Add progress logging
- Add validation query: `SELECT COUNT(*) WHERE business_id IS NULL`
- Add tests: Verify backfill logic per table

**Validation**:

- 100% backfill completion
- No NULL business_id values remain
- No downtime during backfill

**Risk**: Medium (long-running, must be monitored)

---

### Step 3.5: Make business_id NOT NULL (Phase 3)

**Goal**: Enforce business_id constraint after backfill

**Tasks**:

- Verify backfill completion (manual check)
- Create migration: `2026-01-29-business-id-not-null.sql`
- Add NOT NULL constraints:
  ```sql
  ALTER TABLE accounter_schema.charges ALTER COLUMN business_id SET NOT NULL;
  ```
- Run on all tables (acquires brief ACCESS EXCLUSIVE lock per table)
- Add tests: Verify constraint enforcement

**Validation**:

- All business_id columns are NOT NULL
- Inserts without business_id rejected
- Total downtime < 10 seconds per table

**Risk**: Medium (requires ACCESS EXCLUSIVE lock, brief downtime)

**Timing**: Run during low-traffic window (3-5am)

---

### Step 3.6: Add Indexes and Foreign Keys (Phase 4)

**Goal**: Optimize RLS queries and enforce referential integrity

**Tasks**:

- Create migration: `2026-01-30-add-business-id-indexes.sql`
- Create indexes CONCURRENTLY (non-blocking):
  ```sql
  CREATE INDEX CONCURRENTLY idx_charges_business_id ON charges(business_id);
  CREATE INDEX CONCURRENTLY idx_documents_business_id ON documents(business_id);
  ```
- Add foreign keys with NOT VALID (non-blocking):
  ```sql
  ALTER TABLE charges ADD CONSTRAINT fk_charges_business
    FOREIGN KEY (business_id) REFERENCES businesses_admin(id) NOT VALID;
  ```
- Validate foreign keys in separate step:
  ```sql
  ALTER TABLE charges VALIDATE CONSTRAINT fk_charges_business;
  ```
- Add tests: Verify indexes used in query plans

**Validation**:

- All indexes created successfully
- FK constraints enforced
- No production downtime
- Query performance improved (< 50ms for tenant queries)

**Risk**: Low (concurrent operations don't block)

---

### Step 3.7: Roll Out RLS to All Tables

**Goal**: Enable RLS on all tenant tables with business_id

**Tasks**:

- Create migration: `2026-01-31-enable-rls-all-tables.sql`
- Enable RLS on all tables (incremental):
  - Batch 1: Core tables (charges, documents, transactions)
  - Batch 2: Secondary tables (ledger_records, salaries)
  - Batch 3: Remaining tables
- Create policies for each table:
  ```sql
  CREATE POLICY tenant_isolation ON <table_name>
    USING (business_id = accounter_schema.get_current_business_id());
  ```
- For tables with FK-derived business_id (e.g., documents):
  ```sql
  CREATE POLICY tenant_isolation ON documents
    USING (
      EXISTS (
        SELECT 1 FROM charges
        WHERE charges.id = documents.charge_id
        AND charges.business_id = accounter_schema.get_current_business_id()
      )
    );
  ```
- Add comprehensive integration tests:
  - Test isolation across all tables
  - Verify JOIN queries work correctly
  - Load test to verify performance

**Validation**:

- All tenant tables protected by RLS
- No cross-tenant data leaks
- Performance within acceptable range (< 20% overhead)

**Risk**: High (final security activation, requires extensive testing)

**Rollback Plan**: Script to disable RLS per table if critical issues found

---

## Phase 4: Auth0 Integration & GraphQL Context Enrichment (Week 5)

### Step 4.1: Auth0 Tenant Configuration

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

### Step 4.2: Auth0 Management API Service

**Goal**: Create service to interact with Auth0 Management API

**Tasks**:

- Create `packages/server/src/modules/auth/services/auth0-management.service.ts`
- Implement service methods:
  - `getAccessToken()`: Use client credentials flow to obtain M2M access token (cache for 24 hours)
  - `createUser(email: string, invitationMetadata: object)`: Call `POST /api/v2/users` with payload:
    ```json
    {
      "email": "user@example.com",
      "blocked": true,
      "connection": "Username-Password-Authentication",
      "app_metadata": {
        "invitation_id": "uuid",
        "business_id": "uuid",
        "invited_by": "uuid"
      }
    }
    ```
  - `unblockUser(auth0UserId: string)`: Call `PATCH /api/v2/users/{id}` with payload
    `{ "blocked": false }`
  - `deleteUser(auth0UserId: string)`: Call `DELETE /api/v2/users/{id}` (for expired invitation
    cleanup)
- Implement rate limit handling:
  - Detect 429 responses
  - Extract `X-RateLimit-Reset` header
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

**Risk**: Medium (external API dependency, requires Auth0 credentials)

---

### Step 4.3: Auth Context Enrichment Service

**Goal**: Map Auth0 user ID to local business/role data after JWT verification

**Tasks**:

- Create `packages/server/src/modules/auth/services/auth-context-enricher.service.ts`
- Implement service:

  ```typescript
  @Injectable({ scope: Scope.Operation })
  export class AuthContextEnricher {
    constructor(private db: TenantAwareDBClient) {}

    async enrichContext(auth0UserId: string): Promise<AuthContext> {
      // Map Auth0 user ID to local user_id and fetch business/role data
      const { rows } = await this.db.query(
        `
        SELECT user_id, business_id, role_id
        FROM accounter_schema.business_users
        WHERE auth0_user_id = $1
        LIMIT 1
      `,
        [auth0UserId]
      )

      if (rows.length === 0) {
        throw new GraphQLError('User not linked to any business', {
          extensions: { code: 'FORBIDDEN' }
        })
      }

      const { user_id, business_id, role_id } = rows[0]

      return {
        authType: 'user',
        user: {
          userId: user_id,
          auth0UserId: auth0UserId,
          businessId: business_id,
          roleId: role_id
        },
        tenant: {
          businessId: business_id
        }
      }
    }
  }
  ```

- Integrate into GraphQL context creation:
  - After Auth0 JWT verification extracts `sub` claim
  - Call `authContextEnricher.enrichContext(sub)`
  - Store enriched context in request-scoped provider
- Add tests:
  - Valid Auth0 user mapped to local business/role
  - User not in business_users throws FORBIDDEN
  - Database query uses correct schema

**Validation**:

- Auth0 users linked to local business data
- GraphQL resolvers have access to businessId, roleId, userId
- Error handling clear

**Risk**: Medium (critical for request-scoped tenant isolation)

---

### Step 4.4: API Key Authentication (Parallel to Auth0)

**Goal**: Support API key authentication for scraper role

**Tasks**:

- Update `AuthContextProvider` (Step 2.3) to support dual authentication:
  - Check for `Authorization: Bearer <jwt>` → Auth0 verification
  - Else check for `X-API-Key: <key>` → API key verification
- Implement API key verification:
  - Hash provided API key with SHA-256
  - Query `api_keys` table by `key_hash`
  - Fetch associated `business_id` and `role_id`
  - Build AuthContext:
    ```typescript
    {
      authType: 'apiKey',
      user: {
        userId: null,          // API keys not linked to user_id
        auth0UserId: null,
        businessId: business_id,
        roleId: role_id
      },
      tenant: {
        businessId: business_id
      }
    }
    ```
  - Update `last_used_at` asynchronously (hourly batching to avoid write amplification)
- Add tests:
  - Valid API key authenticates correctly
  - Invalid API key rejected
  - API key provides business and role context
  - `last_used_at` updated (integration test)

**Validation**:

- API keys work alongside Auth0 JWT
- Same authorization flow for both auth types
- Scraper role can use API keys

**Risk**: Low (standard API key pattern)

---

## Phase 5: Role-Based Authorization (Week 6)

**Note**: Permissions infrastructure (tables, PermissionResolutionService) is out of scope for this
phase. Authorization checks use role-based logic only (e.g.,
`if (authContext.roleId === 'business_owner')`). Permission-based authorization is a future
enhancement.

### Step 5.1: GraphQL Directives (Simple Checks)

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

### Step 5.2: Authorization Service Pattern

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

### Step 5.3: Domain Authorization Service (Example - Charges)

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

### Step 5.4: Wire Authorization into Resolvers

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

## Phase 6: Invitation Flow (Auth0 Pre-Registration) (Week 7)

### Step 6.1: Invitation Creation Mutation (with Auth0 Management API)

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

### Step 6.2: Accept Invitation Mutation (Auth0 Session Required)

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

### Step 6.3: Invitation Cleanup Background Job

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

### Step 6.4: Audit Log Service Integration

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

## Phase 7: API Key Management (Week 8)

**Note**: API key authentication middleware was implemented in Phase 4, Step 4.4. This phase covers
GraphQL mutations for creating and managing API keys.

### Step 7.1: API Key Generation Mutation

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

### Step 7.2: API Key Management Mutations

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

### Step 7.3: Scraper Role Integration Test

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

## Phase 8: Frontend Integration (Auth0 SDK) (Week 9)

### Step 8.1: Install and Configure Auth0 React SDK

**Goal**: Set up Auth0 authentication in the React client

**Tasks**:

- Install `@auth0/auth0-react`
- Create `packages/client/src/config/auth0-config.ts`:
  ```typescript
  export const auth0Config = {
    domain: import.meta.env.VITE_AUTH0_DOMAIN, // e.g., 'your-tenant.auth0.com'
    clientId: import.meta.env.VITE_AUTH0_CLIENT_ID, // Application Client ID
    audience: import.meta.env.VITE_AUTH0_AUDIENCE, // API identifier
    redirectUri: window.location.origin + '/callback',
    cacheLocation: 'localstorage' as const // For refresh token persistence
  }
  ```
- Wrap app with Auth0Provider in `packages/client/src/main.tsx`:

  ```typescript
  import { Auth0Provider } from '@auth0/auth0-react';
  import { auth0Config } from './config/auth0-config';

  <Auth0Provider {...auth0Config}>
    <App />
  </Auth0Provider>
  ```

- Add environment variables to `.env`:
  ```
  VITE_AUTH0_DOMAIN=your-tenant.auth0.com
  VITE_AUTH0_CLIENT_ID=your-client-id
  VITE_AUTH0_AUDIENCE=https://api.accounter.example.com
  ```
- Add tests:
  - Auth0Provider wraps app correctly
  - Config loaded from environment

**Validation**:

- Auth0 SDK initialized
- Configuration accessible

**Risk**: Low

---

### Step 8.2: Login Flow (Auth0 Universal Login)

**Goal**: Implement login via Auth0 Universal Login

**Tasks**:

- Update `packages/client/src/pages/login-page.tsx`:
  - Remove custom email/password form
  - Add "Log In" button that calls `loginWithRedirect()` from `useAuth0()` hook:

    ```typescript
    import { useAuth0 } from '@auth0/auth0-react';

    function LoginPage() {
      const { loginWithRedirect } = useAuth0();

      return (
        <div>
          <h1>Accounter Login</h1>
          <button onClick={() => loginWithRedirect()}>
            Log In with Auth0
          </button>
        </div>
      );
    }
    ```

  - Auth0 handles redirect to Universal Login page
  - After successful authentication, Auth0 redirects back to `/callback`

- Create callback handler `packages/client/src/pages/callback-page.tsx`:

  ```typescript
  import { useAuth0 } from '@auth0/auth0-react';
  import { useEffect } from 'react';
  import { useNavigate } from 'react-router-dom';

  function CallbackPage() {
    const { isLoading, error, isAuthenticated } = useAuth0();
    const navigate = useNavigate();

    useEffect(() => {
      if (!isLoading) {
        if (error) {
          navigate('/login?error=' + error.message);
        } else if (isAuthenticated) {
          navigate('/dashboard');
        }
      }
    }, [isLoading, error, isAuthenticated, navigate]);

    return <div>Loading...</div>;
  }
  ```

- Add route for `/callback` in router
- Add tests:
  - Login button triggers Auth0 redirect
  - Callback page handles success/error correctly

**Validation**:

- Users can log in via Auth0 Universal Login
- Redirect flow works correctly
- No custom login forms needed

**Risk**: Low

---

### Step 8.3: Protected Routes Component

**Goal**: Restrict unauthenticated access to app routes

**Tasks**:

- Create `packages/client/src/components/protected-route.tsx`:

  ```typescript
  import { useAuth0 } from '@auth0/auth0-react';
  import { Navigate } from 'react-router-dom';

  interface ProtectedRouteProps {
    children: React.ReactNode;
  }

  export function ProtectedRoute({ children }: ProtectedRouteProps) {
    const { isAuthenticated, isLoading } = useAuth0();

    if (isLoading) {
      return <div>Loading...</div>;
    }

    if (!isAuthenticated) {
      return <Navigate to="/login" replace />;
    }

    return <>{children}</>;
  }
  ```

- Wrap protected pages with `<ProtectedRoute>`:
  ```typescript
  <Route path="/dashboard" element={
    <ProtectedRoute>
      <DashboardPage />
    </ProtectedRoute>
  } />
  ```
- Add tests:
  - Authenticated users see content
  - Unauthenticated users redirected to login
  - Loading state shown during auth check

**Validation**:

- Routes protected correctly
- No authenticated state leakage

**Risk**: Low

---

### Step 8.4: Urql Client Configuration (Auth0 Access Token)

**Goal**: Configure GraphQL client to send Auth0 access tokens

**Tasks**:

- Update Urql client setup in `packages/client/src/graphql/client.ts`:

  ```typescript
  import { useAuth0 } from '@auth0/auth0-react'
  import { authExchange } from '@urql/exchange-auth'

  const getAuth = async ({ getToken }) => {
    const token = await getToken()
    if (!token) return null
    return { token }
  }

  const addAuthToOperation = ({ authState, operation }) => {
    if (!authState || !authState.token) return operation

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

  export function useUrqlClient() {
    const { getAccessTokenSilently } = useAuth0()

    return useMemo(
      () =>
        createClient({
          url: import.meta.env.VITE_GRAPHQL_URL,
          exchanges: [
            dedupExchange,
            cacheExchange,
            authExchange({
              getAuth: async () => {
                try {
                  const token = await getAccessTokenSilently()
                  return { token }
                } catch {
                  return null
                }
              },
              addAuthToOperation,
              didAuthError: ({ error }) => {
                return error.graphQLErrors.some(e => e.extensions?.code === 'UNAUTHENTICATED')
              },
              willAuthError: ({ authState }) => {
                return !authState || !authState.token
              }
            }),
            fetchExchange
          ]
        }),
      [getAccessTokenSilently]
    )
  }
  ```

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

### Step 8.5: Logout Flow

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
  ```

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

### Step 8.6: Invitation Acceptance UI Flow

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

## Phase 9: Production Hardening (Week 10)

### Step 9.1: Provider Scope Audit

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

### Step 9.2: Connection Pool Optimization

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

### Step 9.3: Rate Limiting

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

### Step 9.4: Audit Log Analysis Dashboard

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

### Step 9.5: Security Hardening Checklist

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

### Step 9.6: Performance Baseline

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
4. **Auth0 Integration & Context Enrichment** (Week 5): Auth0 Management API, JWT verification,
   enrichment service
5. **Role-Based Authorization** (Week 6): Authorization services and GraphQL directives (role-based,
   no permissions initially)
6. **Invitation Flow** (Week 7): Pre-registration invitations with Auth0 Management API, cleanup
   jobs, audit logging
7. **API Key Management** (Week 8): Generate/list/revoke API keys (independent of Auth0)
8. **Frontend Integration** (Week 9): Auth0 React SDK, Universal Login, protected routes
9. **Production Hardening** (Week 10): Cache isolation, rate limiting, security review, performance
   baseline

**Steps**: 50+ individual steps across 9 phases

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
