## Specification: User Management and Role-Based Access Control (RBAC)

### Critical Risks (Showstoppers)

- **Tenant isolation leakage via pooled connections**: The implementation must use
  `BEGIN; SET LOCAL app.current_business_id = ...; SET LOCAL app.current_user_id = ...; COMMIT;` for
  every request. Any query executed outside a transaction is forbidden.
- **Ambiguous business ownership**: The implementation must define deterministic backfill rules for
  legacy tables that do not carry a `business_id` (see Transition State Management). Rows without
  resolvable ownership must be quarantined and excluded by RLS.
- **Singleton provider cache leakage**: The implementation must ensure all providers caching
  tenant-specific data use `Scope.Operation` or tenant-prefixed cache keys to prevent cross-tenant
  data exposure (see Provider Cache Isolation Strategy).
- **Connection pool exhaustion**: With one connection held per GraphQL operation, ensure adequate
  pool sizing (50-100 connections for production) and implement query timeouts to prevent pool
  starvation. Note: RLS policies do NOT create table-level locks; PostgreSQL's MVCC ensures
  concurrent operations remain non-blocking.

### 1. Overview

This document outlines the implementation of a new user management system for the Accounter
application. The new system will replace the current basic authentication with a robust, secure, and
scalable solution featuring personal user accounts, an invitation-based workflow, and granular
role-based access control (RBAC).

**Authentication Strategy**: The system uses **Auth0** as an external identity provider for user
authentication, handling email/password credentials, JWT token management, session handling, email
verification, and future enhancements like MFA and social logins. All user-facing authentication
(login, signup, password reset) is delegated to Auth0's Universal Login, while **business
authorization, permissions, and API key management remain fully local** to maintain control over
multi-tenant access policies and compliance requirements.

**Migration Strategy**: The Auth0 integration follows a **parallel build and safe cutover** approach
to ensure zero-downtime migration:

- **Phase 1-3** (Infrastructure): Build Auth0 verification infrastructure alongside existing
  authentication (files named with `-v2` suffix). Existing auth remains fully functional.
- **Phase 4** (Activation): **Frontend Auth0 UI deployed first** (dual-auth support), then backend
  switches to Auth0-only after frontend verified. **Zero downtime** - users always have Auth0 login
  available before backend requires it.
- **Phase 5** (Cleanup): Remove old authentication code after 7 days of stability, rename v2 files
  to standard names.

**Critical Sequencing for Zero-Downtime**:

1. **Step 4.6** (Frontend First): Deploy Auth0 React SDK with dual-auth UI (users can choose legacy
   or Auth0)
2. **Step 4.7** (Backend Switch): Backend switches to Auth0-only **after** frontend verified working
3. Result: Users have Auth0 login UI available before backend requires it - **no lockout window**

### 2. Requirements

- **Personal User Accounts**: Users must be able to create and manage their own accounts via Auth0,
  separate from business entities.
- **Authentication**:
  - **Auth0 Integration**: Email/password authentication, credential storage, and user session
    management are handled by Auth0.
  - **JWT Verification**: The GraphQL server must verify Auth0-issued JWTs (RS256 signature) and
    extract user identity from the `sub` claim.
  - **Token Strategy** (Auth0-managed):
    - **Access Token**: Short-lived (15 minutes), issued by Auth0, sent by client in
      `Authorization: Bearer <token>` header, verified by server for API requests. Stored in memory
      by Auth0 SDK (not in cookies).
    - **Refresh Token**: Long-lived (7 days), stored by Auth0 SDK in browser localStorage, used
      automatically to obtain new access tokens when they expire. Supports multi-device sessions and
      automatic rotation.
  - **API Keys**: Implement local API Key authentication for the `scraper` role to support
    long-running, automated processes without expiration issues. API keys are fully local and
    independent of Auth0, sent in `X-API-Key` header.
- **User Onboarding**:
  - New users must be invited to a business by an administrator (`business owner`).
  - **Pre-Registration Invitation Flow**:
    1. Admin creates invitation → Server generates local user UUID and calls Auth0 Management API to
       create user with `blocked: true` status
    2. Auth0 sends password setup email to invited user (Auth0-managed email delivery)
    3. User sets password via Auth0 link → User attempts login → Auth0 redirects to application
    4. Server verifies invitation token (single-use), unblocks Auth0 user, links Auth0 ID to local
       business/role in `business_users` table
    5. User gains immediate business access upon first login
  - **Multi-Business Support**: If user is invited to additional businesses after initial
    activation, they accept invitations while authenticated, linking new business/role to existing
    Auth0 account (no additional Auth0 user creation)
  - **Email Verification**: Fully managed by Auth0 during password setup flow. Email changes are
    handled via Auth0's user profile management (out of scope for initial implementation)
  - **Invitation Token Security**: Tokens are single-use (marked with `accepted_at` timestamp) and
    expire after 7 days. Expired invitations trigger cleanup job to delete unused blocked Auth0
    accounts
- **Roles and Permissions**:
  - **Roles (In Scope)**: The system must support the following roles with role-based authorization:
    - `business owner`: Full access, including user management.
    - `employee`: View-only access to main business info. No access to payroll or other sensitive
      data. Cannot perform actions/changes.
    - `accountant`: Almost full access, but cannot issue documents (e.g., invoices).
    - `scraper`: Can only insert transactions.
  - **Granular Permissions (Future Work)**: Detailed permission-based authorization (e.g.,
    `manage:users`, `issue:docs`, `view:salary`, `insert:transactions`) will be implemented in a
    later phase. The initial implementation uses role-based checks only. However, the database
    schema includes `permissions`, `role_permissions`, and override tables to support future
    migration without breaking changes.
- **Data-Level Security**: The system must enforce data access restrictions based on the user's
  role. For example, an `employee` should not be able to view salary information.
  - **Row-Level Security (RLS)**: Must be implemented at the database level to strictly isolate data
    between businesses.
- **Audit Logging**: The system must verify and record critical security and business actions (e.g.,
  login, user creation, sensitive data access) for compliance and security monitoring.
- **Future-Proofing**:
  - **Social Logins**: Auth0 provides built-in support for social identity providers (Google,
    GitHub, Microsoft, etc.). Enabling social logins requires only Auth0 tenant configuration with
    zero code changes.
  - **Multi-Factor Authentication (MFA)**: Auth0 supports MFA (TOTP, SMS, Push notifications) out of
    the box. Enabling MFA for high-security accounts requires only Auth0 tenant configuration.
  - **Email Customization**: Auth0 email templates can be customized for branding consistency
    (future enhancement, not in scope for initial implementation).
  - **User-Level Multi-Tenancy**: While the database schema (`business_users`) supports users
    belonging to multiple businesses, the initial implementation provides direct dashboard access to
    the invited business on first login. Full multi-business UI switching is a future enhancement.
  - **Granular Permissions (Future Phase - Not in Current Scope)**:
    - **Current Implementation**: Authorization is purely role-based. Authorization services check
      `authContext.roleId` to determine access rights.
    - **Future Migration Path** (zero breaking changes):
      1. Database tables for permissions infrastructure already exist from initial migration
         (`permissions`, `role_permissions`, `user_permission_overrides`,
         `api_key_permission_overrides`)
      2. Implement `PermissionResolutionService` to map roles to permissions and merge overrides
      3. Build admin UI to manage permission grants/revokes per user or API key
      4. Update authorization services to check `authContext.permissions` array instead of role
         names
    - **Use Cases Enabled (Future)**:
      - "This employee can view salaries for their department only" → Grant `view:salary` + add
        department filtering in service layer
      - "This API key can only read transactions, not create them" → Revoke `insert:transactions`
        from scraper role
      - "This accountant cannot approve invoices over $10k" → Create custom permission + enforce
        limit in business logic
      - "Temporarily grant this user extra permissions for a migration task" → Add grant with expiry
    - **Parallel Treatment**: Both user accounts and API keys will use the same permission
      resolution mechanism when implemented

### 3. Architecture and Implementation Details

#### 3.1. Database Schema

A new database migration will be created in `packages/migrations/src`. This migration will create
the following tables:

**Note**: User authentication data (`users`, `user_accounts`, `user_refresh_tokens`,
`email_verification_tokens`) is fully managed by Auth0 and does not exist in the local database.
Only the business-to-user mapping is stored locally.

- **`business_users`**: Links Auth0 users to businesses and roles (replaces the existing legacy
  `users` table concept).
  - `user_id`: `uuid`, primary key, generated when invitation is created
  - `auth0_user_id`: `text`, unique, nullable (populated after first login, stores Auth0 user
    identifier like `auth0|507f1f77bcf86cd799439011`)
  - `business_id`: `uuid`, foreign key to `businesses_admin.id`
  - `role_id`: `text`, foreign key to `roles.id`
  - `created_at`: `timestamptz`
  - `updated_at`: `timestamptz`
  - _Note: This structure supports M:N relationships (one Auth0 user can be linked to multiple
    businesses). Initial application logic provides direct dashboard access to invited business on
    first login._
  - Primary key on (`user_id`, `business_id`)
  - Unique constraint on `auth0_user_id` (one Auth0 identity maps to one local user_id)
- **`roles`**: Defines available roles.
  - `id`: `text`, primary key (slug, e.g., 'business_owner', 'employee')
  - `name`: `text`, unique, not null (Display name, e.g., 'Business Owner')
- **`permissions`**: (Future) Defines available permissions. Not populated initially - authorization
  uses role checks only.
  - `id`: `text`, primary key (slug, e.g., 'manage:users', 'issue:docs')
  - `name`: `text`, unique, not null (Display name, e.g., 'Manage Users')
  - Note: Table created in initial migration for future-proofing, but permission-based authorization
    is out of scope for this phase
