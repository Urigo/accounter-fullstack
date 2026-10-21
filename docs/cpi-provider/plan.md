# Plan: CPI (Consumer Price Index) provider + DB table

## Context

Several features need the Israeli CPI (מדד המחירים לצרכן):

- real vs. inflationary capital gains on securities (SHAAM 6111 codes 520/530 are always 0 today, in
  `packages/server/src/modules/reports/helpers/shaam6111.helper.ts`);
- gains on fixed-asset sales;
- linkage differences (הפרשי הצמדה) on tax debts;
- the annual tax calculation.

There is **no CPI, madad or indexation code anywhere in the repo** today. The goal is one shared,
DB-backed source of truth for CPI values, modelled on how exchange rates are handled (a global table
read through a provider). It also needs an automated sync from the official CBS API and correct
"known index" semantics, so consumers never re-implement index math.

### What the CBS API gives us (reviewed and probed live on 2026-10-21)

**Access**

- Endpoint:
  `GET https://api.cbs.gov.il/index/data/price?id=120010&format=json&download=false&lang=en`
- Public: no key, CORS `*`.
- A `User-Agent` header is mandatory per the CBS docs.
- Parameters: `startPeriod`/`endPeriod` (`mm-yyyy`), `last=N`, `coef=true`, `page`, `pagesize` (max
  1000).
- The full CPI history (1951-09 → 2026-09, **901 rows**) fits in one call with `pagesize=1000`.
- An unknown id or a future range returns `{"month": null, "paging": {"total_items": 0}}`, not an
  error.

**Row shape**
`{year, month, percent, percentYear, currBase: {baseDesc: "Average 2024", value: 105.3}, prevBase}`

**Values are published once, in the base that was current at that time, rounded to 1 decimal. They
are never restated.**

- Dec 2024 = 108.4 in base "Average 2022"; Jan 2025 = 101.5 in base "Average 2024".
- A new base starts every 2 years in January. The next one is expected in Jan 2027.
- Comparing across bases needs **chain coefficients**. `coef=true` returns every older base with its
  coefficient, e.g. `{coeff: 1.074, baseDesc: "Average 2022"}`, back to Sep 1951 (21 links).

**Calculator** (`/index/data/calculator/120010?value=&date=&toDate=`)

- It returns `mult_min`/`mult_max`: each index expressed in the oldest base (Sep 1951 = 100).
- Linkage ratio = `mult_max / mult_min`. Storing that **chained value** per row reproduces the
  official calculator exactly.
- "Known index" rule, verified empirically: a month's index becomes known on the **16th** of the
  following month, whatever the weekday.
  - date 2025-01-14 or 2025-01-15 → Nov 2024
  - date 2025-01-16 → Dec 2024
  - date 2025-11-15 (a Saturday) → still Sep 2025

**Other endpoints**

- `price_selected*` is XML-only; `price_all` is a bulk dump; SDMX (`apis.cbs.gov.il/sdmx`) serves
  OECD-style series.
- None of them is better than `/index/data/price` for this. None exposes the actual publication
  date.

**Law** — Income Tax Ordinance §88:

> "מדד" – מדד המחירים לצרכן **כפי שפורסם לאחרונה לפני היום שבו מדובר**

That is: the index as last published _before_ the day in question.

- When CBS publishes early (the 15th falls on a Friday, Saturday or holiday → it publishes on the
  14th or earlier), §88 and the calculator disagree for a day or two. So we store `published_on` per
  row and do not hard-code the 15th.
- §88 also says that for an **individual's** foreign-currency securities, the exchange rate is the
  "index". Consumers will choose between CPI and FX; the provider only supplies CPI.

## Decisions (confirmed with user)

- **Ingestion:** server-side sync job (startup backfill + daily run + super-admin mutation). No
  scraper-app path for now.
- **Scope of the first PR:** infrastructure only (table, client, sync, provider, helpers, minimal
  GraphQL). Consumers come as follow-up PRs.

