---
'@accounter/client': patch
'@accounter/server': patch
---

- Adds a new client-side `AcceptInvitationPage` with login-redirect support, a `useAcceptInvitation`
  hook, and routing configuration, plus associated session storage plumbing in `auth-callback` and
  `PublicOnlyGuard` to preserve the invitation return-to URL across the Auth0 login flow.
- Introduces `getJwtIdentity()` on `AuthContextProvider` and `getUserEmailById()` on
  `Auth0ManagementProvider` to support fallback identity resolution when the full auth context isn't
  established, and adds verified-email-based relinking of Auth0 subjects in `mapAuth0UserToLocal`.
- Reorders `insertBusinessUser` before `insertInvitation` in the invitation creation flow and
  updates vitest config to support `@` alias and `.tsx` test files.
