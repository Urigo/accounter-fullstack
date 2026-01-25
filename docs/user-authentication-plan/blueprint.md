# User Authentication System - Implementation Blueprint

## Overview

This blueprint outlines the step-by-step implementation of a comprehensive user authentication and
RBAC system for the Accounter application. The plan prioritizes incremental progress, strong
testing, and minimal risk at each stage.

## Guiding Principles

- **Incremental Progress**: Each step builds on the previous, with no orphaned code
- **Test-Driven**: Write tests before or alongside implementation
- **Safety First**: Small, focused changes with validation at each stage
- **Database-First Security**: RLS as primary boundary, application layer as UX enhancement
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

### Step 1.2: Core User Tables Migration

**Goal**: Create foundational user, authentication, and role tables

**Tasks**:

- Create migration: `2026-01-21-create-core-user-tables.sql`
- Create tables:
  - `users` (id, name, email, email_verified_at, created_at, updated_at)
  - `user_accounts` (id, user_id, provider, password_hash)
  - `roles` (id, name) - seed with: business_owner, accountant, employee, scraper
  - `permissions` (id, name) - seed with: manage:users, view:reports, issue:docs,
    insert:transactions
  - `role_permissions` (role_id, permission_id) - seed default mappings
- Add proper indexes on email, user_id foreign keys
- Add tests: Verify table creation, seed data, constraints

**Validation**:

- Tables exist with correct schema
- Seed data loaded correctly
- Unique constraints enforced (email uniqueness)

**Risk**: Low (standard DDL operations)

---

### Step 1.3: Multi-Tenant Join Tables

**Goal**: Create business-user relationships and invitation tables

**Tasks**:

- Create migration: `2026-01-22-create-business-user-tables.sql`
- Create tables:
  - `business_users` (user_id, business_id, role_id) - M:N relationship
  - `invitations` (id, business_id, email, role_id, token, expires_at, created_at)
  - `email_verification_tokens` (id, user_id, token, expires_at, created_at)
- Add composite primary key on `business_users` (user_id, business_id)
- Add unique constraint on invitation token
- Add tests: Verify constraints, FK relationships

**Validation**:

- M:N relationship works correctly
- Token uniqueness enforced
- FK cascades configured properly

**Risk**: Low

---

### Step 1.4: API Keys and Audit Tables

**Goal**: Create tables for API key authentication and audit logging

**Tasks**:

- Create migration: `2026-01-23-create-apikeys-audit-tables.sql`
- Create tables:
  - `api_keys` (id, business_id, role_id, key_hash, name, last_used_at, created_at)
  - `audit_logs` (id, business_id, user_id, action, entity, entity_id, details, ip_address,
    created_at)
- Add index on `api_keys.business_id`
- Add index on `audit_logs` (business_id, created_at)
- Add tests: Verify table structure and indexes

**Validation**:

- Tables created successfully
- Indexes exist and perform well
- JSONB column in audit_logs works correctly

**Risk**: Low

---

### Step 1.5: Refresh Token Multi-Session Support

**Goal**: Replace single refresh token with multi-session storage

**Tasks**:

- Create migration: `2026-01-24-create-refresh-tokens-table.sql`
- Create table:
  - `user_refresh_tokens` (id, user_id, token_hash, created_at, expires_at, revoked_at,
    replaced_by_token_id)
- Add index on `user_id`
- Add index on `token_hash` (for fast lookup)
- Add tests: Verify rotation tracking via `replaced_by_token_id`

**Validation**:

- Table supports multiple concurrent sessions per user
- Token rotation chain can be followed

**Risk**: Low

---

### Step 1.6: Permission Override Tables (Future-Proofing)

**Goal**: Add tables for granular user/API key permission overrides

**Tasks**:

