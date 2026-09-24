# Unprovisioned New User — Handling Plan

**Problem:** a person who signs up through Auth0 Universal Login but has no row in
`accounter_schema.business_users` reaches the app in a broken state: no data, error toasts, and a
re-authentication prompt that can never succeed. This document traces the current behaviour, names
the root cause, and proposes a phased fix.

---

## 1. Current behaviour (traced)

### 1.1 Signup path

`packages/client/src/components/login-page.tsx:62` sends the user to Auth0 Universal Login. That
screen exposes a **Sign Up** tab whenever the Auth0 database connection allows public signups, so
anyone can mint an Auth0 identity. Nothing in the app authorises that identity against a tenant.

### 1.2 What the server does with the new identity

`AuthContextProvider.handleJwtAuth` verifies the JWT successfully, then calls `mapAuth0UserToLocal`
(`packages/server/src/modules/auth/providers/auth-context.provider.ts:484`), which:

1. looks up memberships by `auth0_user_id` → 0 rows;
2. falls back to a **verified-email** lookup, but only across `invitations` rows that are already
   `accepted_at IS NOT NULL` (`:503`) → 0 rows;
3. returns `null`.

`handleJwtAuth` then logs `User not found/linked in local DB` and returns a `null` auth context
(`:444`).

### 1.3 What the client sees

Every `@requiresAuth` field — including `userContext` — hits
`packages/server/src/modules/auth/directives/auth-directives.ts:141`:

```ts
if (!authContext?.user) {
  throw new GraphQLError('Authentication required', { extensions: { code: 'UNAUTHENTICATED' } })
}
```

That single error code drives three separate client behaviours, all wrong here:

| Client site                                         | Reaction                                                 | Why it's wrong                                               |
| --------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------ |
| `providers/urql.tsx:234` `didAuthError`             | classifies it as a token problem → `refreshAuth`         | the token is perfectly valid; refreshing changes nothing     |
| `providers/urql.tsx:256` `requestInteractiveReauth` | may open the session-expiry modal / Auth0 popup          | user is asked to sign in again, then lands in the same state |
| `providers/urql-error-handler.ts:22`                | `toast.error('Operation Error', …)` per failed operation | a wall of "Authentication required" toasts                   |

Meanwhile `UserProvider` (`providers/user-provider.tsx:130`) gets no `data`, leaves `userContext` at
`null`, and still renders `children` — so `ProtectedRoute` (`router/guards/auth-guards.tsx:29`)
passes (Auth0 says authenticated) and the dashboard shell renders empty over a failing query storm.
There is **no** screen, message, or exit ramp for this state.

### 1.4 The only real ways to get provisioned today

- **Invitation** — a `business_owner` creates one, the invitee opens the tokenised link
  (`/accept-invitation/:token`), and `acceptInvitation` (deliberately un-guarded,
  `modules/auth/typeDefs/auth.graphql.ts:32`) inserts the `business_users` row.
- **Super-admin bootstrap** — `bootstrapNewClient`, gated inside the provider by
  `requireSuperAdmin()` (`modules/onboarding/providers/admin-onboarding.provider.ts:89`).

Both are out-of-band. A user who signs up directly, or who signs up first and _then_ looks for the
invitation email, has no in-app path forward.

---

## 2. Root causes

1. **The API conflates "not authenticated" with "authenticated but not provisioned."** One
   `UNAUTHENTICATED` code for both makes the correct client response unknowable.
2. **The client has no notion of a provisioning state.** `ProtectedRoute` checks Auth0 only; the app
   assumes every authenticated user has ≥1 membership.
3. **Invitations are reachable only via the emailed token.** A verified-email match against a
   _pending_ invitation is never attempted — only against already-accepted ones.
4. **Public signup is enabled but leads nowhere.** Accounter is an invitation-only product, so
   signup should be closed at Auth0 — and until it is, the app must handle the users it produces.

---

## 3. Target UX

An authenticated user with zero memberships lands on a dedicated **`/welcome`** screen, never on a
broken dashboard. The screen branches on the real reason:

| State                       | Screen                                                                   |
| --------------------------- | ------------------------------------------------------------------------ |
| Email not verified          | "Verify your email" + resend + re-check button                           |
| Pending invitation(s) found | "You've been invited to _Acme Ltd_" → one-click Accept (no token needed) |
| Nothing pending             | "Accounter is invitation-only" → how to request access / sign out        |
| Membership exists           | normal app (no change)                                                   |

No toasts, no reauth modal, no empty dashboard, and always a way out (sign out / switch account).

---

## 4. Proposed changes

### Phase 0 — Stop the broken state (small, ship first)

**Server**

- Add error code `ONBOARDING_REQUIRED` in `auth-directives.ts`. When `rawAuth.authType === 'jwt'`
  and `AuthContextProvider.getJwtIdentity()` resolves (valid signature, real `sub`) but
  `getAuthContext()` is `null`, throw
  `new GraphQLError('No workspace linked to this account', { extensions: { code: 'ONBOARDING_REQUIRED' } })`
  instead of `UNAUTHENTICATED`. Every other path keeps `UNAUTHENTICATED` unchanged.
  `getJwtIdentity()` already exists and works without a `business_users` row
  (`auth-context.provider.ts:94`) — no new verification code is needed.
- Add an un-guarded `viewer` query (same posture as `acceptInvitation`), resolved from
  `getJwtIdentity()` alone:

  ```graphql
  enum ViewerStatus {
    ACTIVE
    EMAIL_UNVERIFIED
    NO_WORKSPACE
  }

  type Viewer {
    email: String
    emailVerified: Boolean!
    status: ViewerStatus!
  }

  extend type Query {
    viewer: Viewer
  }
  ```

  Returns `null` when there is no valid JWT at all. Deliberately leaks nothing beyond the caller's
  own token claims.

