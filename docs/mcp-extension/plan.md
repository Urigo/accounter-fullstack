# Accounter MCP — UX improvements from the agent-session feedback

## Context

`packages/mcp-server/docs/accounter_mcp_feedback.md` records a real agent session that answered
three questions ("how much did The Guild make this year?", "chart my money over time", "what
changed?") against the connector. It cost ~100 paginated calls, four subagents, and a large amount
of reverse-engineering — because the connector exposes **rows, not answers**, and omits fields the
GraphQL API already returns.

The key finding from exploring the schema: **most top-ranked asks are already available upstream and
simply aren't selected or wrapped.** `incomeExpenseChart`, `profitAndLossReport`, `vatReport`,
`businessTransactionsSumFromLedgerRecords`, `financialAccountsByOwner`, `allDeposits`, and
`business(id)` all exist as `Query` fields. Currency conversion data rides on every transaction as
`eventExchangeRates` / `debitExchangeRates`.

**One exception, which reshaped this plan.** `Transaction.balance` looks like the answer to §2 but
is not trustworthy today, so exposing it as-is would ship a confidently wrong number. See §1.1 — it
is now a server-side prerequisite, not a Phase 1 item.

So the bulk of the work is inside `packages/mcp-server` with no schema or resolver changes.
Server-side gaps are catalogued at the end as follow-up.

Decisions taken: **MCP-only scope**, and **one named tool per report** (precise input schemas beat a
fuzzy `reportType` union for model selection accuracy).

---

## Phase 1 — Fields that already exist but aren't selected — ✅ DONE

_Implemented in `packages/mcp-server/src/tools/` (1.2–1.5; 1.1 deferred as described below). 441
tests pass; `yarn generate`, `yarn lint` and the mcp-server build are clean._

These are a handful of lines each and address §4, §5 and §6 of the feedback. Do these first; they
change every existing tool's output. §2 (the biggest accuracy gap) turns out **not** to be a
select-the-field job — see 1.1.

### 1.1 `balanceAfter` — DEFERRED, needs a server fix first

`Transaction.balance: FinancialAmount!` exists and reads like the answer to §2, but it is **not safe
to expose today**. `packages/server/src/modules/transactions/resolvers/common.ts:57` is a bare
passthrough of the `transactions.current_balance` column, and only some ingestion paths populate it
from the source feed. Per the trigger definitions in
`packages/migrations/src/actions/2026-02-19T17-00-00.update-scraper-triggers-according-to-rls-restrictions.ts`:

| Ingestion trigger                                                      | `current_balance` value              |
| ---------------------------------------------------------------------- | ------------------------------------ |
| `insert_poalim_ils_transaction_handler`                                | `new.current_balance` — real         |
| `insert_poalim_foreign_transaction_handler`                            | `new.current_balance` — real         |
| `insert_bank_discount_transaction_handler`                             | `NEW.balance_after_operation` — real |
| `insert_poalim_swift_transaction_handler`                              | **hardcoded `0`**                    |
| `insert_poalim_deposit_transaction_handler`                            | **hardcoded `0`**                    |
| `insert_creditcard_` / `_max_` / `_cal_` / `_amex_transaction_handler` | **hardcoded `0`**                    |

A hardcoded `0` is indistinguishable from a genuine zero balance, the GraphQL field is non-null so
there is no `null` to signal "unknown", and `Transaction` exposes no `sourceOrigin`, so the MCP
layer **cannot tell trustworthy rows from placeholder ones**. Exposing `balanceAfter` would replace
a reconstructed-but-honest number with a confidently wrong one — strictly worse than the status quo
the feedback complained about.

**Prerequisite (server, out of the agreed MCP-only scope — see follow-up item 0):** change the
placeholder triggers to insert `NULL`, make `Transaction.balance` nullable, and have the resolver
return `null` for a null column. Once `null` means "this source doesn't report balances", the MCP
change becomes the three-line edit originally planned:

- add `balance { raw formatted currency }` to the `McpTransactionDetailsFields` fragment in
  `transaction-details.ts`, and to the inline transaction selection in `charge-details.ts`
  (selections are deliberately not shared as interpolated fragments — see the header comment in
  `entity-shapes.ts`);
- map it to `balanceAfter: NormalizedAmount | null` in `normalizeTransaction` (`entity-shapes.ts`)
  via the existing `normalizeAmount`.

Until then, §2 is addressed by `accounter_list_accounts` (Phase 2) — knowing an account's `type` is
what actually resolves the card-double-count, sweep, and securities traps — and the data-model guide
in Phase 3, which must state plainly that per-transaction balances are unavailable.

### 1.2 `amountLocal` + `exchangeRate` on transactions (§5)

`Transaction.eventExchangeRates: ExchangeRates` carries per-date rates for all supported currencies
(`ils`, `usd`, `eur`, `gbp`, …). Select it, compute in the normalizer, and **do not** emit the raw
rates object (11 floats per row would eat the payload budget).

- Select `eventExchangeRates { date ils usd eur gbp aud cad jpy sek eth usdc grt }` alongside the
  existing amount, in both transaction selections.
- In `entity-shapes.ts`, add a helper `toLocalAmount(amount, rates)`: looks up the rate keyed by
  `amount.currency` (lower-cased), returns
  `{ amountLocal: { value, currency: 'ILS' }, exchangeRate }` or `null` when the rate is absent.
  Emit only those two derived keys.

### 1.3 `chargeType` / `flowKind` on charges (§4)

The schema's concrete charge types are exactly the classification the feedback asks for:
`CommonCharge`, `ConversionCharge`, `InternalTransferCharge`, `BankDepositCharge`,
`ForeignSecuritiesCharge`, `CreditcardBankCharge`, `SalaryCharge`, `MonthlyVatCharge`,
`DividendCharge`, `BusinessTripCharge`, `FinancialCharge`.

- `packages/mcp-server/src/tools/charges.ts` — add `__typename` to `McpSearchCharges`, expose it as
  `chargeType`, and derive `flowKind`
  (`income | expense | internal_transfer | conversion | investment | tax | payroll`) from typename +
  amount sign. Put the mapping table in `entity-shapes.ts` so `charge-details.ts` reuses it.
- `charge-details.ts` already fetches typed charges — expose the same two fields there.
- This makes "what changed my total" answerable by filtering `flowKind` client-side in one pass
  instead of 400+ join calls.

### 1.4 Documents: `direction` + `amountExVat` (§6)

Both are derivable from fields already selected — `document-details.ts` already pulls
`charge { id owner { id } }`, `creditor`, `debtor`, `amount`, `vat`.

- In `normalizeDocument` (`entity-shapes.ts`):
  `direction = creditor?.id === chargeOwnerId ? 'issued' : debtor?.id === chargeOwnerId ? 'received' : null`,
  and `amountExVat = amount.value - (vat?.value ?? 0)` with matching currency.
- `normalizeDocument` needs the owner id; pass it through (it is already on the raw shape).
- Credit invoices are the known edge case the feedback hit — keep `direction` `null` rather than
  guessing when neither party matches the owner, and say so in the tool description.

### 1.5 `get_charges` payload defaults (§8)

`charge-details.ts:135–143` defaults `includeTransactions` and `includeDocuments` to `true`, which
is what forced truncation on nearly every call. Flip both defaults to `false` and state in the
descriptions that the nested collections are opt-in. Existing callers that want nesting pass it
explicitly.

---

## Phase 2 — Report tools (wrapping existing upstream queries)

New file `packages/mcp-server/src/tools/financial-reports.ts`, registered in `registry-instance.ts`.
Every tool follows the established `balanceReportTool` pattern in `reports.ts`: required singular
`businessId`, `SINGLE_BUSINESS_SCOPE_DESCRIPTION_SUFFIX`,
`policy: { requiredRoles: ['business_owner','accountant'], requiresBusinessScope: true, dataClassification: 'business' }`,
membership re-check against `context.readScope.businessIds`, output via `shapeListResult`.

**Scoping note that matters:** `incomeExpenseChart`, `profitAndLossReport` and `vatReport` derive
their owner from `AdminContextProvider.getVerifiedAdminContext()`, which resolves through
`resolveWriteTargetBusinessId(tenant.businessId, activeReadScope)` — i.e. from the forwarded
`x-business-scope`. Because these tools take a required singular `businessId`, `execute.ts` narrows
the scope to that one business and the upstream resolver targets it correctly. `vatReport` and
`businessTransactionsSumFromLedgerRecords` additionally take explicit ids — pass them too, as
defense in depth (mirroring the `byOwners` comment in `charges.ts:130`).

| Tool                               | Upstream query                                                                                         | Answers                                                                                                                                                                                                                               |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `accounter_income_expense_summary` | `incomeExpenseChart(filters: { fromDate, toDate, currency })`                                          | "how much did we make this year", "chart my money over time" — monthly `income`/`expense`/running `balance`, already currency-converted server-side. This is the §5 `convertTo` ask, free.                                            |
| `accounter_profit_and_loss`        | `profitAndLossReport(reportYear, referenceYears)`                                                      | §1 P&L: revenue, cost of sales, gross profit, R&D / marketing / G&A, operating profit, financial expenses, tax, net profit — plus reference years for YoY.                                                                            |
| `accounter_vat_report`             | `vatReport(filters: { financialEntityId, monthDate, chargesType })`                                    | §1 VAT. Return the aggregated income/expense totals plus per-record rows; drop the heavy `missingInfo`/`differentMonthDoc` charge collections.                                                                                        |
| `accounter_counterparty_totals`    | `businessTransactionsSumFromLedgerRecords(filters: { ownerIds, fromDate, toDate, businessIDs, type })` | §1 revenue/expense `groupBy: counterparty`, §7 "top customers" — per-business `credit`/`debit`/`total` from the **ledger**, which is the authoritative source the feedback asked for. Union result — handle the `CommonError` member. |
| `accounter_ledger_records`         | `businessTransactionsFromLedgerRecords(filters: …)`                                                    | §1 `ledger_query`: `invoiceDate`, `business`, `counterAccount`, `amount`, `foreignAmount`, `chargeId`, `details`.                                                                                                                     |
| `accounter_list_accounts`          | `financialAccountsByOwner(ownerId)`                                                                    | §2: id, name, number, `type` (`BANK_ACCOUNT` / `BANK_DEPOSIT_ACCOUNT` / `CREDIT_CARD` / `CRYPTO_WALLET` / `FOREIGN_SECURITIES`), `privateOrBusiness`. The `type` enum alone resolves the card-double-count and securities traps.      |

`accounter_list_accounts` deliberately ships **without** current balances. The obvious
implementation — one `transactionsByFilters` call over a trailing window, newest `balance` per
account — inherits the §1.1 defect exactly: it would report `0` for every credit card, deposit and
SWIFT account. Add `includeCurrentBalance` only after the §1.1 prerequisite lands, and have it
return `null` (not `0`) for accounts whose source reports no balance.

Caveat to state in `accounter_income_expense_summary`'s description: `incomeExpenseChart` computes
its running `balance` by summing every transaction amount for the owner, so it carries the same
card-settlement double-count the feedback describes in §2. The monthly `income`/`expense` split is
sound and currency-converted server-side; the cumulative `balance` is a net cash-flow figure, not an
account balance. Say so in the tool description rather than letting the model infer otherwise.

**Ordering in `registry-instance.ts` is a prompt-engineering lever** (see its header comment).
Register the report tools _before_ the raw list tools so the model reaches for the answer before the
rows: memberships → accounts → income/expense summary → P&L → VAT → counterparty totals →
search_charges → get_charges → get_transactions → get_documents → ledger_records → lookups →
balance_report.

---

## Phase 3 — The data-model guide (§8)

The feedback says a static doc "would have saved the entire reverse-engineering phase." The MCP
handler advertises only `capabilities: { tools: { listChanged: false } }`
(`packages/mcp-server/src/mcp/handler.ts:80`) — implementing the resources protocol is more work
than the payoff. Instead add a pure, no-upstream-call tool (same shape as `businesses.ts`, whose
handler is already pure):

`accounter_data_model_guide` → returns a static markdown string covering:

- Account types and what each means; **credit-card rows are duplicated by the bank's settlement
  rows** — use `accounter_list_accounts` types, don't sum both.
- The Poalim checking→deposit auto-sweep, and that deposits are `BANK_DEPOSIT_ACCOUNT`.
- `FOREIGN_SECURITIES` accounts are single-legged (cost basis, no mirror bank leg).
- `chargeType` / `flowKind` semantics and which are internal movements.
- Date-filter semantics: `fromDate`/`toDate` vs `fromAnyDate`/`toAnyDate` (the §8 confusion — the
  charges tool maps `fromDate` → `fromAnyDate` at `charges.ts:145`, which is exactly why 2020 event
  dates came back for a 2026 query; document this and consider exposing both).
- **That per-transaction balances are not available**, and why: only Poalim ILS/foreign and Discount
  feeds carry one; cards, deposits and SWIFT rows store a placeholder. Point the reader at
  `accounter_income_expense_summary` for flows and at account `type` for what to include or exclude.

Keep the text under ~4KB. Source it from a `const` in the tool module so it ships with the bundle.

---

## Explicitly out of scope (server-side follow-ups)

Record these in `packages/mcp-server/docs/todo.md` rather than implementing:

0. **Make `current_balance` honest — prerequisite for §1.1, and the highest-value server item.**
   Change the six placeholder triggers to insert `NULL` instead of `0`, backfill existing
   placeholder rows (careful: a genuine `0` balance is legitimate, so backfill must key off
   `source_origin` / account type, not the value), make `Transaction.balance` nullable in
   `packages/server/src/modules/transactions/typeDefs/transactions.graphql.ts`, and return `null`
   from the resolver at `resolvers/common.ts:57`. Needs a migration. Longer term the credit-card and
   deposit scrapers should capture the balance the source does expose.
1. **Transaction sorting + pagination** (§3) — `TransactionsFilters` has no `sortBy`, and
   `transactionsByFilters` returns an unbounded `[Transaction!]!`. Real cursor pagination and bulk
   export need `packages/server/src/modules/transactions` changes. This is why the session made ~100
   calls; it is the largest remaining item.
2. **`Charge.totalAmount` null on income charges** (§7) — verify against
   `packages/server/src/modules/charges`; if computable, compute server-side.
3. **`myMemberships.businessName` is nullable** (§7) — this is the `name: null` the reviewer saw.
   Either fix the resolver's join or add an MCP fallback through `businesses(ids:)` in
   `upstream/memberships.ts`.
4. **Document → payment status / AR aging** (§6), **securities positions** (§7), **payroll
   breakdown** (§7), **deposits as first-class** (`allDeposits` exists — a thin wrapper is cheap and
   could be pulled forward if wanted).
5. **Field projection** (§3) — mitigated by Phase 1.5 and the report tools; revisit only if payloads
   still truncate.

---

## Verification

1. `yarn generate` — every new `/* GraphQL */` operation must produce types in
   `packages/mcp-server/src/gql/`. Codegen plucks from plain template literals only, so no `${}`
   interpolation in the new query strings.
2. `yarn workspace @accounter/mcp-server test` — extend the existing suites:
   - `src/tools/__tests__/scope-forwarding.test.ts` and `business-scope-forwarding.test.ts` iterate
     registered tools; new tools must pass without modification (they assert every tool sends
     `x-business-scope`).
   - Add per-tool tests mirroring `lookups.test.ts`: fixture upstream response → asserted normalized
     shape, plus the union/`CommonError` branch for the two ledger tools.
   - Assert `amountLocal`, `chargeType`, `flowKind`, and document `direction` in the `entity-shapes`
     normalizer tests. (No `balanceAfter` assertions — §1.1 is deferred.)
3. `yarn lint && yarn prettier:check`.
4. End-to-end against the live connector (per `packages/mcp-server/docs/local-development.md`):
   re-run the three questions from the feedback doc and confirm each is now one or two calls —
   - "how much did The Guild make this year?" → `accounter_income_expense_summary` or
     `accounter_profit_and_loss`, single call.
   - "chart how much money I have" → `accounter_list_accounts` + `accounter_income_expense_summary`,
     two calls. This one is only _partially_ fixed until follow-up 0 lands — confirm the agent
     reports the flow figure with its double-count caveat rather than presenting it as an account
     balance.
   - "what made the changes?" → `accounter_search_charges` filtered on `flowKind`, no charge-join
     fan-out.
5. Spot-check `accounter_get_transactions` output size — the Phase 1 additions add bytes per row;
   confirm `MAX_TOOL_RESULT_BYTES` (60KB, `packages/mcp-server/src/tools/output.ts:14`) still fits a
   useful page, and lower the default page size if not.
