---
'@accounter/client': patch
---

Stop showing two error toasts for every failed mutation.

Two independent layers reported the same failure. `handleUrqlError` runs globally as
`mapExchange({ onResult })` on the urql client and toasted `"Operation Error"` with the raw GraphQL
message, no toast id, for 5s. Every mutation hook in `src/hooks/` separately ran its result through
`handleCommonErrors`, which toasts `"Error"` under a stable per-entity id, for 100s, with a close
button. A failing mutation raised both.

The hook layer's toast is the better one: it names the entity that failed, it is dismissible, and
its id is the same one the preceding `toast.loading` used, so the loading toast is replaced in place
instead of being stacked on. `handleUrqlError` now returns early for
`result.operation?.kind === 'mutation'` and leaves mutation reporting to the hooks.

Queries are unchanged — they have no hook-level equivalent, so the global handler is still their
only error surface. Network errors are also unchanged for both kinds: that branch stays above the
new guard, because a mutation that never reached the server is the one case the hook layer cannot
describe (`handleCommonErrors` can only call it "Error occurred").

Optional chaining is load-bearing: a result with no `operation` at all still toasts, which is what
the existing `ONBOARDING_REQUIRED` suppression test depends on.
