# Authentication & Access Management UI Specification

## 1. Overview

This document outlines the requirements and implementation plan for a new "Auth Management" section
in the client application. It bridges the gap between the server's existing RBAC and Auth0
capabilities and the admin's ability to manage access for their business directly from the frontend.

The interface is built for the Business Admin (`business_owner` role) to independently handle
business users, pending invitations, and API keys.

## 2. User Stories

As an Admin (`business_owner`):

- I need to be able to generate API keys for automated processes (like scrapers).
- I need to see a list of all active API keys, their details (name, role, last used, created date),
  and revoke them if necessary.
- I need to invite new users to my business by specifying their email and role.
- I need to view all pending/active invitations, their details, and revoke them to cancel access
  before it's accepted.
- I need to view all existing users who have permissions in my business.
- I need to be able to block/remove a user from my business, revoking their local access without
  affecting their global Auth0 account (or access to other businesses).

## 3. Frontend Architecture

### 3.1. Routing & Navigation

- **New Top-Level Route**: Create a new route such as `/admin/auth` or
  `/businesses/:businessId/auth-management`. Ensure it is added to
  `packages/client/src/router/routes.ts` and configured in `packages/client/src/router/config.tsx`.
- **Protection**: The route must be strictly protected via auth guards. Only users possessing the
  `business_owner` role (or matching `userContext?.context.adminBusinessId`) can access this page.
- **Navigation Update**: The existing `UserNav` component
  (`packages/client/src/components/layout/user-nav.tsx`) must be updated to link to this new Auth
  Management page (adding to or sitting alongside the existing "Admin Configurations" link).

### 3.2. Page Structure: Tabbed Interface

The Auth Management page will be presented as a single unified dashboard divided into three main
Shadcn/UI Tabs (`Tabs`, `TabsList`, `TabsTrigger`, `TabsContent`):

#### A. Users Tab

- **View**: A data table displaying all users linked to the current business (`listBusinessUsers`),
  showing their name/email, assigned role, and join date.
- **Actions**: A "Remove/Block" action on each row. Revokes the user's access specifically for this
  business (`removeBusinessUser`).

#### B. Invitations Tab

- **View**: A data table displaying pending and active invitations (`listInvitations`), showing the
  invited email, intended role, expiration date, and status.
- **Actions**:
  - A "Revoke" action on each row to cancel an invitation before acceptance (`revokeInvitation`).
  - An "Invite New User" button that opens a `Dialog` with a form (using `react-hook-form` + `zod`)
    to capture an email address and select a role, invoking `createInvitation`.

#### C. API Keys Tab

- **View**: A data table displaying active API keys (`listApiKeys`), showing the key name, role,
  last used date, and creation date.
- **Actions**:
  - A "Revoke" action on each row to invalidate a token (`revokeApiKey`).
  - A "Generate API Key" button that opens a `Dialog` with a form to capture a name and select a
    role, invoking `generateApiKey`. The resulting plaintext token should be displayed in a
    temporary modal/alert for the user to copy (it is only shown once).

## 4. Backend Requirements (GraphQL Schema Expansions)

While some endpoints already exist (`listApiKeys`, `createInvitation`, `acceptInvitation`,
`generateApiKey`, `revokeApiKey`), the schema in
`packages/server/src/modules/auth/typeDefs/auth.graphql.ts` must be extended to support the
remaining user stories.

### 4.1. New Schema Definitions Needed

These additions execute securely under the current active database transaction (enforcing RLS
mapping to the current `app.current_business_id`).

```graphql
extend type Query {
  " Fetch all users associated with the current business context "
  listBusinessUsers: [BusinessUser!]! @requiresRole(role: "business_owner")

  " Fetch all pending or historical invitations for the current business "
  listInvitations: [InvitationPayload!]! @requiresRole(role: "business_owner")
}

extend type Mutation {
  " Removes a user's access to the current business without affecting their global Auth0 identity "
  removeBusinessUser(userId: ID!): Boolean! @requiresRole(role: "business_owner")

  " Revokes an invitation, preventing it from being accepted "
  revokeInvitation(id: ID!): Boolean! @requiresRole(role: "business_owner")
}

" Represents a user linked to the current business "
type BusinessUser {
  id: ID!
  email: String!
  name: String
  roleId: String!
  createdAt: DateTime!
}
```

