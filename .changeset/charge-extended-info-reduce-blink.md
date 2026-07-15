---
"@accounter/client": patch
---

Reduce the "blinking" in the charge extended-info panel (and its sub-components) when something is
updated via `onExtendedChange`. Applying the same insights as the bank-deposits and charges-table
fixes:

- `charge-extended-info.tsx`: the top loader now only shows on the initial load (`fetching && !charge`)
  instead of on every refetch. The `@defer` `FetchCharge` query is re-executed with
  `network-only`, and its result is merged over the previously loaded charge — a re-executed deferred
  query delivers its non-deferred fields first and streams the deferred fragments in later patches, so
  merging keeps the already-loaded accordion sections rendering their last data until each fresh patch
  arrives, instead of every section collapsing and re-expanding. The rendered charge is also wrapped
  in `useStableValue` so descendants re-render only on real changes.
- `extended-info/charge-matches.tsx`: gate the loader on `fetching && !data` so the matches table
  stays visible during background refetches.
- `extended-info/bank-deposit.tsx`: show the full-section loader only on the initial load; during
  background refetches and create/assign mutations the current content stays visible (mutation
  progress is already surfaced via the inline button states).
