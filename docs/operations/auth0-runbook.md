# Auth0 Operations Runbook

The production Auth0 tenant is shared by the web app and the MCP connectors. Record each value
before you change it, and keep a before/after log of every change.

Management API examples use these placeholders:

```bash
DOMAIN=<tenant>.us.auth0.com
TOKEN=<Management API token>
```

## Common Tasks

### Invite New User

What the code does today (`createInvitation`, `acceptInvitation`):

1.  A business owner calls the `createInvitation` mutation.
2.  The server creates a local placeholder user and calls `createBlockedUser`. That reuses an
    existing Auth0 user for the email, or else creates a `Username-Password-Authentication` user
    that is **blocked**, has an **unverified** email, and has a random temporary password that is
    discarded.
3.  The mutation returns a one-time `token`. **No email is sent.** Someone has to deliver the link
    `https://<frontend>/accept-invitation/<token>` to the invitee out of band. The invitation
    expires after 7 days.
4.  The invitee opens the link and signs in. `acceptInvitation` requires a signed-in user whose
    verified email matches the invitation email (case-insensitive).
5.  On acceptance the membership is bound to the signed-in Auth0 user. An unused invitation
    placeholder is unblocked (if it is the signed-in user) or deleted (if the invitee signed in with
    a different Auth0 user).

**How invitees sign in today:** with Google, using the invited email. Per the code, acceptance then
attaches the invitation to the Google user and removes the unused placeholder. _This is per code,
not yet verified end to end._

**Known gaps:**

- **Email/password invitees have no working path.** The placeholder is blocked and its password was
  discarded, so it cannot sign in. Signing up again with the same email collides with it.
  `sendPasswordResetEmail`
  (`packages/server/src/modules/auth/providers/auth0-management.provider.ts`) issues a
  password-change ticket but has no callers. Open gap, to be filed as a follow-up issue under #4611.
- **The web UI cannot deliver the link.** The client's `createInvitation` mutation
  (`packages/client/src/hooks/use-create-invitation.ts`) does not request `token`, yet it shows
  "Invitation sent successfully". To get a usable link, call `createInvitation` through the GraphQL
  API and select `token`.

### Reset User Password

Self-serve reset works only for users with a `Username-Password-Authentication` identity:

- Click "Forgot Password" on the Universal Login page
- Auth0 sends a password reset email
- User sets a new password

