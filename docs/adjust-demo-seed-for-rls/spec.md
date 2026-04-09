## Plan: Fix Demo Seed for RLS + Auth0

The `seed-demo-data.ts` script creates an admin business but no `business_users` row, so no one can
authenticate and see the seeded data. We fix this with three changes: (1) seed `business_users` rows
for demo users, (2) add an `X-Dev-Auth: <user-id>` header-based bypass on the server (guarded by
`ALLOW_DEV_AUTH=1`), and (3) add a `VITE_DEV_AUTH=1` client mode that skips Auth0Provider and sends
the bypass header.

### Phase 1: Seed Script — Create Demo Users

1. **Add `business_users` and `invitations` to the TRUNCATE list** in seed-demo-data.ts so stale
   rows don't block re-seeding.

2. **Create `seedDemoUsers()` helper** — new file
   `packages/server/src/demo-fixtures/helpers/seed-demo-users.ts`:
   - Inserts two `business_users` rows with deterministic UUIDs (`makeUUID('user', 'demo-admin')`,
     `makeUUID('user', 'demo-accountant')`):
     - **Admin**: `role_id = 'business_owner'`,
       `auth0_user_id = process.env.DEMO_AUTH0_USER_ID ?? null`
     - **Accountant**: `role_id = 'accountant'`, `auth0_user_id = null`
   - `INSERT ... ON CONFLICT DO NOTHING` for idempotency
   - Returns both user_ids

3. **Call `seedDemoUsers()` in seed-demo-data.ts** after `createAdminBusinessContext()`, log both
   user_ids so developer can copy them into .env.

### Phase 2: Server — X-Dev-Auth Bypass (_parallel with Phase 3_)

4. **Extend `RawAuth.authType`** in auth-plugin.ts to include `'devBypass'`.

5. **Add `X-Dev-Auth` header detection** in `authPlugin()` — only when `ALLOW_DEV_AUTH=1` env var is
   set. Header value = `user_id`. Checked before jwt/apiKey.

6. **Add `handleDevBypassAuth()`** in auth-context.provider.ts — queries `business_users` by
   `user_id`, constructs `AuthContext` with resolved business/role.

7. **Update `AuthContext` type** in auth.ts if needed — accept `'devBypass'` in `authType`.

8. **Log startup warning** when `ALLOW_DEV_AUTH=1`: `⚠️ DEV AUTH BYPASS ENABLED`.

### Phase 3: Client — VITE_DEV_AUTH Mode (_parallel with Phase 2_)

9. **Modify index.tsx** — when `VITE_DEV_AUTH=1`, skip `Auth0Provider`, render `RouterProvider`
   directly.

10. **Update urql client** in urql.ts — in dev auth mode, send `X-Dev-Auth: <VITE_DEV_AUTH_USER_ID>`
    header instead of `Authorization: Bearer`.

11. **Bypass auth guards** in auth-guards.tsx — when `VITE_DEV_AUTH=1`, always render children.

12. **Update user-provider.tsx** — skip `useAuth0()` dependency, immediately fetch `UserContext`
    query, use `'dev-user'` as username.

### Phase 4: Documentation & .env Updates

13. **Update `.env.example`** with: `DEMO_AUTH0_USER_ID`, `ALLOW_DEV_AUTH`, `VITE_DEV_AUTH`,
    `VITE_DEV_AUTH_USER_ID`.

14. **Update demo-staging-guide.md** — add "Local Development (No Auth0)" section.

### Phase 5: Verification

15. **Unit tests**: `X-Dev-Auth` recognized only when `ALLOW_DEV_AUTH=1`, ignored otherwise. Valid
    `user_id` resolves correctly; invalid returns null.

16. **Manual verification**:
    - `ALLOW_DEMO_SEED=1 yarn seed:staging-demo` → user_ids logged
    - Server with `ALLOW_DEV_AUTH=1` + client with
      `VITE_DEV_AUTH=1 VITE_DEV_AUTH_USER_ID=<admin-uuid>`
    - App loads without Auth0 login, dashboard shows seeded data
    - Switch to accountant `user_id` → verify role context changes

### Relevant Files

- seed-demo-data.ts — TRUNCATE fix + call seedDemoUsers()
- `packages/server/src/demo-fixtures/helpers/seed-demo-users.ts` — **NEW**
- auth-plugin.ts — devBypass authType
- auth-context.provider.ts — handleDevBypassAuth()
- index.tsx — conditional Auth0Provider
- packages/client/src/providers/urql.ts — X-Dev-Auth header
- auth-guards.tsx — bypass guards
- user-provider.tsx — skip useAuth0()

### Decisions

- Staging always uses real Auth0 via `DEMO_AUTH0_USER_ID`. Dev bypass is local-only.
- Two demo users: admin (business_owner) + accountant, same business.
- `ALLOW_DEV_AUTH=1` is the only production guard (no `NODE_ENV` check — the flag itself is the
  gate).
- RLS `app.auth_type` will be set to `'devBypass'` — existing `owner_id`-based policies work
  unchanged since `business_id` is still set.
