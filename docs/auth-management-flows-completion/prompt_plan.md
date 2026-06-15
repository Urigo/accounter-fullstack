## Phase 1: Blueprint Strategy

The system consists of independent backend schema/resolver functions and a robust client-side UI
requiring routing, layouts, tables, and modal forms. To achieve this cleanly:

1.  **Backend First**: We must expand the GraphQL schema and regenerate types.
2.  **Providers & Resolvers**: Implement database-level interactions and API resolvers mapped to the
    new schema, enforcing Role-Based Access Control (RBAC) and Row-Level Security (RLS) policies.
3.  **Frontend Plumbing**: Scaffold the new protected route, add it to the main navigation, and set
    up the empty tabbed layout.
4.  **Frontend Features (Iterative)**: Implement one tab at a time (API Keys, Invitations, Users),
    handling its respective tables, empty states, and forms.

## Phase 2: Iterative Chunking & Evaluation

**Attempt 1 (Too broad)**

1. Backend (Schema + Resolvers)
2. Frontend (Router + Layout + All 3 Tabs) _Critique 1_: "All 3 Tabs" is a massive jump in
   complexity involving multiple forms, Zod schemas, table generations, and diverse API calls. The
   AI will likely drop context or skip error handling.

**Attempt 2 (Better, but Backend is still large)**

1. Backend Schema
2. Backend Providers & Resolvers
3. Frontend Route & Wrapper
4. API Key Tab
5. Invitations Tab
6. Users Tab _Critique 2_: "Backend Providers & Resolvers" for 4 separate mutations/queries across
   two completely different domain entities (Users and Invitations) is prone to testing gaps. Let's
   split them.

**Attempt 3 (Right-Sized & Safe)**

1. **Schema & Types**: Add GraphQL definitions and run type generation.
2. **Backend - Users Context**: Implement Providers/Resolvers for `listBusinessUsers` and
   `removeBusinessUser` with unit tests.
3. **Backend - Invitations Context**: Implement Providers/Resolvers for `listInvitations` and
   `revokeInvitation` with unit tests.
4. **Frontend - Routing & Shell**: Create the protected route, update the user nav, scaffold the
   Shadcn/UI Tabs.
5. **Frontend - API Keys Tab**: Implement generating keys (with copy state) and revoking them.
6. **Frontend - Invitations Tab**: Implement listing, creating (Zod form), and revoking invitations.
7. **Frontend - Users Tab**: Implement listing and removing active users.

---

## Phase 3: Code-Generation Prompts

Below are the carefully scoped prompts. Feed these one by one to your code-generation LLM.

### Prompt 1: Backend Schema Expansion

```text
We are implementing a new "Auth Management" dashboard for business admins. Our first step is to extend our GraphQL schema to support viewing users, returning existing invitations, and removing users/invitations.

Please perform the following steps:
1. Open `packages/server/src/modules/auth/typeDefs/auth.graphql.ts`.
2. Add a new type `BusinessUser` which includes `id: ID!`, `email: String!`, `name: String`, `roleId: String!`, and `createdAt: DateTime!`.
3. In the `Query` extension, add `listBusinessUsers: [BusinessUser!]!` and `listInvitations: [InvitationPayload!]!`. Both must have the directive `@requiresRole(role: "business_owner")`.
4. In the `Mutation` extension, add `removeBusinessUser(userId: ID!): Boolean!` and `revokeInvitation(id: ID!): Boolean!`. Both must have the directive `@requiresRole(role: "business_owner")`.
5. Run the repository schema generation command `yarn generate` to update all backend and frontend types. Do not write implementation code yet, just ensure the types compile successfully.
```

### Prompt 2: Backend Providers & Resolvers (Users)

```text
Building on our updated GraphQL schema, we need to implement the backend logic to list and remove business users.
We operate in a highly isolated multi-tenant environment. DB interactions must respect `app.current_business_id`.

Please perform the following:
1. In the auth module providers (`packages/server/src/modules/auth/providers/`), add strict methods to query `business_users` joining against `users` to implement `listBusinessUsers`.
2. Add a method `removeBusinessUser` that deletes the relation in `business_users` safely.
3. In the auth resolvers (`packages/server/src/modules/auth/resolvers/`), implement the resolver mappings for `Query.listBusinessUsers` and `Mutation.removeBusinessUser`.
4. Ensure dependency injection is used correctly (`context.injector.get(...)`).
5. Write unit tests for these two provider methods in the corresponding `.spec.ts` files, ensuring that attempting to interact outside the admin's scope is handled correctly.
```

