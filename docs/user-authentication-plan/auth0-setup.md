# Auth0 Setup Guide

This document describes the Auth0 setup required for the Accounter authentication flow. It is
aligned with:

- `docs/user-authentication-plan/blueprint.md` (Phase 4)
- `docs/user-authentication-plan/prompt_plan.md` (Step 4.1-4.7)
- Current implementation in `packages/server` and `packages/client`

## 1. Architecture Summary

Auth0 is the identity provider for user authentication.

- Auth0 responsibilities:
  - Login and session management
  - Password reset / email verification
  - JWT issuance
- Accounter responsibilities:
  - Map Auth0 `sub` (`auth0_user_id`) to local `business_users`
  - Tenant authorization and role resolution
  - API key auth (non-Auth0 flow)

## 2. What Must Exist in Auth0

Create or verify the following objects in the Auth0 tenant.

### 2.1 Regular Web Application (Frontend Login)

Create an Auth0 Application of type `Regular Web Application`.

Configure:

- `Allowed Callback URLs`:
  - `http://localhost:3001/auth/callback`
  - `https://<your-frontend-domain>/auth/callback`
- `Allowed Logout URLs`:
  - `http://localhost:3001`
  - `https://<your-frontend-domain>`
- `Allowed Web Origins`:
  - `http://localhost:3001`
  - `https://<your-frontend-domain>`
- `Allowed Origins (CORS)`:
  - `http://localhost:3001`
  - `https://<your-frontend-domain>`

Save:

- `Domain`
- Frontend `Client ID`

Refresh token requirements (critical for `getAccessTokenSilently` token renewal):

- Enable `Refresh Token Rotation`
- Configure both `Absolute Expiration` and `Inactivity Expiration`
- Ensure `Grant Types` include `Authorization Code` and `Refresh Token`

Note:

- If using `@auth0/auth0-react` in a browser-only SPA, ensure application type and grant settings
  are compatible with SPA + PKCE flows in your tenant policy.

### 2.2 API (Backend JWT Audience)

Create or verify an Auth0 API that represents the GraphQL backend.

Configure:

- `Identifier` (this becomes backend audience), for example:
  - `https://api.accounter.com`
- `Signing Algorithm`:
  - `RS256`
- `Allow Offline Access`:
  - Enabled (required for `offline_access` scope and refresh token issuance)

Save:

- API `Identifier` (used as `AUTH0_AUDIENCE` and `VITE_AUTH0_AUDIENCE`)

### 2.3 Machine-to-Machine Application (Management API)

Create a Machine-to-Machine application for server-side invitation/user lifecycle operations.

Authorize it against `Auth0 Management API` with at least:

- `read:users`
- `create:users`
- `update:users`
- `delete:users`
- `create:user_tickets` (required for password reset tickets)

Save:

- M2M `Client ID`
- M2M `Client Secret`

### 2.4 Database Connection

Enable `Username-Password-Authentication` connection.

This is required because backend invitation flow creates blocked users with:

- `connection: 'Username-Password-Authentication'`

## 3. Backend Environment Configuration

Auth0 configuration is read from `packages/server/src/environment.ts`.

Set the following env vars (typically in your root `.env` that server loads):

```bash
# JWT verification
AUTH0_DOMAIN=<tenant>.auth0.com
AUTH0_AUDIENCE=https://api.accounter.com

# Management API credentials (M2M app)
AUTH0_CLIENT_ID=<m2m-client-id>
AUTH0_CLIENT_SECRET=<m2m-client-secret>
AUTH0_MANAGEMENT_AUDIENCE=https://<tenant>.auth0.com/api/v2/

# Optional but recommended for Auth0 password ticket redirect
FRONTEND_URL=http://localhost:3001
```

Notes:

- `AUTH0_MANAGEMENT_AUDIENCE` must usually be `https://<tenant>.auth0.com/api/v2/`
- If any Auth0 variable is set, all required Auth0 variables must be set (validated by zod)
- Server startup prints whether Auth0 is configured

## 4. Frontend Environment Configuration

Auth0 frontend config is used in `packages/client/src/index.tsx`.

Set in `packages/client/.env`:

```bash
VITE_AUTH0_DOMAIN=<tenant>.auth0.com
VITE_AUTH0_FRONTEND_CLIENT_ID=<regular-web-app-client-id>
VITE_AUTH0_AUDIENCE=https://api.accounter.com
```

Notes:

- Redirect URI is built from route config and should resolve to `/auth/callback`
- Frontend requests token scope: `openid profile email offline_access`
- Tokens are cached in `localstorage` by the Auth0 SDK