- **`role_permissions`**: (Future) Maps permissions to roles. Not populated initially.
  - `role_id`: `text`, foreign key to `roles.id`
  - `permission_id`: `text`, foreign key to `permissions.id`
  - Primary key on (`role_id`, `permission_id`)
  - Note: Table created in initial migration to avoid schema changes when implementing
    permission-based authorization later
- **`user_permission_overrides`**: (Future) Stores user-specific permission grants/revokes.
  - `id`: `uuid`, primary key
  - `user_id`: `uuid`, foreign key to `business_users.user_id`
  - `business_id`: `uuid`, foreign key to `businesses_admin.id`
  - `permission_id`: `text`, foreign key to `permissions.id`
  - `grant_type`: `grant_type_enum` (ENUM: 'grant', 'revoke')
  - `created_at`: `timestamptz`
  - Unique constraint on (`user_id`, `business_id`, `permission_id`)
  - Note: Not populated initially, but schema prepared for future granular permissions
- **`api_key_permission_overrides`**: (Future) Stores API-key-specific permission grants/revokes.
  - `id`: `uuid`, primary key
  - `api_key_id`: `uuid`, foreign key to `api_keys.id`
  - `permission_id`: `text`, foreign key to `permissions.id`
  - `grant_type`: `grant_type_enum` (ENUM: 'grant', 'revoke')
  - `created_at`: `timestamptz`
  - Unique constraint on (`api_key_id`, `permission_id`)
  - Note: Not populated initially, but schema prepared for future granular permissions
- **`invitations`**: Stores pending user invitations.
  - `id`: `uuid`, primary key
  - `business_id`: `uuid`, foreign key to `businesses_admin.id`
  - `email`: `text`, not null
  - `role_id`: `text`, foreign key to `roles.id`
  - `token`: `text`, unique, not null (a cryptographically secure 64-character random string)
  - `auth0_user_created`: `boolean`, default false (tracks whether Auth0 Management API call
    succeeded)
  - `auth0_user_id`: `text`, nullable (stores Auth0 user ID from pre-registration, used for cleanup)
  - `invited_by_user_id`: `uuid`, foreign key to `business_users.user_id` (tracks which admin
    created the invitation)
  - `accepted_at`: `timestamptz`, nullable (single-use token tracking, NULL until accepted)
  - `expires_at`: `timestamptz`, not null (typically 7 days from creation)
  - `created_at`: `timestamptz`
- **`api_keys`**: Stores API keys for the scraper role and other programmatic access.
  - `id`: `uuid`, primary key
  - `business_id`: `uuid`, foreign key to `businesses_admin.id` (API keys are linked to a business,
    not a specific human user)
  - `role_id`: `text`, foreign key to `roles.id` (The role assigned to this key, e.g., 'scraper')
  - `key_hash`: `text`, not null, unique (store hashed version of the key)
  - `name`: `text` (e.g., "Production Scraper")
  - `last_used_at`: `timestamptz` (optional, for auditing - updated hourly to prevent write
    amplification)
  - `created_at`: `timestamptz`
- **`audit_logs`**: Stores a trail of critical actions for security and compliance.
  - `id`: `uuid`, primary key
  - `business_id`: `uuid`, foreign key to `businesses_admin.id`, nullable
  - `user_id`: `uuid`, foreign key to `business_users.user_id`, nullable (nullable to support system
    actions or failed logins)
  - `auth0_user_id`: `text`, nullable (stores Auth0 identity for audit trail)
  - `action`: `text`, not null (e.g., 'USER_LOGIN', 'INVOICE_UPDATE', 'PERMISSION_CHANGE')
  - `entity`: `text`, nullable (e.g., 'Invoice', 'User')
  - `entity_id`: `text`, nullable (ID of the affected record)
  - `details`: `jsonb`, nullable (stores before/after state or metadata)
  - `ip_address`: `text`, nullable
  - `created_at`: `timestamptz`

#### 3.2. Post-Migration Security & RLS

- **Row-Level Security (RLS)**: Enforce multi-tenancy at the Postgres engine level to prevent
  cross-business data leakage.
  - **Policy Strategy**:
    - Enable RLS on all sensitive tables (`transactions`, `documents`, `salary_records`, etc.).
    - Create policies that query a session variable (e.g., `app.current_business_id`) to compare
      against the row's `business_id`.
  - **Application Logic**:
    - The GraphQL middleware (auth plugin) will set postgres configuration variables with
      `SET LOCAL` inside a transaction: `app.current_business_id`, `app.current_user_id`, and
      `app.auth_type`.
    - Any query attempted without this variable set (or with a mismatch) will return zero rows or be
      rejected.
    - **RLS Context Bridge (Phase 3-4 Transition)**:
      - RLS is enabled in Phase 3 (before Auth0 integration in Phase 4)
      - Temporary solution: Existing auth plugin updated to set `app.current_business_id` via
        `SET LOCAL` to support RLS during transition period
      - Permanent solution: `TenantAwareDBClient` sets RLS context (activated in Phase 4.8)
      - Cleanup: Temporary bridge code removed in Phase 4.8 when `TenantAwareDBClient` becomes
        active
    - **CRITICAL**: All database access MUST go through a `TenantAwareDBClient` that wraps queries
      in transactions:

```typescript
// packages/server/src/shared/helpers/tenant-db-client.ts
import { Injectable, Scope } from 'graphql-modules'
import { DBProvider } from '@modules/app-providers/db.provider'
import type { PoolClient, QueryResult } from 'pg'

@Injectable({
  scope: Scope.Operation // Request-scoped: one instance per GraphQL operation
})
export class TenantAwareDBClient {
  private activeClient: PoolClient | null = null
  private transactionDepth = 0

  constructor(
    private dbProvider: DBProvider, // Singleton pool manager
    @Inject(AUTH_CONTEXT) private authContext: AuthContext | null = null // Request-scoped, nullable with default
  ) {}

  // Note: AUTH_CONTEXT injection requires default null value because the token
  // is not registered until Phase 4 (Auth0 activation). Phase 2 creates the
  // infrastructure but doesn't activate it.

  async query<T = any>(queryText: string, params?: any[]): Promise<QueryResult<T>> {
    // Reuse existing transaction if within a GraphQL operation
    if (this.activeClient) {
      return this.activeClient.query<T>(queryText, params)
    }

    // Otherwise create a new transaction for this single query
    return this.transaction(async client => client.query<T>(queryText, params))
  }

  async transaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
    // Support nested transactions (use savepoints)
    const isNested = this.transactionDepth > 0

    if (isNested) {
      this.transactionDepth++
      const savepointName = `sp_${this.transactionDepth}`
      await this.activeClient!.query(`SAVEPOINT ${savepointName}`)
      try {
        const result = await fn(this.activeClient!)
        await this.activeClient!.query(`RELEASE SAVEPOINT ${savepointName}`)
        this.transactionDepth--
        return result
      } catch (error) {
        await this.activeClient!.query(`ROLLBACK TO SAVEPOINT ${savepointName}`)
        this.transactionDepth--
        throw error
      }
    }

    // Start a new top-level transaction
    const client = await this.dbProvider.pool.connect()
    this.activeClient = client
    this.transactionDepth = 1

    try {
      await client.query('BEGIN')

      // Set transaction-scoped RLS context
      if (this.authContext.tenant?.businessId) {
        await client.query('SET LOCAL app.current_business_id = $1', [
          this.authContext.tenant.businessId
        ])
      }
      if (this.authContext.user?.userId) {
        await client.query('SET LOCAL app.current_user_id = $1', [this.authContext.user.userId])
      }
      if (this.authContext.authType) {
        await client.query('SET LOCAL app.auth_type = $1', [this.authContext.authType])
      }

      const result = await fn(client)
      await client.query('COMMIT')
      return result
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      this.transactionDepth = 0
      this.activeClient = null
      client.release()
    }
  }

  // Cleanup hook for GraphQL context disposal
  async dispose() {
    if (this.activeClient) {
      try {
        await this.activeClient.query('ROLLBACK')
      } catch {}
      this.activeClient.release()
      this.activeClient = null
    }
  }
}
```

    *   **Architectural Separation**:
        *   `DBProvider` (Singleton): **Already exists** at `packages/server/src/modules/app-providers/db.provider.ts`. Manages the connection pool, exposes public `pool` property for system-level operations (migrations, background jobs that bypass RLS). Includes `healthCheck()` method for connection validation.
        *   `TenantAwareDBClient` (Request-scoped): Wraps `DBProvider.pool` with tenant isolation, the ONLY DB client allowed in GraphQL resolvers
        *   **ESLint Enforcement**: Configure rule to prevent direct `DBProvider` imports in resolver files

    *   **Performance & Scalability Considerations**:
        *   **Transaction Reuse**: The `TenantAwareDBClient` maintains a single active transaction per GraphQL operation, avoiding transaction overhead for multi-query operations
        *   **Connection Pool Sizing**: With one connection per concurrent request, ensure pool size ≥ expected concurrent users. Recommended: `max_connections = (core_count * 2) + effective_spindle_count`, typically 50-100 for production
        *   **Long-Running Queries**: Operations exceeding 5 seconds should be moved to background jobs to avoid pool exhaustion
        *   **Read Replicas** (Future): Read-only queries can bypass RLS by routing to replicas with tenant filtering in application layer, reducing primary DB load
        *   **PostgreSQL MVCC**: Row-Level Security policies do NOT create table locks; concurrent transactions can read/write independently without blocking
        *   **Monitoring**: Track `pg_stat_activity` for connection pool saturation and `pg_stat_statements` for slow RLS-protected queries

    *   **Why RLS is the Primary Security Boundary**:
        *   **Defense in Depth**: Even if application-layer auth has bugs, RLS prevents data leaks
        *   **Automatic Enforcement**: All queries (including raw SQL, ORMs, manual queries) are filtered
        *   **No Bypass Possible**: Unless using system-level superuser connection
        *   **Application-layer auth is supplementary**: Provides better UX (early failures) and business logic enforcement

    *   **Bypass**:
        *   System-level maintenance tasks can use a "super user" connection that bypasses RLS, but standard application connections must perform as the limited user.
    *   **RLS Function**:

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

