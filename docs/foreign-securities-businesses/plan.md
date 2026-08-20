# Per-security businesses & the Security tab

## Context

Today a foreign-securities charge shows its matched executions inline
(`packages/client/src/components/charges/extended-info/foreign-securities-info.tsx`), but a security
has no identity of its own in the system: `transactions.business_id` points at the single general
"Foreign Securities" business, executions live only in
`accounter_schema.poalim_securities_transactions`, and there is nowhere to see the full life of one
instrument.

The goal is a **business per security**, with a new tab on the business page showing that security's
complete execution history and its current (derived) holding, and with the main securities
transaction pointing at the specific security business instead of the general one — while the
**ledger output stays byte-identical**.

Decisions taken with the user are recorded inline; where a choice was non-obvious, the reason is
noted so the implementer doesn't relitigate it.

### Expected behavior on a foreign-securities charge (the target picture)

- The **main** transaction's counterparty flips from the general "Foreign Securities" business to
  the specific security business (e.g. `ORCL4.9%02/33`).
- The **fee** transaction is untouched — it keeps `Poalim` as counterparty.
- The **ledger records are unchanged**, both the main pair (`Poalim … USD` ⇄
  `Foreign Securities USD`) and the fee pair (`Foreign Securities Fees` ⇄ `Poalim … ILS`).
- When the main transaction has **no counterparty yet**, the cell shows a suggestion plus a select:
  the suggestion is the matched security (and nothing at all when no match is found), and the
  select's options are **only** the existing security businesses plus the general foreign-securities
  business as the edge-case default.

### Key facts discovered during research

- A security is identified in this codebase by Poalim's proprietary **`security_key`**, parsed out
  of the transaction description (`foreign-securities/helpers/security-key.helper.ts`) and joined to
  `accounter_schema.poalim_securities`. **That table has no ISIN column.** `isin` exists only on
  execution rows (`poalim_securities_transactions.isin`). Hence the identifier bridge below.
- `foreignSecuritiesBusinessId` is what makes a charge `ForeignSecurities`
  (`charges/helpers/charge-type.ts:109-115`) and what resolves the `FOREIGN_SECURITIES` account
  (`financial-accounts/helpers/account-by-transaction.helper.ts:23-27`). Both must learn about
  security businesses.
- The ledger's main entry does **not** use `transaction.business_id` as the counterparty: because
  `foreignSecuritiesBusinessId` is in `internalWalletsIds` and the resolver hard-sets
  `source_reference: 'foreign_securities'`, `ledgerEntryFromMainTransaction`
  (`ledger/helpers/common-charge-ledger.helper.ts:231-253`) replaces it with the tax category of the
  account whose `account_number = 'foreign_securities'`. **So adding security businesses to
  `internalWalletsIds` is what keeps the ledger unchanged** — no explicit remapping is needed.
- Holdings/balances are deliberately not ingested, so "current hold" must be derived from
  executions.
- There is currently **no securities branch** in `transaction-suggestions.resolver.ts`; securities
  rows fall through to the POALIM description heuristics and get suggested as Poalim.

---

## 1. Data model — migrations

Two new tables under `packages/migrations/src/actions/`. Copy the RLS block used by
`2026-08-11T12-00-00.add-poalim-securities-table.ts` (FORCE RLS + `tenant_isolation` policy +
`owner_id` index) — new tables are not covered by the historical bulk-RLS migrations.

**`accounter_schema.businesses_securities`** — the 1:1 extension that marks a business as a
security, modelled on `businesses_admin`:

| column                                                                                   | notes                                                            |
| ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `id uuid PK`                                                                             | FK → `accounter_schema.businesses(id)` (same id as the business) |
| `owner_id uuid NOT NULL`                                                                 | FK → `businesses(id)`, RLS key                                   |
| `isin text NOT NULL`                                                                     | unique per owner                                                 |
| `symbol`, `eng_name`, `heb_name`, `exchange`, `currency_code`, `item_type`, `stock_type` | cached descriptors for display                                   |
| `is_etf boolean`, `is_foreign boolean`, `issuer_country_code text`                       |                                                                  |
| `created_at`, `updated_at`                                                               |                                                                  |