## 5. Token Validation Requirements (Current Backend Behavior)

Backend auth context provider verifies:

- Issuer: `https://<AUTH0_DOMAIN>/`
- Audience: `AUTH0_AUDIENCE`
- Signature: JWKS from `https://<AUTH0_DOMAIN>/.well-known/jwks.json`

The JWT `sub` claim must map to local `accounter_schema.business_users.auth0_user_id`. If not
mapped, request remains unauthenticated for business operations.

## 6. Management API Usage (Current Backend Behavior)

`Auth0ManagementService` supports:

- `getUserByEmail(email)`
- `createBlockedUser(email, password?)`
- `unblockUser(auth0UserId)`
- `blockUser(auth0UserId)`
- `deleteUser(auth0UserId)`
- `sendPasswordResetEmail(auth0UserId)`

Operational implications:

- Invitation pre-registration creates blocked Auth0 users
- Invitation acceptance unblocks user and triggers password setup flow
- Expired invitation cleanup can remove Auth0 user

## 7. Setup Checklist

Use this checklist after configuration:

- [ ] Auth0 tenant exists and is reachable
- [ ] Regular Web App configured with correct callback/logout/origin URLs
- [ ] Callback/logout/web origins/cors values exactly match frontend URL (scheme/host/port, no
      mismatch)
- [ ] Refresh Token Rotation enabled with absolute + inactivity expiration configured
- [ ] App grant types include `Authorization Code` and `Refresh Token`
- [ ] API exists with RS256 and expected identifier/audience
- [ ] API `Allow Offline Access` is enabled
- [ ] M2M app exists and has required Management API scopes
- [ ] `Username-Password-Authentication` connection enabled
- [ ] Server Auth0 env vars set (`AUTH0_*`)
- [ ] Client Auth0 env vars set (`VITE_AUTH0_*`)
- [ ] Local user mapping exists in `business_users.auth0_user_id`

## 8. Validation Steps

1. Start server and verify startup log indicates Auth0 is configured.
2. Start client and open login page.
3. Click `Continue with Auth0`.
4. Complete login in Auth0 Universal Login.
5. Verify redirect returns to `/auth/callback` and then app home.
6. Execute a GraphQL request requiring auth and verify it succeeds.
7. Verify the authenticated Auth0 user is linked in local DB.
8. Keep session idle until access token expiry (~15 min), then execute an authenticated request and
   verify silent renewal succeeds without redirect loop.

## 9. Troubleshooting

- Symptom: `Auth0 configuration is missing`
  - Cause: Missing backend env vars
  - Fix: Set all required `AUTH0_*` vars and restart server

- Symptom: JWT verification fails (`issuer` or `audience` mismatch)
  - Cause: Wrong `AUTH0_DOMAIN` or `AUTH0_AUDIENCE`
  - Fix: Ensure API identifier equals backend audience and issuer matches tenant domain

- Symptom: Login succeeds in Auth0 but API acts unauthenticated
  - Cause: `sub` not mapped to `business_users.auth0_user_id`
  - Fix: Link Auth0 user ID to local business user row

- Symptom: Invitation/password-reset operations fail
  - Cause: Missing Management API scopes or wrong management audience
  - Fix: Verify M2M scopes and `AUTH0_MANAGEMENT_AUDIENCE`

- Symptom: Auth0 `403` from `/oauth/token` (refresh/silent token renewal fails)
  - Cause: Missing refresh/offline-access settings or URL mismatch
  - Fix checklist:
    - Verify app grant types include `Authorization Code` and `Refresh Token`
    - Verify `Refresh Token Rotation` is enabled with valid expiration settings
    - Verify API `Allow Offline Access` is enabled
    - Verify callback/logout/web origins/cors values exactly match current frontend URL
    - Verify client env values (`VITE_AUTH0_DOMAIN`, `VITE_AUTH0_FRONTEND_CLIENT_ID`,
      `VITE_AUTH0_AUDIENCE`) match tenant configuration
    - Force a clean interactive login (logout + clear local session artifacts) to mint a new refresh
      token after config changes
    - Check Auth0 logs (`Monitoring -> Logs`) for the exact failure reason (`invalid_grant`,
      `access_denied`, `unauthorized_client`, etc.)

## 10. Runtime Configuration Record

Populate this section per environment (do not commit secrets):

- Tenant Domain:
- API Audience:
- Frontend Client ID:
- M2M Client ID:
- Frontend URL:
- Last Verified Date:
- Verified By:
