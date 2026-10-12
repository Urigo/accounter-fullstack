# Auth0 Operations Runbook

## Common Tasks

### Invite New User

1.  Admin creates invitation via GraphQL mutation
2.  System calls Auth0 Management API to create blocked user
3.  Invitation email sent with magic link
4.  User clicks link, sets password, account unblocked
5.  User can now log in via Auth0 Universal Login

### Reset User Password

Users with an email/password login can self-serve password resets via Auth0 Universal Login:

- Click "Forgot Password" on login page
- Auth0 sends password reset email
- User sets new password

This only works for users that have a `Username-Password-Authentication` (database) identity. A user
who signed up with a social connection such as Google has no password to reset, and Auth0 sends
nothing, by design. To give such a user a password, follow
[Add an Email/Password Login to a Social-Only User](#add-an-emailpassword-login-to-a-social-only-user).

### Add an Email/Password Login to a Social-Only User

Use this when a user who signed up with a social connection (for example Google) also wants to sign
in with email and password. It uses Auth0 account linking, so it needs no database change.

#### How it works

Accounter links each local user to exactly **one** Auth0 user ID (the token's `sub`). It is stored
in `accounter_schema.business_users.auth0_user_id` (one row per membership, the same value on every
row) and, for super-admins, in `accounter_schema.super_admins.auth0_user_id`.

Account linking merges a **secondary** identity into a **primary** Auth0 user. Whichever method the
user then signs in with, the token's `sub` is the primary's user ID. So the plan is: keep the
existing social user as the primary, and link a new database identity under it as the secondary.

> **Link before first use.** If a login's `sub` is unknown, `mapAuth0UserToLocal`
> (`packages/server/src/modules/auth/providers/auth-context.provider.ts`) can fall back to the
> email. When the access token carries `email` with `email_verified: true`, and the user has
> accepted an invitation, it **overwrites** `auth0_user_id` on all of that user's `business_users`
> rows with the new `sub`. It does not touch `super_admins`. A database identity that signs in
> before it is linked can therefore take over the user's mapping, and drop their super-admin access.
> Run steps 3 and 4 back to back, and don't hand out a password until step 5.

#### Prerequisites

- Auth0 tenant admin access, and a Management API token: Dashboard → Applications → APIs → Auth0
  Management API → API Explorer (valid for 24 hours). The examples below use
  `export TOKEN=… DOMAIN=…`. Keep the token out of tickets, chat and shell history you share.
- Read-only access to the production database.
- The ID of the `Username-Password-Authentication` connection (`con_…`): Dashboard → Authentication
  → Database, or `GET /api/v2/connections?name=Username-Password-Authentication`.

Record every value you read (user IDs, identities, DB rows) before changing anything, so the change
can be rolled back.

#### Steps

1. **Find the user's primary Auth0 user.** Dashboard → User Management → Users → search the email,
   or:

   ```bash
   curl -s -H "Authorization: Bearer $TOKEN" \
     "https://$DOMAIN/api/v2/users-by-email?email=<URL-encoded email>"
   ```

   - Expect **one** user, with a social user ID such as `google-oauth2|…` and
     `email_verified: true`. This is the primary.
   - If an `auth0|…` user with the same email already exists, **stop**. Note whether it is `blocked`
     and what `app_metadata.registered_by` says (`accounter` means an Accounter invitation created
     it). Then decide whether to link that user rather than create a new one, and check the DB
     (step 2) for any row that references it.

2. **Confirm that Accounter stores the same `sub`.** Read-only:

   ```sql
   SELECT bu.user_id, bu.business_id, bu.role_id, bu.auth0_user_id, i.accepted_at
   FROM accounter_schema.invitations i
   JOIN accounter_schema.business_users bu ON bu.user_id = i.user_id
   WHERE lower(i.email) = lower('<email>');

   -- If there is no invitation row, look the user up by the primary's user ID:
   SELECT user_id, business_id, role_id, auth0_user_id
   FROM accounter_schema.business_users
   WHERE auth0_user_id = '<primary user ID>';

   SELECT * FROM accounter_schema.super_admins WHERE auth0_user_id = '<primary user ID>';
   ```

   **Every** `auth0_user_id` must equal the primary's user ID from step 1. If any row holds a
   different `sub`, stop and find out why before linking.

3. **Create the database identity.** Dashboard: Users → Create User → Connection
   `Username-Password-Authentication`, the same email, and a long random password that you discard.
   API:

   ```bash
   curl -s -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
     "https://$DOMAIN/api/v2/users" \
     -d '{"connection":"Username-Password-Authentication","email":"<email>","password":"<random, discard>","email_verified":true}'
   ```

   - `email_verified: true` is justified because the social provider already verified this email
     (step 1). Don't set it if the primary's email isn't verified.
   - "Disable Sign Ups" on the connection doesn't block users created by an admin.
   - Record the new user's ID (`auth0|…`) and its `identities[0].provider` and
     `identities[0].user_id`.

4. **Link it immediately**, as the secondary under the primary. The dashboard has no linking UI, so
   use the [Management API](https://auth0.com/docs/api/management/v2/users/post-identities):

   ```bash
   curl -s -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
     "https://$DOMAIN/api/v2/users/<URL-encoded primary user ID>/identities" \
     -d '{"provider":"auth0","user_id":"<secondary identities[0].user_id>","connection_id":"con_…"}'
   ```

   - `user_id` is the secondary's `identities[0].user_id`: the ID **without** the `auth0|` prefix.
   - The response lists **two** identities: the social one and `auth0`.
   - Afterwards, `users-by-email` returns only the primary, now with both identities. The
     secondary's `user_metadata` and `app_metadata` are discarded, and it no longer appears as a
     separate user.

5. **Let the user set a password.** Create a password-change ticket for the database identity:

   ```bash
   curl -s -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
     "https://$DOMAIN/api/v2/tickets/password-change" \
     -d '{"email":"<email>","connection_id":"con_…","ttl_sec":86400,"result_url":"<frontend URL>/login"}'
   ```

   - The API **returns a URL and sends no email.** The URL is a credential: send it to the user
     through a private channel, never a public ticket or a shared chat.
   - Alternative: `POST https://$DOMAIN/dbconnections/change_password` with
     `{"client_id":"<web app client ID>","email":"<email>","connection":"Username-Password-Authentication"}`
     makes Auth0 email the reset link itself. This requires a working tenant email provider.

6. **Verify.**
   - The user signs in to the web app with email and password, then separately with the social
     connection. Both show the same businesses and roles.
   - In Dashboard → Monitoring → Logs, both successful logins (type `s`) carry the same user ID, the
     primary's.
   - Re-run the queries from step 2: `auth0_user_id` is unchanged.

#### Rollback

1. Unlink the secondary:

   ```bash
   curl -s -X DELETE -H "Authorization: Bearer $TOKEN" \
     "https://$DOMAIN/api/v2/users/<URL-encoded primary user ID>/identities/auth0/<secondary identities[0].user_id>"
   ```

   This restores the `auth0|…` user as a standalone user.

2. Delete that user straight away, before anyone signs in with it (see "Link before first use"
   above):

   ```bash
   curl -s -X DELETE -H "Authorization: Bearer $TOKEN" \
     "https://$DOMAIN/api/v2/users/auth0%7C<secondary identities[0].user_id>"
   ```

The primary, and so `business_users.auth0_user_id` and `super_admins.auth0_user_id`, are not changed
by linking, unlinking or deleting the secondary. The social login keeps working throughout.

#### Invitations for a linked user

Inviting a linked user to another business reuses their primary: the invitation looks the email up
in Auth0, and a primary with a linked database identity is the one it picks. It never creates,
unblocks or deletes a user that already exists, and accepting requires the user to be signed in with
the matching verified email. Don't send an invitation for the email between steps 3 and 4, when the
unlinked `auth0|…` user would be picked instead.

### Revoke User Access

1.  Admin removes user from business via GraphQL mutation
2.  User record marked as inactive in local database
3.  RLS policies prevent data access
4.  Optional: Block user in Auth0 to prevent login

### Troubleshooting

#### User Cannot Log In

- Check Auth0 dashboard: User → View → Blocked status
- Check local database: business_users table, auth0_user_id mapping
- Check Auth0 logs: Dashboard → Monitoring → Logs
- Verify email verified in Auth0

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