**Client**

- `providers/urql.tsx:234` — `didAuthError` must match `UNAUTHENTICATED` only, so
  `ONBOARDING_REQUIRED` never triggers `refreshAuth` or `requestInteractiveReauth`.
- `providers/urql-error-handler.ts` — suppress the toast for `ONBOARDING_REQUIRED`; the dedicated
  screen is the message.
- New `OnboardingGuard`, composed inside `ProtectedRoute` (`router/guards/auth-guards.tsx`): query
  `viewer`; if `status !== ACTIVE`, `<Navigate to={ROUTES.WELCOME} replace />`.
- New route `ROUTES.WELCOME = '/welcome'` + `components/screens/welcome.tsx` rendering the branches
  from §3. Always include **Sign out** and **Use a different account**.
- `screens/auth-callback.tsx:100` — when `viewer.status !== ACTIVE`, resolve `returnTo` to
  `/welcome` rather than `ROUTES.CHARGES.ROOT`.
- `UserProvider` — treat "authenticated, no context" as a first-class state rather than silently
  rendering children with `userContext: null`.

After Phase 0 the dead end is still a dead end, but it is an _explained_ one instead of a broken
app. Phases 1–2 open the exits.

### Phase 1 — Claim pending invitations without the email link

**Server**

- Extend `viewer` with `pendingInvitations: [PendingInvitation!]!` —
  `{ id, businessId, businessName, role, expiresAt }` — selected by
  `LOWER(email) = LOWER($jwtEmail) AND accepted_at IS NULL AND expires_at > NOW()`, and **only**
  when `email_verified` is true in the JWT.
- Add `claimInvitation(invitationId: ID!): AcceptInvitationPayload!` (un-guarded like
  `acceptInvitation`), reusing `AcceptInvitationsProvider`'s existing insert/accept logic. It must
  re-assert the verified-email match server-side — the id alone is not authorisation.

**Client**

- `/welcome` lists the invitations and calls `claimInvitation` via a hook under `src/hooks/`, then
  invalidates `viewer`/`userContext` and routes to `ROUTES.HOME`.

This alone resolves the most common real-world case: the user signed up before (or instead of)
clicking the emailed link.

### Phase 2 — Close public signup at Auth0

**Decided: Accounter stays invitation-only. There is no self-serve workspace creation.**

Disable sign-ups on the Auth0 database connection (Authentication → Database → _Disable Sign Ups_).
The invitation flow already pre-creates (blocked) Auth0 users
(`migrations/.../create-invitations-apikeys-tables.ts` header), so invited users can still register
and set a password; only uninvited strangers are turned away, at Auth0, before they ever reach the
app. Record the setting in `docs/user-authentication-plan/auth0-setup.md` and the operations
runbook.

Phases 0 and 1 are still required after this, and are not merely defensive:

- accounts created **before** the connection is locked down still exist and still land in the
  no-membership state;
- an invited user whose invitation has **expired or been revoked** before they accept has a valid
  Auth0 identity and no membership — a permanent, reachable state under invitation-only;
- social/enterprise connections (if any are ever enabled) do not honour the database connection's
  signup switch;
- a user removed from their last business (`removeBusinessUser`) lands in exactly this state.

So the Auth0 switch narrows the funnel; it does not remove the state. `/welcome` remains the
terminal screen for it, and its "nothing pending" branch should say the product is invitation-only
and point at how to request access — not offer a workspace-creation form.

**Sequence:** Phase 0 → Phase 1 → Phase 2. Do the config change last, so the app already handles
gracefully the accounts that exist by then.

---

## 5. Security notes

- `viewer` and `claimInvitation` stay outside `@requiresAuth` by necessity (the user has no auth
  _context_ yet), so both must verify the JWT via `getJwtIdentity()` themselves and expose nothing
  beyond the caller's own claims. Never trust a client-supplied email.
- Gate every invitation match on `email_verified === true`; otherwise an attacker signs up with a
  victim's address and claims their invitation. This mirrors the existing rule at
  `auth-context.provider.ts:551`.
- `ONBOARDING_REQUIRED` must not widen any data path — it changes only which error is reported, not
  whether the resolver runs.

## 6. Testing

- `modules/auth/directives/__tests__/auth-directives.test.ts` — valid JWT, no membership →
  `ONBOARDING_REQUIRED`; no/invalid token → still `UNAUTHENTICATED`.
- New `modules/common/__tests__/viewer.resolver.test.ts` — the three statuses; unverified email
  hides pending invitations.
- New `modules/auth/__tests__/claim-invitation.test.ts` — happy path, wrong email, expired,
  already-accepted, unverified email.
- Client: `OnboardingGuard` redirect; `/welcome` branch rendering; a urql test asserting
  `ONBOARDING_REQUIRED` does **not** trigger `refreshAuth` (guards the reauth-loop regression).

## 7. Files touched

**Server** — `modules/auth/directives/auth-directives.ts`,
`modules/auth/providers/auth-context.provider.ts` (expose the "identity without tenant" case),
`modules/common/typeDefs/user-context.graphql.ts` + new `viewer` resolver, and
`modules/auth/{typeDefs,resolvers,providers}` for `claimInvitation`.

**Client** — `providers/urql.tsx`, `providers/urql-error-handler.ts`, `providers/user-provider.tsx`,
`router/guards/auth-guards.tsx`, `router/routes.ts`, `router/config.tsx`,
`components/screens/auth-callback.tsx`, new `components/screens/welcome.tsx`, new hooks under
`src/hooks/`.

Run `yarn generate` after the schema changes, then `yarn lint`.
