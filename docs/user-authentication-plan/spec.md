---

## Specification: User Management and Role-Based Access Control (RBAC)

### 1. Overview

This document outlines the implementation of a new user management system for the Accounter application. The new system will replace the current basic authentication with a robust, secure, and scalable solution featuring personal user accounts, an invitation-based workflow, and granular role-based access control (RBAC).

### 2. Requirements

*   **Personal User Accounts**: Users must be able to create and manage their own accounts, separate from business entities.
*   **Authentication**:
    *   Implement email/password-based authentication.
    *   Use JSON Web Tokens (JWT) for session management.
    *   JWT expiration: **7 days** for standard users.
    *   **API Keys**: Implement API Key authentication for the `scraper` role to support long-running, automated processes without expiration issues.
*   **User Onboarding**:
    *   New users must be invited to a business by an administrator (`business owner`).
    *   The invitation process will be manual initially: an admin generates an invitation link and shares it with the user.
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
*   **Future-Proofing**: The architecture should allow for future additions, such as social logins (Google, GitHub) and automated email notifications for invitations.

### 3. Architecture and Implementation Details

#### 3.1. Database Schema

A new database migration will be created in `packages/migrations/src`. This migration will create the following tables:

*   **`users`**: Stores personal user information.
    *   `id`: `uuid`, primary key
    *   `name`: `text`, not null
    *   `email`: `text`, unique, not null
    *   `created_at`, `updated_at`: `timestamptz`
*   **`user-accounts`**: Stores authentication-related data, linked to a user.
    *   `id`: `uuid`, primary key
    *   `user_id`: `uuid`, foreign key to `users.id`
    *   `provider`: `provider_enum` (ENUM: 'email', 'google', 'github'), not null
    *   `password_hash`: `text`, nullable (for non-password providers)
*   **`roles`**: Defines available roles.
    *   `id`: `serial`, primary key
    *   `name`: `text`, unique, not null (e.g., 'business owner', 'employee')
*   **`permissions`**: Defines available permissions.
    *   `id`: `serial`, primary key
    *   `name`: `text`, unique, not null (e.g., 'manage:users', 'issue:docs')
*   **`role_permissions`**: Maps permissions to roles.
    *   `role_id`: `integer`, foreign key to `roles.id`
    *   `permission_id`: `integer`, foreign key to `permissions.id`
    *   Primary key on (`role_id`, `permission_id`)
*   **`business_users`**: The existing `users` table should be repurposed or replaced by this join table to link users, businesses, and roles.
    *   `user_id`: `uuid`, foreign key to `users.id`
    *   `business_id`: `uuid`, foreign key to `businesses.id`
    *   `role_id`: `integer`, foreign key to `roles.id`
    *   Primary key on (`user_id`, `business_id`)
*   **`invitations`**: Stores pending user invitations.
    *   `id`: `uuid`, primary key
    *   `business_id`: `uuid`, foreign key to `businesses.id`
    *   `email`: `text`, not null
    *   `role_id`: `integer`, foreign key to `roles.id`
    *   `token`: `text`, unique, not null (a cryptographically secure 64-character random string)
    *   `expires_at`: `timestamptz`, not null
    *   `created_at`: `timestamptz`
*   **`api_keys`**: Stores API keys for the scraper role and other programatic access.
    *   `id`: `uuid`, primary key
    *   `business_id`: `uuid`, foreign key to `businesses.id` (API keys are linked to a business, not a specific human user)
    *   `role_id`: `integer`, foreign key to `roles.id` (The role assigned to this key, e.g., 'scraper')
    *   `key_hash`: `text`, not null, unique (store hashed version of the key)
    *   `name`: `text` (e.g., "Production Scraper")
    *   `last_used_at`: `timestamptz` (optional, for auditing)
    *   `created_at`: `timestamptz`

#### 3.2. GraphQL API (`packages/server`)

A new `auth` module will be created under `packages/server/src/modules`.

*   **Schema (`schema.graphql`)**:
    *   **Types**: `AuthPayload { token: String! }`, `User`, `Role`, `Permission`, `ApiKey { id: ID!, name: String!, lastUsedAt: String, createdAt: String! }`, `GenerateApiKeyPayload { apiKey: String! }`.
    *   **Mutations**:
        *   `inviteUser(email: String!, role: String!, businessId: ID!): String!` - Returns an invitation URL. Restricted to users with `manage:users` permission.
        *   `acceptInvitation(token: String!, name: String!, password: String!): AuthPayload!` - Creates a new user and sets the JWT cookie.
        *   `login(email: String!, password: String!): AuthPayload!` - Authenticates a user and sets the JWT cookie.
        *   `logout`: Invalidates the session by clearing the JWT cookie.
        *   `generateApiKey(businessId: ID!, name: String!): GenerateApiKeyPayload!` - Generates a new API key for the `scraper` role linked to the specified business. Restricted to `business owner`.
        *   `revokeApiKey(id: ID!): Boolean!` - Revokes an API key.