#### 3.2.1. Macro-Level Flaw Detection (Decisions)

- **Single Points of Failure**: The implementation must enforce request-scoped transactions for RLS
  and replace single refresh token storage with multi-session storage.
- **Data Leakage Vectors**: The implementation must create DataLoaders per request, must never share
  caches across requests, and must enforce RLS for all tenant tables and views.
- **Architectural Debt**: The implementation must support an explicit `active_business_id` per
  session and must avoid embedding immutable permissions without rotation safeguards.

#### 3.2.1.1. Provider Cache Isolation Strategy

**Current Risk**: Singleton providers with shared caches (e.g., `BusinessesProvider`) leak data
across tenants because cache keys lack tenant context.

**Required Changes**:

1. **Change Provider Scope** (Recommended):

```typescript
// BEFORE: Singleton with global cache (UNSAFE)
@Injectable({ scope: Scope.Singleton })
export class BusinessesProvider {
  cache = getCacheInstance({ stdTTL: 60 * 5 }) // Shared across all requests!
}

// AFTER: Operation-scoped with request-isolated cache (SAFE)
@Injectable({ scope: Scope.Operation })
export class BusinessesProvider {
  cache = getCacheInstance({ stdTTL: 60 * 5 }) // One cache per request

  constructor(
    private dbProvider: DBProvider,
    private authContext: AuthContext // Inject tenant context
  ) {}
}
```

2. **Alternative - Tenant-Prefixed Cache Keys** (for performance-critical singletons):

```typescript
@Injectable({ scope: Scope.Singleton })
export class BusinessesProvider {
  cache = getCacheInstance({ stdTTL: 60 * 5 })

  constructor(private dbProvider: DBProvider) {}

  // Tenant context must be passed explicitly to cache-using methods
  public getBusinessByIdLoader(tenantId: string) {
    return new DataLoader((ids: readonly string[]) => this.batchBusinessesByIds(ids, tenantId), {
      cacheKeyFn: id => `tenant:${tenantId}:business:${id}`, // CRITICAL: Tenant prefix
      cacheMap: this.cache
    })
  }

  public async getAllBusinesses(tenantId: string) {
    const cacheKey = `tenant:${tenantId}:all-businesses`
    const cached = this.cache.get(cacheKey)
    // ...
  }
}
```

3. **Migration Checklist for All Providers**:
   - [ ] Audit all `@Injectable({ scope: Scope.Singleton })` providers
   - [ ] Identify which providers cache tenant-specific data
   - [ ] Convert to `Scope.Operation` OR add tenant prefixing
   - [ ] Providers that can remain Singleton:
     - System configuration providers (non-tenant data)
     - Pure utility services with no state
     - External API clients (if tenant context passed per-method)
   - [ ] Add integration tests verifying cache isolation between tenants

**Known Providers Requiring Audit** (based on current codebase):

- `packages/server/src/modules/financial-entities/providers/businesses.provider.ts` - Check if
  Singleton with cache
- `packages/server/src/modules/financial-entities/providers/financial-entities.provider.ts` - Check
  if Singleton with cache
- `packages/server/src/modules/admin-context/providers/admin-context.provider.ts` - **Currently**
  uses `Scope.Singleton` with shared cache (UNSAFE), **refactored in Phase 2.7** to
  `Scope.Operation` with request-scoped cache
- `packages/server/src/plugins/admin-context-plugin.ts` - Uses global cache (UNSAFE), removed in
  Phase 4.9 when provider activated
- Any provider with `DataLoader` - Must be `Scope.Operation` (DataLoaders are already request-scoped
  if provider is Operation-scoped)

**Cache Isolation Test Pattern**:

```typescript
// packages/server/src/modules/__tests__/cache-isolation.integration.test.ts
import { describe, it, expect } from 'vitest'
import { createTestContext } from '../test-utils'

describe('Cache Isolation', () => {
  it('should not leak data between tenants', async () => {
    // Create two authenticated contexts for different businesses
    const context1 = await createTestContext({ businessId: 'business-a' })
    const context2 = await createTestContext({ businessId: 'business-b' })

    // Access same resource via provider
    const result1 = await context1.injector.get(SomeProvider).getData('entity-123')
    const result2 = await context2.injector.get(SomeProvider).getData('entity-123')

    // Verify results are isolated by tenant
    expect(result1).not.toEqual(result2)
  })
})
```

4. **DataLoader Instance Creation**:

```typescript
// In GraphQL context creation (per-request):
export const createGraphQLContext = async (request, pool, auth) => {
  const db = new TenantAwareDBClient(new DBProvider(pool), auth)

  // Create fresh DataLoader instances per request
  const businessesProvider = new BusinessesProvider(db, auth)
  const chargesProvider = new ChargesProvider(db, auth)

  return {
    db,
    auth,
    dataloaders: {
      businesses: businessesProvider.getBusinessByIdLoader,
      charges: chargesProvider.getChargeByIdLoader
    }
  }
}
```

#### 3.2.2. Database Execution Blueprint (Multi-Tenant Migration)

- **Tables that must carry `business_id`**:
  - business_tax_category_match (owner_id)
  - business_trip_charges (charge_id => charges)
  - business_trips
  - business_trips_attendees (business_trip_id => business_trips)
  - business_trips_employee_payments (id => business_trips_transactions => business_trips)
  - business_trips_transactions (business_trip_id => business_trips)
  - business_trips_transactions_accommodations (id => business_trips_transactions => business_trips)
  - business_trips_transactions_car_rental (id => business_trips_transactions => business_trips)
  - business_trips_transactions_flights (id => business_trips_transactions => business_trips)
  - business_trips_transactions_match (business_trips_transaction_id => business_trips_transactions
    => business_trips)
  - business_trips_transactions_other (id => business_trips_transactions => business_trips)
  - business_trips_transactions_tns (id => business_trips_transactions => business_trips)
  - businesses (id => financial_entities)
  - businesses_admin (id => businesses => financial_entities)
  - businesses_green_invoice_match (business_id => businesses => financial_entities)
  - charge_balance_cancellation (charge_id => charges)
  - charge_spread (charge_id => charges)
  - charge_tags (charge_id => charges)
  - charge_unbalanced_ledger_businesses (charge_id => charges)
  - charges
  - charges_bank_deposits (charge_id => charges)
  - clients (business_id => businesses => financial_entities)
  - clients_contracts (client_id => clients => businesses => financial_entities)
  - corporate_tax_variables (corporate_id)
  - deel_invoices (document_id => documents => charges)
  - deel_workers (business_id => businesses => financial_entities)
  - depreciation (charge_id => charges)
  - dividends (business_id => businesses => financial_entities)
  - documents (charge_id => charges)
  - documents_issued (id => documents => charges)
  - dynamic_report_templates (owner_id)
  - employees (business_id => businesses => financial_entities)
  - financial_accounts (owner)
  - financial_accounts_tax_categories (financial_account_id => financial_accounts)
  - financial_bank_accounts (id => financial_accounts)
  - financial_entities (owner_id)
  - ledger_records (charge_id => charges)
  - misc_expenses (charge_id => charges)
  - pcn874 (business_id)
  - poalim_ils_account_transactions
  - salaries (employer)
  - tags
  - tax_categories (id => financial_entities)
  - transactions (charge_id => charges)
  - user_context (owner_id)

- **Locking Strategy** (5-Phase Low-Downtime Migration):
  - **Phase 1**: Add `business_id` columns as nullable (acquires brief ACCESS EXCLUSIVE lock, < 1
    second)
  - **Phase 2**: Backfill in batches of 10,000 rows with 1-second sleep between batches (background
    job, no downtime)
  - **Phase 3**: Validate 100% backfill completion (SELECT COUNT(\*) WHERE business_id IS NULL must
    = 0)
  - **Phase 4**: Add NOT NULL constraint (requires brief ACCESS EXCLUSIVE lock, < 5 seconds)
  - **Phase 5**: Create indexes `CONCURRENTLY` (2-10 minutes, non-blocking), then add foreign keys
    with `NOT VALID` and validate separately
  - **Total Downtime**: < 10 seconds per large table

- **Migration Naming Collision Resolution**:
  - The current `accounter_schema.users` table is actually a businesses table and MUST be renamed
    before creating the new `business_users` table:

```sql
-- Pre-migration: 2026-01-20-rename-users-to-legacy-businesses.sql
ALTER TABLE accounter_schema.users RENAME TO legacy_business_users;
-- Postgres automatically updates FK constraints

-- Main migration: 2026-01-21-create-user-auth-system.sql
-- Note: No 'users' table created (managed by Auth0)
CREATE TABLE accounter_schema.business_users (
  user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth0_user_id TEXT UNIQUE,  -- Populated on first login
  business_id UUID NOT NULL REFERENCES accounter_schema.businesses_admin(id),
  role_id TEXT NOT NULL REFERENCES accounter_schema.roles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT business_users_pk PRIMARY KEY (user_id, business_id)
);
-- ... other tables (roles, permissions, invitations, api_keys, audit_logs) ...

-- Post-migration: 2026-01-22-backfill-business-users.sql
-- Optional: Migrate existing legacy business owners to new system
-- Note: This creates local user_id entries without Auth0 accounts
-- Actual Auth0 accounts created when admins invite these users
INSERT INTO accounter_schema.business_users (user_id, business_id, role_id, auth0_user_id)
SELECT gen_random_uuid(), lbu.id, 'business_owner', NULL
FROM accounter_schema.legacy_business_users lbu;
```

