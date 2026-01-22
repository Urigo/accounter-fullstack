---

## Specification: User Management and Role-Based Access Control (RBAC)

### Critical Risks (Showstoppers)

*   **Tenant isolation leakage via pooled connections**: The implementation must use `BEGIN; SET LOCAL app.current_business_id = ...; SET LOCAL app.current_user_id = ...; COMMIT;` for every request. Any query executed outside a transaction is forbidden.
*   **Ambiguous business ownership**: The implementation must define deterministic backfill rules for legacy tables that do not carry a `business_id` (see Transition State Management). Rows without resolvable ownership must be quarantined and excluded by RLS.
*   **Singleton provider cache leakage**: The implementation must ensure all providers caching tenant-specific data use `Scope.Operation` or tenant-prefixed cache keys to prevent cross-tenant data exposure (see Provider Cache Isolation Strategy).
*   **Connection pool exhaustion**: With one connection held per GraphQL operation, ensure adequate pool sizing (50-100 connections for production) and implement query timeouts to prevent pool starvation. Note: RLS policies do NOT create table-level locks; PostgreSQL's MVCC ensures concurrent operations remain non-blocking.

### 1. Overview

This document outlines the implementation of a new user management system for the Accounter application. The new system will replace the current basic authentication with a robust, secure, and scalable solution featuring personal user accounts, an invitation-based workflow, and granular role-based access control (RBAC).

### 2. Requirements

*   **Personal User Accounts**: Users must be able to create and manage their own accounts, separate from business entities.
*   **Authentication**:
    *   Implement email/password-based authentication.
    *   Use JSON Web Tokens (JWT) for session management.
    *   **Token Strategy**:
        *   **Access Token**: Short-lived (e.g., 15 minutes), used for API requests.
        *   **Refresh Token**: Long-lived (e.g., 7 days), securely stored (HttpOnly cookie) and used to obtain new access tokens. The implementation must store refresh tokens in a dedicated table to support multi-device sessions, rotation, and reuse detection.
    *   **API Keys**: Implement API Key authentication for the `scraper` role to support long-running, automated processes without expiration issues.