For a social-only user (for example, one who signed up with Google), Auth0 sends nothing and shows
no error; this is by design. To give such a user a password, follow
[Add an email/password login to a social-only user](#add-an-emailpassword-login-to-a-social-only-user).

### Revoke User Access

1.  Admin removes user from business via GraphQL mutation
2.  User record marked as inactive in local database
3.  RLS policies prevent data access
4.  Optional: Block user in Auth0 to prevent login

## Sign-in Methods

### Identity model

- A local user maps to exactly **one** Auth0 user ID (the token's `sub`). It is stored in
  `accounter_schema.business_users.auth0_user_id` on every membership row of that user, and in
  `accounter_schema.super_admins.auth0_user_id` for super-admins.
- Auth0 [account linking](https://auth0.com/docs/manage-users/user-accounts/user-account-linking)
  attaches extra identities (Google, email/password, …) to one **primary** user. Every linked
  sign-in method then yields the primary's `user_id` as `sub`, so several sign-in methods need no
  change in Accounter.
- **Email relink fallback** (`mapAuth0UserToLocal` in
  `packages/server/src/modules/auth/providers/auth-context.provider.ts`): when no `business_users`
  row matches the `sub`, and the access token carries a verified email that matches an **accepted
  invitation**, the server rewrites `auth0_user_id` on **all** of that local user's rows to the new
  `sub`. It never touches `super_admins`. An unlinked identity that signs in can therefore take over
  the mapping from the existing one.

### Add an email/password login to a social-only user

Placeholders: `<email>`; `<primary>`, the existing user's ID (for example
`google-oauth2|<Google account ID>`); `<local user id>`, the user's `business_users.user_id`. The
Management API token needs `read:users`, `create:users`, `update:users`, `read:connections` and
`create:user_tickets`.

1.  **Confirm the current mapping.**

    ```bash
    curl -s -H "Authorization: Bearer $TOKEN" \
      "https://$DOMAIN/api/v2/users-by-email?email=<email>" | jq '.[] | {user_id, identities}'
    ```

    Expect exactly one user, `<primary>`. If a `Username-Password-Authentication` user already
    exists for this email (for example, an invitation placeholder), stop and resolve it first.

    ```sql
    SELECT business_id, auth0_user_id
    FROM accounter_schema.business_users
    WHERE user_id = '<local user id>';

    SELECT auth0_user_id FROM accounter_schema.super_admins WHERE auth0_user_id = '<primary>';
    ```

    Every `business_users` row must hold `<primary>`. The second query tells you whether the user is
    a super-admin.

2.  **Create the database user** with the same email, already verified, and a random password that
    you discard.

    ```bash
    curl -s -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
      "https://$DOMAIN/api/v2/users" \
      -d '{"connection":"Username-Password-Authentication","email":"<email>","email_verified":true,"verify_email":false,"password":"<random, discarded>"}' \
      | jq '{user_id}'
    ```

    Note the returned `auth0|<id>`.

3.  **Link it immediately** as a secondary identity under `<primary>`, before anyone signs in with
    it. Until it is linked, a first sign-in with the new identity can make the email relink fallback
    overwrite `auth0_user_id` with `auth0|<id>`.

    ```bash
    curl -s -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
      "https://$DOMAIN/api/v2/users/<primary>/identities" \
      -d '{"provider":"auth0","user_id":"<id>"}' | jq '.[] | {provider, user_id}'
    ```

    `user_id` here is the part after `auth0|`. The response lists both identities.

4.  **Issue a password-change ticket.** Look up the connection ID, then create the ticket:

    ```bash
    curl -s -H "Authorization: Bearer $TOKEN" \
      "https://$DOMAIN/api/v2/connections?name=Username-Password-Authentication&fields=id" | jq .
    
    curl -s -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
      "https://$DOMAIN/api/v2/tickets/password-change" \
      -d '{"email":"<email>","connection_id":"<connection id>","ttl_sec":86400}' | jq .
    ```

    The API returns a `ticket` URL and **sends no email**. The link sets the password, so treat it
    as a credential: send it to the user privately and don't paste it into tickets or chat history.

5.  **Verify.** After the user sets a password, they sign in once with email/password and once with
    Google. In Auth0 Logs, both `s` events show the same `user_id`, `<primary>`. Both sessions show
    the same businesses, and the step 1 query still returns `<primary>` on every row.

6.  **Rollback.** Unlink the identity, then delete the database user:

    ```bash
    curl -s -X DELETE -H "Authorization: Bearer $TOKEN" \
      "https://$DOMAIN/api/v2/users/<primary>/identities/auth0/<id>" | jq .
    curl -s -o /dev/null -w "%{http_code}\n" -X DELETE -H "Authorization: Bearer $TOKEN" \
      "https://$DOMAIN/api/v2/users/auth0%7C<id>"
    ```

    Expect `204` from the delete. Re-run the step 1 queries.

### Unlink an identity

```bash
curl -s -X DELETE -H "Authorization: Bearer $TOKEN" \
  "https://$DOMAIN/api/v2/users/<primary>/identities/<provider>/<id>" | jq .
```

- The primary keeps its `user_id`, so `business_users` and `super_admins` are unchanged.
- The unlinked identity becomes a separate Auth0 user, `<provider>|<id>`, with no local mapping. If
  it signs in and the email relink fallback applies, it **takes over** every `business_users` row of
  the local user, and the primary sign-in method stops resolving. Unless that is the intent, delete
  or block the unlinked user right after unlinking.

### Change a user's primary login

Auth0 has no "swap primary" call. Unlink the secondary, then link the old primary under it. The
user's `sub` becomes the new primary's `user_id`, so the database has to follow:

1.  Record the current state (step 1 of the procedure above).
2.  Unlink `<new primary>` from `<old primary>`, then link `<old primary>` under `<new primary>`
    with `POST /api/v2/users/<new primary>/identities`. If the old primary has other linked
    identities, unlink each one first and link it under the new primary too.
3.  Immediately update the mapping, as a role that can write `super_admins` (the app role can only
    read it):

    ```sql
    BEGIN;
    UPDATE accounter_schema.business_users
      SET auth0_user_id = '<new primary>', updated_at = NOW()
      WHERE user_id = '<local user id>';
    UPDATE accounter_schema.super_admins
      SET auth0_user_id = '<new primary>'
      WHERE auth0_user_id = '<old primary>';
    COMMIT;
    ```

    Leave `audit_logs.auth0_user_id` alone; it records history.

4.  Verify as in step 5 of the procedure above, expecting `<new primary>`.
5.  Rollback: reverse the link and the `UPDATE`s.

Between steps 2 and 3, the email relink fallback may already rewrite `business_users` on its own,
but not `super_admins`, so don't skip step 3.

### Optional: Universal Login hint for social users

Not required by the procedures above. A tenant text customization (Branding → Universal Login →
custom text for the login prompt) can tell social users where to go, for example: "Signed up with
Google? Use _Continue with Google_." Record it here if it is configured.

## Troubleshooting

#### User Cannot Log In

- Check Auth0 dashboard: User → View → Blocked status
- Check local database: business_users table, auth0_user_id mapping
- Check Auth0 logs: Dashboard → Monitoring → Logs
- Verify email verified in Auth0
- "Forgot Password" does nothing: the user is social-only (see
  [Reset User Password](#reset-user-password))
- Signed in, but sees no businesses: the `sub` in Auth0 Logs doesn't match `auth0_user_id` (see
  [Identity model](#identity-model))

#### JWT Verification Failing

- Check server logs for specific error
- Verify AUTH0_DOMAIN and AUTH0_AUDIENCE config
- Test JWKS endpoint: `curl https://{domain}/.well-known/jwks.json`
- Decode JWT at jwt.io and verify claims

#### Performance Issues

- Check Auth0 status: https://status.auth0.com
- Monitor JWT verification latency (should be < 50ms)
- Check JWKS caching (should cache for 10+ minutes)
- Verify database connection pool not exhausted

## MCP Connectors

The Auth0 applications behind the MCP connectors (Claude, Cursor) and their recorded configuration
are documented in
[`packages/mcp-server/docs/connecting-clients.md`](../../packages/mcp-server/docs/connecting-clients.md).
