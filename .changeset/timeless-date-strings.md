---
'@accounter/server': minor
'@accounter/client': patch
---

Keep date-only values as `TimelessDateString` (`yyyy-mm-dd`) end to end, so calendar days no longer
shift with the server's or browser's timezone:

- Postgres `date` / `date[]` columns are read as `yyyy-mm-dd` strings (custom node-pg type parsers)
  and typed `TimelessDateString` by pgtyped (`typesOverrides`), instead of server-local `Date`s.
- `Charge.min/max{Event,Debit,Documents}Date` and `LedgerRecord` / `SingleSidedLedgerRecord`
  `invoiceDate` / `valueDate` are now `TimelessDate` instead of `DateTime`: they return the day
  (`2026-05-01`), not a timezone-dependent ISO timestamp.
- Server-side day arithmetic uses new timezone-independent helpers, fixing days that moved west of
  UTC: VAT / PCN874 report months, document and bank-deposit date inputs, salary and reserve ledger
  dates, revaluation dates, exchange-rate dates, corporate tax rates and more.
- The tenant's calendar days are reckoned in `Asia/Jerusalem` (a `TENANT_TIMEZONE` constant, to be
  derived per tenant later) instead of the server's timezone: "today" (document dates and due
  dates, default VAT month, contract billing month, sync windows), current-year checks, the day of
  absolute instants (Otsar Hahayal and Poalim securities dates, balance-charge value dates, email
  receive dates) and the instant a day starts at (day-only crypto rate lookups, Green Invoice
  `firstPayment`).
- `TimelessDateString` is now the pattern `${number}-${number}-${number}` instead of a union of
  every day in 2000-2049, which kept server type-checking fast and allows earlier years.
- Client: the charges table, charge matching, ledger tables and CSV exports read these fields as
  calendar days, and every `dd/MM/yy` date cell (transactions, documents, business trips,
  depreciation, bank deposits) formats the `yyyy-mm-dd` string directly through a shared
  `formatTimelessDate` helper instead of `new Date(...)`, which showed the previous day west of UTC.