- Create migration: `2026-01-25-create-permission-overrides.sql`
- Create ENUM: `grant_type_enum` ('grant', 'revoke')
- Create tables:
  - `user_permission_overrides` (id, user_id, business_id, permission_id, grant_type, created_at)
  - `api_key_permission_overrides` (id, api_key_id, permission_id, grant_type, created_at)
- Add unique constraints
- Add tests: Verify ENUM enforcement, constraints

**Validation**:

- Tables exist but remain unpopulated initially
- Schema ready for future granular permissions feature

**Risk**: Very Low (tables not used yet)

---

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

### Step 2.3: Auth Context Provider

**Goal**: Create request-scoped auth context from JWT/API key

**Tasks**:

- Create `packages/server/src/modules/auth/providers/auth-context.provider.ts`
- Implement AuthContext interface:
  ```typescript
  interface AuthContext {
    authType: 'jwt' | 'apiKey' | 'system'
    user?: AuthUser
    tenant: TenantContext
    accessTokenExpiresAt?: number
  }
  ```
- Implement provider:
  - Extract JWT from Authorization header or cookie
  - Validate token signature and expiration
  - Parse payload into AuthUser
  - Store in request-scoped injectable
- Add tests:
  - Valid JWT parsed correctly
  - Expired JWT rejected
  - Missing token results in null context
  - API key support placeholder (implement later)

**Validation**:

- AuthContext available in all resolvers
- Token validation works
- Context isolated per request

**Risk**: Medium (foundational security component)

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
    FOREIGN KEY (business_id) REFERENCES businesses(id) NOT VALID;
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

## Phase 4: Authentication Implementation (Week 5)

### Step 4.1: Password Hashing Service

**Goal**: Create secure password hashing utility

**Tasks**:

- Create `packages/server/src/modules/auth/services/password.service.ts`
- Implement using bcrypt:
  - `hash(password: string): Promise<string>` (salt rounds: 10)
  - `verify(password: string, hash: string): Promise<boolean>`
- Add unit tests:
  - Hash generates different values for same input
  - Verify returns true for correct password
  - Verify returns false for incorrect password
  - Timing-safe comparison

**Validation**:

- Passwords hashed securely
- Constant-time verification
- No plaintext password storage

**Risk**: Low (standard bcrypt usage)

---

### Step 4.2: JWT Plugin Configuration

**Goal**: Set up GraphQL Yoga JWT plugin for token management

**Tasks**:

- Install `@graphql-yoga/plugin-jwt`
- Configure plugin in GraphQL server:
  - Access token secret (from env)
  - Refresh token secret (from env)
  - Access token expiration: 15 minutes
  - Refresh token expiration: 7 days
- Create token signing functions:
  - `signAccessToken(payload: AccessTokenPayload): string`
  - `signRefreshToken(payload: RefreshTokenPayload): string`
- Add tests:
  - Tokens sign correctly
  - Tokens verify correctly
  - Expired tokens rejected

**Validation**:

- JWT plugin integrated
- Token generation/verification works
- Secrets loaded from environment

**Risk**: Low (using official plugin)

---

### Step 4.3: PermissionResolutionService

**Goal**: Create unified permission resolver for users and API keys

**Tasks**:

- Create `packages/server/src/modules/auth/services/permission-resolution.service.ts`
- Implement service:
  - `resolvePermissions(subject: AuthSubject): Promise<string[]>`
  - `getRolePermissions(roleId: string): Promise<string[]>`
  - `getPermissionOverrides(subject: AuthSubject): Promise<PermissionOverride[]>`
  - `mergePermissions(base: string[], overrides: PermissionOverride[]): string[]`
- Support both user and API key subjects:
  ```typescript
  type AuthSubject =
    | { type: 'user'; userId: string; businessId: string; roleId: string }
    | { type: 'apiKey'; apiKeyId: string; businessId: string; roleId: string }
  ```
- Add unit tests:
  - Base role permissions resolved correctly
  - Override tables queried correctly (even if empty)
  - Merge logic correct (grant adds, revoke removes)