## Recommended approach

### 1. Migration — `packages/migrations/src/actions/2026-10-21T12-00-00.price-indexes.ts`

- Use the `sql\`...\``form from`2025-07-23T11-00-24.support-sek-currency.ts`.
- Register it at the end of `MIGRATIONS` in `packages/migrations/src/run-pg-migrations.ts`.
- Both tables are global (no `owner_id`, no RLS), like `exchange_rates`. The RLS invariant test only
  checks tables that have `owner_id`.
- The table is generic: it is keyed by CBS `index_code`, so the construction-input index (200010,
  used in real-estate contracts) and others can be added later at no schema cost. Only CPI (120010)
  is synced now.

```sql
CREATE TABLE accounter_schema.price_index_bases (
  index_code        integer NOT NULL,
  base_label        text    NOT NULL,          -- CBS English baseDesc, e.g. 'Average 2024'
  first_period      date    NOT NULL,          -- first month published in this base (day = 1)
  chain_coefficient numeric,                   -- to the previous base; NULL for the oldest
  chained_factor    numeric NOT NULL,          -- product of the coefficients down to the oldest base
  PRIMARY KEY (index_code, base_label)
);
CREATE TABLE accounter_schema.price_index_values (
  index_code        integer NOT NULL,
  period            date    NOT NULL CHECK (extract(day FROM period) = 1),
  value             numeric NOT NULL,          -- as published, in base_label
  base_label        text    NOT NULL,
  chained_value     numeric NOT NULL,          -- value * chained_factor (CBS "mult")
  monthly_change_pct numeric, yearly_change_pct numeric,
  published_on      date    NOT NULL,          -- index is "known" from published_on + 1 day
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (index_code, period),
  FOREIGN KEY (index_code, base_label) REFERENCES accounter_schema.price_index_bases
);
CREATE INDEX ON accounter_schema.price_index_values (index_code, published_on);
```

Use plain `numeric` with no precision limit: the 1980s values and the chained values are large.

### 2. CBS client — `packages/server/src/modules/app-providers/cbs-price-index-client.ts`

- Modelled on `coinmarketcap.ts`: `@Injectable({ scope: Scope.Singleton, global: true })`,
  registered in `modules-app.ts` `providers`.
- `fetchValues(code, { startPeriod?, last? })`
  - sets `User-Agent: accounter/<version>`, `AbortSignal.timeout(15_000)`,
    `format=json&lang=en&pagesize=1000`;
  - follows `paging.next_url` defensively;
  - treats `month: null` as `[]`.
- `fetchChain(code)` calls `last=1&coef=true` and returns the base list with its coefficients.
- Parsing is a pure exported `parseCbsPriceResponse(json)` built on a **zod** schema (zod 4 is
  already a server dependency). Shape drift fails loudly.
- Normalisation: map `baseDesc` → `base_label`; map `(year, month)` → `period`.

### 3. Sync — `PriceIndexSyncProvider` (`price-indexes/providers/price-index-sync.provider.ts`)

`PriceIndexSyncProvider.sync({ indexCodes = [120010], now, full })` depends only on `DBProvider` and
the CBS client, so it can be constructed by hand outside DI. The pure row-building logic lives in
`helpers/sync-price-indexes.helper.ts`. Two reasons for this shape:

- the startup job runs **outside DI**: `src/index.ts` schedules jobs before `createGraphQLApp`, the
  same as `cleanupExpiredInvitations(dbProvider, …)`;
- the mutation calls the same provider through DI.

Steps:

- Run in one transaction guarded by `pg_try_advisory_xact_lock(hashtext('price_index_sync'))`. With
  several instances, only one syncs.
- **Empty table or `full`:** call `fetchChain` + full `fetchValues`, upsert all bases, upsert all
  901 values.
