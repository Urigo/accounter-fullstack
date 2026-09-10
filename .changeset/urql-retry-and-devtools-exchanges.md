---
'@accounter/client': patch
---

Add `retryExchange` for network failures, and the urql devtools exchange in development.

A single network blip was fatal: the operation failed, a toast appeared, and nothing recovered short
of the user navigating again. `retryExchange` now retries on `error.networkError` only — never on
GraphQL errors, which are answers rather than failures and will not change on a second attempt.
Mutations are excluded by `retryExchange`'s default and stay that way, because none of ours are
idempotent.

Placement matters more than it looks. `retryExchange` sits **after** `authExchange` and immediately
before `fetchExchange`, so `authExchange` observes a single settled result rather than each attempt
and a retry can never drive `didAuthError`/`refreshAuth`. Two tests pin the ordering and the
`retryIf` predicate.

`devtoolsExchange` is added first in the chain, behind `import.meta.env.DEV`, so the urql browser
devtools finally attach during development. A production build was checked to confirm it is
tree-shaken out.

The chain also gains a comment marking where `cacheExchange` belongs — between the error handler and
auth — for when normalized caching lands. Nothing occupies that slot today: passing an explicit
`exchanges` array means urql installs no cache of its own.