#### 3.3. GraphQL Yoga + Modules Architecture

**Integration Pattern**: The server uses GraphQL Yoga as the execution layer and GraphQL Modules for
dependency injection and modular organization. Understanding their interaction is critical for
proper authentication implementation.

**Context Flow (4 Layers)**:

1. **Yoga Initial Context**: Created by Yoga for each HTTP request, contains `request`, `params`,
   `env`, `pool`
2. **Plugin Context Extension**: Plugins use `useExtendContext()` to add raw auth data
   (`rawAuth: { authType, token }`)
3. **Modules DI Processing**: Operation-scoped providers (like `AuthContextProvider`) process raw
   auth and create structured `AuthContext`
4. **Injection Tokens**: Provide typed access to auth context across all modules via `AUTH_CONTEXT`
   token

**Key Architecture Principles**:

- **Separation of Concerns**: Plugins handle HTTP-level concerns (header parsing), Providers handle
  business logic (JWT verification, permission resolution)
- **Operation Scope**: Auth-related providers MUST use `Scope.Operation` to ensure request isolation
  and prevent data leakage
- **Injection Tokens**: Use `InjectionToken` for cross-module access to auth context (e.g.,
  `AUTH_CONTEXT`, `ADMIN_CONTEXT`)
- **No Direct Pool Access**: Resolvers MUST NOT access `pool` directly; use `TenantAwareDBClient`
  injected via DI
- **Parallel Migration**: New auth infrastructure built alongside existing (v2 files) until safe
  cutover in Phase 4

**Plugin Order** (Critical for Correctness):

```typescript
const yoga = createYoga({
  plugins: [
    authPlugin(), // 1. Parse auth headers → add rawAuth to Yoga context
    useGraphQLModules(app), // 2. Modules DI processes AuthContextProvider
    adminContextPlugin(), // 3. Load business-specific config (uses AUTH_CONTEXT)
    useDeferStream(),
    useHive(/* ... */)
  ]
})
```

**Auth Plugin Responsibilities** (Minimal - Delegates to Modules):

- Extract `Authorization: Bearer <token>` or `X-API-Key` from headers
- Add `rawAuth: { authType: 'jwt' | 'apiKey', token: string }` to Yoga context
- **Does NOT**: Verify JWT, query database, or resolve permissions (delegated to
  `AuthContextProvider`)

**Migration Note**: During Phase 2-3, new auth plugin created as `auth-plugin-v2.ts` alongside
existing auth plugin. Existing plugin remains active until Phase 4 cutover.

**AuthContextProvider Responsibilities** (Core Auth Logic):

- Verify JWT signature using `jose` library and Auth0 JWKS endpoint
- Extract Auth0 user ID (`sub` claim) and map to local `user_id` via database lookup
- Fetch user's business/role associations from `business_users` table
- Return structured `AuthContext` object with `{ authType, user, tenant, accessTokenExpiresAt }`
- Injected as `AUTH_CONTEXT` token for use across all modules

**Migration Note**: During Phase 2-3, preparatory infrastructure is built alongside existing auth:

- `authPluginV2.ts` created (not registered in plugin array yet)
- `AuthContextProvider` created with `AUTH_CONTEXT` token (not registered in DI yet)
- `TenantAwareDBClient` created with nullable `AUTH_CONTEXT` injection (registered but unused)
- Existing auth provider remains fully active and functional
- **Phase 4.6**: Frontend Auth0 UI deployed with dual-auth support (users can choose legacy or
  Auth0)
- **Phase 4.7**: Backend switches to Auth0-only (frontend already has Auth0 UI - zero downtime)
- Result: Users always have a working login method throughout migration

**Injection Token Provisioning** (in `modules-app.ts`):

```typescript
export async function createGraphQLApp(env: Environment, pool: pg.Pool) {
  return createApplication({
    modules: [
      /* ... all modules */
    ],
    providers: [
      // ... existing providers
      {
        provide: AUTH_CONTEXT,
        scope: Scope.Operation,
        useFactory: async (context: any, authProvider: AuthContextProvider) => {
          return authProvider.getAuthContext() // Returns AuthContext | null
        },
        deps: [CONTEXT, AuthContextProvider]
      }
    ]
  })
}
```

**Usage in Resolvers/Services**:

```typescript
@Injectable({ scope: Scope.Operation })
export class ChargesService {
  constructor(
    @Inject(AUTH_CONTEXT) private auth: AuthContext | null,
    private db: TenantAwareDBClient
  ) {}

  async createCharge(input: ChargeInput) {
    if (!this.auth?.tenant?.businessId) {
      throw new GraphQLError('Unauthenticated', {
        extensions: { code: 'UNAUTHENTICATED' }
      })
    }

    // db.query automatically uses auth.tenant.businessId for RLS
    return this.db.query(/* ... */)
  }
}
```

#### 3.4. GraphQL API (`packages/server`)

A new `auth` module will be created under `packages/server/src/modules`.

**Note**: Authentication mutations (`login`, `signup`, `password reset`) are fully handled by Auth0
Universal Login and do not exist in the GraphQL API. The server's role is limited to JWT
verification, Auth0 user pre-registration during invitations, and business/role authorization.

- **Schema (`schema.graphql`)**:
  - **Audit Service**: Implement a dedicated `AuditService` to handle log ingestion.
    - Should be called asynchronously to avoid blocking user requests.
    - Must be integrated into critical flows: invitation creation, invitation acceptance, API key
      generation/revocation, and business logic events (e.g., `createInvoice`).
    - Should log both `user_id` (local UUID) and `auth0_user_id` (Auth0 identity) for complete audit
      trail.
  - **Types**: `User { id: ID!, email: String!, businesses: [BusinessRole!]! }`,
    `BusinessRole { businessId: ID!, businessName: String!, role: Role! }`, `Role`, `Permission`,
    `ApiKey { id: ID!, name: String!, lastUsedAt: String, createdAt: String! }`,
    `GenerateApiKeyPayload { apiKey: String! }`,
    `InvitationPayload { invitationUrl: String!, email: String!, expiresAt: String! }`.
  - **Mutations**:
    - `createInvitation(email: String!, role: String!, businessId: ID!): InvitationPayload!` -
      **Auth0 Integration**: (1) Generates secure invitation token and local `user_id` UUID, (2)
      Calls Auth0 Management API to create user with `blocked: true` and
      `app_metadata: { invitation_id, business_id, invited_by }`, (3) Stores invitation in DB with
      `auth0_user_created: true` and `auth0_user_id`, (4) Returns invitation URL. **Error
      Handling**: Detects Auth0 rate limits (429) and returns user-friendly error, fails immediately
      on other Auth0 errors with transaction rollback. Authorization: requires `manage:users`
      permission.
    - `acceptInvitation(token: String!): Boolean!` - **Auth0 Integration**: (1) Validates token is
      unused (`accepted_at IS NULL`) and not expired, (2) Marks token with `accepted_at = NOW()`
      (single-use), (3) Calls Auth0 Management API to unblock user (first acceptance only,
      subsequent invitations skip unblocking), (4) Updates `business_users.auth0_user_id` with Auth0
      `sub` claim from authenticated context, (5) Returns success. **Must be called while
      authenticated** (user logged in via Auth0 after password setup). For first invitation: user
      completes Auth0 password setup → logs in → app calls this mutation. For additional businesses:
      authenticated user accepts invitation to link another business.
    - `generateApiKey(businessId: ID!, name: String!, roleId: String!): GenerateApiKeyPayload!` -
      Generates a new API key for programmatic access linked to the specified business. Restricted
      to `business owner`.
    - `revokeApiKey(id: ID!): Boolean!` - Revokes an API key.
- **Services and Resolvers**:
  - **Auth0 JWT Verification**: Use `jose` library to verify RS256-signed JWTs from Auth0. Configure
    middleware to:
    1. Extract JWT from `Authorization: Bearer <token>` header
    2. Verify signature using Auth0's JWKS endpoint
       (`https://<tenant>.auth0.com/.well-known/jwks.json`)
    3. Validate `iss` (issuer), `aud` (audience), and `exp` (expiration) claims
    4. Extract `sub` claim (Auth0 user ID like `auth0|507f1f77bcf86cd799439011`)
  - **Auth0 Management API Integration**: Create `Auth0ManagementService` to handle user lifecycle:
    - **Get M2M Access Token**: Use client credentials flow with Auth0 Management API to obtain
      access token (cache for 24 hours)
    - **Create User**: `POST /api/v2/users` with payload
      `{ email, blocked: true, connection: 'Username-Password-Authentication', app_metadata: { invitation_id, business_id, invited_by } }`
    - **Unblock User**: `PATCH /api/v2/users/{auth0_user_id}` with payload `{ blocked: false }`
    - **Delete User**: `DELETE /api/v2/users/{auth0_user_id}` (for expired invitations cleanup)
    - **Rate Limit Handling**: Detect 429 responses, extract `X-RateLimit-Reset` header, return
      user-friendly error with retry-after time
  - **GraphQL Context Enrichment**: After Auth0 JWT verification, enrich GraphQL context with local
    user data:

