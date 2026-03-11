---
'@accounter/client': patch
---

- Rename `RequireAuthGuard` to `ProtectedRoute` (with a compatibility alias) and update route config
  usage.
- Preserve attempted path via `returnTo` state and use it in `LoginPage` redirect + Auth0
  `appState`.
- Add a `ProtectedRoute` unit test running under `jsdom` and add `jsdom`/`@types/jsdom` dev
  dependencies.
