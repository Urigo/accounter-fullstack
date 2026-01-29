---
'@accounter/server': patch
---

- **Auth0 JWT Integration**: Introduced the `AuthContextV2Provider` to handle JWT authentication,
  verifying tokens using Auth0's JSON Web Key Set (JWKS) and the `jose` library.
- **Environment Configuration for Auth0**: Added `Auth0Model` to `environment.ts` to validate and
  expose `AUTH0_DOMAIN` and `AUTH0_AUDIENCE` environment variables, ensuring they are provided
  together.
- **Expanded Authentication Context**: The `AuthContext` and related types (`AuthUser`,
  `TenantContext`) have been significantly extended to include more detailed user information (e.g.,
  email, permissions, `auth0UserId`, `emailVerified`) and `accessTokenExpiresAt`.
- **Database Mapping for Auth0 Users**: Implemented logic to map authenticated Auth0 user IDs to
  existing local user and business IDs in the `accounter_schema.business_users` table.
- **New Dependency**: The `jose` library (version `6.1.3`) has been added to `package.json` and
  `yarn.lock` to facilitate JWT operations.
- **Unit Tests for Auth Context**: New unit tests for `AuthContextV2Provider` were added, covering
  various scenarios like null auth types, API key placeholders, successful JWT verification, and
  different failure modes.