```typescript
@Injectable({ scope: Scope.Operation })
export class AuthContextEnricher {
  constructor(
    private db: TenantAwareDBClient,
    private permissionResolver: PermissionResolutionService
  ) {}

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

    // Note: Permission resolution is future work - current implementation uses role-based checks
    // When permissions are implemented, add: permissions = await this.permissionResolver.resolvePermissions(...)

    return {
      auth0UserId: auth0UserId,
      userId: user_id,
      businessId: business_id,
      roleId: role_id,
      authType: 'user'
    }
  }
}
```

    *   **API Key Authentication**: Remains fully local (no Auth0 involvement):
        *   Extract API key from `X-API-Key` header
        *   Hash and lookup in `api_keys` table
        *   Fetch associated `business_id` and `role_id`
        *   Set `authContext.authType = 'apiKey'`, `authContext.roleId = role_id`, `authContext.businessId = business_id`
        *   Note: Permission resolution is future work - current implementation uses role-based checks
    *   **Permission Resolution Service** (Future Implementation - Not in Current Scope):
        *   When permission-based authorization is implemented in a future phase, create a unified `PermissionResolutionService` that works identically for both user JWT and API key authentication:
        *   Note: For the initial implementation, authorization checks use `authContext.roleId` directly (e.g., `if (roleId === 'business_owner')` or `if (!['business_owner', 'accountant'].includes(roleId))`)

```typescript
@Injectable({ scope: Scope.Operation })
export class PermissionResolutionService {
  constructor(private db: TenantAwareDBClient) {}

  /**
   * Resolves effective permissions for any authenticated subject (user or API key)
   * Resolution order: Base role permissions → Apply individual overrides → Return merged set
   */
  async resolvePermissions(subject: AuthSubject): Promise<string[]> {
    const basePermissions = await this.getRolePermissions(subject.roleId)

    // Future: Apply user/API key specific overrides (tables exist but initially empty)
    const overrides = await this.getPermissionOverrides(subject)

    return this.mergePermissions(basePermissions, overrides)
  }

  private async getRolePermissions(roleId: string): Promise<string[]> {
    const { rows } = await this.db.query(
      `
      SELECT p.id as permission_id
      FROM accounter_schema.role_permissions rp
      JOIN accounter_schema.permissions p ON rp.permission_id = p.id
      WHERE rp.role_id = $1
    `,
      [roleId]
    )
    return rows.map(r => r.permission_id)
  }

  private async getPermissionOverrides(subject: AuthSubject): Promise<PermissionOverride[]> {
    // Initial implementation: Tables exist but queries return empty results
    // Future implementation: Admin UI populates these tables for granular control
    if (subject.type === 'user') {
      const { rows } = await this.db.query(
        `
        SELECT permission_id, grant_type
        FROM accounter_schema.user_permission_overrides
        WHERE user_id = $1 AND business_id = $2
      `,
        [subject.userId, subject.businessId]
      )
      return rows
    } else if (subject.type === 'apiKey') {
      const { rows } = await this.db.query(
        `
        SELECT permission_id, grant_type
        FROM accounter_schema.api_key_permission_overrides
        WHERE api_key_id = $1
      `,
        [subject.apiKeyId]
      )
      return rows
    }
    return []
  }

  private mergePermissions(basePermissions: string[], overrides: PermissionOverride[]): string[] {
    const permSet = new Set(basePermissions)

    // Apply overrides: grants ADD permissions, revokes REMOVE permissions
    for (const override of overrides) {
      if (override.grant_type === 'grant') {
        permSet.add(override.permission_id)
      } else if (override.grant_type === 'revoke') {
        permSet.delete(override.permission_id)
      }
    }

    return Array.from(permSet)
  }
}

// Unified auth subject type - works for both users and API keys
type AuthSubject =
  | { type: 'user'; userId: string; businessId: string; roleId: string }
  | { type: 'apiKey'; apiKeyId: string; businessId: string; roleId: string }

interface PermissionOverride {
  permission_id: string
  grant_type: 'grant' | 'revoke'
}
```

    *   **Benefits of Unified Resolution** (When Implemented):
        *   Both users and API keys will use identical permission resolution logic
        *   Adding granular permissions later only requires:
            1. Implementing `PermissionResolutionService` to query permissions and override tables
            2. Seeding initial permission data into `permissions` and `role_permissions` tables
            3. Updating authorization services to check `authContext.permissions` array instead of `authContext.roleId`
            4. Populating override tables via admin UI for edge cases
        *   Consistent behavior across all authentication methods
    *   **Secure Invitation Token**: Use `crypto.randomBytes(32).toString('hex')` to generate a cryptographically secure, 64-character invitation token. Tokens have a 7-day expiration enforced by database constraint.
    *   **`createInvitation` Implementation**:
        1. Validate email format and check for duplicate pending invitations
        2. Generate local `user_id` UUID and secure invitation token
        3. Call Auth0 Management API to create user with `blocked: true`, store `invitation_id` in `app_metadata`
        4. Handle Auth0 errors: 429 rate limit → return retry-after message, other errors → rollback transaction
        5. Insert invitation record with `auth0_user_created: true` and `auth0_user_id`
        6. Return invitation URL: `/accept-invitation?token=...`
    *   **`acceptInvitation` Implementation** (requires authenticated session):
        1. Verify invitation token exists and `accepted_at IS NULL` (unused) and not expired
        2. Extract `auth0_user_id` from GraphQL context (user already authenticated via Auth0)
        3. Mark invitation as used: `UPDATE invitations SET accepted_at = NOW()`
        4. Check if this is user's first invitation acceptance (query `business_users` for existing `auth0_user_id`)
        5. If first acceptance: Call Auth0 Management API to unblock user (`PATCH /api/v2/users/{id}` with `blocked: false`)
        6. Insert or update `business_users` row linking Auth0 ID to business/role
        7. Return success
    *   **Invitation Cleanup Job** (background task, runs daily):
        1. Query expired invitations: `SELECT * FROM invitations WHERE auth0_user_created = true AND accepted_at IS NULL AND expires_at < NOW()`
        2. For each expired invitation: Check if Auth0 user has any other valid invitations
        3. If no valid invitations remain: Call Auth0 Management API `DELETE /api/v2/users/{auth0_user_id}`
        4. Mark invitation as cleaned (or delete record)
    *   **API Key Management**:
        *   **Generation**: Use `crypto.randomBytes(32).toString('hex')` to create a unique 64-character key. Hash it with `bcrypt` before storing in `api_keys.key_hash`.
        *   **Return Value**: Return the plain key to the user **only once** on creation. Display a warning that it cannot be retrieved again.
        *   **Validation**: On each API request with an `X-API-Key` header:
            1. Hash the provided key and query `api_keys` for a match
            2. If found and not revoked, fetch associated `business_id` and `role_id`
            3. Attach `roleId`, `businessId`, and `authType: 'apiKey'` to the GraphQL context
        *   **Audit**: Log key generation and usage in `audit_logs`.
        *   **Note**: Permission-based validation is future work - current implementation uses role-based checks

- **Authorization Strategy (Layered Defense)**:
  - **Layer 1 - Database RLS**: Primary security boundary. Automatically filters all queries by
    `business_id`.
  - **Layer 2 - GraphQL Directives**: Simple, static checks only.
  - **Layer 3 - Service Layer**: Complex, data-dependent authorization and business rules.
  - **Note**: Granular permission-based authorization is future work. Current implementation uses
    role-based checks (`authContext.roleId`).

- **GraphQL Directives (Minimal Use)**:
  - `@requiresAuth`: Ensures user is authenticated (Auth0 JWT valid or API key valid). Use on all
    protected queries/mutations.
  - `@requiresRole(role: String!)`: Role-based access check (e.g.,
    `@requiresRole(role: "business_owner")`). Primary authorization mechanism for this phase.
  - **Do NOT use directives for**: Resource ownership checks, data-dependent business rules, complex
    authorization logic.

- **AuthorizationService Pattern** (Service Layer):
  - Create dedicated authorization services per domain:
    - `ChargesAuthService.canEdit(userId, chargeId)`: Checks charge ownership via RLS query
    - `DocumentsAuthService.canIssue(userId, businessId)`: Checks role (e.g., `business_owner` or
      `accountant` only)
    - `UsersAuthService.canManage(userId)`: Checks role is `business_owner`
    - `UsersAuthService.canManage(userId, targetUserId)`: Prevents self-role-changes, checks
      hierarchy
  - **Implementation Pattern**:

```typescript
@Injectable({ scope: Scope.Operation })
export class ChargesAuthService {
  constructor(
    private db: TenantAwareDBClient,
    private authContext: AuthContext
  ) {}

  async canEdit(chargeId: string): Promise<void> {
    // Role-based authorization (permission-based checks are future work)
    if (!['business_owner', 'accountant'].includes(this.authContext.roleId)) {
      throw new GraphQLError('Insufficient privileges to edit charges', {
        extensions: { code: 'FORBIDDEN' }
      })
    }

    // RLS handles business_id filtering automatically
    const { rows } = await this.db.query('SELECT id FROM accounter_schema.charges WHERE id = $1', [
      chargeId
    ])

    if (rows.length === 0) {
      throw new GraphQLError('Charge not found or access denied', {
        extensions: { code: 'FORBIDDEN' }
      })
    }
  }
}
```

    *   **Resolver Integration**:

```typescript
export const resolvers: Resolvers = {
  Mutation: {
    updateCharge: async (_, { id, data }, { chargesAuthService, chargesService }) => {
      // Authorization check (service layer)
      await chargesAuthService.canEdit(id)

      // Business logic (RLS enforced automatically in queries)
      return chargesService.updateCharge(id, data)
    }
  }
}
```

- **Permission Checks in Services** (Not Directives):
  - Store user permissions in JWT payload (from `role_permissions` table)
  - Check permissions in service methods, not resolvers:

