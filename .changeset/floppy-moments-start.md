---
'@accounter/client': patch
---

- **Auth0 Configuration Documentation**: Updated `auth0-setup.md` to include detailed requirements
  for refresh token rotation, `offline_access` scope, and a comprehensive troubleshooting guide for
  token renewal failures.
- **Enhanced URQL Auth Exchange**: Refactored the client-side URQL authentication exchange to manage
  access tokens more effectively, including silent renewal, handling `UNAUTHENTICATED` GraphQL
  errors, and preventing redirect loops during reauthentication.
- **Improved Reauthentication Flow**: Modified the login page to detect session expiry (`reauth=1`
  query parameter) and display an appropriate message, while also ensuring that `loginWithRedirect`
  requests the `offline_access` scope and prompts for re-login when necessary.