- **Incremental:**
  - Skip the HTTP call entirely while `now` is before the 10th of the month after the next expected
    period.
  - Otherwise fetch `startPeriod = latest − 2 months` with `coef=true`.
  - If a row carries a base we don't know (a new base each odd January), insert it, using
    `prevBase[0].coeff` as its `chain_coefficient`.
- `published_on` for **new** rows =
  `min(15th of the month after the period, today in Asia/Jerusalem)`. An early publication caught by
  the daily run is recorded exactly; backfilled history follows the calculator's rule.
  - **Known limitation:** only an early publication seen by a run on that same day is recorded
    exactly. After downtime, and for backfilled history, an early publication still reads as the
    15th, which can shift the "known" index by a day or two around month boundaries. This matches
    the CBS calculator; `published_on` can be corrected by hand and survives re-syncs.
- Upsert `ON CONFLICT (index_code, period) DO UPDATE` value, base, chained value and percentages
  **only when they differ**, and log a warning: CPI should never change. **Never overwrite
  `published_on`**, so manual corrections stick.
- Return `{ inserted, updated, basesUpserted, skipped }`.

### 4. Module — `packages/server/src/modules/price-indexes/`

Scaffold with the `new-module` skill: `index.ts`, `types.ts`, `typeDefs/`, `resolvers/`,
`providers/`, `helpers/`. Register it in `modules-app.ts`.

**`providers/price-indexes.provider.ts`**

- `@Injectable({ scope: Scope.Operation, global: true })`, constructor `(db: DBProvider)`.
  - `DBProvider` because the table is global, as in `FiatExchangeProvider` and `CountriesProvider`.
  - Operation scope gives a fresh cache per request. This deliberately avoids the stale-cache
    problem of Singleton `FiatExchangeProvider`, whose 24h cache is never cleared after an upload.
- `getSeriesLoader: DataLoader<code, PriceIndexSeries>` loads the whole series in one
  `sql<IGetSeriesQuery>` query. That is about 900 rows, cheap, and lets every lookup be answered in
  memory.
- Write SQL (`upsertPriceIndexBases`, `upsertPriceIndexValues`) lives in the sync provider as
  pgtyped constants.

**`helpers/price-index.helper.ts`** — pure functions, the API consumers use.

Any change between two points is computed **locally**:

- no CBS call at query time;
- the result does not depend on which base the two points were published in.

Each side ("base point" and "target point") is resolved independently, so contracts that mix modes
work. For example: base = the index for Jan 2023, target = the known index on the payment date.

- `resolvePoint(series, { date, mode })`:
  - `mode: 'KNOWN'` (default) — §88 and the CBS calculator: the last row whose `published_on < date`
  - `mode: 'FOR_PERIOD'` — "מדד בגין": the row for the date's month
- `resolveStatedBase(bases, { value, baseLabel })` — a contract that states a base index _value_
  (e.g. "100.7 points, Average 2020"). The chained value = `value × chained_factor(baseLabel)`.
- `getRatio(fromPoint, toPoint)` = `to.chained_value / from.chained_value`
- `linkAmount(amount, from, to)` →
  `{ linkedAmount, ratio, changePercent, fromIndex, toIndex, linkageDifference }`
- `valueInBase(row, targetBase, bases)` = `chained_value / chained_factor(targetBase)`. It shows any
  month in any base, e.g. Dec 2024 in "Average 2024" = 108.4 / 1.074 ≈ 100.93.
- No rounding inside the helpers. Consumers round, because tax forms and the CBS calculator round
  differently.
- A missing period throws `PriceIndexNotAvailableError`, which carries the period, so callers can
  tell "not yet published" apart from a bug.

**Thin provider facade** — `PriceIndexesProvider.getKnownIndexAt(code, date)` etc. These wrap the
loader + helpers, so other modules call `injector.get(PriceIndexesProvider)`.

**GraphQL (`typeDefs/price-indexes.graphql.ts`)**