- Add integration tests:
  - Works for user auth
  - Works for API key auth
  - Handles missing role gracefully

**Validation**:

- Service returns correct permissions for roles
- Ready for future override population

**Risk**: Low (straightforward business logic)

---

### Step 4.4: Login Mutation (Email/Password)

**Goal**: Implement core authentication flow

**Tasks**:

- Create GraphQL schema:
  ```graphql
  type Mutation {
    login(email: String!, password: String!): AuthPayload!
  }
  type AuthPayload {
    accessToken: String!
    user: User!
  }
  ```
- Create `packages/server/src/modules/auth/resolvers/login.resolver.ts`
- Implement login flow:
  1. Query `users` by email
  2. Fetch `user_accounts` for provider='email'
  3. Verify password using PasswordService
  4. Check email_verified_at (reject if NULL)
  5. Query `business_users` to get businessId and roleId
  6. Call `PermissionResolutionService.resolvePermissions()`
  7. Generate access token with payload:
     ```typescript
     {
       ;(userId, email, businessId, roleId, permissions, exp)
     }
     ```
  8. Generate refresh token
  9. Store refresh token hash in `user_refresh_tokens`
  10. Set refresh token as HttpOnly cookie
  11. Log to audit_logs (action: 'USER_LOGIN')
  12. Return { accessToken, user }
- Add comprehensive tests:
  - Successful login with correct credentials
  - Failed login with wrong password
  - Failed login for non-existent user
  - Failed login for unverified email
  - Refresh token stored correctly
  - Audit log entry created
- Add rate limiting (e.g., 5 attempts per 15 minutes per IP)

**Validation**:

- Users can authenticate successfully
- Tokens issued correctly
- HttpOnly cookie set
- Audit trail captured

**Risk**: Medium (core security flow, must be perfect)

---

### Step 4.5: RefreshTokenService with Rotation

**Goal**: Implement secure token refresh with reuse detection

**Tasks**:

- Create `packages/server/src/modules/auth/services/refresh-token.service.ts`
- Implement methods:
  - `generateRefreshToken(userId: string): Promise<{ token, tokenId }>`
  - `rotateToken(oldTokenId: string): Promise<{ newToken, newTokenId }>`
  - `validateAndRotate(token: string): Promise<AccessToken | null>`
  - `revokeToken(tokenId: string): Promise<void>`
  - `detectReuse(tokenId: string): Promise<boolean>` - checks if token has been replaced
- Implement rotation flow:
  1. Hash provided token
  2. Query `user_refresh_tokens` by token_hash
  3. Check if already replaced (reuse detection)
  4. If reused: revoke entire token family, throw error
  5. If valid: generate new token, update replaced_by_token_id
  6. Return new access + refresh tokens
- Add tests:
  - Normal rotation succeeds
  - Reused token detected and rejected
  - Token family revoked on reuse
  - Expired tokens rejected

**Validation**:

- Token rotation works correctly
- Reuse detection prevents token theft
- Revoked tokens cannot be used

**Risk**: High (security-critical, complex logic)

---

### Step 4.6: Refresh Token Mutation

**Goal**: Allow clients to obtain new access tokens

**Tasks**:

- Add to schema:
  ```graphql
  type Mutation {
    refreshToken: AuthPayload!
  }
  ```
- Create resolver:
  - Read refresh token from HttpOnly cookie
  - Call `RefreshTokenService.validateAndRotate()`
  - If reuse detected: return UNAUTHENTICATED error
  - Generate new access token (same payload as login)
  - Set new refresh token cookie
  - Return new access token
- Add tests:
  - Valid refresh succeeds
  - Expired refresh fails
  - Reused token detected
  - New tokens issued correctly

**Validation**:

- Clients can obtain new access tokens seamlessly
- Security maintained through rotation

**Risk**: Medium

---

### Step 4.7: Logout Mutation

