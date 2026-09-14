---
'@accounter/client': patch
---

Discard the urql client on logout.

`useLogout` cleared `sessionStorage` and handed off to Auth0, but left the urql client untouched. The
call that would have fixed it was commented out with a `// TODO: clear URQL cache`, and pointed at
`urqlClient.resetStore?.()` — an Apollo method that urql does not implement, so uncommenting it would
have silently done nothing.

`useLogout` now calls `resetUrqlClientAndNotify()`, which drops the singleton and pushes a fresh
client into the Provider. It runs *before* `logout()`, because that triggers a full-page redirect and
anything queued behind it may never run.

This has no visible effect today: the redirect tears down module state anyway, and the client holds
no cache to leak. It stops being harmless the moment a cache exists — a normalized cache surviving a
logout-then-login inside one page lifetime would serve the previous user's entities to the next one.
Landing it before `@urql/exchange-graphcache` keeps that from ever being reachable.

`resetUrqlClientAndNotify` is extracted from `setBusinessScope`, which already paired
`resetUrqlClient()` with the `onClientReset` swap. Both callers need both halves, so they now share
one function instead of each remembering to make the second call.
