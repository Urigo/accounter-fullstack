---
"@accounter/server": patch
"@accounter/client": patch
---

Stream charge-match suggestions to the queue with `@defer`. `ChargeWithSuggestions.suggestions` is
now a lazy field resolver (backed by a per-operation DataLoader that still builds the shared
candidate pool once), so the `BY_DATE` queue resolver returns base charges without scoring them.
The client `ChargesAwaitingMatchQueue` query wraps `suggestions` in a deferred inline fragment, so
the queue list paints immediately and each charge's suggestions stream in, with a per-card
"Scoring suggestions…" state while they load. `BY_SCORE` still evaluates up front (scores are
needed to sort) and carries the suggestions on the response.