```typescript
export class DocumentsService {
  async issueInvoice(data: InvoiceInput) {
    // Permission check
    if (!this.authContext.user.permissions.includes('issue:docs')) {
      throw new GraphQLError('Cannot issue documents', {
        extensions: { code: 'FORBIDDEN', requiredPermission: 'issue:docs' }
      })
    }

    // Email verification for critical operations
    // RLS ensures business_id is automatically filtered
    return this.db.query('INSERT INTO documents ...')
  }
}
```

#### 3.3.1. Middleware & Resolver Hardening

- **Authorization Architecture Principles**:
  - **Never trust client input for authorization**: `businessId` in mutations is data, not auth
    context
  - **RLS is the primary enforcement**: All tenant isolation happens at database level
  - **Directives for simple checks only**: Authentication, basic roles
  - **Service layer for complex authorization**: Resource ownership, data-dependent permissions,
    business rules
  - **Fail closed**: Deny access by default; explicit grants only

- **Context Binding**: The implementation must derive `businessId` exclusively from JWT or API key
  validation. Any `businessId` argument provided by the client must be treated as data, not as
  authorization.

#### 3.3.2. AdminContext Migration from Plugin to Provider

**Current Issue**: The existing `adminContextPlugin` uses Yoga's plugin system, which creates
problems:

1. Cannot properly use GraphQL Modules dependency injection
2. Risk of global cache leakage between requests/tenants
3. Cannot inject `AUTH_CONTEXT` or `TenantAwareDBClient` properly

**Required Migration**: Convert to Operation-scoped provider following the same pattern as
`AuthContextProvider`.

**Implementation**:

**Phase 2.7 Code** (Preparatory - Infrastructure Only):

```typescript
// packages/server/src/modules/admin-context/providers/admin-context.provider.ts
import { Injectable, Scope } from 'graphql-modules';
import { GraphQLError } from 'graphql';
import { DBProvider } from '../../app-providers/db.provider.js';

@Injectable({ scope: Scope.Operation })
export class AdminContextProvider {
  private cachedContext: AdminContext | null = null;

  constructor(
    private dbProvider: DBProvider,  // Still using DBProvider in Phase 2.7
  ) {}

  async getAdminContext(): Promise<AdminContext> {
    if (!this.cachedContext) {
      // Phase 2.7: Uses existing auth from plugin context
      // businessId comes from current request's auth context (plugin-provided)
      // This is a preparatory refactor - fixes cache isolation only

      // Use DBProvider directly - RLS not enforced yet
      // Phase 4.9 will switch to TenantAwareDBClient
      const [rawContext] = await getAdminBusinessContext.run(
        { adminBusinessId: /* from current auth */ },
        this.dbProvider
      );

      if (!rawContext) {
        throw new Error('Admin business context not found');
      }

      this.cachedContext = normalizeContext(rawContext);
    }
    return this.cachedContext;
  }
}

// Phase 2.7: Token defined but provider NOT registered yet
// Phase 4.9: Provider registered in modules-app.ts
```

**Phase 4.9 Code** (Activation - After Auth0 and Frontend Integration):

```typescript
// packages/server/src/modules/admin-context/providers/admin-context.provider.ts
import { Injectable, Scope, Inject } from 'graphql-modules';
import { GraphQLError } from 'graphql';
import { AUTH_CONTEXT } from '../../../shared/tokens.js';
import { TenantAwareDBClient } from '../../app-providers/tenant-db-client.js';
import type { AuthContext } from '../../../shared/types/auth.js';

@Injectable({ scope: Scope.Operation })
export class AdminContextProvider {
  private cachedContext: AdminContext | null = null;

  constructor(
    @Inject(AUTH_CONTEXT) private auth: AuthContext | null,
    private db: TenantAwareDBClient,  // Phase 4.9: Switch to TenantAwareDBClient
  ) {}

  async getAdminContext(): Promise<AdminContext> {
    if (!this.cachedContext) {
      if (!this.auth?.tenant?.businessId) {
        throw new GraphQLError('Unauthenticated', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      // Phase 4.9: Use TenantAwareDBClient - RLS enforced automatically
      // businessId is derived from validated Auth0 JWT, never from client input
      const [rawContext] = await getAdminBusinessContext.run(
        { adminBusinessId: this.auth.tenant.businessId },
        this.db  // TenantAwareDBClient enforces RLS via SET LOCAL
      );

      if (!rawContext) {
        throw new Error('Admin business context not found');
      }

      this.cachedContext = normalizeContext(rawContext);
    }
    return this.cachedContext;
  }
}

// In modules-app.ts, provide via injection token:
import { ADMIN_CONTEXT } from './shared/tokens.js';

// Add to providers array (Phase 4.9 only):
{
  provide: ADMIN_CONTEXT,
  scope: Scope.Operation,
  useFactory: async (provider: AdminContextProvider) => provider.getAdminContext(),
  deps: [AdminContextProvider],
}
```

**Migration Steps**:

**Phase 2.7** (Preparatory - Infrastructure):

1. Refactor existing `AdminContextProvider` in
   `packages/server/src/modules/admin-context/providers/`
   - Change scope from `Scope.Singleton` to `Scope.Operation`
   - Remove shared cache and DataLoader
   - Add request-scoped cache
   - **Keep using DBProvider** (TenantAwareDBClient not available yet)
2. Add `ADMIN_CONTEXT` injection token to `packages/server/src/shared/tokens.ts`
3. Create backup file for rollback
4. Write isolation tests with DBProvider mocks
5. **DO NOT register provider yet** (plugin remains active)
6. **DO NOT remove plugin yet** (existing users rely on it)

**Phase 4.9** (Activation - After Auth0 and Frontend):

1. Update `AdminContextProvider` to inject `AUTH_CONTEXT` and use `TenantAwareDBClient`
2. Register provider in `modules-app.ts` providers array
3. Update all resolvers/providers to inject
   `@Inject(ADMIN_CONTEXT) private adminContext: AdminContext`
4. Remove `adminContextPlugin` from Yoga plugins array in `index.ts`
5. Delete `packages/server/src/plugins/admin-context-plugin.ts`
6. Verify all admin features work with provider-based approach

**Migration Timing** (Two-Phase Approach):

**Phase 2.7** (Preparatory - Infrastructure Only):

- Refactor `AdminContextProvider` from `Scope.Singleton` to `Scope.Operation`
- Remove shared cache (getCacheInstance) and DataLoader
- Add request-scoped cache (private cachedContext)
- **IMPORTANT**: Still uses `DBProvider` directly (not `TenantAwareDBClient`)
- **IMPORTANT**: Does NOT inject `AUTH_CONTEXT` yet (not available until Phase 4)
- Plugin remains active, refactored provider not registered
- Purpose: Fix cache isolation vulnerability (tenant leakage risk)

**Phase 4.9** (Activation - After Auth0 and Frontend Integration):

- Switch from `DBProvider` to `TenantAwareDBClient` (RLS enforcement)
- Add `AUTH_CONTEXT` injection
- Register provider in `modules-app.ts`
- Remove `adminContextPlugin`
- Update all resolvers/providers to inject `ADMIN_CONTEXT` token

**Why Two Phases?**

- `TenantAwareDBClient` requires `AUTH_CONTEXT` injection
- `AUTH_CONTEXT` not available until Auth0 is active (Phase 4)
- Refactoring in Phase 2 fixes cache isolation issues immediately
- Full DI integration waits for Auth0 activation

**Benefits** (when fully activated in Phase 4.9):

- ✅ Request-scoped caching (no cross-tenant leakage) - **Achieved in Phase 2.7**
- ✅ No DataLoader complexity - **Achieved in Phase 2.7**
- ⏳ Proper DI integration with AUTH_CONTEXT - **Phase 4.9**
- ⏳ Type-safe injection via ADMIN_CONTEXT token - **Phase 4.9**
- ⏳ Automatically uses TenantAwareDBClient (RLS enforcement) - **Phase 4.9**
- ⏳ Consistent with AuthContextProvider pattern - **Phase 4.9**

* **Transaction Scope**: All request DB access must run inside a `BEGIN ... SET LOCAL ... COMMIT`
  block to avoid connection pool leakage.

---

### 4. Auth0 Migration Strategy

**Objective**: Migrate from existing authentication to Auth0 without service disruption or breaking
existing functionality.

#### 4.1. Parallel Build Approach (Phase 2-3)

**Principle**: Build Auth0 infrastructure alongside existing authentication. Existing auth remains
fully functional.

**Implementation**:

- New auth components created:
  - `auth-plugin-v2.ts` (not registered in plugin array yet)
  - `AuthContextProvider` with `AUTH_CONTEXT` token (not registered in DI yet)
  - `TenantAwareDBClient` with nullable `AUTH_CONTEXT` injection (registered but won't function
    until Phase 4)
- Environment flag added: `USE_AUTH0: boolean` (default: false)
- All Phase 2-3 work uses EXISTING auth context (not Auth0)
- Server remains fully functional throughout infrastructure build
- Note: No "-v2" suffix for injection tokens - `AUTH_CONTEXT` is the standard token name from the
  start

**Validation**: After each step, verify existing auth still works. Run full integration test suite.

#### 4.2. Parallel Testing (Phase 4, Steps 4.1-4.5)

**Objective**: Test Auth0 authentication in parallel with existing auth before cutover.

**Approach**:

1. **Environment Configuration** (Step 4.1): Add Auth0 config to environment (doesn't activate Auth0
   yet)
