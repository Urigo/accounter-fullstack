---
"@accounter/client": patch
---

Fix whole-table "expand all" in the new charges table and load the expanded rows efficiently.

- `new-charges-table.tsx`: the table now accepts an `isAllOpened` prop and drives tanstack-table's
  `expanded` state from it (`true` expands every row, `{}` collapses them). Previously the toolbar's
  expand-all button toggled local `isAllOpened` state that was never passed to the table, so nothing
  happened; per-charge expansion via the row button was unaffected.
- New `charges-extended-info-loader.tsx`: a `BatchChargesExtendedInfoProvider` that, while expand-all
  is active, hydrates every expanded row's extended info with a single `chargesByIDs` query instead
  of one `FetchCharge` query per row (which was 100 queries for a full 100-row page). Its selection
  set mirrors `FetchCharge`, including the same deferred fragments, so a batched charge is
  interchangeable with a single-charge result.
- `charge-extended-info.tsx`: consumes the batch loader when it's active (pausing its own per-charge
  query and delegating refetch-on-change to the batch); otherwise behaves exactly as before.
- Wired `isAllOpened` through the all-charges, missing-info-charges and single-charge screens.