### Prompt 3: Backend Providers & Resolvers (Invitations)

```text
Now that users are handled, we must address the backend logic for business invitations.

Please perform the following in a test-driven manner:
1. In the auth module providers, implement a method to query the invitations table for the current business context (`listInvitations`).
2. Implement a method `revokeInvitation` that safely deletes or invalidates a given invitation record. It must verify the invitation belongs to the current business before acting.
3. Update the auth resolver file to map `Query.listInvitations` and `Mutation.revokeInvitation` to these new provider methods.
4. Add unit test coverage in the provider `.spec.ts` files verifying correct isolation and deletion logic.
```

### Prompt 4: Frontend Routing & Navigation Shell

```text
With our backend ready, we will set up the frontend plumbing for the Auth Management page.

Please perform the following:
1. Create a placeholder component at `packages/client/src/components/admin-settings/auth-management/index.tsx`. It should render a layout container with a title "Access Management" and a Shadcn `Tabs` component with three triggers: "API Keys", "Invitations", and "Users". Render a simple text placeholder inside each `TabsContent`.
2. In `packages/client/src/router/routes.ts`, add an entry for `AUTH_MANAGEMENT: (businessId: string) => /businesses/${businessId}/auth-management`.
3. In `packages/client/src/router/config.tsx`, import this page lazily and map it as a new route. It must be wrapped in your `ProtectedRoute` and ensure it sits within the standard Dashboard/Business layout where the `adminBusinessId` is guaranteed.
4. In `packages/client/src/components/layout/user-nav.tsx`, find the logic that renders the "Admin Configurations" `<DropdownMenuItem>`. Right below it, add a new `<DropdownMenuItem>` linking to `ROUTES.BUSINESSES.AUTH_MANAGEMENT(userContext.context.adminBusinessId)`.
```

### Prompt 5: Frontend API Keys Management Tab

```text
We will now implement the first tab: API Keys.

Please perform the following:
1. Create an `ApiKeysTab` component (`packages/client/src/components/admin-settings/auth-management/api-keys-tab.tsx`).
2. Write a urql GraphQL query for `listApiKeys` and a mutation for `revokeApiKey`. Also import the existing `generateApiKey` mutation.
3. Build a data table displaying the `listApiKeys` payload. Add a "Revoke" button on each row that calls `revokeApiKey` and updates the urql cache.
4. Add a "Generate New Key" button that opens a `Dialog` (Shadcn modal).
5. Inside the Dialog, build a form using `react-hook-form` and `zod` requiring a `name` and a selected `roleId`.
6. Upon mutation success, displaying the raw plaintext token back to the user *once*. Provide a simple "Copy" to clipboard button and an alert warning them to save it immediately.
7. Hook this `ApiKeysTab` up to your placeholder in `packages/client/src/components/admin-settings/auth-management/index.tsx`.
```

### Prompt 6: Frontend Invitations Management Tab

```text
We will now implement the Invitations tab.

Please perform the following:
1. Create an `InvitationsTab` component.
2. Define the exact urql queries and mutations for `listInvitations`, `createInvitation`, and `revokeInvitation`.
3. Build a data table showing pending invitations. It should map the roles beautifully and display expiration dates. Include a "Revoke" action on each row. Wrap the revoke action in a confirmation prompt, and upon execution, invalidate/update the cache.
4. Add an "Invite User" `Dialog` with a `react-hook-form` capturing `email` (Zod validated) and `roleId`.
5. Handle mutation errors gracefully (e.g., if a user is already invited) by showing an error via the application's toast notification system.
6. Connect `InvitationsTab` to the main Auth Management layout.
```

### Prompt 7: Frontend Users Management Tab

```text
Finally, we will implement the Users tab to lock everything in.

Please perform the following:
1. Create a `BusinessUsersTab` component.
2. Write queries and mutations for `listBusinessUsers` and `removeBusinessUser`.
3. Build the data table to display the user names, email, and roles.
4. Include a "Remove User" button on each row. Since this is a destructive action, executing this must open an "Are you sure?" confirmation dialog.
5. Provide strong UI fallbacks (empty state "No users found", loading skeletons).
6. Wire it into the main layout component. Run all client tests to verify UI forms (`yarn test`), clean up any orphaned imports, and ensure the entire feature flows sequentially from Nav -> Auth Management Page -> Individual Tabs.
```
