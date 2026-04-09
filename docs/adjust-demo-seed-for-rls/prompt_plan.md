### The Blueprint: Iterative Implementation Plan

**Phase 1: Data Seeding (Foundation)**

- **Step 1:** Create the standalone `seedDemoUsers` helper. This is safe, isolated, and can be
  unit-tested or manually verified without touching existing auth logic.
- **Step 2:** Integrate `seedDemoUsers` into `seed-demo-data.ts`. Update the `TRUNCATE` tables to
  prevent foreign key or duplication errors. This completes the DB state needed for the next phases.

**Phase 2: Server-Side Auth Bypass (Backend Integration)**

- **Step 3:** Update Server Types and build `handleDevBypassAuth`. We'll create the isolated logic
  to look up a user by ID and construct an `AuthContext`, complete with unit tests.
- **Step 4:** Wire up the Auth Plugin. We'll add the `ALLOW_DEV_AUTH=1` guard, intercept the
  `X-Dev-Auth` header, and call the function from Step 3. We'll also add tests to guarantee the
  bypass strictly fails if `ALLOW_DEV_AUTH` is not set.

**Phase 3: Client-Side Auth Bypass (Frontend Integration)**

- **Step 5:** Update the URQL Client. Modify the GraphQL client to conditionally send the
  `X-Dev-Auth` header based on `VITE_DEV_AUTH`.
- **Step 6:** Bypass Frontend Guards and Providers. Conditionally render the `Auth0Provider` in
  `index.tsx`, disable route blocks in `auth-guards.tsx`, and mock the user context in
  `user-provider.tsx`.

**Phase 4: Documentation (Finalization)**

- **Step 7:** Update environment templates and staging guides so the team knows how to use this new
  tooling.

---

### Code-Generation Prompts

You can feed these prompts one by one into your code-generation LLM. They are designed to build
sequentially, ensuring no orphaned code.

#### Prompt 1: Demo Seed Helper

```text
We are adding a local development authentication bypass to our fullstack application (React/Node.js). Our first step is to create a helper that seeds deterministic demo users.

Create a new file: `packages/server/src/demo-fixtures/helpers/seed-demo-users.ts`.

Requirements:
1. Export an async function `seedDemoUsers(dbConnection, businessId)`.
2. Generate two deterministic UUIDs using a utility (assume `makeUUID('user', 'demo-admin')` and `makeUUID('user', 'demo-accountant')`).
3. Insert two records into the `business_users` table:
   - Admin: `role_id = 'business_owner'`, `auth0_user_id = process.env.DEMO_AUTH0_USER_ID ?? null`
   - Accountant: `role_id = 'accountant'`, `auth0_user_id = null`
4. Use `INSERT ... ON CONFLICT DO NOTHING` to ensure the script is idempotent.
5. Return an object containing both `adminUserId` and `accountantUserId`.
6. Write a brief unit test for this helper mocking the db connection to ensure the correct SQL structure is generated.
```

#### Prompt 2: Integrate Demo Seed Helper

```text
Building on the previous step, we need to integrate `seedDemoUsers` into our main seed script.

Modify the existing file: `seed-demo-data.ts`.

Requirements:
1. Locate the `TRUNCATE` array at the top of the file. Add `business_users` and `invitations` to this list so stale rows don't block re-seeding.
2. Locate the function `createAdminBusinessContext()`. Immediately after this function executes, call the new `seedDemoUsers(db, businessId)` helper.
3. Add a `console.log` that explicitly prints out the `adminUserId` and `accountantUserId` returned by the helper, instructing the developer to copy them into their `.env` file for local development bypass.
```

#### Prompt 3: Server Auth Context & Types

```text
Now we need to handle the server-side logic for the auth bypass. We'll start with the types and context provider.

Modify `packages/server/src/auth.ts` (or equivalent types file):
1. Extend the `RawAuth.authType` union type to include `'devBypass'`.

Modify `packages/server/src/auth-context.provider.ts`:
1. Add a new exported async function: `handleDevBypassAuth(db, userId: string)`.
2. This function should query the `business_users` table for the given `userId`.
3. If found, construct and return a standard `AuthContext` object, setting the `authType` to `'devBypass'`.
4. If not found, return null or throw an AuthenticationError.
5. Write unit tests for `handleDevBypassAuth` ensuring it returns the correct context for a valid mock user, and fails appropriately for an invalid one.
```

#### Prompt 4: Server Auth Plugin Integration

```text
Building on the `handleDevBypassAuth` function, we need to wire it into the incoming request lifecycle.

Modify `packages/server/src/auth-plugin.ts`:
1. Locate the `authPlugin()` middleware/function.
2. At the very top of the execution block, check for the presence of the `ALLOW_DEV_AUTH=1` environment variable.
3. Add a startup `console.warn('⚠️ DEV AUTH BYPASS ENABLED')` if this flag is true.
4. If `ALLOW_DEV_AUTH=1` is true, check the incoming request headers for `X-Dev-Auth`.
5. If the header exists, take its value (the userId), and await the `handleDevBypassAuth` function we created previously. Return this context, bypassing standard JWT/ApiKey checks.
6. Write unit tests for `authPlugin`:
   - Assert `X-Dev-Auth` is ignored if `ALLOW_DEV_AUTH` is missing or false.
   - Assert it calls `handleDevBypassAuth` if the flag is true and the header is present.
```

#### Prompt 5: Client URQL & Env config

```text
Now we move to the frontend client to send the bypass credentials.

Modify `packages/client/src/providers/urql.ts` (or your GraphQL client config):
1. Check for `import.meta.env.VITE_DEV_AUTH === '1'`.
2. Update the fetch exchange / auth exchange: if dev auth is enabled, inject the header `X-Dev-Auth: <VITE_DEV_AUTH_USER_ID>` instead of the standard `Authorization: Bearer <token>`.
3. Ensure that if `VITE_DEV_AUTH` is false, the existing Auth0 token logic remains completely untouched.
```

#### Prompt 6: Client Providers & Guards

```text
Our frontend still expects Auth0 to wrap the app. We need to conditionally bypass the Auth0Provider and frontend route guards.

Modify `packages/client/src/index.tsx` (or your root component):
1. Check `import.meta.env.VITE_DEV_AUTH === '1'`.
2. If true, skip rendering the `Auth0Provider` and render the `RouterProvider` (or app children) directly.

Modify `packages/client/src/auth-guards.tsx`:
1. If `VITE_DEV_AUTH === '1'`, bypass the guard logic and always render `{children}`.

Modify `packages/client/src/user-provider.tsx`:
1. If `VITE_DEV_AUTH === '1'`, conditionally skip the `useAuth0()` dependency hook (which would crash outside its provider).
2. Immediately fetch the `UserContext` graphQL query (relying on the URQL client from the previous step). Set a mock username like `'dev-user'`.
```

#### Prompt 7: Documentation and Environment

```text
Finally, we need to update our documentation so developers know how to use this bypass.

Modify `.env.example`:
1. Add the following keys with descriptive comments explaining they are for local development without Auth0:
   - `DEMO_AUTH0_USER_ID=`
   - `ALLOW_DEV_AUTH=1`
   - `VITE_DEV_AUTH=1`
   - `VITE_DEV_AUTH_USER_ID=`

Modify `demo-staging-guide.md` (or equivalent documentation):
1. Add a new section titled "Local Development (No Auth0)".
2. Briefly explain how to run the seed script to get the demo user IDs.
3. Explain how to configure the `.env` variables to enable the bypass.
4. Explain how to switch between the 'Admin' and 'Accountant' contexts by swapping the `VITE_DEV_AUTH_USER_ID`.
```