*   **Services and Resolvers**:
*   **JWT Generation & Verification**: Use the `@graphql-yoga/plugin-jwt` for handling JWTs. This plugin will be configured to sign tokens on login/invitation acceptance and to verify them on every request. The JWT payload should contain `userId`, `email`, `roles`, `permissions`, and the expiration (`exp`).
*   **Password Hashing**: Use `bcrypt` to hash and compare passwords.    *   **Secure Invitation Token**: Use `crypto.randomBytes(32).toString('hex')` to generate a cryptographically secure, 64-character invitation token. This token would have a strict expiration (72 hours) enforced by the database or application logic to prevent brute-force attacks.    *   **`inviteUser`**: Generates a cryptographically secure random token, stores it in the `invitations` table with an expiration (72 hours), and returns a URL like `/accept-invitation?token=...`.
    *   **`acceptInvitation`**: Validates the token, checks for expiration, creates records in the `users` and `user-accounts` tables, links the user to the business in `business_users`, deletes the invitation, and sets the JWT cookie.
    *   **API Key Management**:
        *   **Generation**: Use `crypto.randomBytes(32).toString('hex')` to generate keys. Store a hashed version (e.g., using `bcrypt` or `argon2`) in the `api_keys` table with the associated `business_id` and `scraper` role. Only return the raw key to the user (admin) upon generation.
        *   **Validation**: When a request contains an API key header (e.g., `Authorization: Bearer <key>` or `X-API-Key: <key>`), hash the provided key and look it up in the `api_keys` table. If found, authenticate the request with the associated `business_id` and `role_id`.
*   **Authentication Plugin (`packages/server/src/plugins/auth-plugin.ts`)**:
    *   This plugin will be refactored to leverage `@graphql-yoga/plugin-jwt` for token validation, `@whatwg-node/server-plugin-cookies` for cookie management, and `@graphql-yoga/plugin-csrf-prevention` for security.
    *   The plugin will support dual authentication mechanisms:
        1.  **JWT from Cookie**: For standard browser-based users.
        2.  **API Key from Header**: For the `scraper` role/automated tools. Check for `Authorization` header. If the format is `Bearer <key>`, attempt to validate it as an API Key first (checking against DB hash). If valid, attach a context object containing the `businessId` and `role` (e.g., `scraper`) to the request, allowing access to resources within that business scope.
    *   The JWT plugin will be configured with a custom extractor to retrieve the token from the `access_token` cookie.
    *   On successful verification, the decoded JWT payload (containing the user's ID, roles, and permissions) will be attached to the GraphQL `context`. This avoids the need for extra database lookups on each request.
    *   The `validateUser` function will be updated to check `context.currentUser.permissions` (or a similar field populated by the JWT plugin) against the `@auth` directive's requirements.

#### 3.3. Client Application (`packages/client`)

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
    *   The Apollo Client does not need to manually attach the `Authorization` header (since the cookie is sent automatically by the browser). Instead, ensure `credentials: 'include'` is set in the Apollo Client configuration.
*   **Routing**:
    *   Implement a "protected route" component that wraps pages requiring authentication. If the user is not authenticated, they should be redirected to the `/login` page.

### 4. Error Handling

*   **Authentication Errors**: The GraphQL API should return standard `UNAUTHENTICATED` errors if a user's token is missing, invalid, or expired. The client should catch this error and redirect to the login page.
*   **Authorization Errors**: The API should return `FORBIDDEN` errors if a user attempts to perform an action they do not have permission for. The client should handle this gracefully, displaying an error message to the user.
*   **Invitation Errors**: The `acceptInvitation` mutation should handle cases where the token is invalid or expired, returning a clear error message.

### 5. Testing Plan

*   **Backend (Unit/Integration Tests)**:
    *   Test the `inviteUser`, `acceptInvitation`, and `login` mutations with valid and invalid inputs.
    *   Test password hashing and JWT generation/validation logic.
    *   Test **API Key authentication**: verify that a valid API key in the header authenticates the user, and an invalid one fails.
    *   Test the `auth-plugin`'s ability to correctly parse tokens and attach user context.
    *   Test the RBAC logic: ensure users can only access data and perform actions allowed by their roles. Create tests for each role (`employee`, `accountant`, etc.) to verify their specific restrictions.
*   **Client (Component/E2E Tests)**:
    *   Test the login and invitation acceptance forms.
    *   Test that the JWT is correctly stored and sent with API requests.
    *   Test the protected route logic, ensuring unauthorized users are redirected.
    *   Test that UI elements for restricted actions (e.g., "Manage Users" button) are hidden for users without the necessary permissions.
---