2. **Auth0 Tenant Setup** (Step 4.2): Configure Auth0 tenant, applications, Management API
3. **Management API Service** (Step 4.3): Build Auth0 integration service (tested in isolation)
4. **Parallel Testing** (Step 4.4):
   - Conditionally register Auth0 providers based on `USE_AUTH0` flag
   - Create test endpoint to verify Auth0 works
   - Test both auth systems independently
5. **Migration Test Users** (Step 4.5): Create test users in Auth0, link to local business users

**Validation**: Both auth systems work independently. No conflicts. Can toggle between systems via
flag.

#### 4.3. Safe Cutover (Phase 4, Steps 4.6-4.7)

**CRITICAL**: Frontend Auth0 UI must be deployed BEFORE backend switch to ensure zero downtime.

**Step 4.6 - Frontend First (Deploy Auth0 UI)**:

**Prerequisites**:

- [ ] Auth0 tenant fully configured (Step 4.2)
- [ ] Auth0 Management API working (Step 4.3)
- [ ] Parallel backend testing successful (Step 4.4)

**Tasks**:

1. Install `@auth0/auth0-react` in client package
2. Implement dual-auth login page (users can choose legacy or Auth0)
3. Create Auth0 callback handler
4. Update Urql client to support both auth token types
5. Deploy to production
6. Verify Auth0 login works alongside legacy login

**Step 4.7 - Backend Switch (Auth0-Only)**:

**Prerequisites Checklist**:

- [ ] **Frontend Auth0 UI deployed and tested (Step 4.6)** ← CRITICAL
- [ ] Auth0 tenant fully configured
- [ ] Auth0 Management API working
- [ ] Parallel testing successful (Step 4.4)
- [ ] Test users migrated successfully (Step 4.5)
- [ ] All Phase 1-3 tests passing
- [ ] Staging deployment successful with Auth0 enabled
- [ ] Rollback plan documented and tested

**Cutover Process**:

1. **Verify Frontend Ready**: Confirm Auth0 login works in production
2. **Code Changes**:
   - Replace `authPlugin()` with `authPluginV2()` in plugins array
   - Replace `AUTH_CONTEXT` provider registration to use `AuthContextV2Provider`
   - Update `TenantAwareDBClient` to inject new `AUTH_CONTEXT`
3. **Deploy Backend to Staging**: Full validation with Auth0 active
4. **Deploy Backend to Production**: Monitor error rates, ready to rollback
5. **Update Frontend**: Make Auth0 login default (remove legacy login option)
6. **Monitor First 24 Hours**: Login success rates, JWT verification errors, Auth0 API latency

**Result**: Zero downtime - users had Auth0 UI available before backend required it.

**Rollback Plan**:

```bash
# If issues occur within first hour:
1. Revert backend to previous deployment (old authPlugin)
2. Revert frontend to show legacy login as default
3. Verify old auth working
4. Investigate Auth0 issues offline
5. Fix and redeploy when ready
```

**Risk Mitigation**:

- Frontend-first deployment eliminates lockout risk
- Immediate rollback capability for both frontend and backend
- Monitoring alerts for auth failures
- 24/7 on-call during first week
- User communication plan if extended downtime needed

#### 4.4. Post-Migration Cleanup (Phase 5)

**Timing**: After 7 days of stability in production

**Tasks**:

1. Delete old authentication files
2. Rename v2 files to standard names (`auth-plugin-v2.ts` → `auth-plugin.ts`)
3. Remove `USE_AUTH0` feature flag
4. Update documentation
5. Remove old auth tests

**Validation**: Clean codebase, no deprecated code, all tests pass.

---

#### 3.4. Client Application (`packages/client`)

**Note**: All login, signup, and password management flows are handled by Auth0 Universal Login. The
client application does not implement custom login forms.

- **Auth0 SDK Integration** (`@auth0/auth0-react`):
  - Wrap the application in `<Auth0Provider>` with configuration:
    - `domain`: Auth0 tenant domain (e.g., `accounter.auth0.com`)
    - `clientId`: Auth0 Application Client ID
    - `redirectUri`: Application callback URL (e.g., `http://localhost:3000/callback`)
    - `audience`: GraphQL API identifier configured in Auth0
    - `scope`: `openid profile email`
    - `cacheLocation`: `localstorage` for persistence across page reloads
    - `useRefreshTokens`: `true` for silent authentication
  - Use `useAuth0()` hook to access authentication state:
    - `isAuthenticated`: Boolean indicating login status
    - `user`: Auth0 user profile (email, name, sub)
    - `loginWithRedirect()`: Triggers Auth0 Universal Login
    - `logout()`: Clears Auth0 session and local state
    - `getAccessTokenSilently()`: Retrieves valid JWT for API requests

- **UI Components**:
  - **Login Page** (`/login`): Simple page with "Login" button that calls `loginWithRedirect()`
  - **Callback Page** (`/callback`): Handles Auth0 redirect after login, completes authentication
    handshake, redirects to dashboard or invitation acceptance flow
  - **Accept Invitation Page** (`/accept-invitation?token=...`):
    1. Check if user is authenticated via `useAuth0().isAuthenticated`
    2. If not authenticated: Show "You've been invited to X" message with "Login to Accept" button
       that calls `loginWithRedirect({ appState: { returnTo: '/accept-invitation?token=...' } })`
    3. If authenticated: Automatically call `acceptInvitation` mutation with token from URL, handle
       success/error
    4. On success: Redirect to business dashboard with direct access (first-time login UX)
  - **Invite User Form** (Admin Settings): Form for `business owner` to create invitations (email,
    role selection), calls `createInvitation` mutation, displays invitation URL with copy button
  - **API Key Management** (Admin Settings):
    - Allow generating new keys for the `scraper` role
    - Display the generated key **only once** with copy button
    - List active keys (showing name, creation date, last used) and allow revocation

- **Token Management & GraphQL Integration**:
  - **Automatic Token Injection**: Configure Urql to automatically attach Auth0 JWT to requests:
    ```typescript
    const client = createClient({
      url: '/graphql',
      fetchOptions: async () => {
        const token = await getAccessTokenSilently()
        return {
          headers: { Authorization: `Bearer ${token}` },
          credentials: 'include'
        }
      }
    })
    ```
  - **Token Refresh**: Auth0 SDK handles automatic token refresh via refresh tokens stored in local
    storage (no manual refresh mutation needed)
  - **Session Persistence**: Auth0 SDK maintains session across page reloads using refresh tokens

- **Business Context Selection** (Multi-Business Support):
  - After successful login, query GraphQL API for user's businesses:
    `query { me { businesses { businessId, businessName, role } } }`
  - If user belongs to multiple businesses, show business selector UI
  - Store selected `businessId` in React Context (does NOT go into JWT - business context is
    server-side only)
  - On business switch, refetch all data to update UI with new business context

- **Routing & Protected Routes**:
  - Implement `<ProtectedRoute>` component that checks `useAuth0().isAuthenticated`
  - If not authenticated, redirect to `/login`
  - If authenticated but no business context, redirect to business selection
  - Wrap all authenticated pages (dashboard, reports, etc.) in `<ProtectedRoute>`

#### 3.4.1. Frontend State & Cache Safety (Urql Graphcache)

- **Cache Reset Triggers**: The implementation must hard-reset the Graphcache store on login,
  logout, invitation acceptance, business switch, and `UNAUTHENTICATED` responses.
- **Business Context Provider**: The implementation must maintain `activeBusinessId` in React
  context and must re-instantiate the Urql client on business changes to prevent stale entities from
  bleeding across tenants.

### 5. Error Handling

- **Authentication Errors**:
  - The GraphQL API returns `UNAUTHENTICATED` errors if Auth0 JWT is missing, invalid, expired, or
    signature verification fails
  - Client catches this error and calls `loginWithRedirect()` to trigger Auth0 login
- **Authorization Errors**: The API should return `FORBIDDEN` errors if a user attempts to perform
  an action they do not have permission for. The client should handle this gracefully, displaying an
  error message to the user.
- **Auth0 Integration Errors**:
  - **Rate Limit (429)**: Return error with
    `extensions: { code: 'AUTH0_RATE_LIMIT', retryAfter: seconds }`, client displays "Please try
    again in X seconds"
  - **Auth0 API Failure**: Return generic error "Unable to process invitation at this time", log
    details server-side
  - **User Already Exists**: Return error "User with this email already exists", client suggests
    using existing account
- **Invitation Errors**:
  - The `acceptInvitation` mutation should handle cases where:
    - Token is invalid or not found: `INVITATION_NOT_FOUND`
    - Token already used (`accepted_at` not null): `INVITATION_ALREADY_USED`
    - Token expired: `INVITATION_EXPIRED`
    - User not authenticated: `UNAUTHENTICATED` with message "Please log in to accept invitation"

### 6. Testing Plan

