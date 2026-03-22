---
'@accounter/server': patch
---

- **Ensured Unique Extended Charges**: Modified the `getChargesByFilters` SQL query to use a
  `LEFT JOIN LATERAL` with `LIMIT 1` when joining `extended_charges`, preventing potential duplicate
  charge entries if multiple `extended_charges` exist for a single charge ID.
- **Improved Query Sorting Determinism**: Updated the `ORDER BY` clause in the `getChargesByFilters`
  query to include `ec.id` as a final tie-breaker, ensuring consistent and deterministic sorting of
  results.
