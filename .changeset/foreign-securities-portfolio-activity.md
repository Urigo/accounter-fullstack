---
'@accounter/server': minor
'@accounter/client': minor
---

Show the ingested Poalim portfolio executions alongside a foreign-securities charge's bank
transactions.

`accounter_schema.poalim_securities_transactions` was written by the scraper ingestion but never
read back, so a foreign-securities charge showed only the security's static reference details and
the cash movement — not the trade behind it. The securities section of the charge now renders a
"Portfolio activity" table under the existing (now labelled) "Bank transactions" table, with the
trade/value dates, direction, quantity, price, net value, commission and tax of each matched
execution.

The executions table carries no link to `accounter_schema.transactions`, so the pairing is derived
at query time by the new `matchSecurityExecutions` helper: same security key, same Poalim account
tuple (bank/branch/account, resolved from the transaction's `account_id`), an execution date within
a few days of the transaction's event or debit date, **and** a matching amount. The amount is what
makes it safe — a security can be executed several times on the same day, so date alone would
attach all of them to every cash movement; a candidate in the window that matches no amount is
dropped rather than shown as a maybe.

Schema: `ChargeSecurity.executions: [SecurityExecution!]!` and a new `SecurityExecution` type
exposing a curated subset of the ~100 source columns, normalized to the codebase's own vocabulary
rather than the bank's:

- dates are `TimelessDate` (the columns are `DATE`), quantities and prices are `Float`;
- every amount is a `FinancialAmount` built with `formatFinancialAmount` — trade-currency values
  carry the execution's own currency, the bank's NIS-suffixed columns carry `Currency.Ils`;
- `formatCurrency` now recognizes the securities feed's Hebrew currency labels (`שקל חדש`,
  `דולר ארה"ב`);
- `tradeType`, `transactionType` and `paymentType` are GraphQL enums mirroring the closed
  vocabularies the scraper already validates against (`TRADE_TYPES`, `TRANSACTION_TYPES`,
  `PAYMENT_TYPES` in `hapoalim-securities-transactions-schema.ts`). A value the scraper accepts but
  the translation map does not know about raises a named error pointing at both definitions, rather
  than being silently dropped.