**Goal**: Allow users to invalidate tokens

**Tasks**:

- Add to schema:
  ```graphql
  type Mutation {
    logout: Boolean!
  }
  ```
- Create resolver:
  - Extract refresh token from cookie
  - Mark token as revoked in `user_refresh_tokens`
  - Clear HttpOnly cookie
  - Log to audit_logs (action: 'USER_LOGOUT')
- Add tests:
  - Logout succeeds for authenticated user
  - Refresh token cannot be reused after logout
  - Cookie cleared

**Validation**:

- Users can log out successfully
- Tokens invalidated properly

**Risk**: Low

---

## Phase 5: Role-Based Access Control (Week 6)

### Step 5.1: GraphQL Directives (Simple Checks)

**Goal**: Implement minimal directive-based authorization

**Tasks**:

- Create `packages/server/src/modules/auth/directives/requires-auth.directive.ts`
- Implement `@requiresAuth` directive:
  - Check if `context.auth.user` exists
  - If not: throw UNAUTHENTICATED error
- Implement `@requiresVerifiedEmail` directive:
  - Check if `context.auth.user.emailVerified === true`
  - If not: throw FORBIDDEN error with code 'EMAIL_NOT_VERIFIED'
- Implement `@requiresRole(role: String!)` directive:
  - Check if `context.auth.user.roleId === role`
  - If not: throw FORBIDDEN error
- Add tests:
  - Each directive enforces correctly
  - Error codes correct
  - Directives compose correctly

**Validation**:

- Directives work as schema guards
- Error messages clear

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
      /* ... */
    }
    protected requireVerifiedEmail(): void {
      /* ... */
    }
    protected requirePermission(permission: string): void {
      /* ... */
    }
    protected requireOwnership(resourceOwnerId: string): Promise<void> {
      /* ... */
    }
  }
  ```
- Add tests:
  - Base methods work correctly
  - Can be extended by domain services

**Validation**:

- Reusable authorization patterns established

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
      this.requireVerifiedEmail()

      // Check ownership via RLS-protected query
      const charge = await this.db.query('SELECT id FROM charges WHERE id = $1', [chargeId])
      if (!charge.rows.length) {
        throw new ForbiddenError('Charge not found or access denied')
      }
    }
  }
  ```
- Update charge update resolver to call `chargesAuthService.canUpdateCharge()`
- Add tests:
  - Authorized users can update
  - Unauthorized users blocked
  - RLS enforced

**Validation**:

- Pattern demonstrated clearly
- RLS + service layer work together

**Risk**: Low

---

### Step 5.4: Wire Authorization into Resolvers

**Goal**: Add authorization checks to all mutations

**Tasks**:

- Audit all mutations in codebase
- Add `@requiresAuth` to protected queries/mutations
- Add `@requiresVerifiedEmail` to critical mutations:
  - Document issuance
  - User management
  - Salary operations
- Add service-layer checks for:
  - Resource ownership (update/delete operations)
  - Complex permissions (e.g., accountant can view but not delete)
- Add integration tests:
  - Each mutation tested with different roles
  - Verify correct access granted/denied

**Validation**:

- All mutations protected appropriately
- Authorization matrix documented and tested

**Risk**: High (requires touching many resolvers, error-prone)

**Note**: Break into sub-steps per module

---

## Phase 6: Invitation & Email Verification (Week 7)

### Step 6.1: Invitation Creation Mutation

**Goal**: Allow business owners to invite users

**Tasks**:

- Add to schema:
  ```graphql
  type Mutation {
    inviteUser(email: String!, roleId: String!): Invitation! @requiresAuth @requiresVerifiedEmail
  }
  ```
- Create resolver:
  - Verify caller has `manage:users` permission
  - Check if email already exists in `users` or `invitations`
  - Generate cryptographically secure token (64 chars)
  - Insert into `invitations` table
  - Set expires_at to 7 days from now
  - Return invitation object
  - (Future: Send email notification - not in scope)
