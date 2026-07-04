---
'@accounter/server': patch
---

**Wildcard business-recognition emails**: `suggestion_data.emails` now accepts wildcard patterns
(e.g. `*@cloudflare.com`) alongside concrete addresses, so suppliers that send invoices from a
unique address per invoice (such as `qr45uf@cloudflare.com`) can be recognized by a single entry.

- The suggestion-data schema validates wildcard patterns (`*` allowed anywhere in an email-shaped
  entry) while still rejecting over-broad values like a bare `*`.
- Both recognition lookups (`BusinessesProvider.getBusinessByEmail` and the email-ingestion control
  provider) translate `*` to a `LIKE` wildcard in SQL, escaping `_`, `%` and `\` so literal entries
  keep matching exactly. Matching stays case-insensitive.
- New `email-pattern.helper.ts` is the source of truth for the pattern shape and provides an
  in-process matcher used by tests.
