---
'@accounter/client': minor
---

Add a public landing page at `/`.

Logged-out visitors now get a static marketing page describing what Accounter does — how data is
collected and matched, the feature set, the integrations, the Israeli compliance formats and the MCP
connector — with "Sign in" and "Request access" buttons in the header. Anyone with a session is
redirected into the app instead.

The route tree changed to make room for it: the protected subtree is now a pathless layout route, so
`/` belongs to the landing page, and `ROUTES.APP_HOME` (`/charges`) is the new destination for
everything that means "send the user into the app" — post-login, post-invitation, the error
boundary's home links and the dashboard logo.