Unique index `businesses_securities_owner_isin_uindex (owner_id, isin)`.

**`accounter_schema.security_identifiers`** — the extensible bridge (user requirement: scalable to
more sources later):

| column                                                               | notes                                                                                                        |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `id uuid PK default gen_random_uuid()`                               |                                                                                                              |
| `owner_id uuid NOT NULL`                                             | RLS key                                                                                                      |
| `business_id uuid NOT NULL`                                          | FK → `businesses_securities(id)` ON DELETE CASCADE                                                           |
| `identifier_type accounter_schema.security_identifier_type NOT NULL` | new PG enum, initial values `POALIM_SECURITY_KEY`, `ISIN`; a future source is one `ALTER TYPE ... ADD VALUE` |
| `identifier_value text NOT NULL`                                     |                                                                                                              |

Unique index on `(owner_id, identifier_type, identifier_value)` — one Poalim key resolves to exactly
one security business; several keys may point at the same business (that's the ISIN-collapse case).
Index on `(owner_id, business_id)`.

**Also update** `BusinessesProvider.replaceBusiness`
(`financial-entities/providers/businesses.provider.ts`) to rewire both new tables when businesses
are merged — it already enumerates ~14 referencing tables and silently misses anything not listed.

---

## 2. Server — `foreign-securities` module owns the new code

The module already owns securities knowledge; it will cross-module `extend type LtdFinancialEntity`,
which is established practice (`charges`, `financial-accounts`, `sort-codes` all do it).

### 2.1 New provider — `providers/security-businesses.provider.ts`

`@Injectable({ scope: Scope.Operation, global: true })`, `TenantAwareDBClient` + pgtyped,
DataLoaders, mirroring `admin-businesses.provider.ts`:

- `getSecurityBusinessByBusinessIdLoader` — for the `securityInfo` field.
- `getSecurityBusinessByIdentifierLoader(type, value)` — `POALIM_SECURITY_KEY` → business (used by
  suggestions and the tab).
- `getAllSecurityBusinesses()` / `getAllSecurityBusinessIds()` — owner-cached; feeds charge typing,
  account resolution and the client picker.
- `ensureSecurityBusiness({ isin, descriptors })` — **idempotent**: look up `(owner, isin)`; if
  absent, in one transaction create the financial entity
  (`FinancialEntitiesProvider.insertFinancialEntity`), the business
  (`BusinessesProvider.insertBusiness`, which accepts a `PoolClient`), then the
  `businesses_securities` row.
- `linkIdentifier(businessId, type, value)` — `ON CONFLICT DO NOTHING`.

**Creation defaults** (user choice: _minimal + inherit from the general business_):

- `financial_entities.name` = `` `${engName} (${symbol})` `` (fall back to `engName`, then ISIN);
  `hebrew_name` = `heb_name`.
- `sort_code`, `irs_code`, tax-category match and `country` are **copied from the general
  foreign-securities business** (`adminContext.foreignSecurities.foreignSecuritiesBusinessId`) so
  security businesses behave like it in every sort-code/tax-category-driven report.
- No `suggestion_data` — phrase matching must not accidentally pick up a security.

### 2.2 Rewritten execution↔transaction matcher

`helpers/match-security-executions.helper.ts` is rewritten (user explicitly asked for the refactor).
Drop `DEFAULT_DATE_WINDOW_DAYS`, `DEFAULT_AMOUNT_TOLERANCE`, the multi-date/multi-amount fan-out and
the magnitude compare. New rule, **signed, exact, account-scoped**:

1. **Account** — execution `(bank_number, branch_number, account_number)` must equal the
   transaction's Poalim tuple (resolved by the caller as today via `FinancialAccountsProvider` +
   `FinancialBankAccountsProvider`).
2. **Date** — `execution.value_date` equals the transaction's effective debit date
   (`debit_date_override ?? debit_date`). Compare through `dateToTimelessDateString` (the existing
   DST-safe path). An execution with a null `value_date` cannot match.
