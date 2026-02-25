---
'@accounter/server': patch
---

- Added `test-auth0-parallel.ts` script to test Auth0 JWT verification and database access with RLS context
- Integrated `AuthContextV2Provider` and `AUTH_CONTEXT_V2` token into the DI container in `modules-app.ts`
- Added npm script `test:auth0-parallel` to run the test script
