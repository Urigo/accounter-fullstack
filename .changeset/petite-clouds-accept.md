---
'@accounter/client': patch
---

- **Classify refresh-token failures correctly.** New `isReauthRequiredAuth0Error` helper treats
  `invalid_grant` and `missing_refresh_token` (alongside `login_required`/`invalid_token`) as
  session-expiry, returning `{ status: 'unauthenticated' }`. Genuine network/transient errors stay
  `error`.
- **In-place re-authentication.** A new `SessionExpiryDialog` shows "Session expired — Sign in to
  continue", re-authenticates via `loginWithPopup()`, and lets `refreshAuth` resume the queued
  request(s) with the fresh token — no lost page state.
- **Robust fallback.** A small `reauth-coordinator` bridges the framework-agnostic urql singleton to
  the React modal (single-flight, so N concurrent failed ops share one prompt). When no handler is
  registered (route loaders before React mounts) or the popup is blocked/declined, it falls back to
  the existing full-page `/login?reauth=1` redirect.