*   **User Onboarding**:
    *   New users must be invited to a business by an administrator (`business owner`).
    *   The invitation process will be manual initially: an admin generates an invitation link and shares it with the user (later we'll add email delivery, not in scope of this plan).
    *   **Email Verification Strategy**:
        *   **Invitation Flow**: Email is implicitly verified when user accepts invitation via unique token link (proves email ownership)
        *   **Email Changes**: If a user updates their email, they must re-verify via a verification token sent to the new address
        *   **Unverified Account Restrictions**: Users with unverified emails can view data but cannot perform critical actions (issue documents, manage users, etc.)
        *   **Verification Token Expiry**: Email verification tokens expire after 24 hours to limit attack windows
*   **Roles and Permissions**:
    *   The system must support the following roles:
        *   `business owner`: Full access, including user management.
        *   `employee`: View-only access to main business info. No access to payroll or other sensitive data. Cannot perform actions/changes.
        *   `accountant`: Almost full access, but cannot issue documents (e.g., invoices).
        *   `scraper`: Can only insert transactions.
    *   The system must support at least the following permissions, with a design that allows for more to be added easily:
        *   `manage:users`
        *   `issue:docs`
        *   `view:salary`
        *   `insert:transactions`
*   **Data-Level Security**: The system must enforce data access restrictions based on the user's role. For example, an `employee` should not be able to view salary information.
    *   **Row-Level Security (RLS)**: Must be implemented at the database level to strictly isolate data between businesses.
*   **Audit Logging**: The system must verify and record critical security and business actions (e.g., login, user creation, sensitive data access) for compliance and security monitoring.
*   **Future-Proofing**:
    *   The architecture should allow for future additions, such as social logins (Google, GitHub) and automated email notifications for invitations.
    *   **User-Level Multi-Tenancy**: While the database schema (`business_users`) supports users belonging to multiple businesses, the initial implementation will assume a 1:1 relationship or auto-select the first available business context upon login. Full multi-business UI switching is a future enhancement.
    *   **Multi-Factor Authentication (MFA)**: While out of scope for the initial implementation, the system should be designed with future MFA support (TOTP, etc.) in mind to enhance security for sensitive financial data.

### 3. Architecture and Implementation Details

#### 3.1. Database Schema

A new database migration will be created in `packages/migrations/src`. This migration will create the following tables:

*   **`users`**: Stores personal user information.
    *   `id`: `uuid`, primary key
    *   `name`: `text`, not null
    *   `email`: `text`, unique, not null
    *   `email_verified_at`: `timestamptz`, nullable (NULL until email is verified)
    *   `created_at`, `updated_at`: `timestamptz`
*   **`user-accounts`**: Stores authentication-related data, linked to a user.
    *   `id`: `uuid`, primary key
    *   `user_id`: `uuid`, foreign key to `users.id`
    *   `provider`: `provider_enum` (ENUM: 'email', 'google', 'github'), not null
    *   `password_hash`: `text`, nullable (for non-password providers)
*   **`user_refresh_tokens`**: Stores refresh tokens per device/session.
    *   `id`: `uuid`, primary key
    *   `user_id`: `uuid`, foreign key to `users.id`
    *   `token_hash`: `text`, not null
    *   `created_at`: `timestamptz`
    *   `expires_at`: `timestamptz`
    *   `revoked_at`: `timestamptz`, nullable
    *   `replaced_by_token_id`: `uuid`, nullable (rotation tracking)
*   **`roles`**: Defines available roles.
    *   `id`: `text`, primary key (slug, e.g., 'business_owner', 'employee')
    *   `name`: `text`, unique, not null (Display name, e.g., 'Business Owner')
*   **`permissions`**: Defines available permissions.
    *   `id`: `text`, primary key (slug, e.g., 'manage:users', 'issue:docs')
    *   `name`: `text`, unique, not null (Display name, e.g., 'Manage Users')
*   **`role_permissions`**: Maps permissions to roles.
    *   `role_id`: `text`, foreign key to `roles.id`
    *   `permission_id`: `text`, foreign key to `permissions.id`
    *   Primary key on (`role_id`, `permission_id`)
*   **`business_users`**: The existing `users` table should be repurposed or replaced by this join table to link users, businesses, and roles.
    *   `user_id`: `uuid`, foreign key to `users.id`
    *   `business_id`: `uuid`, foreign key to `businesses.id`
    *   `role_id`: `text`, foreign key to `roles.id`
    *   *Note: This structure supports M:N relationships, but initial application logic will enforce/assume a single active business context per user session.*
    *   Primary key on (`user_id`, `business_id`)
*   **`invitations`**: Stores pending user invitations.
    *   `id`: `uuid`, primary key
    *   `business_id`: `uuid`, foreign key to `businesses.id`
    *   `email`: `text`, not null
    *   `role_id`: `text`, foreign key to `roles.id`
    *   `token`: `text`, unique, not null (a cryptographically secure 64-character random string)
    *   `expires_at`: `timestamptz`, not null
    *   `created_at`: `timestamptz`
*   **`email_verification_tokens`**: Stores email verification tokens for existing users.
    *   `id`: `uuid`, primary key
    *   `user_id`: `uuid`, foreign key to `users.id`
    *   `token`: `text`, unique, not null (a cryptographically secure 64-character random string)
    *   `expires_at`: `timestamptz`, not null (typically 24 hours from creation)
    *   `created_at`: `timestamptz`
    *   Note: Invitation acceptance automatically verifies email; this table is for re-verification or email changes
*   **`api_keys`**: Stores API keys for the scraper role and other programatic access.
    *   `id`: `uuid`, primary key
    *   `business_id`: `uuid`, foreign key to `businesses.id` (API keys are linked to a business, not a specific human user)
    *   `role_id`: `text`, foreign key to `roles.id` (The role assigned to this key, e.g., 'scraper_production')
    *   `key_hash`: `text`, not null, unique (store hashed version of the key)
    *   `name`: `text` (e.g., "Production Scraper")
    *   `last_used_at`: `timestamptz` (optional, for auditing - updated hourly, to prevent write amplification)
*   **`audit_logs`**: Stores a trail of critical actions for security and compliance.
    *   `id`: `uuid`, primary key
    *   `business_id`: `uuid`, foreign key to `businesses.id`, nullable
    *   `user_id`: `uuid`, foreign key to `users.id`, nullable (nullable to support system actions or failed logins)
    *   `action`: `text`, not null (e.g., 'USER_LOGIN', 'INVOICE_UPDATE', 'PERMISSION_CHANGE')
    *   `entity`: `text`, nullable (e.g., 'Invoice', 'User')
    *   `entity_id`: `text`, nullable (ID of the affected record)
    *   `details`: `jsonb`, nullable (stores before/after state or metadata)
    *   `ip_address`: `text`, nullable
    *   `created_at`: `timestamptz`

#### 3.2. Post-Migration Security & RLS

*   **Row-Level Security (RLS)**: Enforce multi-tenancy at the Postgres engine level to prevent cross-business data leakage.
    *   **Policy Strategy**:
        *   Enable RLS on all sensitive tables (`transactions`, `documents`, `salary_records`, etc.).
        *   Create policies that query a session variable (e.g., `app.current_business_id`) to compare against the row's `business_id`.
    *   **Application Logic**:
        *   The GraphQL middleware (auth plugin) will set postgres configuration variables with `SET LOCAL` inside a transaction: `app.current_business_id`, `app.current_user_id`, and `app.auth_type`.
        *   Any query attempted without this variable set (or with a mismatch) will return zero rows or be rejected.
        *   **CRITICAL**: All database access MUST go through a `TenantAwareDBClient` that wraps queries in transactions:

```typescript
// packages/server/src/shared/helpers/tenant-db-client.ts
import { Injectable, Scope } from 'graphql-modules';
import { DBProvider } from '@modules/app-providers/db.provider';
import type { PoolClient, QueryResult } from 'pg';

@Injectable({
  scope: Scope.Operation, // Request-scoped: one instance per GraphQL operation
})
export class TenantAwareDBClient {
  private activeClient: PoolClient | null = null;
  private transactionDepth = 0;

  constructor(
    private dbProvider: DBProvider,      // Singleton pool manager
    private authContext: AuthContext,    // Request-scoped auth context
  ) {}

  async query<T = any>(queryText: string, params?: any[]): Promise<QueryResult<T>> {
    // Reuse existing transaction if within a GraphQL operation
    if (this.activeClient) {
      return this.activeClient.query<T>(queryText, params);
    }
    
    // Otherwise create a new transaction for this single query
    return this.transaction(async (client) => client.query<T>(queryText, params));
  }

  async transaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
    // Support nested transactions (use savepoints)
    const isNested = this.transactionDepth > 0;
    
    if (isNested) {
      this.transactionDepth++;
      const savepointName = `sp_${this.transactionDepth}`;
      await this.activeClient!.query(`SAVEPOINT ${savepointName}`);
      try {
        const result = await fn(this.activeClient!);
        await this.activeClient!.query(`RELEASE SAVEPOINT ${savepointName}`);
        this.transactionDepth--;
        return result;
      } catch (error) {
        await this.activeClient!.query(`ROLLBACK TO SAVEPOINT ${savepointName}`);
        this.transactionDepth--;
        throw error;
      }
    }
    
    // Start a new top-level transaction
    const client = await this.dbProvider.pool.connect();
    this.activeClient = client;
    this.transactionDepth = 1;
    
    try {
      await client.query('BEGIN');
      
      // Set transaction-scoped RLS context
      if (this.authContext.tenant?.businessId) {
        await client.query('SET LOCAL app.current_business_id = $1', [this.authContext.tenant.businessId]);
      }
      if (this.authContext.user?.userId) {
        await client.query('SET LOCAL app.current_user_id = $1', [this.authContext.user.userId]);
      }
      if (this.authContext.authType) {
        await client.query('SET LOCAL app.auth_type = $1', [this.authContext.authType]);
      }
      
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      this.transactionDepth = 0;
      this.activeClient = null;
      client.release();
    }
  }

  // Cleanup hook for GraphQL context disposal
  async dispose() {
    if (this.activeClient) {
      try {
        await this.activeClient.query('ROLLBACK');
      } catch {}
      this.activeClient.release();
      this.activeClient = null;
    }
  }
}
```

    *   **Architectural Separation**:
        *   `DBProvider` (Singleton): Manages the connection pool, used for system-level operations (migrations, background jobs that bypass RLS)
        *   `TenantAwareDBClient` (Request-scoped): Wraps `DBProvider.pool` with tenant isolation, the ONLY DB client allowed in GraphQL resolvers
        *   **ESLint Enforcement**: Configure rule to prevent direct `DBProvider` imports in resolver files

    *   **Performance & Scalability Considerations**:
        *   **Transaction Reuse**: The `TenantAwareDBClient` maintains a single active transaction per GraphQL operation, avoiding transaction overhead for multi-query operations
        *   **Connection Pool Sizing**: With one connection per concurrent request, ensure pool size ≥ expected concurrent users. Recommended: `max_connections = (core_count * 2) + effective_spindle_count`, typically 50-100 for production
        *   **Long-Running Queries**: Operations exceeding 5 seconds should be moved to background jobs to avoid pool exhaustion
        *   **Read Replicas** (Future): Read-only queries can bypass RLS by routing to replicas with tenant filtering in application layer, reducing primary DB load
        *   **PostgreSQL MVCC**: Row-Level Security policies do NOT create table locks; concurrent transactions can read/write independently without blocking
        *   **Monitoring**: Track `pg_stat_activity` for connection pool saturation and `pg_stat_statements` for slow RLS-protected queries

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

*   **Single Points of Failure**: The implementation must enforce request-scoped transactions for RLS and replace single refresh token storage with multi-session storage.
*   **Data Leakage Vectors**: The implementation must create DataLoaders per request, must never share caches across requests, and must enforce RLS for all tenant tables and views.
*   **Architectural Debt**: The implementation must support an explicit `active_business_id` per session and must avoid embedding immutable permissions without rotation safeguards.

#### 3.2.1.1. Provider Cache Isolation Strategy

**Current Risk**: Singleton providers with shared caches (e.g., `BusinessesProvider`) leak data across tenants because cache keys lack tenant context.

**Required Changes**:

1. **Change Provider Scope** (Recommended):
```typescript
// BEFORE: Singleton with global cache (UNSAFE)
@Injectable({ scope: Scope.Singleton })
export class BusinessesProvider {
  cache = getCacheInstance({ stdTTL: 60 * 5 }); // Shared across all requests!
}

// AFTER: Operation-scoped with request-isolated cache (SAFE)
@Injectable({ scope: Scope.Operation })
export class BusinessesProvider {
  cache = getCacheInstance({ stdTTL: 60 * 5 }); // One cache per request
  
  constructor(
    private dbProvider: DBProvider,
    private authContext: AuthContext, // Inject tenant context
  ) {}
}
```

2. **Alternative - Tenant-Prefixed Cache Keys** (for performance-critical singletons):
```typescript
@Injectable({ scope: Scope.Singleton })
export class BusinessesProvider {
  cache = getCacheInstance({ stdTTL: 60 * 5 });
  
  constructor(private dbProvider: DBProvider) {}
  
  // Tenant context must be passed explicitly to cache-using methods
  public getBusinessByIdLoader(tenantId: string) {
    return new DataLoader(
      (ids: readonly string[]) => this.batchBusinessesByIds(ids, tenantId),
      {
        cacheKeyFn: id => `tenant:${tenantId}:business:${id}`, // CRITICAL: Tenant prefix
        cacheMap: this.cache,
      },
    );
  }
  
  public async getAllBusinesses(tenantId: string) {
    const cacheKey = `tenant:${tenantId}:all-businesses`;
    const cached = this.cache.get(cacheKey);
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

4. **DataLoader Instance Creation**:
```typescript
// In GraphQL context creation (per-request):
export const createGraphQLContext = async (request, pool, auth) => {
  const db = new TenantAwareDBClient(new DBProvider(pool), auth);
  
  // Create fresh DataLoader instances per request
  const businessesProvider = new BusinessesProvider(db, auth);
  const chargesProvider = new ChargesProvider(db, auth);
  
  return {
    db,
    auth,
    dataloaders: {
      businesses: businessesProvider.getBusinessByIdLoader,
      charges: chargesProvider.getChargeByIdLoader,
    },
  };
};
```

#### 3.2.2. Database Execution Blueprint (Multi-Tenant Migration)

*   **Tables that must carry `business_id`**:
    *   business_tax_category_match (owner_id)
    *   business_trip_charges (charge_id => charges)
    *   business_trips
    *   business_trips_attendees (business_trip_id => business_trips)
    *   business_trips_employee_payments (id => business_trips_transactions => business_trips)
    *   business_trips_transactions (business_trip_id => business_trips)
    *   business_trips_transactions_accommodations (id => business_trips_transactions => business_trips)
    *   business_trips_transactions_car_rental (id => business_trips_transactions => business_trips)
    *   business_trips_transactions_flights (id => business_trips_transactions => business_trips)
    *   business_trips_transactions_match (business_trips_transaction_id => business_trips_transactions => business_trips)
    *   business_trips_transactions_other (id => business_trips_transactions => business_trips)
    *   business_trips_transactions_tns (id => business_trips_transactions => business_trips)
    *   businesses (id => financial_entities)
    *   businesses_admin (id => businesses => financial_entities)
    *   businesses_green_invoice_match (business_id => businesses => financial_entities)
    *   charge_balance_cancellation (charge_id => charges)
    *   charge_spread (charge_id => charges)
    *   charge_tags (charge_id => charges)
    *   charge_unbalanced_ledger_businesses (charge_id => charges)
    *   charges
    *   charges_bank_deposits (charge_id => charges)
    *   clients (business_id => businesses => financial_entities)
    *   clients_contracts (client_id => clients => businesses => financial_entities)
    *   corporate_tax_variables (corporate_id)
    *   deel_invoices (document_id => documents => charges)
    *   deel_workers (business_id => businesses => financial_entities)
    *   depreciation (charge_id => charges)
    *   dividends (business_id => businesses => financial_entities)
    *   documents (charge_id => charges)
    *   documents_issued (id => documents => charges)
    *   dynamic_report_templates (owner_id)
    *   employees (business_id => businesses => financial_entities)
    *   financial_accounts (owner)
    *   financial_accounts_tax_categories (financial_account_id => financial_accounts)
    *   financial_bank_accounts (id => financial_accounts)
    *   financial_entities (owner_id)
    *   ledger_records (charge_id => charges)
    *   misc_expenses (charge_id => charges)
    *   pcn874 (business_id)
    *   poalim_ils_account_transactions
    *   salaries (employer)
    *   tags
    *   tax_categories (id => financial_entities)
    *   transactions (charge_id => charges)
    *   user_context (owner_id)

*   **Locking Strategy** (5-Phase Low-Downtime Migration):
    *   **Phase 1**: Add `business_id` columns as nullable (acquires brief ACCESS EXCLUSIVE lock, < 1 second)
    *   **Phase 2**: Backfill in batches of 10,000 rows with 1-second sleep between batches (background job, no downtime)
    *   **Phase 3**: Validate 100% backfill completion (SELECT COUNT(*) WHERE business_id IS NULL must = 0)
    *   **Phase 4**: Add NOT NULL constraint (requires brief ACCESS EXCLUSIVE lock, < 5 seconds)
    *   **Phase 5**: Create indexes `CONCURRENTLY` (2-10 minutes, non-blocking), then add foreign keys with `NOT VALID` and validate separately
    *   **Total Downtime**: < 10 seconds per large table

*   **Migration Naming Collision Resolution**:
    *   The current `accounter_schema.users` table is actually a businesses table and MUST be renamed before creating the new personal users table:

```sql
-- Pre-migration: 2026-01-20-rename-users-to-legacy-businesses.sql
ALTER TABLE accounter_schema.users RENAME TO legacy_business_users;
-- Postgres automatically updates FK constraints

-- Main migration: 2026-01-21-create-user-auth-system.sql
CREATE TABLE accounter_schema.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- ... other auth tables ...

-- Post-migration: 2026-01-22-backfill-business-users.sql
INSERT INTO accounter_schema.users (id, name, email, created_at)
SELECT gen_random_uuid(), name, name || '@legacy.local', created
FROM accounter_schema.legacy_business_users;

INSERT INTO accounter_schema.business_users (user_id, business_id, role_id)
SELECT u.id, lbu.id, 'business_owner'
FROM accounter_schema.users u
JOIN accounter_schema.legacy_business_users lbu ON u.name = lbu.name;
```

#### 3.3. GraphQL API (`packages/server`)

A new `auth` module will be created under `packages/server/src/modules`.

*   **Schema (`schema.graphql`)**:
    *   **Audit Service**: Implement a dedicated `AuditService` to handle log ingestion.
        *   Should be called asynchronously to avoid blocking user requests.
        *   Must be integrated into critical flows: `login`, `logout`, `inviteUser`, `acceptInvitation`, `generateApiKey`, `revokeApiKey`.
        *   Should be reusable by other modules for business logic events (e.g., `createInvoice`).
    *   **Types**: `AuthPayload { token: String! }`, `User`, `Role`, `Permission`, `ApiKey { id: ID!, name: String!, lastUsedAt: String, createdAt: String! }`, `GenerateApiKeyPayload { apiKey: String! }`.
    *   **Mutations**:
        *   `inviteUser(email: String!, role: String!, businessId: ID!): String!` - Returns an invitation URL. Restricted to users with `manage:users` permission.
        *   `acceptInvitation(token: String!, name: String!, password: String!): AuthPayload!` - Creates a new user, **auto-verifies their email** (sets `email_verified_at = NOW()`), and sets the JWT cookies (Access & Refresh).
        *   `login(email: String!, password: String!): AuthPayload!` - Authenticates a user and sets the JWT cookies (Access & Refresh).
        *   `requestEmailVerification`: String! - Generates a verification token for the current user's email. Returns success message. Requires authentication.
        *   `verifyEmail(token: String!): Boolean!` - Validates the verification token and sets `email_verified_at`. Returns true on success.
        *   `updateEmail(newEmail: String!, password: String!): String!` - Updates user email, **clears `email_verified_at`**, generates verification token. Requires password confirmation.
        *   `refreshToken`: AuthPayload! - Uses the Refresh Token cookie to generate a new Access Token.
        *   `logout`: Invalidates the session by clearing the cookies and removing the refresh token from the DB.
        *   `generateApiKey(businessId: ID!, name: String!): GenerateApiKeyPayload!` - Generates a new API key for the `scraper` role linked to the specified business. Restricted to `business owner`.
        *   `revokeApiKey(id: ID!): Boolean!` - Revokes an API key.
*   **Services and Resolvers**:
    *   **JWT Generation & Verification**: Use the `@graphql-yoga/plugin-jwt` for handling JWTs. This plugin will be configured to sign tokens on login/invitation acceptance and to verify them on every request. The Access Token payload should contain `userId`, `email`, `roles`, `permissions`, and a short expiration (`exp`).
    *   **Password Hashing**: Use `bcrypt` to hash and compare passwords.
    *   **Secure Invitation Token**: Use `crypto.randomBytes(32).toString('hex')` to generate a cryptographically secure, 64-character invitation token. This token would have a strict expiration (72 hours) enforced by the database or application logic to prevent brute-force attacks.
    *   **`inviteUser`**: Generates a cryptographically secure random token, stores it in the `invitations` table with an expiration (72 hours), and returns a URL like `/accept-invitation?token=...`.
    *   **`acceptInvitation`**: Validates the token, checks for expiration, creates records in the `users` and `user-accounts` tables with `email_verified_at = NOW()` (invitation acceptance proves email ownership), links the user to the business in `business_users`, deletes the invitation, and sets the auth cookies.
    *   **`requestEmailVerification`**: Generates a secure verification token, stores it in `email_verification_tokens` with 24-hour expiry, returns success message (in future, will trigger email delivery).
    *   **`verifyEmail`**: Validates token from `email_verification_tokens`, sets `users.email_verified_at = NOW()`, deletes the token.
    *   **`updateEmail`**: Validates current password, updates `users.email`, sets `email_verified_at = NULL`, generates new verification token, returns success message.
    *   **`login`**: Authenticates credentials. On success, generates a generic Refresh Token (random string) and an Access Token (JWT).
        *   *Context Note*: The login process identifies the user's associated business (via `business_users`). If multiple exist, it selects the first one default. The resulting JWT includes this specific `businessId`.
        *   Stores the hash of the Refresh Token in `user_refresh_tokens`. Sets both as `HttpOnly` cookies.
    *   **Refresh Token Rotation Service** (with reuse detection):

```typescript
export class RefreshTokenService {
  constructor(private dbProvider: DBProvider) {}
  
  async rotateToken(oldTokenHash: string, userId: string) {
    const client = await this.dbProvider.pool.connect();
    try {
      await client.query('BEGIN');
      
      const { rows } = await client.query(`
        SELECT id, revoked_at, replaced_by_token_id, expires_at
        FROM accounter_schema.user_refresh_tokens
        WHERE token_hash = $1 AND user_id = $2
      `, [oldTokenHash, userId]);
      
      if (rows.length === 0 || new Date(rows[0].expires_at) < new Date()) {
        await client.query('ROLLBACK');
        return null; // Invalid or expired
      }
      
      const oldToken = rows[0];
      
      // REUSE DETECTION: If token was already rotated, this is a replay attack
      if (oldToken.replaced_by_token_id) {
        console.error('[SECURITY] Token reuse detected for user', userId);
        await client.query(`
          UPDATE accounter_schema.user_refresh_tokens
          SET revoked_at = NOW()
          WHERE id = $1 OR id = $2
        `, [oldToken.id, oldToken.replaced_by_token_id]);
        await client.query('COMMIT');
        return null; // Force re-login
      }
      
      if (oldToken.revoked_at) {
        await client.query('ROLLBACK');
        return null;
      }
      
      // Generate new token
      const newRefreshToken = crypto.randomBytes(32).toString('hex');
      const newRefreshTokenHash = await bcrypt.hash(newRefreshToken, 10);
      
      const { rows: newRows } = await client.query(`
        INSERT INTO accounter_schema.user_refresh_tokens
          (user_id, token_hash, expires_at)
        VALUES ($1, $2, NOW() + INTERVAL '7 days')
        RETURNING id
      `, [userId, newRefreshTokenHash]);
      
      // Mark old token as replaced (not revoked, for reuse detection)
      await client.query(`
        UPDATE accounter_schema.user_refresh_tokens
        SET replaced_by_token_id = $1
        WHERE id = $2
      `, [newRows[0].id, oldToken.id]);
      
      await client.query('COMMIT');
      
      const newAccessToken = this.jwtService.sign({ sub: userId, /* ... */ });
      return { newAccessToken, newRefreshToken };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}
```

    *   **API Key Management**:
        *   **Generation**: Use `crypto.randomBytes(32).toString('hex')` to create a unique 64-character key. Hash it with `bcrypt` before storing in `api_keys.key_hash`.
        *   **Return Value**: Return the plain key to the user **only once** on creation. Display a warning that it cannot be retrieved again.
        *   **Validation**: On each API request with an `X-API-Key` header, hash the provided key and query `api_keys` for a match. If found and not revoked, attach the corresponding `businessId` and `roleId` to the context.
        *   **Audit**: Log key generation and usage in `audit_logs`.
    *   **`refreshToken`**: Validates the Refresh Token from the cookie, generates a new Access Token, and optionally rotates the Refresh Token (security best practice).
    *   **`logout`**: Clears the cookies and marks the current Refresh Token as revoked in `user_refresh_tokens`.
*   **Authorization Directive (`@auth`)**:
    *   Create a GraphQL schema directive `@auth(requires: Permission!, requiresVerifiedEmail: Boolean)` to protect individual fields or mutations.
    *   The directive's implementation will check the user's permissions (pre-populated by the JWT plugin) against the `@auth` directive's requirements.
    *   **Email Verification Enforcement**: When `requiresVerifiedEmail: true`, the directive checks `authContext.user.emailVerifiedAt` and returns `FORBIDDEN` if null. Critical mutations (issue documents, manage users, update business settings) must require verified email.

#### 3.3.1. Middleware & Resolver Hardening

*   **Context Binding**: The implementation must derive `businessId` exclusively from JWT or API key validation. Any `businessId` argument provided by the client must be treated as data, not as authorization.
    *   **Critical**: The `adminContextPlugin` MUST be refactored to use `auth.tenant.businessId` instead of the legacy `currentUser.userId` pattern:

```typescript
export const adminContextPlugin: () => Plugin<{ adminContext: AdminContext }> = () =>
  useExtendContext(
    async (contextSoFar: { 
      env: Environment; 
      auth: AuthContext;  // Use auth.tenant.businessId
      db: TenantAwareDBClient;
    }) => {
      if (!contextSoFar.auth.tenant?.businessId) {
        throw new Error('No business context available');
      }
      
      const rawContext = await fetchContext(
        contextSoFar.auth.tenant.businessId,  // Correct: Use businessId from auth context
        contextSoFar.db,
      );
      
      const adminContext = normalizeContext(rawContext);
      return { adminContext };
    },
  );
```

*   **Transaction Scope**: All request DB access must run inside a `BEGIN ... SET LOCAL ... COMMIT` block to avoid connection pool leakage.
    *   **GraphQL Context**: Must provide `db: TenantAwareDBClient` instead of raw `pool: pg.Pool`
    *   **ESLint Rule**: Enforce no direct `pool.query()` usage in resolvers
*   **Global Filter**: Resolvers must use a tenant-aware DB adapter that injects `business_id` automatically. Any raw query access must be disallowed in GraphQL resolvers.
*   **RLS + Views**: Any `extended_*` view used by GraphQL must be defined as `security_barrier` and must rely on RLS-protected base tables.
*   **Composite Uniqueness**: All business-scoped unique constraints must include `business_id`:
    *   `documents`: (business_id, serial_number)
    *   `financial_entities`: (business_id, name)
    *   `tags`: (business_id, name)
    *   `tax_categories`: (business_id, code)
    *   `employees`: (business_id, employee_id)
    *   `business_users`: PRIMARY KEY (user_id, business_id)
    *   `invitations`: (business_id, email)

#### 3.4. Client Application (`packages/client`)

*   **UI Components**:
    *   Modify the existing `login-page.tsx` component. The form should be updated to use `email` instead of `username`, and the `onSubmit` handler should be adapted to call the new `login` GraphQL mutation.
    *   Create a new screen/page for `Accept Invitation` (`/accept-invitation`).
    *   Create a form for admins to invite new users.
    *   **Admin Settings**: Add a section in the Business Settings for administrators (`business owner`) to manage API keys.
        *   Allow generating new keys for the `scraper` role.
        *   Display the generated key **only once**.
        *   List active keys (showing name, creation date, last used) and allow revocation.
*   **Token Storage & State Management**:
    *   **Cookie-Based Auth**: The server will set the JWT in an `HttpOnly`, `Secure`, `SameSite` cookie upon successful login or invitation acceptance. This prevents client-side JavaScript from accessing the token, mitigating XSS attacks.
    *   **CSRF Protection**: To counter Cross-Site Request Forgery (CSRF) attacks (which cookies are vulnerable to), the server's CSRF prevention plugin must be enabled and configured.
    *   **Client State**: The client will use React Context to track the user's *authentication status* (e.g., `isLoggedIn`, `currentUser`), but it will **not** manage the raw JWT string.
*   **Networking**:
    *   The Urql client does not need to manually attach the `Authorization` header (since the cookie is sent automatically by the browser). Instead, ensure `credentials: 'include'` is set in the Urql configuration.
*   **Routing**:
    *   Implement a "protected route" component that wraps pages requiring authentication. If the user is not authenticated, they should be redirected to the `/login` page.

#### 3.4.1. Frontend State & Cache Safety (Urql Graphcache)

*   **Cache Reset Triggers**: The implementation must hard-reset the Graphcache store on login, logout, invitation acceptance, business switch, and `UNAUTHENTICATED` responses.
*   **Business Context Provider**: The implementation must maintain `activeBusinessId` in React context and must re-instantiate the Urql client on business changes to prevent stale entities from bleeding across tenants.

### 4. Error Handling

*   **Authentication Errors**: The GraphQL API should return standard `UNAUTHENTICATED` errors if a user's token is missing, invalid, or expired. The client should catch this error and redirect to the login page.
*   **Authorization Errors**: The API should return `FORBIDDEN` errors if a user attempts to perform an action they do not have permission for. The client should handle this gracefully, displaying an error message to the user.
*   **Email Verification Errors**: The API should return `FORBIDDEN` with code `EMAIL_NOT_VERIFIED` when unverified users attempt protected actions. The client should display a prominent banner prompting email verification.
*   **Invitation Errors**: The `acceptInvitation` mutation should handle cases where the token is invalid or expired, returning a clear error message.
*   **Verification Token Errors**: The `verifyEmail` mutation should handle expired or invalid tokens with specific error codes (`TOKEN_EXPIRED`, `TOKEN_INVALID`) to guide user action.

### 5. Testing Plan

*   **Backend (Unit/Integration Tests)**:
    *   Test the `inviteUser`, `acceptInvitation`, and `login` mutations with valid and invalid inputs.
    *   Test **Email Verification Flow**:
        *   Verify `acceptInvitation` sets `email_verified_at` automatically
        *   Verify `requestEmailVerification` generates valid token with 24-hour expiry
        *   Verify `verifyEmail` updates `email_verified_at` and deletes token
        *   Verify expired tokens are rejected
        *   Verify `updateEmail` clears verification status and generates new token
    *   Test password hashing and JWT generation/validation logic.
    *   Test **API Key authentication**: verify that a valid API key in the header authenticates the user, and an invalid one fails.
    *   Test the `auth-plugin`'s ability to correctly parse tokens and attach user context.
    *   Test **Audit Logging**: verify that critical actions (login, invite) create corresponding records in the `audit_logs` table.
    *   Test the RBAC logic: ensure users can only access data and perform actions allowed by their roles. Create tests for each role (`employee`, `accountant`, etc.) to verify their specific restrictions.
    *   Test **Email Verification Enforcement**: verify that unverified users are blocked from critical mutations (issue documents, manage users) with `EMAIL_NOT_VERIFIED` error.
*   **Client (Component/E2E Tests)**:
    *   Test the login and invitation acceptance forms.
    *   Test that the JWT is correctly stored and sent with API requests.
    *   Test the protected route logic, ensuring unauthorized users are redirected.
    *   Test that UI elements for restricted actions (e.g., "Manage Users" button) are hidden for users without the necessary permissions.

### 6. Transition State Management (Dual-Write & Defaulting)

*   **Dual-Write**: The implementation must write `business_id` for all tenant tables and continue writing legacy owner columns until migration completion.
*   **Backfill Rules**:
        *   `charges.business_id = charges.owner_id`
        *   `ledger_records.business_id = ledger_records.owner_id`
        *   `financial_entities.business_id = financial_entities.owner_id`
        *   `user_context.business_id = user_context.owner_id`
        *   `financial_accounts.business_id = financial_accounts.owner`
        *   `documents.business_id = COALESCE(charges.owner_id, documents.debtor_id, documents.creditor_id)`
        *   `documents_issued.business_id = documents.business_id`
        *   `salaries.business_id = employees.business_id` via `employee_id`, fallback `charge_id -> charges.owner_id`
        *   `charge_tags.business_id = charges.owner_id`
        *   `tags.business_id = charge_tags.business_id`
*   **Quarantine**: Rows that cannot be deterministically assigned must remain inaccessible by RLS until resolved.

### 7. Auth/Tenant Context Interfaces

```ts
export type AuthType = "jwt" | "apiKey" | "system";

export interface AuthUser {
    userId: string;
    email: string;
    emailVerifiedAt: number | null;  // Unix timestamp or null if unverified
    roles: string[];
    permissions: string[];
    permissionsVersion: number;
}

export interface TenantContext {
    businessId: string;
    businessName?: string;
}

export interface AuthContext {
    authType: AuthType;
    user?: AuthUser;
    tenant?: TenantContext;
    accessTokenExpiresAt?: number;
}

export interface RequestContext {
    auth: AuthContext;
    dbTenant: {
        query<T>(sql: string, params?: unknown[]): Promise<T>;
        transaction<T>(fn: () => Promise<T>): Promise<T>;
    };
    audit: {
        log(action: string, entity?: string, entityId?: string, details?: Record<string, unknown>): void;
    };
}
```
---
