---
'@accounter/server': patch
---

- **Auth0 Environment Variables**: Auth0-related environment variables have been introduced in
  `.env.template` to support JWT verification and Management API access.
- **Environment Configuration Update**: The server's environment configuration
  (`packages/server/src/environment.ts`) has been updated to parse and validate the new Auth0
  variables, ensuring that if Auth0 is configured, all necessary related variables are present.
- **New Unit Tests**: A new test file (`packages/server/src/__tests__/environment.test.ts`) has been
  added to verify the correct loading and validation of Auth0 environment variables under various
  scenarios.
- **Dependency Addition**: The `jose` library has been added as a new dependency, likely for
  handling JSON Web Tokens (JWTs).