3. **Amount + currency** — pick the execution's net-value column by the transaction's currency:
   `trade_currency → net_value_trade_currency`,
   `settlement_currency → net_value_settlement_currency`, ILS → `net_value_nis`. Compare **exactly**
   after normalising the decimal strings.
4. **Sign** — the expected cash direction comes from `trade_type`
   (`helpers/security-execution-enums.helper.ts`): `Buy`, `TransferOut*` ⇒ money out (negative
   transaction amount); `Sell`, `Redemption`, `DividendPayment`, `InterestPayment`, `TransferIn*` ⇒
   money in. Signs must agree.

Expose the core as a pairwise predicate plus **greedy 1:1 pairing** (an execution and a transaction
are each consumed once) and two entry points over it:

- `matchSecurityExecutions(transactions, executions, accountTuples)` →
  `Map<securityKey, executions[]>` — the existing charge-side signature, unchanged for callers.
- `matchExecutionsToTransactions(...)` → `Map<executionId, { transactionId, chargeId }>` — the
  reverse direction the new tab needs.

Update/extend the helper's unit tests to the new rule; delete tests asserting the old tolerance.

### 2.3 GraphQL surface

`typeDefs/foreign-securities.graphql.ts`:

```graphql
extend type LtdFinancialEntity {
  securityInfo: SecurityBusiness
}

type SecurityBusiness {
  id: UUID!
  business: Business!
  isin: String!
  symbol: String
  engName: String
  hebName: String
  exchange: String
  currencyCode: String
  itemType: String
  stockType: String
  isEtf: Boolean
  isForeign: Boolean
  identifiers: [SecurityIdentifier!]!
}

type SecurityIdentifier {
  type: SecurityIdentifierType!
  value: String!
}

enum SecurityIdentifierType {
  POALIM_SECURITY_KEY
  ISIN
}

type SecurityPosition {
  quantity: Float!
  averageCost: FinancialAmount
  totalBought: FinancialAmount
  totalSold: FinancialAmount
  "Earliest ingested execution — the position is only as complete as history from this date"
  historyStartDate: TimelessDate!
  lastExecutionDate: TimelessDate
}

type SecurityBusinessHistory {
  security: SecurityBusiness!
  position: SecurityPosition!
  executions: [SecurityHistoryExecution!]!
}

" SecurityExecution plus its cash-leg linkage "
type SecurityHistoryExecution { ...SecurityExecution fields..., charge: Charge, transaction: Transaction }

extend type Query {
  securityBusinessHistory(businessId: UUID!): SecurityBusinessHistory!
  allSecurityBusinesses: [LtdFinancialEntity!]!
}
```

Resolvers (`resolvers/`): `LtdFinancialEntity.securityInfo` via the loader;
`Query.securityBusinessHistory` = identifiers → security keys → executions (extend
`getSecurityExecutions` with a by-security-keys variant, no charge/date bound) → position math →
`matchExecutionsToTransactions` for the per-row charge link. Reuse the existing row→GraphQL mapping
in `resolvers/foreign-securities.resolver.ts` rather than duplicating the `FinancialAmount`
construction.

**Position math** (user choice: _derive + show as-of caveat_): signed sum of `nv` by `trade_type` —
`Buy`/`TransferIn*`/`StockDistribution` add, `Sell`/`TransferOut*`/`Redemption` subtract,
`DividendPayment`/`InterestPayment` are cash-only (0). Average cost = running average over buy legs
using `net_value_trade_currency`. `historyStartDate` = earliest `trade_date`; the client renders the
caveat from it.

### 2.4 Charge typing, account resolution, internal wallets

- `charges/helpers/charge-type.ts:109-115` — the `ForeignSecurities` branch additionally matches
  when `mainBusinessId` or any of `allBusinessIds` is in `getAllSecurityBusinessIds()`. (Stored
  charge types are untouched — derivation only runs for NULL-typed charges.)
- `financial-accounts/helpers/account-by-transaction.helper.ts:23-27` — same widening, so the
  `Account` column keeps showing `foreign_securities`.