`enum PriceIndexType { CONSUMER_PRICE_INDEX }` maps to 120010 inside the server, so CBS codes stay
internal.

```graphql
type PriceIndexValue {
  period: String!
  value: Float!
  base: String!
  valueInLatestBase: Float!
  monthlyChangePercent: Float
  yearlyChangePercent: Float
  publishedOn: TimelessDate!
}
enum PriceIndexMode {
  KNOWN
  FOR_PERIOD
} # KNOWN = last published before the date (§88); FOR_PERIOD = index for that month
input PriceIndexPointInput {
  date: TimelessDate!
  mode: PriceIndexMode = KNOWN
}
type PriceIndexLinkage {
  amount: Float!
  linkedAmount: Float!
  ratio: Float!
  changePercent: Float!
  fromIndex: PriceIndexValue!
  toIndex: PriceIndexValue!
}
extend type Query {
  priceIndexValues(
    type: PriceIndexType!
    fromPeriod: String!
    toPeriod: String!
  ): [PriceIndexValue!]! @requiresAuth
  priceIndexLinkage(
    type: PriceIndexType!
    amount: Float!
    from: PriceIndexPointInput!
    to: PriceIndexPointInput!
  ): PriceIndexLinkage! @requiresAuth
}
extend type Mutation {
  syncPriceIndexes(full: Boolean): PriceIndexSyncResult! @requiresAuth
}
```

- The mutation's resolver calls `SuperAdminProvider.requireSuperAdmin()`
  (`modules/auth/providers/super-admin.provider.ts`), the same guard `bootstrapNewClient` uses. The
  data is global, so tenant roles must not trigger writes.

### 5. Scheduling + env

- `packages/server/src/environment.ts`: add
  `PriceIndexSyncModel = zod.object({ PRICE_INDEX_SYNC_ENABLED: zod.union([zod.literal('1'), zod.literal('0')]).default('1') })`,
  following the `EmailIngestionModel` flag pattern.
  - Expose it as `env.priceIndexSync.enabled`.
- `packages/server/src/index.ts`, when enabled:
  - fire one non-blocking run at startup, which backfills a fresh DB;
  - add a daily `scheduleDailyAtUtc(17, 0, DAY_IN_MS, …)` (`src/jobs/utils.ts`). The release is
    18:30 Israel time on weekdays and 14:00 on Fridays; 17:00 UTC is after both, in either DST
    state;
  - cancel it in `gracefulShutdown` next to `cleanupSchedule`.
- The server already calls external APIs with plain `fetch` (CoinMarketCap). No new dependency is
  needed, because we use JSON, not XML.

### Out of scope — planned follow-ups

**A. Consumers of the provider**

1. **Securities:** real vs. inflationary gain per FIFO lot.
   - Lots come from `foreign-securities/helpers/security-cost-basis.helper.ts`; booking happens in
     `foreign-securities-ledger-generation.resolver.ts`.
   - This feeds SHAAM 6111 codes 520/530/570.
   - Tax rule: under deflation the inflationary amount is 0.
2. **Fixed-asset sale:** adjusted cost = (cost − depreciation) × ratio, in the `depreciation`
   module.
3. **Linkage differences** on late tax/VAT payments.
4. **Reconciliation** against the bank-reported
   `poalim_securities_transactions.real_profit_loss_nis`.
5. **Client UI** for CPI values and a linkage calculator.

**B. Move the Bank of Israel exchange-rates fetch to a server job**

Today `scraper-app` pulls BOI rates and pushes them through `uploadCurrencyRates`
(`scraper-app/src/server/scrapers/currency-rates.ts`). Replace that with a scheduled server job
built the same way as this sync (client + sync provider + `scheduleDailyAtUtc`), and remove the task
from `scraper-app`. While doing it, fix the `FiatExchangeProvider` 24h cache going stale after an
upload.

## Risks