- **Backend (Unit/Integration Tests)**:
  - Test the `createInvitation` and `acceptInvitation` mutations with valid and invalid inputs
  - **Auth0 Integration Tests** (with mocked Auth0 Management API):
    - Verify `createInvitation` calls Auth0 API with correct payload (`blocked: true`, email,
      `app_metadata`)
    - Verify `createInvitation` handles Auth0 rate limits (429) and returns user-friendly error
    - Verify `createInvitation` rollback on Auth0 API failure
    - Verify `acceptInvitation` calls Auth0 API to unblock user on first acceptance
    - Verify `acceptInvitation` skips unblock for subsequent business invitations
    - Verify invitation cleanup job deletes blocked Auth0 users for expired invitations
  - **Auth0 JWT Verification Tests**:
    - Verify middleware correctly validates RS256 signatures using JWKS
    - Verify middleware rejects expired tokens
    - Verify middleware rejects tokens with invalid `iss` or `aud` claims
    - Verify context enrichment maps Auth0 user ID to local `user_id` correctly
  - Test **API Key authentication**: verify that a valid API key in the header authenticates the
    user, and an invalid one fails.
  - Test **Audit Logging**: verify that critical actions (invitation creation/acceptance, API key
    generation) create corresponding records in the `audit_logs` table with both `user_id` and
    `auth0_user_id`.
  - Test **Authorization Services**:
    - Verify `ChargesAuthService.canEdit()` rejects charges from other businesses (RLS enforcement)
    - Verify `DocumentsAuthService.canIssue()` checks permissions
    - Verify `UsersAuthService.canManage()` prevents privilege escalation
  - Test the RBAC logic: ensure users can only access data and perform actions allowed by their
    roles. Create tests for each role (`employee`, `accountant`, etc.) to verify their specific
    restrictions.
  - Test **Cross-Tenant Isolation**: Attempt to access resources from Business A while authenticated
    to Business B (must fail at RLS layer).
  - **Note**: Permission-based authorization tests are out of scope for this phase. Focus on
    role-based checks (e.g., verify `business_owner` can manage users, `employee` cannot).
- **Client (Component/E2E Tests)**:
  - Test Auth0 login flow with mock Auth0 provider
  - Test invitation acceptance requiring authentication
  - Test that the Auth0 JWT is correctly attached to API requests via Authorization header
  - Test the protected route logic, ensuring unauthorized users trigger Auth0 login
  - Test that UI elements for restricted actions (e.g., "Manage Users" button) are hidden for users
    without the necessary permissions.

### 7. Transition State Management (Dual-Write & Defaulting)

- **Dual-Write**: The implementation must write `business_id` for all tenant tables and continue
  writing legacy owner columns until migration completion.
- **Backfill Rules**:
  - `charges.business_id = charges.owner_id`
  - `ledger_records.business_id = ledger_records.owner_id`
  - `financial_entities.business_id = financial_entities.owner_id`
  - `user_context.business_id = user_context.owner_id`
  - `financial_accounts.business_id = financial_accounts.owner`
  - `documents.business_id = COALESCE(charges.owner_id, documents.debtor_id, documents.creditor_id)`
  - `documents_issued.business_id = documents.business_id`
  - `salaries.business_id = employees.business_id` via `employee_id`, fallback
    `charge_id -> charges.owner_id`
  - `charge_tags.business_id = charges.owner_id`
  - `tags.business_id = charge_tags.business_id`
- **Quarantine**: Rows that cannot be deterministically assigned must remain inaccessible by RLS
  until resolved.

### 8. Auth/Tenant Context Interfaces

```ts
export type AuthType = 'user' | 'apiKey' | 'system'

export interface AuthUser {
  userId: string // Local UUID from business_users table
  auth0UserId: string // Auth0 identifier (e.g., "auth0|507f1f77...")
  email: string // From Auth0 JWT
  roles: string[] // From business_users
  permissions: string[] // Resolved via PermissionResolutionService
  permissionsVersion: number // For cache invalidation
}

export interface TenantContext {
  businessId: string
  businessName?: string
}

export interface AuthContext {
  authType: AuthType
  user?: AuthUser
  tenant?: TenantContext
  accessTokenExpiresAt?: number // From Auth0 JWT 'exp' claim
}

export interface RequestContext {
  auth: AuthContext
  dbTenant: {
    query<T>(sql: string, params?: unknown[]): Promise<T>
    transaction<T>(fn: () => Promise<T>): Promise<T>
  }
  audit: {
    log(action: string, entity?: string, entityId?: string, details?: Record<string, unknown>): void
  }
}
```

---

## Appendix A: Auth0 Configuration Guide

This appendix provides the required Auth0 tenant configuration for the Accounter application.

### A.1. Create Auth0 Tenant

1. Sign up for Auth0 at https://auth0.com (Free tier supports up to 7,000 monthly active users)
2. Create a new tenant (e.g., `accounter` → domain will be `accounter.auth0.com`)
3. Choose region closest to primary user base for optimal latency

### A.2. Configure Application (Regular Web App)

1. Navigate to **Applications** → **Create Application**
2. Name: `Accounter Web App`
3. Type: **Regular Web Application**
4. **Settings** tab configuration:
   - **Allowed Callback URLs**: `http://localhost:3000/callback, https://app.accounter.com/callback`
   - **Allowed Logout URLs**: `http://localhost:3000, https://app.accounter.com`
   - **Allowed Web Origins**: `http://localhost:3000, https://app.accounter.com`
   - **Allowed Origins (CORS)**: `http://localhost:3000, https://app.accounter.com`
   - **Application Login URI**: `http://localhost:3000/login` (for social connection redirects)
5. **Advanced Settings** → **Grant Types**: Ensure `Authorization Code`, `Refresh Token` are enabled
6. **Refresh Token Rotation**: Enabled
7. **Refresh Token Expiration**: Absolute expiration after 7 days, Inactivity expiration after 3
   days
8. Save changes and note the **Domain**, **Client ID**, and **Client Secret**

### A.3. Configure API (GraphQL Server)

1. Navigate to **Applications** → **APIs** → **Create API**
2. Name: `Accounter GraphQL API`
3. Identifier: `https://api.accounter.com` (used as JWT `aud` claim)
4. Signing Algorithm: **RS256** (asymmetric, more secure than HS256)
5. **Settings** tab:
   - **RBAC Settings**: Do NOT enable (permissions managed locally, not in Auth0)
   - **Allow Skipping User Consent**: Enabled (first-party application)
   - **Allow Offline Access**: Enabled (for refresh tokens)
   - **Token Expiration**: Access Token 900 seconds (15 minutes)
6. Save changes

### A.4. Configure Management API Access (M2M)

For server-side Auth0 Management API calls (user pre-registration, unblocking, deletion):

1. Navigate to **Applications** → **Machine to Machine Applications** → **Authorize**
2. Select **Auth0 Management API**
3. Required scopes:
   - `create:users` - Create users during invitation
   - `update:users` - Unblock users after invitation acceptance
   - `delete:users` - Clean up expired invitations
   - `read:users` - Verify user status
   - `update:users_app_metadata` - Store invitation tracking data
   - `read:users_app_metadata` - Read invitation metadata
4. Save and note the **Client ID** and **Client Secret** for M2M application

### A.5. Database Connection Configuration

1. Navigate to **Authentication** → **Database** → **Username-Password-Authentication**
2. **Settings** tab:
   - **Requires Username**: Disabled (use email only)
   - **Disable Sign Ups**: **Enabled** (only invited users can create accounts via pre-registration)
   - **Password Policy**: `Good` (8+ chars, 3 char types)
   - **Password History**: 5 passwords (prevent reuse)
   - **Password Dictionary**: Enabled (block common passwords)
3. **Password Reset** tab:
   - **Customization**: (Future enhancement - customize email templates)
4. Save changes

### A.6. Email Configuration

Auth0 provides built-in email delivery for initial setup. For production:

1. Navigate to **Branding** → **Email Provider**
2. Configure custom SMTP (SendGrid, Mailgun, AWS SES) for:
   - Branded sender address (e.g., `noreply@accounter.com`)
   - Higher rate limits (Auth0 built-in email has strict limits)
   - Deliverability control
3. **Email Templates**:
   - **Welcome Email**: Sent when Auth0 user is created during invitation (contains password setup
     link)
   - **Change Password**: For user-initiated password resets
   - (Future enhancement: Customize templates to match Accounter branding)

### A.7. Security Settings

1. Navigate to **Security** → **Attack Protection**
2. **Brute Force Protection**: Enabled (10 attempts, 15-minute lockout)
3. **Suspicious IP Throttling**: Enabled (blocks IPs with excessive failures)
4. **Breached Password Detection**: Enabled (blocks passwords from known breaches)

### A.8. Rate Limits Reference

Auth0 Management API rate limits (varies by plan):

- **Free Tier**: 2 requests/second, burst 10
- **Developer Pro**: 10 requests/second, burst 50
- **Exceeded Limit Response**: `429 Too Many Requests` with `X-RateLimit-Reset` header

**Implementation**: Detect 429 responses, extract retry-after time, return user-friendly error: "Too
many invitations created. Please try again in X seconds."

### A.9. Environment Variables

Store Auth0 configuration in environment variables:

**Client (`packages/client/.env`)**:

```bash
VITE_AUTH0_DOMAIN=accounter.auth0.com
VITE_AUTH0_CLIENT_ID=<Application Client ID>
VITE_AUTH0_AUDIENCE=https://api.accounter.com
VITE_AUTH0_REDIRECT_URI=http://localhost:3000/callback
```

**Server (`packages/server/.env`)**:

```bash
AUTH0_DOMAIN=accounter.auth0.com
AUTH0_AUDIENCE=https://api.accounter.com
AUTH0_JWKS_URI=https://accounter.auth0.com/.well-known/jwks.json

# Management API M2M credentials
AUTH0_MGMT_CLIENT_ID=<M2M Application Client ID>
AUTH0_MGMT_CLIENT_SECRET=<M2M Application Client Secret>
AUTH0_MGMT_AUDIENCE=https://accounter.auth0.com/api/v2/
```

### A.10. Testing Auth0 Integration

**Local Development**:

1. Create test users manually in Auth0 Dashboard → **User Management** → **Users**
2. Set initial password and unblock user for testing login flow
3. Use Auth0's "Try Connection" feature to test email deliverability

**Automated Testing**:

- Mock Auth0 Management API responses in integration tests
- Use Auth0's Test Tokens for JWT verification testing
- Consider Auth0's
  [Mock](https://github.com/auth0/node-auth0/blob/master/EXAMPLES.md#testing-with-mocks) library for
  Node.js tests

---