- `admin-context/providers/admin-context.provider.ts:407-414` — append the owner's security business
  ids to `internalWalletsIds` (user choice: _yes_). **Query them with plain SQL inside the provider,
  not by injecting `SecurityBusinessesProvider`** — that provider depends on `AdminContextProvider`
  for `ownerId`, and injecting it back would create a cycle. This is what preserves both the ledger
  output and the balance report's internal-transfer filtering.
- `common/typeDefs/user-context.graphql.ts` + `common/resolvers/user-context.resolver.ts` — expose
  `foreignSecuritiesBusinessId` on `UserContext` (precedent: `bankDepositBusinessId` at
  `user-context.resolver.ts:65-67`); the client needs it as the picker's fallback option.

**Ledger: no change.** Add a regression test asserting a securities charge whose main transaction
carries a security business produces the same two entries as today (`Poalim … USD` ⇄
`Foreign Securities USD`, and the fee pair unchanged).

### 2.5 Transaction suggestion

`transactions/resolvers/transaction-suggestions.resolver.ts` — add a securities branch for
**non-fee** transactions, ahead of the POALIM description heuristics (`:241-254`): run
`extractSecurityKeys(source_description)`; if exactly one key resolves through
`getSecurityBusinessByIdentifierLoader`, suggest that business; otherwise fall through (no
suggestion invented). Fee transactions keep suggesting Poalim — matches the screenshot, where the
fee row stays `Poalim`.

### 2.6 Automation for new securities

`scraper-ingestion/providers/poalim-scraper-ingestion.provider.ts` →
`uploadPoalimSecuritiesTransactions`: after the rows are inserted, for each distinct `isin` among
them call `ensureSecurityBusiness(...)` (descriptors taken from the execution row: `eng_name`,
`heb_name`, `symbol`, `issuer_exchange`, `trade_currency`, `issuer_country_code`) and
`linkIdentifier(businessId, 'POALIM_SECURITY_KEY', row.security)`. Rows with a null `isin` are
skipped — those stay unlinked and are handled manually via the counterparty picker.

---

## 3. Backfill — `scripts/backfill-security-businesses.ts`

Standalone tsx script (user choice), modelled on `scripts/seed-demo-data.ts` for dotenv + `pg.Pool`
wiring. Flags: `--owner=<uuid>` (default: all owners), `--apply` (default is a dry-run report). It
must set the tenant GUC / connect with a role that satisfies the `tenant_isolation` policies, the
same way the existing seed scripts do.

1. **Create businesses** —
   `SELECT DISTINCT owner_id, isin, security, eng_name, heb_name, symbol, issuer_exchange, trade_currency, issuer_country_code FROM accounter_schema.poalim_securities_transactions WHERE isin IS NOT NULL`.
   One business per `(owner_id, isin)`; every `security` value seen with that ISIN becomes a
   `POALIM_SECURITY_KEY` identifier row. Idempotent — re-runnable.
2. **Re-point transactions** — for each transaction where `is_fee = false` **and**
   `business_id = <owner's foreign_securities_business_id>` **and**
   `extractSecurityKeys(source_description)` yields exactly one key that resolves to a security
   business, set `business_id` to it. Never touch a transaction whose business is anything else —
   that would overwrite a human decision.
3. Print counts (businesses created, identifiers linked, transactions re-pointed, keys with no ISIN,
   ambiguous descriptions) and, in dry-run, a sample of each bucket.

Security keys with no ISIN are intentionally left alone; they surface as an unassigned counterparty
in the charge UI, where the picker below resolves them.

---

## 4. Client

### 4.1 The Security tab

- `packages/client/src/components/business/index.tsx` — add a `security` tab (lucide icon,
  `searchParams`-driven like the others), gated on `securityInfo` being present in the
  `BusinessPage` fragment: `... on LtdFinancialEntity { securityInfo { id isin symbol } }` — the
  same shape as the existing `adminInfo`/`clientInfo` gating. Also bump the hard-coded
  `lg:grid-cols-8` on `TabsList`, which is already wrong for the current tab count.