## 5. Security & Isolation Considerations

- **Tenant Isolation**: Both frontend and backend implementations must guarantee that an admin can
  only manipulate users, invitations, and keys strictly associated with their own `adminBusinessId`.
- **RBAC Directives**: Every new backend mutation and query must enforce the
  `@requiresRole(role: "business_owner")` directive as defined in the schema.
- **Future Permissions**: Ensure the client-side role dropdowns default to standard roles
  (`employee`, `accountant`, `scraper`, `business owner`) but are mapped correctly to the existing
  DB IDs.

## 6. Data Handling & State Management

- **GraphQL Client (Urql)**:
  - All data fetching will be handled using Urql.
  - **Cache Invalidation**: Upon successful execution of any mutation (`generateApiKey`,
    `revokeApiKey`, `createInvitation`, `revokeInvitation`, `removeBusinessUser`), the Urql cache
    must be properly updated or invalidated to re-fetch the relevant lists (`listApiKeys`,
    `listInvitations`, `listBusinessUsers`). This ensures the UI instantly reflects changes without
    requiring a manual page refresh.
- **Form State**: Use `react-hook-form` integrated with `zod` for handling schema validations (e.g.,
  verifying valid email format for invitations, enforcing string lengths for API key names).
- **API Key Security**: The generated plaintext API key returned from the `generateApiKey` mutation
  **must not** be persisted in any client-side store or state manager after the user dismisses the
  creation modal. It should be rendered once with a "Copy to Clipboard" utility button, accompanied
  by a warning that it will never be accessible again.

## 7. Error Handling Strategies

- **GraphQL / Network Errors**:
  - Wrap API mutation calls in `try/catch` or check the `error` object returned from Urql's
    `useMutation`.
  - Present network and resolver-level errors (e.g., "User already exists", "Invitation expired") to
    the user using the application's global toast/notification system (e.g., Sonner).
- **Validation Errors**: Form validation errors (like missing fields or invalid emails) should be
  caught client-side by Zod and displayed inline beneath the respective input fields prior to
  submission.
- **Authorization Errors**: If an unauthorized user (non-admin) navigates directly to the route URL,
  the existing `ProtectedRoute` / Router constraints must securely intercept the request and
  redirect them to a fallback route (e.g., Dashboard or unauthorized page).

## 8. Testing Plan

To ensure high reliability and security, the implementation must be covered by the following testing
layers:

### 8.1. Backend / Server Tests (Vitest)

- **Resolver Isolation Tests**: Write tests ensuring that `listBusinessUsers` and `listInvitations`
  return _only_ the records for the currently authenticated `adminBusinessId` (verifying RLS and
  connection payload context).
- **Permission Tests**: Verify that calling `removeBusinessUser`, `revokeInvitation`, or
  `createInvitation` without the `business_owner` role actively throws an authorization error.
- **Mutation Logic Tests**: Ensure `removeBusinessUser` correctly unlinks the user from the
  `business_users` joining table without deleting the underlying user profile.

### 8.2. Frontend / Component Tests

- **Form Validation Tests**: Verify that the "Invite User" form rejects submissions with bad email
  formats, and the "Generate Key" form rejects empty names.
- **Role Display Tests**: Ensure that the raw DB role IDs are properly formatted to human-readable
  strings before display in the tables.

### 8.3. Integration / End-to-End Tests

- **Invitation Flow**: Simulate an Admin creating an invitation, verify it appears in the active
  list, then simulate a revocation and verify it disappears.
- **API Key Flow**: Simulate generating a new API key, verifying the modal appropriately surfaces
  the secret and standardizes the list, and then simulate a revoke action to remove it.