- Add tests:
  - Business owner can invite
  - Employee cannot invite (FORBIDDEN)
  - Duplicate email rejected
  - Token generated correctly

**Validation**:

- Invitations created successfully
- Permissions enforced

**Risk**: Low

---

### Step 6.2: Accept Invitation Mutation

**Goal**: Allow new users to create accounts via invitation

**Tasks**:

- Add to schema:
  ```graphql
  type Mutation {
    acceptInvitation(token: String!, name: String!, password: String!): AuthPayload!
  }
  ```
- Create resolver:
  1. Query `invitations` by token
  2. Verify token not expired
  3. Begin transaction: a. Create `users` record (email from invitation, set email_verified_at to
     NOW) b. Create `user_accounts` record with hashed password c. Create `business_users` record
     (link to business and role) d. Delete invitation e. Resolve permissions via
     PermissionResolutionService f. Generate access + refresh tokens g. Store refresh token h. Log
     to audit_logs (action: 'USER_CREATED')
  4. Commit transaction
  5. Return AuthPayload
- Add tests:
  - Valid invitation accepted successfully
  - Expired token rejected
  - Invalid token rejected
  - User created correctly
  - Email automatically verified
  - Tokens issued

**Validation**:

- New users can join via invitation
- Email verified implicitly
- Atomic transaction succeeds

**Risk**: Medium (multi-step transaction, must be atomic)

---

### Step 6.3: Email Verification Token Generation

**Goal**: Allow users to request email verification

**Tasks**:

- Add to schema:
  ```graphql
  type Mutation {
    requestEmailVerification: Boolean! @requiresAuth
  }
  ```
- Create resolver:
  - Check if user already verified (skip if yes)
  - Delete any existing tokens for user
  - Generate cryptographically secure token (64 chars)
  - Insert into `email_verification_tokens` (expires_at: 24 hours)
  - (Future: Send email - not in scope)
  - Return true
- Add tests:
  - Token generated successfully
  - Old tokens replaced
  - Already-verified users handled gracefully

**Validation**:

- Verification tokens created correctly

**Risk**: Low

---

### Step 6.4: Email Verification Mutation

**Goal**: Allow users to verify their email

**Tasks**:

- Add to schema:
  ```graphql
  type Mutation {
    verifyEmail(token: String!): Boolean!
  }
  ```
- Create resolver:
  1. Query `email_verification_tokens` by token
  2. Check expiration
  3. Update `users.email_verified_at = NOW()`
  4. Delete token
  5. Log to audit_logs (action: 'EMAIL_VERIFIED')
  6. Return true
- Add tests:
  - Valid token verifies email
  - Expired token rejected with TOKEN_EXPIRED code
  - Invalid token rejected with TOKEN_INVALID code
  - Verified status persists

**Validation**:

- Users can verify email successfully
- Error codes clear for UX

**Risk**: Low

---

### Step 6.5: Email Verification Enforcement

**Goal**: Block critical operations for unverified users

**Tasks**:

- Add `@requiresVerifiedEmail` directive to mutations:
  - Document issuance (createInvoice, etc.)
  - User management (inviteUser)
  - Financial operations (createSalaryRecord)
- Update frontend to detect EMAIL_NOT_VERIFIED error
- Display banner prompting verification
- Add integration tests:
  - Unverified users blocked from critical ops
  - Error code returned correctly
  - Verified users proceed normally

**Validation**:

- Email verification required for sensitive actions
- UX clear and helpful

**Risk**: Low

---

## Phase 7: API Key Authentication (Week 8)

### Step 7.1: API Key Generation Mutation

**Goal**: Allow business owners to create API keys

**Tasks**:

