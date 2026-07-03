---
'@accounter/server': patch
---

Enrich the charges `freeText` filter (`allCharges` query) so it matches more than just text
descriptions. In addition to the existing `user_description` / transaction / document description
matches, the `search_matches` CTE in `ChargesProvider.getChargesByFilters` now also matches:

- **Amounts** — transaction `amount` and document `total_amount` / `vat_amount`. Both the raw and
  `ABS()` values are compared so signed and unsigned inputs match. Thousands separators are stripped
  from the search term (via a resolver-computed `freeTextNumeric` param) so both `1,234.56` and
  `1234.56` match the plain value stored in the DB.
- **Counterparty business names** — by joining `financial_entities` on the business ids referenced
  by the charge's transactions (`business_id`) and documents (`creditor_id`, `debtor_id`). The
  document match is split into separate creditor/debtor `UNION` branches so the planner can use the
  foreign-key indexes.