- New `packages/client/src/components/business/security-section.tsx`, self-contained with its own
  `query BusinessSecuritySection($businessId: UUID!)` (the Charges/Transactions/Ledger tabs already
  work this way, so execution history isn't fetched on every business page load):
  - **Position summary card** — derived quantity, average cost, totals, the security's reference
    details (ISIN, symbol, exchange, currency, type, ETF/foreign badges), and the explicit caveat
    _"derived from ingested trades since {historyStartDate}"_.
  - **Full execution history table** — every execution across all of this ISIN's security keys. Lift
    the row rendering out of `foreign-securities-info.tsx`'s "Portfolio activity" table into a
    shared component instead of copying it; add a **link per row to the matched charge**
    (`ROUTES.CHARGES.DETAIL`), rendered as plain text when no charge matched.

### 4.2 Counterparty picker on the charge page

The transactions table lives at `packages/client/src/components/transactions-table/**`; the
Counterparty cell (`cells/counterparty.tsx`, plus its `cells-legacy/counterparty.tsx` twin) already
pre-seeds the select from `missingInfoSuggestions.business` and confirms with the check button — so
the suggestion side needs no client work beyond the server branch in §2.5.

What changes: the **option list**. Per the user's choice this is decided client-side by charge type,
so thread `chargeType` from `charge-extended-info.tsx:253` (`charge?.__typename`) →
`charge-transactions-table.tsx` → `transactions-table/index.tsx` (inject onto the row object exactly
like `enableEdit`/`enableChargeLink`) → the counterparty cells. When
`chargeType === 'ForeignSecuritiesCharge' && !transaction.isFee`, the options become the security
businesses plus the general foreign-securities business (the edge-case default); otherwise the
existing `useGetBusinesses()` list is used unchanged. Other `TransactionsTable` callers pass no
charge type and are unaffected.

- New `packages/client/src/hooks/use-get-security-businesses.ts` — `query AllSecurityBusinesses`
  returning `{ id name }` + `selectableSecurityBusinesses`, mirroring
  `hooks/use-get-admin-businesses.ts`.
- The general business id comes from `useUserContext()` via the new `foreignSecuritiesBusinessId`
  field (§2.4).
- Security businesses stay visible in all the ordinary business lists (user choice: _show
  everywhere_) — no filtering work elsewhere.

### 4.3 Charge securities panel

`foreign-securities-info.tsx` — link each security's header block to its business page when a
security business exists, and surface the ISIN alongside the security key.

---

## 5. Suggested PR split

1. Migrations + `SecurityBusinessesProvider` + `securityInfo`/`allSecurityBusinesses` GraphQL (no
   behavior change yet).
2. Matcher rewrite + its tests (pure refactor, charge view output should be unchanged apart from the
   stricter rule).
3. Charge typing / account resolution / `internalWalletsIds` / `UserContext` widening + ledger
   regression test.
4. Ingestion hook + suggestion branch.
5. Backfill script (run dry first).
6. Client: security tab, then the counterparty picker.

---

## Verification

- `yarn generate` after every schema touch, then `yarn lint` and `yarn prettier:check`.
- **Unit** (`yarn test`): new matcher rules (value-date equality, currency-selected net value, sign
  agreement, account scoping, 1:1 greediness, null `value_date`), position math per `trade_type`,
  and business-name construction.
- **Integration** (`yarn test:integration`, needs Postgres + migrations): `ensureSecurityBusiness`
  idempotency, identifier uniqueness, RLS isolation between owners, and the ledger regression test
  in §2.4. Note the root `.env` points at the production DB — override `POSTGRES_*` before running
  these.
- **Backfill**: run the script dry against a local DB restored from a snapshot, eyeball the report,
  then `--apply` and confirm the securities charges still type as `ForeignSecurities` and their
  ledger records are identical (diff `ledger` rows before/after).
- **End-to-end** (`yarn build`, `yarn server:dev`, `yarn client:dev`): open a foreign-securities
  charge — the main transaction shows the security business as counterparty, the fee row still shows
  Poalim, and the ledger table matches the screenshot; clear a counterparty and confirm the
  suggestion + the filtered picker; open the security's business page and check the Security tab's
  position card, execution history and per-row charge links.
