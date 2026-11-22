---
'@accounter/server': patch
'@accounter-helper/migrations': patch
---

Payoneer as an account source: a `payoneer_transactions` table whose insert trigger books each
activity item as its main movement (gross payment / amount sent) plus a Payoneer fee transaction on
the same charge, an `uploadPayoneerTransactions` scraper mutation, and a `payoneerBusinessId` admin
context setting that joins the internal wallets (so Payoneer fees are booked against the Payoneer
account) and drives fee counterparty suggestions. `yarn payoneer:import` uploads activity captured
from a signed-in Payoneer session, since Payoneer has no API for account holders.
