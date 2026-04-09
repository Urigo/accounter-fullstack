---
'@accounter/client': patch
'@accounter/server': patch
---

- **Developer Authentication Bypass**: Introduced a new development-only authentication mechanism
  that allows bypassing Auth0. This enables developers to impersonate seeded demo users by setting
  specific environment variables and passing an `X-Dev-Auth` header.
- **Client-Side Integration**: Modified the client application to conditionally use the new dev
  authentication flow, affecting how authentication tokens are provided to URQL and how user context
  and protected routes are handled. New environment variables (`VITE_DEV_AUTH`,
  `VITE_DEV_AUTH_USER_ID`) were added for client-side configuration.
- **Server-Side Authentication Plugin**: Updated the server's authentication plugin to detect and
  prioritize the `X-Dev-Auth` header when the `ALLOW_DEV_AUTH` environment variable is enabled. A
  new `handleDevBypassAuth` function was implemented to resolve user context based on the provided
  user ID from the dev auth header.
- **Enhanced Demo Data Seeding**: The demo data seeding script (`seed-demo-data.ts`) was updated to
  automatically seed deterministic demo users (admin and accountant) and print their IDs. This
  facilitates easy setup for local development using the new dev authentication bypass.
- **Documentation Update**: The `demo-staging-guide.md` documentation was updated with clear
  instructions on how to set up and use the local development authentication bypass, including
  environment variable configuration and role switching.
