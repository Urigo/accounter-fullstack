---
"@accounter/server": patch
---

Speed up the `chargesAwaitingMatchQueue` query by building the match candidate pool once per
request instead of once per queued charge. `ChargesMatcherProvider` now exposes a batch
`findMatchesForCharges`, which loads and classifies the shared candidate pool a single time and
scores every source charge against it in memory (the per-source ±12-month window is still applied
in-memory, so results are unchanged). This removes the previous per-charge re-query and
re-hydration of the candidate pool — the dominant cost, especially for `BY_SCORE` which evaluated
up to 100 charges.