- Add to schema:
  ```graphql
  type Mutation {
    generateApiKey(name: String!, roleId: String!): GenerateApiKeyPayload!
      @requiresAuth
      @requiresVerifiedEmail
  }
  type GenerateApiKeyPayload {
    apiKey: String! # Only shown once
    apiKeyRecord: ApiKey!
  }
  ```
- Create resolver:
  - Verify caller has `manage:users` permission
  - Generate cryptographically secure key (128 chars)
  - Hash key using SHA-256
  - Insert into `api_keys` table
  - Log to audit_logs (action: 'API_KEY_CREATED')
  - Return plaintext key (only time it's visible) + record
- Add tests:
  - Business owner can generate
  - Key generated securely
  - Hash stored correctly
  - Plaintext key returned only once

**Validation**:

- API keys created successfully
- Secure generation and storage

**Risk**: Low

---

### Step 7.2: API Key Validation Middleware

**Goal**: Support API key authentication in GraphQL context

**Tasks**:

- Update AuthContextProvider:
  - Check for `X-API-Key` header
  - If present:
    1. Hash provided key
    2. Query `api_keys` by key_hash
    3. Verify key exists and not revoked
    4. Fetch business_id and role_id
    5. Call PermissionResolutionService.resolvePermissions({ type: 'apiKey', ... })
    6. Set AuthContext:
       ```typescript
       {
         authType: 'apiKey',
         tenant: { businessId },
         user: { roleId, permissions, emailVerified: true }
       }
       ```
    7. Update last_used_at (hourly, async to avoid write amplification)
- Add tests:
  - Valid API key authenticates
  - Invalid key rejected
  - Permissions resolved correctly
  - last_used_at updated

**Validation**:

- API keys work alongside JWT
- Same permission system for both auth types

**Risk**: Medium (extends auth flow)

---

### Step 7.3: API Key Management Mutations

**Goal**: Allow management of API keys

**Tasks**:

- Add to schema:
  ```graphql
  type Mutation {
    listApiKeys: [ApiKey!]! @requiresAuth
    revokeApiKey(id: ID!): Boolean! @requiresAuth
  }
  ```
- Create resolvers:
  - listApiKeys: query by business_id (from auth context)
  - revokeApiKey: delete from api_keys, check ownership
- Add tests:
  - Keys listed for correct business only
  - Revoke works and logs audit trail

**Validation**:

- API key lifecycle manageable

**Risk**: Low

---

### Step 7.4: Scraper Role Integration Test

**Goal**: Verify scraper can insert transactions via API key

**Tasks**:

- Create integration test:
  1. Generate API key with role='scraper'
  2. Call insertTransaction mutation with X-API-Key header
  3. Verify transaction inserted
  4. Verify RLS enforced (scraper cannot access other business data)
  5. Verify permissions limited (scraper cannot issue documents)
- Add end-to-end test with actual scraper service

**Validation**:

- Scraper role works as designed
- Limited permissions enforced

**Risk**: Low

---

## Phase 8: Frontend Integration (Week 9)

### Step 8.1: Update Login Page

**Goal**: Integrate login mutation into existing login page

**Tasks**:

- Update `packages/client/src/pages/login-page.tsx`:
  - Change form field from `username` to `email`
  - Call `login` mutation with email/password
  - Store access token in React context
  - Handle errors:
    - Invalid credentials
    - Unverified email (show verification banner)
  - Redirect to dashboard on success
- Add tests:
  - Form submits correctly
  - Errors displayed
  - Successful login redirects

**Validation**:

- Users can log in via UI

**Risk**: Low

---

### Step 8.2: Auth Context Provider (React)

**Goal**: Manage authentication state in client

**Tasks**:

- Create `packages/client/src/contexts/auth-context.tsx`
- Implement context:
  ```typescript
  interface AuthContextValue {
    isAuthenticated: boolean
    currentUser: User | null
    login: (email: string, password: string) => Promise<void>
    logout: () => Promise<void>
    refreshToken: () => Promise<void>
  }
  ```
- Implement provider:
  - Store access token in memory (not localStorage - XSS risk)
  - Refresh token automatic (before expiry)
  - Handle UNAUTHENTICATED errors globally
- Add tests:
  - Auth state managed correctly
  - Auto-refresh works
  - Logout clears state

**Validation**:

- Auth state available throughout app

**Risk**: Low

---

### Step 8.3: Protected Route Component

**Goal**: Restrict unauthenticated access

**Tasks**:

- Create `packages/client/src/components/protected-route.tsx`
- Implement component:
  - Check `authContext.isAuthenticated`
  - If false: redirect to /login
  - If true: render children
- Wrap protected pages with component
- Add tests:
  - Authenticated users see content
  - Unauthenticated users redirected

**Validation**:

- Routes protected correctly

**Risk**: Low

---

### Step 8.4: Urql Client Configuration

**Goal**: Configure GraphQL client for cookie-based auth

**Tasks**:

- Update Urql client setup:
  - Set `credentials: 'include'` (send cookies)
  - Add error exchange:
    - Catch UNAUTHENTICATED errors
    - Attempt token refresh
    - Retry original request
    - If refresh fails: redirect to login
  - Add auth exchange (if needed for Authorization header)
- Add tests:
  - Cookies sent with requests
  - Auto-refresh on 401
  - Redirect on refresh failure

**Validation**:

- Client maintains authenticated session

**Risk**: Low

---

### Step 8.5: Email Verification Banner

**Goal**: Prompt unverified users to verify email

**Tasks**:

- Create `packages/client/src/components/email-verification-banner.tsx`
- Show banner when:
  - User authenticated but emailVerified === false
  - Mutation fails with EMAIL_NOT_VERIFIED error
- Banner actions:
  - "Resend Verification Email" button
  - Dismiss (but show again on next mutation error)
- Add tests:
  - Banner appears for unverified users
  - Resend works
  - Banner dismisses

**Validation**:

- Users guided to verify email

**Risk**: Low

---

### Step 8.6: Invitation Acceptance Flow

**Goal**: Allow users to accept invitations via UI

**Tasks**:

- Create `/accept-invitation/:token` route
- Create accept invitation page:
  - Pre-fill email from invitation (fetch via query)
  - Form for name and password
  - Call acceptInvitation mutation
  - On success: redirect to dashboard (logged in automatically)
- Add tests:
  - Valid token shows form
  - Invalid/expired token shows error
  - Successful acceptance logs user in

**Validation**:

- Invitation flow complete

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
  - Login: 5 attempts per 15 minutes per IP
  - acceptInvitation: 10 attempts per hour per IP
  - requestEmailVerification: 3 requests per hour per user
- Use Redis for distributed rate limiting (if multi-instance)
- Add tests:
  - Rate limits enforced
  - Limits reset after window
  - Error messages clear

**Validation**:

- Brute-force attacks mitigated

**Risk**: Low

---

### Step 9.4: Audit Log Analysis Dashboard

**Goal**: Make audit logs actionable

**Tasks**:

- Create read-only queries for audit logs:
  - Recent logins per business
  - Failed login attempts
  - Permission changes
  - Sensitive data access
- Add GraphQL query:
  ```graphql
  type Query {
    auditLogs(businessId: ID, userId: ID, action: String, limit: Int): [AuditLog!]! @requiresAuth
  }
  ```
- (Optional) Create admin dashboard page
- Add tests:
  - Queries return correct logs
  - RLS enforced (users see only their business logs)

**Validation**:

- Audit trail useful for compliance and investigations

**Risk**: Low

---

### Step 9.5: Security Hardening Checklist

**Goal**: Final security review before production

**Tasks**:

- [ ] All passwords hashed with bcrypt (min 10 rounds)
- [ ] JWT secrets strong and rotated (min 256-bit)
- [ ] Refresh tokens stored as hashes only
- [ ] API keys stored as hashes only
- [ ] HttpOnly, Secure, SameSite cookies configured
- [ ] CORS configured correctly (whitelist origins)
- [ ] Rate limiting on all public endpoints
- [ ] RLS enabled on all tenant tables
- [ ] ESLint rule prevents direct pool access in resolvers
- [ ] All GraphQL mutations have authorization checks
- [ ] Audit logs capture all security events
- [ ] Error messages don't leak sensitive info (e.g., "user not found" vs "invalid credentials")
- [ ] SQL injection prevented (parameterized queries only)
- [ ] XSS prevented (no dangerouslySetInnerHTML, CSP headers)
- [ ] Dependencies audited (`npm audit`, Dependabot)

**Validation**:

- Security checklist 100% complete

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
  - Login mutation: < 500ms (p95)
  - Database query time: < 50ms (p95)
  - RLS overhead: < 20% vs non-RLS
- Set up ongoing monitoring:
  - Application metrics (Prometheus/Grafana)
  - Database metrics (pg_stat_statements)
  - Error rate tracking
  - Alerts for degradation

**Validation**:

- Performance meets SLAs
- Monitoring captures issues

**Risk**: Low

---

## Phase 10: Migration from Legacy System (Week 11-12)

### Step 10.1: Dual-Write Period

**Goal**: Maintain backward compatibility during migration

**Tasks**:

- Implement dual-write for user operations:
  - Writes go to both new `users` and legacy `legacy_business_users`
  - Reads prefer new tables, fallback to legacy
- Add feature flag: `USE_NEW_AUTH_SYSTEM` (default: false)
- Gradual rollout:
  - Week 1: Enable for internal users
  - Week 2: Enable for 10% of businesses
  - Week 3: Enable for 50% of businesses
  - Week 4: Enable for 100% of businesses
- Monitor for issues

**Validation**:

- No data inconsistencies
- Both systems functional

**Risk**: Medium (data synchronization complexity)

---

### Step 10.2: Data Reconciliation

**Goal**: Verify new system matches legacy

**Tasks**:

- Create reconciliation script:
  - Compare user counts (legacy vs new)
  - Compare business associations
  - Flag discrepancies
- Run daily during dual-write period
- Fix any inconsistencies found

**Validation**:

- New system complete and accurate

**Risk**: Low

---

### Step 10.3: Legacy System Deprecation

**Goal**: Turn off old authentication

**Tasks**:

- Once `USE_NEW_AUTH_SYSTEM` at 100% for 2 weeks:
  - Stop dual-writes
  - Archive legacy auth code (don't delete yet)
  - Update documentation
- Monitor for 1 week
- If stable: delete legacy code in follow-up PR

**Validation**:

- New system fully operational
- No rollback needed

**Risk**: Low (by this point, new system proven)

---

## Summary Metrics

**Total Timeline**: 12 weeks (can be parallelized in some areas)

**Steps**: 60+ individual steps across 10 phases

**Risk Distribution**:

- Low Risk: 35 steps
- Medium Risk: 18 steps
- High Risk: 7 steps

**Testing Coverage**:

- Unit tests: Every service/utility function
- Integration tests: All GraphQL mutations/queries
- E2E tests: Critical user flows (login, invitation, permissions)
- Load tests: Production readiness validation

**Key Success Metrics**:

- Zero cross-tenant data leaks (tested via integration tests)
- < 20% RLS performance overhead (measured via load tests)
- 100% security checklist completion
- All migrations reversible with rollback plans
- Comprehensive audit trail for all security events

---

## Next Steps

This blueprint should be transformed into:

1. **Jira/GitHub Issues**: One issue per step (or grouped logically)
2. **Implementation Prompts**: Detailed prompts for LLM code generation (see `prompt_plan.md`)
3. **Test Plan**: Comprehensive test scenarios for QA
4. **Deployment Plan**: Staging → Production rollout strategy