- **CBS may block non-Israeli or datacenter IPs.** The `X-TS-AJAX-Request` header points to an F5
  WAF. The probes here worked through the proxy, but **reachability from the production host must be
  checked before merge.**
  - Fallback: keep the same parse/sync code, but run the fetch in `scraper-app` (local, Israeli IP)
    and push through a `@requiresRole(role:"scraper")` mutation. That is how BOI fiat rates arrive
    today (`scraper-app/src/server/scrapers/currency-rates.ts` → `uploadCurrencyRates`).
- **Integration tests must not wipe global rows.** The scraper-ingestion test does
  `DELETE FROM exchange_rates`; ours must not. Use a fake `index_code` (e.g. 999001) in tests.

## Critical files

- **New:**
  - `packages/migrations/src/actions/2026-10-21T12-00-00.price-indexes.ts`
  - `packages/server/src/modules/app-providers/cbs-price-index-client.ts`
  - `packages/server/src/modules/price-indexes/**`
- **Edit:**
  - `packages/migrations/src/run-pg-migrations.ts`
  - `packages/server/src/modules-app.ts`
  - `packages/server/src/environment.ts`
  - `packages/server/src/index.ts`

## Verification

1. **Unit** (`yarn test`)
   - Client parsing, with fixtures captured from the live API: `last=2&coef=true`, the base-change
     window `11-2024…02-2025`, and the empty `month: null` reply.
   - Fetch is stubbed with `vi.stubGlobal('fetch', …)`, as in
     `scraper-app/src/server/scrapers/__tests__/currency-rates.test.ts`.
   - Helper golden cases, checked against the official CBS calculator:
     - known index on 2025-01-14 and 2025-01-15 = Nov 2024 (108.7); on 2025-01-16 = Dec 2024 (108.4)
     - link 100 from 2025-01-10 to 2026-10-10 = **104.53**: Nov-24 108.7 (base 2022) → Aug-26 105.8
       (base 2024), chain 1.074
     - 100 from 2025-01-20 to 2026-10-20 = **104.33**
     - 100 from 2024-12-10 to 2025-01-10 = **99.63**
     - an early-publication row (`published_on` = the 14th) is known on the 15th
     - date-to-date linkage of 1,000, including spans across many base changes. Each was already
       reproduced locally from the live data and matched the CBS calculator to the agora:
       - 1995-03-01 → 2026-10-21 = 2233.08
       - 2003-07-20 → 2026-10-21 = 1478.49
       - 2010-01-10 → 2018-06-30 = 1083.16
       - 2015-06-20 → 2024-03-03 = 1118.52
       - 1986-05-05 → 2000-01-01 = 5217.86
     - `FOR_PERIOD` mode and a mixed `FOR_PERIOD` → `KNOWN` pair resolve the expected months
     - `valueInBase(Dec 2024, "Average 2024")` ≈ 100.93
2. **Integration** (`yarn test:integration`), against the migrated DB, with fake index code 999001
   and a mocked client:
   - full sync inserts the bases and values;
   - a re-run is a no-op;
   - a new base in January is added with the correct chained value;
   - `published_on` survives a re-sync;
   - the advisory lock prevents a parallel run;
   - the provider loader returns the series.
3. **Manual**
   - `yarn workspace @accounter-helper/migrations migration:run`, then start the server with
     `PRICE_INDEX_SYNC_ENABLED=1`, then `select count(*) from accounter_schema.price_index_values`
     returns about 901.
   - Query
     `priceIndexLinkage(type: CONSUMER_PRICE_INDEX, amount: 100, from: {date: "2025-01-10"}, to: {date: "2026-10-10"})`
     and compare with
     `https://api.cbs.gov.il/index/data/calculator/120010?value=100&date=2025-01-10&toDate=2026-10-10&format=json`.
4. `yarn generate`, `yarn lint`, `yarn workspace @accounter/server typecheck`,
   `yarn prettier:check`.
