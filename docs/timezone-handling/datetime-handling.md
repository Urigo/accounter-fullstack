# Datetime and timezone handling

Part of [#4560](https://github.com/Urigo/accounter-fullstack/issues/4560) (timezone handling). This
covers the third checklist item: **make datetime values explicit about timezone (UTC in transit,
local time only at display)**. It maps every value that carries a time of day, or that switches
between a day and a point in time, through the server, the client and the other packages, and
classifies how safe each one is today.

It is a report only. It changes no code, and it proposes no fix that has not been spelled out as a
work item ([section 5](#5-work-items)) with the tests to land with it ([section 6](#6-test-plan)).

Sibling docs:

- [Date fields inventory](./date-fields-inventory.md)
  ([#4568](https://github.com/Urigo/accounter-fullstack/pull/4568)) lists where every date and
  datetime is stored and how the API types it.
- [External provider dates](./external-provider-dates.md)
  ([#4629](https://github.com/Urigo/accounter-fullstack/pull/4629)) maps every date that arrives
  from an external provider. Its case IDs (WIN-\*, POA-\*, GI-\*, DEEL-\*, CMC-\*, …), conversion
  rules (R1–R13) and manual checks (M-1…M-12) are reused here rather than repeated.
- [#4592](https://github.com/Urigo/accounter-fullstack/pull/4592) (merged) keeps date-only values as
  `TimelessDateString` end to end. It added the tenant timezone (`TENANT_TIMEZONE`,
  `packages/server/src/shared/constants.ts:9`), the helpers in
  `packages/server/src/shared/helpers/tenant-timezone.ts` and
  `packages/server/src/shared/helpers/timeless-date.ts`, and the test helpers in
  `packages/server/src/__tests__/helpers/timezones.ts`.

Code was read on `main` at `abd0493` (Mesh v1 migration).

**Paths.** To keep the tables readable:

- Paths starting with `modules/`, `shared/`, `jobs/` or `demo-fixtures/` are under
  `packages/server/src/`.
- Paths starting with `components/`, `helpers/`, `hooks/` or `providers/` are under
  `packages/client/src/`.
- Migrations are under `packages/migrations/src/actions/` and are named by their timestamp, e.g.
  `2024-01-29T13-15-23.initial.ts`.
- Everything else is relative to the repository root.

## Contents

- [Terms and the target model](#terms-and-the-target-model)
- [Summary](#summary)
- [1. The clocks](#1-the-clocks)
- [2. Server](#2-server)
- [3. Client](#3-client)
- [4. Other packages](#4-other-packages)
- [5. Work items](#5-work-items)
- [6. Test plan](#6-test-plan)
- [7. Decisions needed](#7-decisions-needed)
- [8. Non-timezone bugs found along the way](#8-non-timezone-bugs-found-along-the-way)
- [Appendix: probes](#appendix-probes)

## Terms and the target model

- **Day:** a calendar date (`yyyy-mm-dd`) with no time and no timezone. #4592 made these
  `TimelessDateString` / `TimelessDate` end to end.
- **Instant:** a point in time. It is the same moment everywhere; only how it is _shown_ depends on
  a timezone.
- **Wall-clock time:** a date and time with no offset, e.g. a Postgres `timestamp` (without time
  zone), a bank's `HH:MM`, or what a user types into a date-time picker. It only becomes an instant
  once someone decides which zone it is in. Most of the problems below are wall-clock times whose
  zone is decided implicitly, by whichever machine happens to read or write them.

The target model, which the work items move towards:

| Rule | What it says                                                                                                                                                                                                                                                                          |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T1   | An instant is stored as `timestamptz`, never as `timestamp` without time zone.                                                                                                                                                                                                        |
| T2   | An instant travels as `DateTime`: RFC 3339 with `Z` on output, an explicit offset required on input. Not as `String`, not as an offset-less string, not as a wall-clock time.                                                                                                         |
| T3   | A day travels as `TimelessDate` and is never turned into an instant unless an API needs one (then `timelessDateToTenantInstant`).                                                                                                                                                     |
| T4   | Turning an instant into a day, and every "today", "this month" or "this year", uses the **tenant timezone**: `instantToTimelessDate`, `todayTimelessDate`, `currentTenantYear` on the server, and a client equivalent (W7).                                                           |
| T5   | An instant is converted to local time only for display, in a zone chosen per kind of value ([3.4](#34-tenant-or-browser-the-display-policy)), and the zone is visible whenever it is not obvious.                                                                                     |
| T6   | No code depends on the server process's `TZ` or the database session's `TimeZone`. Both are still pinned to UTC as a safety net (W1), so that anything missed behaves the same in every environment.                                                                                  |
| T7   | A wall-clock time from a source (a bank's purchase time, a user's typed time) is turned into an instant at the boundary where it enters, with the source's zone named in code (e.g. `Asia/Jerusalem` for an Israeli bank, the tenant zone for a user typing into a bookkeeping form). |

**Marks**, as in #4629: ✅ safe; ⚠️ depends on a clock, named in the case; 🔍 not proven, needs a
manual check before fixing; 🐞 wrong for a reason other than timezone.

**Zones** named in the cases:

- **process:** the server process's `TZ`.
- **DB:** the Postgres session `TimeZone`.
- **tenant:** `TENANT_TIMEZONE` (`Asia/Jerusalem`).
- **UTC.**
- **browser:** the user's browser zone.
- **scraper:** the zone of the machine running scraper-app.
- **stored day:** the date part of a `timestamp` value as stored. node-pg reads a `timestamp` and
  `format` prints it in the same process zone, so this day doesn't depend on any zone at read time.
  Which zone it was _written_ in is a separate question.

**Priorities**, as in #4629:

- **P1:** stored or sent data can be wrong today in a realistic setup: an Israeli user, a server on
  UTC (the usual container default, and what CI and the docker images use), or a user abroad.
- **P2:** wrong only when the process and DB clocks differ, or blocked on a decision or manual
  check.
- **P3:** display, labels, defaults near midnight, or latent.

## Summary

**The main findings:**

1. **Nothing pins the process or DB clocks** (SRV-20). 26 of the 44 `DateTime` declarations in the
   schema are backed by `timestamp` without time zone, so the instant the API sends depends on
   whether the zone that wrote the value matches the zone that reads it:
   - charge, transaction, business and tax category `createdAt` / `updatedAt`;
   - dynamic report `created` / `updated`;
   - `Transaction.exactEffectiveDate`;
   - `MiscExpense.valueDate` and its inputs.

   The same `timestamp` columns are written in **three different zones**: the DB session (SQL
   defaults, triggers, crypto scrapers), the server process (`misc_expenses.value_date`,
   `crypto_exchange_rates`) and an Israeli bank's wall clock (Max `debit_timestamp`). SRV-1 to
   SRV-6.

2. **The misc-expense value date is the riskiest datetime** (SRV-2, SRV-3, CLI-20). Along the chain,
   the same value is read in four different zones:
   1. The user types a wall-clock time in the **browser's** zone.
   2. It is sent as a UTC instant.
   3. It is stored as the **server process's** wall clock.
   4. The ledger takes its stored day as the value date, and uses the same value as the
      exchange-rate instant.
   5. The balance-charge lock check meanwhile uses the **tenant** day.

   An Israeli user who enters 01:30 on 1 May, with the server on UTC, gets a ledger value date of 30
   April (probe in the [appendix](#appendix-probes)).

3. **The client has no notion of the tenant zone.**
   - Every "today", "this month" and "this year" default uses the browser clock (CLI-21). Two use
     the **UTC** day (CLI-18, CLI-19).
   - Its one date-time input reads the browser's wall clock and shows no zone (CLI-20).
   - Instants are shown in the browser's zone, without a label and in mixed formats (CLI-22).
4. **The client still turns days into instants in 19 places** (CLI-1 to CLI-19). Two of them corrupt
   saved data west of UTC: contract start and end dates (CLI-2), and a business's registration date
   (CLI-1). One makes salary records impossible to edit west of UTC (CLI-7). These are days, not
   datetimes, so strictly they belong to the fourth checklist item (client audit). They are listed
   because this report covers every date shown or entered in the UI.
5. **Files for the Israeli Tax Authority mix zones.**
   - PCN874's header date is the UTC day, so a regenerated report always "differs" from the saved
     one (SRV-12).
   - The uniform-format header combines a UTC date with a process-local time (SRV-13).
   - Its `entryDate` is the DB session's day (SRV-11).
6. **Cross-package types don't carry the scalars.**
   - scraper-app and email-ingestion-gateway map no date scalars in codegen (XP-1, XP-3).
   - The client types `DateTime` as `Date` while it receives a string (CLI-23).
   - The Mesh v1 `Date` scalar turns Green Invoice request dates into ISO instants (GI-5, 🔍 whether
     it reaches the wire).
7. **🐞 Green Invoice `firstPayment` is an amount, and we send a unix time in it** (SRV-16). This
   answers #4629's M-10.

### Server

| Case   | Where                                                                                                                                      | What can go wrong now                                                                                                                                                                             | Marks | Priority                          | Work   |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- | --------------------------------- | ------ |
| SRV-1  | `created_at` / `updated_at` on `charges`, `transactions`, `financial_entities`, `ledger_records`, `dynamic_report_templates` (`timestamp`) | Written by SQL in the DB zone, read by node-pg in the process zone. The `DateTime` sent is off by the difference between the two.                                                                 | ⚠️    | P2 (P1 if the clocks differ, D-1) | W1, W2 |
| SRV-2  | `misc_expenses.value_date` (`timestamp`)                                                                                                   | A client instant is stored as the process wall clock. The ledger value day and the exchange-rate instant come from that.                                                                          | ⚠️    | P1                                | W3     |
| SRV-3  | `generateBalanceCharge`                                                                                                                    | The lock check uses the tenant day of the value date, but storage and the ledger use the process wall clock. They disagree near midnight whenever the process zone isn't the tenant's.            | ⚠️    | P2                                | W3     |
| SRV-4  | `transactions.debit_timestamp` (`timestamp`)                                                                                               | Max writes an Israeli wall clock; Kraken and Etherscan the DB zone's. The server reads it in the process zone for `exactEffectiveDate` and for crypto rate instants.                              | ⚠️ 🔍 | P2                                | W2     |
| SRV-5  | `crypto_exchange_rates.date` / `sample_date` (`timestamp`)                                                                                 | The rate cache is keyed by exact equality on the process wall clock. Changing the server zone misses the cache, calls CoinMarketCap again and stores duplicate rows the unique key doesn't catch. | ⚠️    | P2                                | W2     |
| SRV-6  | Balance and annual revenue reports                                                                                                         | SQL compares `timestamp` columns written in different zones.                                                                                                                                      | ⚠️    | P2                                | W2     |
| SRV-7  | `TimelessDate` scalar                                                                                                                      | Still accepts a JS `Date` and takes its process-zone day. Any resolver that returns an instant there silently gets the server's day.                                                              | ⚠️    | P3 (latent)                       | W4     |
| SRV-8  | `DateTime` scalar                                                                                                                          | The contract is right: `Z` out, offset required in. `serialize` returns a `Date`, so in-process consumers see `Date`s.                                                                            | ✅    | —                                 | W4     |
| SRV-9  | Instants typed `String`: email ingestion `createdAt` / `updatedAt` / `expiresAt` / `receivedAt`                                            | No scalar guarantee. `receivedAt` is forwarded unvalidated from an HTTP header.                                                                                                                   | ⚠️    | P3                                | W5     |
| SRV-10 | Email ingestion charge description                                                                                                         | Shows the UTC day of `receivedAt` (EML-1).                                                                                                                                                        | ⚠️    | P3                                | W6     |
| SRV-11 | SHAAM uniform format, B100 `entryDate`                                                                                                     | The DB zone's day of `ledger_records.created_at`, not the tenant's.                                                                                                                               | ⚠️    | P2                                | W6     |
| SRV-12 | PCN874 header `generationDate`                                                                                                             | Defaults to the UTC day. The saved-vs-regenerated comparison covers the header, so any report regenerated on a later day shows a diff.                                                            | ⚠️    | P2                                | W6     |
| SRV-13 | SHAAM uniform format, A000 `processStartDate` / `processStartTime`                                                                         | UTC date with process-local time.                                                                                                                                                                 | ⚠️    | P2                                | W6     |
| SRV-14 | Deel `issued_at` / `due_date`                                                                                                              | A fixed +7h "fix", and the document day is the UTC day of the shifted value (#4629's DEEL-1 to DEEL-4).                                                                                           | ⚠️ 🔍 | P2                                | M-8    |
| SRV-15 | Otsar Hahayal ILS business and registration dates                                                                                          | Days stored as `timestamptz` from offset-less strings. The server derives the tenant day and the trigger the DB day (OTS-1).                                                                      | ⚠️    | P2                                | W2     |
| SRV-16 | Green Invoice `firstPayment`                                                                                                               | A unix time is sent in what is an amount field.                                                                                                                                                   | 🐞    | P1                                | W8     |
| SRV-17 | Scripts that open DB connections without `pgTypeParsers`                                                                                   | `date` values come back as process-local `Date`s.                                                                                                                                                 | ⚠️    | P3                                | W1     |
| SRV-18 | Ledger scenario integration tests                                                                                                          | Fail under `TZ=America/New_York`, because of SRV-1.                                                                                                                                               | ⚠️    | P3                                | W2     |
| SRV-19 | Salary month normalization fallback                                                                                                        | `new Date(month)` in the process zone.                                                                                                                                                            | ⚠️    | P3                                | W6     |
| SRV-20 | Clock configuration                                                                                                                        | Nothing sets the process `TZ` or the DB session `TimeZone`, so every ⚠️ above follows the deployment.                                                                                             | ⚠️    | P2                                | W1     |

### Client

| Case   | Where                                                 | What can go wrong now                                                                                               | Priority |
| ------ | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | -------- |
| CLI-1  | Business admin, registration date                     | West of UTC, **saves** the previous day.                                                                            | P1       |
| CLI-2  | Client contract dialog, start and end dates           | West of UTC, **saves** both dates a day early.                                                                      | P1       |
| CLI-3  | Transactions CSV export                               | West of UTC, every date is a day early.                                                                             | P2       |
| CLI-4  | Similar transactions modal                            | West of UTC, shows the previous day.                                                                                | P3       |
| CLI-5  | Client page, contracts section                        | West of UTC, shows the previous day, in the browser's locale format.                                                | P3       |
| CLI-6  | Salary month titles                                   | West of UTC, shows the previous month.                                                                              | P3       |
| CLI-7  | Edit salary record modal                              | West of UTC, **queries the previous month**, so the record is not found.                                            | P1       |
| CLI-8  | Salary record form, month picker default              | West of UTC, preselects the previous month.                                                                         | P2       |
| CLI-9  | Salaries filter                                       | West of UTC, shows the previous month.                                                                              | P3       |
| CLI-10 | Charge "year of relevance" picker                     | West of UTC, shows the previous year, and a re-save **writes** it.                                                  | P1       |
| CLI-11 | Monthly income / expense chart filter                 | West of UTC, shows the previous month.                                                                              | P3       |
| CLI-12 | Monthly income / expense page description             | West of UTC, shows the previous month.                                                                              | P3       |
| CLI-13 | Charts page, monthly buckets                          | West of UTC, amounts dated the 1st land in the previous month.                                                      | P2       |
| CLI-14 | Annual audit, ledger-lock confirmation                | West of UTC, says "December 30th".                                                                                  | P3       |
| CLI-15 | Issue-documents month pickers                         | West of UTC on the 1st, shows the previous month.                                                                   | P3       |
| CLI-16 | Insert misc expense, value-date default               | A day becomes UTC midnight: 20:00 the day before in New York, 03:00 in Israel. Feeds SRV-2.                         | P2       |
| CLI-17 | Uniform format modal, "future date" check             | Rejects today after local midnight east of UTC, accepts tomorrow in the evening west of UTC.                        | P3       |
| CLI-18 | Dynamic report, default "to" date                     | The **UTC** today: yesterday in Israel until 02:00/03:00, tomorrow in New York after 19:00/20:00.                   | P2       |
| CLI-19 | Issue document, payment date default                  | Same as CLI-18.                                                                                                     | P2       |
| CLI-20 | `DateTimePickerInput` (misc expense, balance charge)  | Reads the browser's wall clock and shows no zone. With SRV-2, the ledger day depends on the browser and the server. | P1       |
| CLI-21 | "Today", "this month", "this year" defaults (over 25) | Follow the browser clock, not the tenant's. Differ near midnight and at year end.                                   | P3       |
| CLI-22 | Displayed instants                                    | No zone shown, mixed formats (`toLocaleString`, `en-US`, `dd/MM/yyyy`). Invitation expiry shows only a date.        | P3       |
| CLI-23 | Codegen types `DateTime` as `Date`                    | At runtime it is an ISO string. Nothing checks this.                                                                | P3       |
| CLI-24 | Calendar "today" highlight                            | Follows the browser clock.                                                                                          | P3       |
| CLI-25 | "Today" constants computed at module load             | Go stale in a tab left open past midnight.                                                                          | P3       |

### Other packages

| Case  | Where                                                        | What can go wrong now                                                                                                                                                             | Marks | Priority            |
| ----- | ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- | ------------------- |
| GI-5  | green-invoice-graphql search `fromDate` / `toDate` (Mesh v1) | The `Date` scalar's `parseValue` turns `2026-09-27` into a `Date`, which the REST body serializes as `2026-09-27T00:00:00.000Z`. The day is kept; the format may not be accepted. | 🔍    | P3 (no caller)      |
| OUT-1 | Green Invoice issuing `date`, `dueDate`, `payment[].date`    | Typed `String` and forwarded unvalidated.                                                                                                                                         | ⚠️    | P3                  |
| OUT-2 | Bank scrape windows                                          | Built in the scraper machine's zone (#4629's WIN-1 to WIN-9).                                                                                                                     | ⚠️    | P2 (per #4629)      |
| XP-1  | scraper-app → server                                         | Codegen maps no date scalars. Days are sent as `String`. Max installments (MAX-2) and Otsar Excel serials (OTS-2) are built in process-local time.                                | ⚠️    | P1 / P2 (per #4629) |
| XP-2  | modern-poalim-scraper → scraper-app                          | Range options are `Date`s (WIN-\*).                                                                                                                                               | ⚠️    | P2                  |
| XP-3  | email-ingestion-gateway → server                             | `receivedAt` is not validated. Codegen maps no date scalars; everything is `String`.                                                                                              | ⚠️    | P3                  |
| XP-4  | mcp-server ↔ server                                          | Arguments are strict and reads are passed through, fine after #4592. `ChargeMetadata.createdAt` inherits SRV-1.                                                                   | ✅    | —                   |
| XP-5  | server → generator packages                                  | Date inputs are `z.string()` in the uniform format. Header clocks: SRV-12, SRV-13.                                                                                                | ⚠️    | P3                  |
| XP-6  | Kraken, Etherscan and Etana scrapers → DB                    | pg-promise connections set no session zone (#4629's KRK-1, ETH-1, ETA-1).                                                                                                         | ⚠️    | P2                  |
| XP-7  | `InsertedTransactionSummary.date`                            | `String` with mixed shapes: `dd/mm/yyyy`, raw bank strings, `yyyy-mm-dd`.                                                                                                         | 🐞    | P3                  |

New intake cases not in #4629 (VAT-1, PAY-1, ISR-1a, ANT-2, EML-2, DEEL-7, AUTH-1, DRV-1, CLD-1) are
in [4.1](#41-intake-cross-check-with-4629).

## 1. The clocks

Six clocks can decide what a datetime means. Nothing in the repository pins any of them:

| Clock          | Where it is used                                                                                                                                           | Configured?                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Server process | node-pg reads `timestamp` values and sends `Date` parameters in it; date-fns local functions; `format(…)`                                                  | **No.** The only `TZ` assignments are in tests. Searched: `TZ`, `PGTZ`, `SET TIME ZONE`, pool `options`, `pg.defaults`, docker files, `.github/workflows`, `vitest.config.ts`. Staging runs on Render (`packages/server/docs/demo-staging-guide.md:646`) with the platform default.                                                                                                                                                                             |
| DB session     | `now()` / `CURRENT_TIMESTAMP` written into `timestamp` columns, `timestamptz::date`, offset-less strings cast to `timestamptz` (R5, R6)                    | **No.** The server pool sets only `types` (`packages/server/src/index.ts:33-61`). Other pools set nothing: `packages/server/src/scripts/run-invitation-cleanup.ts:34-43`, `packages/server/src/__tests__/helpers/db-connection.ts:21-30`, `packages/server/scripts/seed-super-admin.ts:20-27`, `packages/server/src/demo-fixtures/validate-demo-data.ts:41-48`, and the pg-promise connections in the crypto scrapers. The docker and CI images default to UTC. |
| Tenant         | `instantToTimelessDate`, `todayTimelessDate`, `timelessDateToTenantInstant`, `currentTenantYear` (`packages/server/src/shared/helpers/tenant-timezone.ts`) | **Yes**, a constant: `TENANT_TIMEZONE = 'Asia/Jerusalem'` (`packages/server/src/shared/constants.ts:9`). Its comment says it will come from `user_context` per tenant later. **The client has no equivalent:** no timezone constant, no `Intl.DateTimeFormat` with a `timeZone`, and no timezone field on `UserContext` (`packages/client/src/providers/user-provider.tsx:10-25`, `packages/server/src/modules/common/typeDefs/user-context.graphql.ts:16-29`). |
| UTC            | `toISOString()`, `getUTC*`, `Date.UTC` day arithmetic                                                                                                      | Fixed.                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Browser        | Every client `new Date()`, date-fns call and `toLocale*` call                                                                                              | The user's machine.                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Scraper        | scraper-app, modern-poalim-scraper and its Chromium                                                                                                        | The user's machine (#4629's R12).                                                                                                                                                                                                                                                                                                                                                                                                                               |

The process and DB clocks only stop mattering once every instant is stored as `timestamptz` and
every day is derived with an explicit zone (T1, T4). Until then, the production values are the open
question M-11 in #4629 (D-1 below).

## 2. Server

### 2.1 Transport: the scalars

**`DateTime`** is `graphql-scalars`' `DateTimeResolver`. It is version 2.0.0
(`packages/server/package.json:71`), registered at `modules/common/resolvers/common.resolver.ts:8`
and declared at `modules/common/typeDefs/common.graphql.ts:25`. Server codegen maps it to `Date` for
input and output (`codegen.ts:58-61`). It behaves like this (probed, see the
[appendix](#appendix-probes)):

- **Output:** `serialize(Date)` returns the `Date` itself. Over HTTP, JSON turns it into
  `toISOString()`, always UTC with `Z`. In-process consumers of an execution result (tests, anything
  reading `result.data` before JSON) get a `Date`.
- **Input:** only RFC 3339 strings with an offset or `Z`. `2026-05-01T10:00:00` (no offset) and
  `2026-05-01` (a day) are rejected. The instant is exact.

So `DateTime` itself already meets T2. Every problem with `DateTime` values comes from what is
behind it: the `timestamp` columns ([2.2](#22-where-instants-come-from)).

**`TimelessDate`** (`modules/common/resolvers/timeless-date.ts:13-44`) validates `yyyy-mm-dd`. But
`serialize` and `parseValue` still accept a JS `Date` and turn it into a day with
`dateToTimelessDateString`, which uses process-local getters (`:21-23`, `:31-33`). Since #4592
nothing should pass a `Date` there. If something does, an instant silently becomes the **server's**
day, not the tenant's (SRV-7).

**Instants or days sent through other scalars:**

| Field                                                                                                     | Where                                                                                                                                                                                                               | Sent as                                        |
| --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| `EmailIngestionAlias.createdAt` / `updatedAt: String!`                                                    | `modules/email-ingestion/resolvers/email-ingestion-alias.resolver.ts:14-15`                                                                                                                                         | `toISOString()` of a `timestamptz`             |
| `IngestGrant.expiresAt: String!`                                                                          | `modules/email-ingestion/resolvers/email-ingestion-control.resolver.ts:70`                                                                                                                                          | `toISOString()` of a JS-clock instant (`:48`)  |
| `IngestEmailInput.receivedAt`, `IngestControlInput.receivedAt: String`                                    | `modules/email-ingestion/typeDefs/email-ingestion.graphql.ts:61,182`                                                                                                                                                | Whatever the gateway forwards from a header    |
| `ProviderCredentialStatus` / `ProviderCredentialResult.configuredAt: DateTime!`                           | `modules/provider-credentials/providers/provider-credentials.provider.ts:90` sends `toISOString()`, then `new Date(…)` again in `modules/provider-credentials/resolvers/provider-credentials.resolvers.ts:26,47,71` | `DateTime`, after a needless round trip        |
| `DynamicReportLeafApproval.setAt: DateTime!`                                                              | Stored as an ISO string in jsonb (`modules/reports/resolvers/dynamic-report.resolver.ts:108`), read back with `new Date(…)` (`:331`)                                                                                | `DateTime`                                     |
| `DocumentPaymentRecord(Input).firstPayment: Float`                                                        | `modules/documents/helpers/issue-document.helper.ts:96-97`                                                                                                                                                          | Unix seconds of the tenant's midnight (SRV-16) |
| `DocumentDraft.date` / `dueDate`, `DocumentPaymentRecord.date`, `InsertedTransactionSummary.date: String` | [2.4](#24-graphql-schema)                                                                                                                                                                                           | Days                                           |

### 2.2 Where instants come from

#### `timestamptz` columns: the instant is certain ✅

- **Documents:** `documents.created_at` / `updated_at`.
- **Auth:**
  - `business_users`, `roles`, `permissions`;
  - `invitations.accepted_at` / `expires_at` / `created_at`;
  - `api_keys.last_used_at` / `revoked_at` / `created_at`;
  - `audit_logs.created_at`.
- **Workflows and settings:** `annual_audit_step_status.*_at`, `provider_credentials.*_at`.
- **Email ingestion:** `email_ingestion_*` (alias routing, grants, nonces, quarantine, idempotency).
- **Dynamic reports:** `dynamic_report_template_snapshots.created_at`, and `dynamic_report_threads`
  / `dynamic_report_comments` `*_at` (default `clock_timestamp()`).
- **Securities:** `businesses_securities`, `poalim_securities.as_of_date` (a bank quote time with an
  offset).
- **Deel:** `deel_invoices.*`, `deel_workers.contract_start_date`. These are days in meaning
  (#4629's DEEL-4).
- **Otsar Hahayal:** `otsar_hahayal_ils_account_transactions.date_of_business_day` /
  `date_of_registration`. The column type is an instant, but the values are calendar days sent
  without an offset, so Postgres reads them in the DB zone (SRV-15, OTS-1).

The full column list is in the inventory.

#### `timestamp` without time zone: the instant is uncertain ⚠️

A `timestamp` is a wall-clock time. Each column below is written in some zone and read back by
node-pg in the **process** zone (#4629's R7). It is the right instant only when the two zones match.
Probe: the stored `2026-05-01 22:30:00` reads as `22:30Z` under `TZ=UTC`, `19:30Z` under
`Asia/Jerusalem` and `02:30Z` the next day under `America/New_York`.

| Column                                                                                              | Migration                                          | Written in                                                                                                                                                                                                                                                                                                                     | Read by                                                                                                                                                                                                                            |
| --------------------------------------------------------------------------------------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `charges.created_at` / `updated_at`                                                                 | `2024-01-29T13-15-23.initial.ts:877-878`           | **DB**: default `CURRENT_TIMESTAMP`, and the `update_general_updated_at()` trigger sets `now()` (`2024-01-29T13-15-23.initial.ts:1542-1550`)                                                                                                                                                                                   | `ChargeMetadata.createdAt` / `updatedAt` (`modules/charges/resolvers/charges.resolver.ts:647-648`); `modules/cron-jobs/helpers/merge-charges-by-reference.helper.ts:569` orders by it                                              |
| `transactions.created_at` / `updated_at`                                                            | `2024-01-29T13-15-23.initial.ts:1001-1002`         | **DB**                                                                                                                                                                                                                                                                                                                         | `Transaction.createdAt` / `updatedAt` (`modules/transactions/resolvers/common.ts:66-75`)                                                                                                                                           |
| `financial_entities.created_at` / `updated_at`                                                      | `2024-01-29T13-15-23.initial.ts:843-844`           | **DB**                                                                                                                                                                                                                                                                                                                         | `Business`, `FinancialEntity`, `TaxCategory` `createdAt` / `updatedAt` (`modules/financial-entities/resolvers/common.ts:26-27`, `modules/financial-entities/resolvers/tax-categories.resolver.ts:141-142`)                         |
| `ledger_records.created_at` / `updated_at`                                                          | `2024-01-29T13-15-23.initial.ts:1230-1231`         | **DB** (the insert at `modules/ledger/providers/ledger.provider.ts:189-233` leaves them to the default)                                                                                                                                                                                                                        | SHAAM `entryDate` (`modules/reports/helpers/uniform-format.helper.ts:96`, SRV-11)                                                                                                                                                  |
| `dynamic_report_templates.created_at` / `updated_at`                                                | `2025-02-12T11-50-44…`                             | **DB**                                                                                                                                                                                                                                                                                                                         | `DynamicReportInfo.created` / `updated` (`modules/reports/resolvers/dynamic-report.resolver.ts:349-350`)                                                                                                                           |
| `transactions.debit_timestamp`                                                                      | `2025-04-08T09-16-45…`                             | DB triggers only. **Max:** `payment_date + deal_data_purchase_time`, the bank's Israeli wall clock (`2026-02-19T17-00-00…:484-485`). **Kraken / Etherscan:** `to_timestamp(epoch)` in the **DB** zone (`packages/kraken-scraper/src/store.ts:238`, `packages/etherscan-scraper/src/store.ts:204`). Bank and card rows: `NULL`. | `Transaction.exactEffectiveDate` (`modules/transactions/resolvers/common.ts:39-43`); the effective day, ledger value day and crypto rate instant ([2.3](#23-switches-between-days-and-instants))                                   |
| `misc_expenses.value_date`                                                                          | `2024-10-01T12-37-42.refactor-misc-expenses.ts:24` | **Process**: a `DateTime` input `Date` sent by node-pg as process-local time with an offset, which the column drops (`modules/misc-expenses/providers/misc-expenses.provider.ts:70-72,87-94`)                                                                                                                                  | `MiscExpense.valueDate` (`modules/misc-expenses/resolvers/misc-expenses.resolver.ts:173`); the ledger (`modules/ledger/helpers/misc-expenses-ledger.helper.ts:58-59`)                                                              |
| `crypto_exchange_rates.date` / `sample_date`                                                        | `2024-01-29T13-15-23.initial.ts:778,784`           | **Process** (`modules/exchange-rates/providers/crypto-exchange.provider.ts:25-31,137-143`)                                                                                                                                                                                                                                     | Exact-equality lookups (`modules/exchange-rates/providers/crypto-exchange.provider.ts:19-23`); `modules/reports/providers/balance-report.provider.ts:44-49`; `modules/reports/providers/annual-revenue-report.provider.ts:182-195` |
| `kraken_trades.value_date`, `kraken_ledger_records.value_date`, `etherscan_transactions.event_date` | `2024-01-29T13-15-23.initial.ts:738,758,596`       | **DB** (`to_timestamp`, from the scraper packages)                                                                                                                                                                                                                                                                             | Only through `transactions.debit_timestamp`                                                                                                                                                                                        |

#### Clocks inside SQL

- **✅ Safe:** every `now()`, `NOW()` and `clock_timestamp()` written into or compared with a
  `timestamptz`. Examples:
  - `modules/annual-audit/providers/annual-audit.provider.ts:37`
  - `modules/auth/providers/accept-invitations.provider.ts:24,33,57`
  - `modules/auth/providers/api-keys.provider.ts:42`
  - `modules/auth/providers/auth-context.provider.ts:332-334,548`
  - `modules/auth/providers/invitations.provider.ts:44`
  - `modules/documents/providers/documents.provider.ts:115,339`
  - `modules/email-ingestion/providers/email-ingestion-control.provider.ts:119`
  - `modules/provider-credentials/providers/provider-credentials.provider.ts:31`
  - `modules/reports/providers/dynamic-report-comments.provider.ts:60,69,80`
  - `jobs/cleanup-expired-invitations.ts:30`

  Also safe: date arithmetic on `date` columns (`date ± interval`, `make_date`, `::DATE`,
  `to_date`).

- **⚠️ DB zone:**
  - the `CURRENT_TIMESTAMP` defaults and the `update_general_updated_at()` trigger behind SRV-1;
  - `CURRENT_DATE` in the demo seed (`demo-fixtures/helpers/seed-exchange-rates.ts:25`);
  - in the database itself, the Otsar trigger's `date_of_registration::DATE` (OTS-1) and the crypto
    triggers' `value_date::text::date` (`packages/kraken-scraper/src/store.ts:97-98`,
    `packages/etherscan-scraper/src/store.ts:71-72`).
- **⚠️ Comparisons across writer zones (SRV-6):**
  - `cer.date <= t.debit_timestamp` (`modules/reports/providers/balance-report.provider.ts:46`):
    process vs DB or Israeli wall clock;
  - `cer.date <= nlr.date` (`modules/reports/providers/annual-revenue-report.provider.ts:188`):
    process wall clock vs a day.

#### Clocks in JavaScript

All ✅:

- **Invitation cleanup:** scheduled at 02:00 UTC with `setUTCHours` (`jobs/utils.ts:1-11,47-55`,
  `packages/server/src/index.ts:119-139`).
- **Invitation and email grant expiry:** `Date.now() + …`, stored as `timestamptz`
  (`modules/auth/providers/invitations.provider.ts:173`,
  `modules/email-ingestion/resolvers/email-ingestion-control.resolver.ts:48`).
- **Cache TTLs and watchdogs:** `Date.now()`.
- **Green Invoice draft detection:** compares epoch values
  (`modules/app-providers/green-invoice-client.ts:107,137`).
- **Approval `setAt`:** `new Date().toISOString()`.
- **"Today" and "this year":** go through the tenant helpers
  ([2.3](#23-switches-between-days-and-instants)).

The in-memory ledger records get made-up `created_at` / `updated_at` values from `new Date()`
(`modules/ledger/helpers/utils.helper.ts:349,368`). That is harmless for timezones, but they are not
real audit times.

#### Inputs

- **`DateTime` inputs:** only two, `InsertMiscExpenseInput.valueDate` and
  `UpdateMiscExpenseInput.valueDate`
  (`modules/misc-expenses/typeDefs/misc-expenses.graphql.ts:44,55`). They reach `insertMiscExpense`,
  `insertMiscExpenses`, `updateMiscExpense` and `generateBalanceCharge(balanceRecords:)`
  (`modules/charges/typeDefs/financial-charges.graphql.ts:28-31`).
- **No `DateTime` arguments** anywhere.
- **`String` inputs that carry time:**
  - `IngestEmailInput.receivedAt` (SRV-9);
  - `PoalimSecurityInput.asOfDate`, which has an offset and goes into `timestamptz`, ✅ when the
    offset is present (#4629's POA-4);
  - `OtsarHahayalIlsTransactionInput.dateOfBusinessDay` / `dateOfRegistration` (SRV-15);
  - `MaxTransactionInput.dealDataPurchaseTime`, an Israeli `HH:MM` that ends up in `debit_timestamp`
    (SRV-4).

### 2.3 Switches between days and instants

Every place in `packages/server/src` (outside tests) where a day becomes an instant or the reverse.
Searches that found **nothing** outside tests: the date-fns local functions (`startOf*`, `endOf*`,
`add*`, `sub*`, `differenceIn*`, `isBefore` / `isAfter`), local getters (`getFullYear`, `getMonth`,
`getDate`), `.split('T')[0]`, `substring(0, 10)` and `toISOString().slice(0, 10)`. #4592 replaced
them all.

**Classification:**

- **✅ Safe:** cannot depend on a zone.
- **✅ Tenant:** an instant becomes a day, or "today", through the tenant helpers. Done by #4592.
- **⚠️ Needs tenant:** should use the tenant zone and does not.
- **⚠️ Uncertain:** depends on the process or DB zone, or on an unproven source zone.

| Where                                                                                                                                                                             | Expression                                                                                                                      | Direction                                 | Zone used               | Class                          | Note                                                                                                                                                       |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- | ----------------------- | ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `shared/helpers/misc.ts:220-222` (`dateToTimelessDateString`), `:236-241` (`optional…`)                                                                                           | `format(date, 'yyyy-MM-dd')`                                                                                                    | instant → day                             | process                 | ✅ for `timestamp` values only | Since #4592 every caller passes a `timestamp` value, whose stored day it returns in any zone. The name invites misuse on real instants (SRV-7).            |
| `shared/helpers/misc.ts:231-234` (`timelessDateStringToLocalDate`)                                                                                                                | `new Date(y, m - 1, d)`                                                                                                         | day → local `Date`                        | process (round trip)    | ✅                             | Only used to `format` contract labels (`modules/contracts/helpers/contracts.helper.ts:87-88,96`).                                                          |
| `modules/common/resolvers/timeless-date.ts:21-23,31-33`                                                                                                                           | `dateToTimelessDateString(value)`                                                                                               | instant → day                             | process                 | ⚠️ Uncertain                   | SRV-7, latent.                                                                                                                                             |
| `modules/transactions/helpers/effective-date.helper.ts:12-13`; `modules/transactions/helpers/common.helper.ts:49-51`                                                              | `dateToTimelessDateString(debit_timestamp)`                                                                                     | `timestamp` → day                         | stored day              | ✅ by design; ⚠️ source        | Crypto rows get the **DB zone's** day (UTC in practice); Max rows the Israeli day. With T4 both should be the tenant day (SRV-4).                          |
| `modules/charges/helpers/common.helper.ts:318-324`; `modules/charges-matcher/providers/transaction-aggregator.ts:106-110`; `modules/charts/resolvers/charts.resolver.ts:37,45-47` | Same, on `debit_timestamp` or `COALESCE(debit_timestamp, debit_date)` (`modules/charges/providers/charges.provider.ts:346-347`) | `timestamp` → day                         | stored day              | ✅ / ⚠️ source                 | As above.                                                                                                                                                  |
| `modules/ledger/helpers/utils.helper.ts:58-61,129-134`                                                                                                                            | `valueDate = dateToTimelessDateString(debit_timestamp)`; `exchangeRateDate = debit_timestamp`                                   | `timestamp` → day, and used as an instant | stored day / process    | Day ✅; instant ⚠️ Uncertain   | The rate instant is right only when the process zone equals the writer's zone.                                                                             |
| `modules/ledger/helpers/utils.helper.ts:89-94`                                                                                                                                    | `timelessDateToTenantInstant(date).toISOString()`                                                                               | day → instant (key)                       | tenant                  | ✅ Tenant                      | Key for crypto rows.                                                                                                                                       |
| `modules/ledger/helpers/misc-expenses-ledger.helper.ts:58-59`                                                                                                                     | `dateToTimelessDateString(expense.value_date)`; `exchangeRateDate: value_date`                                                  | `timestamp` → day, and used as an instant | stored day              | ⚠️ Uncertain                   | **SRV-2.** The stored day is the process zone's day of the client's instant.                                                                               |
| `modules/exchange-rates/providers/exchange.provider.ts:46-47`                                                                                                                     | `day = dateToTimelessDateString(date)`; `instant = timelessDateToTenantInstant(date)`                                           | both                                      | stored day / tenant     | ✅ / ⚠️                        | The tenant instant is then **written into a `timestamp`** in the process zone (SRV-5).                                                                     |
| `modules/exchange-rates/providers/crypto-exchange.provider.ts:100-102`                                                                                                            | `subHours(date, 23)`, `getTime() / 1000`                                                                                        | instant arithmetic                        | —                       | ✅ arithmetic; ⚠️ input        | `date` can be a `debit_timestamp` read in the process zone.                                                                                                |
| `modules/exchange-rates/resolvers/common.ts:56-65`; `modules/exchange-rates/resolvers/exchange.resolver.ts:112-120`                                                               | `debit_timestamp` used as a rate instant                                                                                        | `timestamp` as instant                    | process                 | ⚠️ Uncertain                   | SRV-4.                                                                                                                                                     |
| `modules/charges/resolvers/financial-charges.resolver.ts:305-308` vs `:331`                                                                                                       | `instantToTimelessDate(record.valueDate)` for the lock check; `valueDate` stored as is                                          | instant → day                             | tenant vs process       | ⚠️ Uncertain                   | **SRV-3.** Two zones for one value.                                                                                                                        |
| `modules/reports/helpers/uniform-format.helper.ts:96`                                                                                                                             | `dateToTimelessDateString(record.created_at)`                                                                                   | `timestamp` → day                         | stored day = **DB** day | ⚠️ Needs tenant                | **SRV-11.**                                                                                                                                                |
| `modules/scraper-ingestion/providers/otsar-hahayal-scraper-ingestion.provider.ts:435-436,487`                                                                                     | `instantToTimelessDate(row.date_of_*)`                                                                                          | instant → day                             | tenant                  | ⚠️ Uncertain                   | The stored instant is midnight in the **DB** zone; right only while the DB zone is not east of Jerusalem (SRV-15). Compare `toCalendarDate` at `:499-500`. |
| `modules/scraper-ingestion/providers/poalim-scraper-ingestion.provider.ts:1527`                                                                                                   | `instantToTimelessDate(r.as_of_date)`                                                                                           | instant → day                             | tenant                  | ✅ Tenant                      | A real instant with an offset.                                                                                                                             |
| `modules/scraper-ingestion/helpers/utils.helper.ts:27-30` (`toCalendarDate`)                                                                                                      | `value.slice(0, 10)`                                                                                                            | bank string → day                         | none                    | ✅                             | The bank's own date digits.                                                                                                                                |
| `modules/deel/helpers/deel.helper.ts:67-74,205`                                                                                                                                   | `timelessDateToUtcDate(document.date)` ± 1 day; `utcDateToTimelessDate(issued_at)`                                              | both                                      | UTC                     | ⚠️ Uncertain                   | Consistent on both sides (#4629's DEEL-6), but the day is the UTC day of the +7h-shifted `issued_at` (SRV-14).                                             |
| `modules/app-providers/deel/deel-client.provider.ts:31-35`                                                                                                                        | `addHours(new Date(s), 7).toUTCString()`                                                                                        | instant → instant                         | assumes UTC−7 all year  | ⚠️ 🔍                          | PST is UTC−8 and PDT UTC−7; the comment says "PST dates as UTC" (M-8).                                                                                     |
| `modules/email-ingestion/providers/email-ingestion-ingest.provider.ts:198-209`                                                                                                    | `toLocaleDateString('en-US', { timeZone: 'UTC' })`                                                                              | instant → day text                        | UTC                     | ⚠️ Needs tenant                | **SRV-10.** Has a TODO at `:207`.                                                                                                                          |
| `modules/documents/helpers/issue-document.helper.ts:96-97`                                                                                                                        | `timelessDateToTenantInstant(event_date).getTime() / 1000`                                                                      | day → instant                             | tenant                  | ✅ zone; 🐞                    | **SRV-16:** the field is an amount.                                                                                                                        |
| `modules/documents/resolvers/documents.resolver.ts:44-47`                                                                                                                         | `timelessDateToTenantInstant(date)` vs `created_at`                                                                             | day → instant                             | tenant                  | ✅ Tenant                      | Sort key.                                                                                                                                                  |
| `modules/salaries/helpers/salary-month.helper.ts:16`                                                                                                                              | `format(new Date(month), 'yyyy-MM')`                                                                                            | string → month                            | process                 | ⚠️ Uncertain                   | **SRV-19.** Fallback only; `yyyy-mm…` input is sliced at `:13-14`.                                                                                         |
| "Today" and "this year" call sites (list below)                                                                                                                                   | `todayTimelessDate()`, `currentTenantYear()`                                                                                    | now → day / year                          | tenant                  | ✅ Tenant                      | Done by #4592.                                                                                                                                             |
| `jobs/utils.ts:2-10`                                                                                                                                                              | `setUTCHours` / `setUTCDate`                                                                                                    | instant                                   | UTC                     | ✅                             | Scheduling only.                                                                                                                                           |
| `modules/cron-jobs/helpers/merge-charges-by-reference.helper.ts:569`                                                                                                              | `created_at.getTime()` ordering                                                                                                 | `timestamp` ordering                      | process                 | ✅ mostly                      | Can tie or invert across a DST fall-back hour (SRV-1).                                                                                                     |

The "today" and "this year" call sites #4592 aligned to the tenant:

- **Today:**
  - `modules/contracts/helpers/contracts.helper.ts:93`
  - `modules/charges/resolvers/charge-suggestions/charge-suggestions.resolver.ts:36-38`
  - `modules/charges-matcher/providers/charges-matcher.provider.ts:361`
  - `modules/app-providers/deel/deel-client.provider.ts:63-64,142`
  - `modules/app-providers/green-invoice-client.ts:127-128`
  - `modules/documents/helpers/issue-document.helper.ts:257`
  - `modules/documents/resolvers/documents-issuing.resolver.ts:198,353`
  - `modules/financial-entities/resolvers/business-transactions-sum-from-ledger-records.resolver.ts:111`
  - `modules/ledger/resolvers/ledger-generation/monthly-vat-ledger-generation.resolver.ts:82`
- **This year:**
  - `modules/ledger/helpers/recovery-reserve.helper.ts:195`
  - the financial ledger generation resolvers
  - `modules/reports/resolvers/depreciation-report.resolver.ts:46`
  - the corporate tax, P&L and tax reports

### 2.4 GraphQL schema

#### The 44 `DateTime` declarations

These are the 42 output fields (counting interface fields) and 2 input fields in
`packages/server/src/modules/*/typeDefs`. **26 of them are backed by `timestamp` without time
zone**, so the ISO string they produce depends on the process and DB clocks.

| Fields                                                                                                                                                                                                                                                              | Backing column                                                         | Verdict                                                                                                                                                                                                                                                                                |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AnnualAuditStepStatusInfo.updatedAt` / `completedAt` (`modules/annual-audit/typeDefs/annual-audit.graphql.ts:65-66`)                                                                                                                                               | `timestamptz`                                                          | ✅ keep                                                                                                                                                                                                                                                                                |
| `InvitationPayload.expiresAt`, `Invitation.expiresAt`, `ApiKey.lastUsedAt` / `createdAt`, `BusinessUser.createdAt` (`modules/auth/typeDefs/auth.graphql.ts:45,54,75-76,85`)                                                                                         | `timestamptz`                                                          | ✅ keep                                                                                                                                                                                                                                                                                |
| `ProviderCredentialStatus` / `ProviderCredentialResult.configuredAt` (`modules/provider-credentials/typeDefs/provider-credentials.graphql.ts:18,27`)                                                                                                                | `timestamptz`                                                          | ✅ keep; drop the ISO round trip                                                                                                                                                                                                                                                       |
| `DynamicReportThread.createdAt` / `resolvedAt`, `DynamicReportComment.createdAt` / `editedAt` / `deletedAt` (`modules/reports/typeDefs/dynamic-report-comments.graphql.ts:42-43,55-57`)                                                                             | `timestamptz`                                                          | ✅ keep                                                                                                                                                                                                                                                                                |
| `DynamicReportSnapshotMeta.createdAt`, `DynamicReportSnapshot.createdAt` (`modules/reports/typeDefs/dynamic-report.graphql.ts:71,82`)                                                                                                                               | `timestamptz`                                                          | ✅ keep                                                                                                                                                                                                                                                                                |
| `DynamicReportLeafApproval.setAt` (`modules/reports/typeDefs/dynamic-report.graphql.ts:99`)                                                                                                                                                                         | ISO string with `Z` in jsonb                                           | ✅ keep                                                                                                                                                                                                                                                                                |
| `Security.asOfDate` (`modules/foreign-securities/typeDefs/foreign-securities.graphql.ts:109`)                                                                                                                                                                       | `timestamptz` (a bank quote time with an offset)                       | ✅ keep                                                                                                                                                                                                                                                                                |
| `ChargeMetadata.createdAt` / `updatedAt` (`modules/charges/typeDefs/charges.graphql.ts:431,433`)                                                                                                                                                                    | `charges` `timestamp`, DB zone                                         | ⚠️ SRV-1: keep `DateTime`, migrate the column (W2)                                                                                                                                                                                                                                     |
| `Business`, `LtdFinancialEntity`, `PersonalFinancialEntity`, `FinancialEntity` `createdAt` / `updatedAt` (`modules/financial-entities/typeDefs/businesses.graphql.ts:25-26,60-61,97-98`; `modules/financial-entities/typeDefs/financial-entities.graphql.ts:22-23`) | `financial_entities` `timestamp`, DB zone                              | ⚠️ SRV-1: same                                                                                                                                                                                                                                                                         |
| `TaxCategory.createdAt` / `updatedAt` (`modules/financial-entities/typeDefs/tax-categories.graphql.ts:68-69`)                                                                                                                                                       | `financial_entities` `timestamp`, DB zone                              | ⚠️ SRV-1: same                                                                                                                                                                                                                                                                         |
| `DynamicReportInfo.created` / `updated` (`modules/reports/typeDefs/dynamic-report.graphql.ts:57-58`)                                                                                                                                                                | `dynamic_report_templates` `timestamp`, DB zone                        | ⚠️ SRV-1: same                                                                                                                                                                                                                                                                         |
| `Transaction`, `CommonTransaction`, `ConversionTransaction` `createdAt` / `updatedAt` (`modules/transactions/typeDefs/transactions.graphql.ts:127,129,156-157,180-181`)                                                                                             | `transactions` `timestamp`, DB zone                                    | ⚠️ SRV-1: same                                                                                                                                                                                                                                                                         |
| `Transaction`, `CommonTransaction`, `ConversionTransaction` `exactEffectiveDate` (`modules/transactions/typeDefs/transactions.graphql.ts:117,151,170`)                                                                                                              | `transactions.debit_timestamp` `timestamp`, zone depends on the source | ⚠️ SRV-4: keep `DateTime`; migrate the column, converting **per source** (W2). Today a Max purchase at 14:30 Israel time is sent as `14:30Z` from a UTC server.                                                                                                                        |
| `MiscExpense.valueDate`, `UpdateMiscExpenseInput.valueDate`, `InsertMiscExpenseInput.valueDate` (`modules/misc-expenses/typeDefs/misc-expenses.graphql.ts:32,44,55`)                                                                                                | `misc_expenses.value_date` `timestamp`, process zone                   | ⚠️ SRV-2: **needs a decision (D-2).** It is used both as a day (the ledger value date) and as an instant (the exchange rate). Either a `TimelessDate` value day plus an optional `DateTime`, or a true instant stored as `timestamptz` whose day is always derived in the tenant zone. |

#### Fields typed `String`, `Int` or `Float` that carry a date or an instant

The switch list. "Breaking" means the Hive schema check reports it. The consumers in the repo are
listed so the change can be made in one PR.

| ID     | Field                                                                                                                                                                                                                                                                                       | Today                                             | Switch to                                                                                                                                                        | Breaking? / consumers                                                                                                                                          |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GQL-1  | `DocumentDraft.date` / `dueDate`, `DocumentIssueInput.date` / `dueDate`, `DocumentPaymentRecord.date`, `DocumentPaymentRecordInput.date` (`modules/documents/typeDefs/documents-issuing.graphql.ts:54-55,87,165-166,225`)                                                                   | `String`, days, not validated                     | `TimelessDate`                                                                                                                                                   | Input side: yes. Client issuing form and preview modal; the server's Green Invoice mapping.                                                                    |
| GQL-2  | `InsertedTransactionSummary.date` (`modules/scraper-ingestion/typeDefs/scraper-ingestion.graphql.ts:7`)                                                                                                                                                                                     | `String` with mixed shapes (XP-7)                 | `TimelessDate`                                                                                                                                                   | Output only. scraper-app UI (`packages/scraper-app/src/ui/components/task-row.tsx:382`).                                                                       |
| GQL-3  | `YearOfRelevance.year` (`modules/charges/typeDefs/charges.graphql.ts:526`)                                                                                                                                                                                                                  | `String`; its input twin is `TimelessDate`        | `TimelessDate` (or `Int` year)                                                                                                                                   | Output only. Client charge spread input (CLI-10).                                                                                                              |
| GQL-4  | `EmailIngestionAlias.createdAt` / `updatedAt`, `IngestGrant.expiresAt` (`modules/email-ingestion/typeDefs/email-ingestion.graphql.ts:122,218-219`)                                                                                                                                          | `String!` ISO                                     | `DateTime!`                                                                                                                                                      | Wire format unchanged (ISO with `Z`). email-ingestion-gateway reads `expiresAt` as a string (`packages/email-ingestion-gateway/src/server-client.ts:143,409`). |
| GQL-5  | `IngestEmailInput.receivedAt`, `IngestControlInput.receivedAt` (`modules/email-ingestion/typeDefs/email-ingestion.graphql.ts:61,182`)                                                                                                                                                       | `String`, raw header                              | `DateTime`, **only after** the gateway normalizes to RFC 3339, since `DateTime` rejects RFC 2822 and offset-less strings                                         | Yes. The gateway (XP-3).                                                                                                                                       |
| GQL-6  | `MiscExpense.valueDate` and its inputs                                                                                                                                                                                                                                                      | `DateTime` on a `timestamp`                       | Per D-2                                                                                                                                                          | Yes. Client misc-expense forms, balance charge modal, ledger.                                                                                                  |
| GQL-7  | `DocumentPaymentRecord(Input).firstPayment` (`modules/documents/typeDefs/documents-issuing.graphql.ts:102,237`)                                                                                                                                                                             | `Float`, a unix time today                        | Keep `Float`, but as the amount it is (SRV-16)                                                                                                                   | No.                                                                                                                                                            |
| GQL-8  | Day strings in the scraper ingestion inputs: Poalim ILS `eventDate` / `valueDate`, Poalim foreign `executingDate` / `validityDate` / `valueDate`, Otsar foreign and credit card dates (`modules/scraper-ingestion/typeDefs/scraper-ingestion.graphql.ts:65,87,117,139-140,649,655,672,674`) | `String`, already `yyyy-mm-dd`                    | `TimelessDate`                                                                                                                                                   | Yes. scraper-app only. Leave the raw bank strings (Isracard, Cal, Discount, Max, SWIFT) as `String`; #4629 covers how they are parsed.                         |
| GQL-9  | `OtsarHahayalIlsTransactionInput.dateOfBusinessDay` / `dateOfRegistration` (`:620-621`)                                                                                                                                                                                                     | `String` `yyyy-mm-ddT00:00:00` into `timestamptz` | Store as `date` (as was done for Poalim securities in `2026-08-14T10-00-00.poalim-securities-transactions-calendar-dates.ts`); the input can stay a raw `String` | No (input stays). DB migration.                                                                                                                                |
| GQL-10 | `Salary.month`, `SalaryRecordInput.month`, `SalaryRecordEditInput.month` (`modules/salaries/typeDefs/salaries.graphql.ts:48,87,133`)                                                                                                                                                        | `String` `yyyy-MM`                                | Optional: a year-month scalar                                                                                                                                    | Yes. Low value; fixing SRV-19 and CLI-6 to CLI-9 matters more.                                                                                                 |
| —      | `BankFinancialAccount` `accountDealDate` / `accountUpdateDate` / `accountAgreementOpeningDate` (`Int`, `yyyymmdd`)                                                                                                                                                                          | Days from the bank                                | Leave                                                                                                                                                            | Not datetimes.                                                                                                                                                 |
| —      | Years as `Int` / `String`                                                                                                                                                                                                                                                                   | Years                                             | Leave                                                                                                                                                            | No timezone involved.                                                                                                                                          |

### 2.5 Fragile spots, in more detail

- **SRV-2 and SRV-3, the misc-expense chain.** Example: the server runs on UTC, and an Israeli user
  enters `2026-05-01 01:30` in the value-date picker.
  1. The browser sends `2026-04-30T22:30:00.000Z` (probe).
  2. node-pg writes that `Date` as `2026-04-30T22:30:00.000+00:00`, and the `timestamp` column keeps
     `2026-04-30 22:30`.
  3. The ledger value date becomes **2026-04-30**, and the exchange rate is taken for that instant.
  4. In `generateBalanceCharge`, the lock check takes the tenant day of the same instant,
     **2026-05-01**.

  With the server in Israel, the stored wall clock would be `2026-05-01 01:30` instead. So the
  ledger day depends on the server's zone. And because the input reads the browser's wall clock, it
  depends on where the user is too.

- **SRV-4, `debit_timestamp`.**
  - Crypto rows hold the DB zone's wall clock, which is UTC in practice. A server running in Israel
    reads them 2–3 hours early, so CoinMarketCap is asked for the wrong instant, and their effective
    day is the UTC day.
  - Max rows hold an Israeli wall clock, so a UTC server sends `exactEffectiveDate` 2–3 hours late.
  - Max purchase times that fall in the spring-forward gap become shifted instants.
- **SRV-5, crypto rate cache.** `WHERE date = $date` with `ON CONFLICT (date, coin_symbol, against)`
  (`modules/exchange-rates/providers/crypto-exchange.provider.ts:19-31`). A day's tenant midnight is
  stored as `21:00` or `22:00` (summer or winter) the day before on a UTC server and as `00:00` on
  an Israeli one. Moving the server, or running local development in Israel against a shared DB,
  makes a second set of rows.
- **SRV-18, the known test failure.** `assertAuditTrail` checks that `created_at` is not in the
  future (`modules/ledger/__tests__/helpers/ledger-assertions.ts:151`), called from
  `modules/ledger/__tests__/ledger-scenario-a.integration.test.ts:208` and
  `modules/ledger/__tests__/ledger-scenario-b.integration.test.ts:222`.
  1. `ledger_records.created_at` stores the DB's UTC wall clock.
  2. Under `TZ=America/New_York`, node-pg reads it 4–5 hours in the future, and the assertion fails.
  3. Zones east of UTC pass, because there the value reads as the past.

  The test is right; the column is the bug.

- **SRV-17.** `packages/server/scripts/seed-super-admin.ts:20-27` and
  `packages/server/src/demo-fixtures/validate-demo-data.ts:41-48` open pools without
  `pgTypeParsers`. So there, `date` values are still process-local `Date`s, and
  `packages/server/src/demo-fixtures/validators/ledger-validators.ts:399-426` compares them with
  `new Date('2020-01-01')`, which is UTC midnight.

## 3. Client

### 3.1 How datetimes arrive and leave

- **Arriving.** The client codegen maps `DateTime` to `Date` for input and output
  (`codegen.ts:213-216`). But urql does no scalar exchange (`providers/urql.tsx`), so at runtime
  every `DateTime` is an ISO string. One file already says so
  (`components/businesses/business-rows.ts:70-71`). This is CLI-23: the types claim `Date`, the code
  calls `new Date(value)` on what is really a string, and nothing checks the difference.
  `TimelessDate` maps to the client's own `TimelessDateString` (`codegen.ts:203`,
  `helpers/dates.ts:19-27`), which still only allows the years 2000–2049.
- **Leaving.** urql serializes variables with `JSON.stringify`, so a `Date` goes out as
  `toISOString()`, UTC with `Z`. Only the misc-expense `valueDate` sends a `DateTime`. Every other
  date argument is a `TimelessDate` string or an `Int` year.
- **Libraries.**
  - date-fns 4 only. Its `format` and `parse` work in the browser's zone, and a string argument goes
    through `new Date(string)`.
  - react-day-picker 10, behind `components/ui/calendar.tsx`. It supports `timeZone` and `today`,
    but the app passes neither (CLI-24).
  - No `Intl.DateTimeFormat`, no `date-fns-tz` or `@date-fns/tz`. `toLocale*String` is used at about
    15 date call sites.
- **Helpers** in `helpers/dates.ts`:
  - `formatTimelessDate` (`:11-17`) is safe: it rearranges the string parts.
  - `formatTimelessDateString(date: Date)` (`:3-5`) is `format(date, 'yyyy-MM-dd')` in the browser's
    zone. It is safe for "now" and for local-midnight dates, and wrong for `new Date('yyyy-mm-dd')`
    (CLI-1).
  - There is no client helper for the tenant's "today" or for showing an instant.

### 3.2 Every instant shown in the UI

Days (`TimelessDate`) are covered in [3.3](#33-days-shown-in-the-ui). These are all the places that
show a `DateTime`:

| Where                                                                                                                                             | Field                                               | How it is shown today                                                                                 | Show in (see [3.4](#34-tenant-or-browser-the-display-policy))                                                                 |
| ------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `components/charges/extended-info/misc-expenses.tsx:72`                                                                                           | `MiscExpense.valueDate`                             | `format(new Date(iso), 'yyyy-MM-dd')`: the browser's day, time dropped                                | **Tenant**, with the time, because it decides the ledger day and rate. Can differ from the ledger's value date today (SRV-2). |
| `components/charges/extended-info/foreign-securities-info.tsx:92`                                                                                 | `Security.asOfDate`                                 | `formatSecurityDate`, then `new Date`, then `dd/MM/yyyy`: the browser's day                           | Tenant day (it is the date the quote was taken, for the books)                                                                |
| `components/admin-settings/auth-management/api-keys-tab.tsx:145,147`                                                                              | `ApiKey.lastUsedAt`, `createdAt`                    | `toLocaleString()` / `toLocaleDateString()`, browser locale and zone                                  | Browser, with the zone in a tooltip                                                                                           |
| `components/admin-settings/auth-management/invitations-tab.tsx:155`                                                                               | `Invitation.expiresAt`                              | `toLocaleDateString()`: **date only**, so the expiry time is hidden and the date can mislead by a day | Browser, **with the time** and the zone                                                                                       |
| `components/admin-settings/provider-integrations/deel-card.tsx:101`, `components/admin-settings/provider-integrations/green-invoice-card.tsx:102` | `configuredAt`                                      | `toLocaleDateString('en-US')`: M/D/YYYY, unlike the rest of the app                                   | Browser, in the app's `dd/MM/yyyy`                                                                                            |
| `components/businesses/columns.tsx:100,106` (from `components/businesses/business-rows.ts:108-109`)                                               | `Business.createdAt` / `updatedAt`                  | `dd/MM/yyyy`, browser day                                                                             | Browser, with a tooltip                                                                                                       |
| `components/business/business-header.tsx:79`                                                                                                      | `Business.createdAt` ("Since MMM yyyy")             | `format(iso, 'MMM yyyy')`                                                                             | Browser (low stakes)                                                                                                          |
| `components/reports/dynamic-report/dialogs/template-manager.tsx:121` (from `components/reports/dynamic-report/index.tsx:248`)                     | `DynamicReportInfo.updated`                         | `toLocaleDateString('en-US', …)`                                                                      | Browser, with a tooltip                                                                                                       |
| `components/reports/dynamic-report/toolbar.tsx:155,287`                                                                                           | `DynamicReportSnapshot.createdAt` (baseline picker) | `toLocaleDateString(undefined, …)`                                                                    | Browser, with a tooltip                                                                                                       |
| `components/reports/dynamic-report/thread-view.tsx:48-56,398,401`; `components/reports/dynamic-report/discussions-list.tsx:77`                    | `DynamicReportComment.createdAt`                    | `toLocaleString(undefined, { day, month, year, hour, minute })`, no zone                              | Browser, with the zone in a tooltip                                                                                           |
| `components/reports/dynamic-report/approval-status.tsx:42` → `components/reports/dynamic-report/utils/approvals.ts:305-311`                       | `DynamicReportLeafApproval.setAt`                   | `toLocaleDateString(undefined, …)`, date only                                                         | **D-3**: an audit-trail date on the books. Browser plus a zone label, or tenant.                                              |
| Annual audit status hooks (`hooks/use-set-annual-audit-step-status.ts:20-21` and the step hooks)                                                  | `updatedAt`, `completedAt`                          | Fetched, never shown                                                                                  | —                                                                                                                             |
| `components/common/modals/insert-misc-expense-modal.tsx:83-86`                                                                                    | `Transaction.exactEffectiveDate`                    | Not shown; used as the misc-expense value-date default (CLI-16)                                       | —                                                                                                                             |

**Not in the client at all:** email ingestion times, audit logs, ingestion grants, cron schedules.
Exports only use days, and PDF file names only use years.

### 3.3 Days shown in the UI

Most date cells already format the `yyyy-mm-dd` string directly. Using `formatTimelessDate`:

- charges table (`components/charges/cells/date.tsx:49,52`);
- transactions (`components/transactions-table/cells/event-date.tsx:13`,
  `components/transactions-table/cells/debit-date.tsx:14,17`);
- documents (`components/documents-table/cells/date.tsx:17`);
- ledger (`components/ledger-table/date-cell.tsx:10,13`);
- business ledger;
- depreciation;
- bank deposits;
- business trips.

Raw `yyyy-mm-dd` strings:

- VAT report columns;
- yearly ledger;
- annual revenue;
- dynamic report periods;
- bank deposits list.

The rest:

- `components/cron-jobs/index.tsx:36-42` uses `parseISO`, which reads a day as local midnight: ✅.
- `components/contracts/cells/date.tsx:11` uses `toLocaleDateString` with `timeZone: 'UTC'`. The day
  is right, but the format follows the browser's locale.

All of these are ✅ in every zone. The exceptions are the bugs in
[3.6](#36-day-bugs-found-cli-1-to-cli-19).

**Sorting** by `new Date(day).getTime()` is ✅: every row shifts by the same amount. It happens in
`components/transactions-table/columns.tsx:94,121`, `components/documents-table/columns.tsx:161`,
`components/bank-deposits/columns.tsx:66`,
`components/bank-deposits/deposits-transactions-table.tsx:104-105` and
`components/business/client/contracts-section.tsx:79`.

**Fragile but right today:**

- The VAT report and PCN validation pickers and titles rely on the `yyyy-MM-15` convention, which no
  timezone can push into another month: `components/reports/vat-monthly-report/index.tsx:132`,
  `components/reports/vat-monthly-report/vat-monthly-report-filters.tsx:47`,
  `components/reports/validations/validate-reports-filter.tsx:72-73,84-85` and
  `components/common/forms/modify-document-fields.tsx:258`.
- The business trip day count
  (`components/common/business-trip-report/parts/report-header.tsx:82-84`) shifts both ends equally.
  It can be off by one if a DST change falls inside the trip.

### 3.4 Tenant or browser: the display policy

This is a proposal; D-3 confirms it. The rule of thumb: **a value that decides something in the
books is shown in the tenant zone; a value that records an activity is shown in the viewer's zone.**
Wherever it is not obvious which zone is meant, the zone is shown.

| Kind                     | Examples                                                                                                      | Show in                                                    | Why                                                                                                                                                    |
| ------------------------ | ------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Day                      | Every `TimelessDate`                                                                                          | No zone: the digits as stored                              | A day has no zone. Converting it is the bug.                                                                                                           |
| Bookkeeping instant      | Misc-expense value date and time, `exactEffectiveDate`, `Security.asOfDate` (as a day)                        | **Tenant**, labelled (e.g. "01/05/2026 01:30 Israel time") | The ledger day and the exchange rate are taken in the tenant zone (T4). The user must see the day the books will use, wherever they are.               |
| Activity / audit instant | Comments, snapshots, template updates, API key use, invitations, "configured since", business created/updated | **Browser**, with the absolute time and zone in a tooltip  | It answers "when did this happen, for me". There is no bookkeeping consequence.                                                                        |
| Approval instant         | `DynamicReportLeafApproval.setAt`                                                                             | **D-3** (recommendation: browser plus a tooltip)           | An audit trail, read by accountants who may sit in another zone than the tenant.                                                                       |
| Expiry                   | `Invitation.expiresAt`                                                                                        | Browser, **with the time**                                 | Whether something is still valid is relative to now, for the viewer.                                                                                   |
| "Today" defaults         | Filter defaults, document date, payment date, report year, VAT month, "close deposit" date                    | **Tenant**                                                 | Must match the server's `todayTimelessDate()`. Otherwise an Israeli bookkeeper abroad, or anyone near midnight, gets yesterday's or tomorrow's period. |

### 3.5 Inputs

- **`DatePickerInput`** (`components/common/inputs/date-picker-input.tsx`) is ✅. It takes and
  returns `TimelessDateString`, validates typed text against `TIMELESS_DATE_REGEX` (`:17-23`), and
  builds local-midnight dates from the parts for the calendar (`:25-28,140-149`).
  - Its 32 call sites send `yyyy-mm-dd` strings: charge filters, ledger and trial balance filters,
    documents filters, balance report, charts, dynamic report period, transaction and document edit
    forms, misc-expense invoice date, business trips, attendees, trip expenses and depreciation.
  - Only the calendar's "today" highlight follows the browser (CLI-24).
- **Native `<input type="date">`** gives `yyyy-mm-dd`, which is ✅ when passed through:
  - bank deposits;
  - charge matching queue;
  - issue document date and due date;
  - uniform format range.

  The exceptions are CLI-1 and CLI-2, which re-parse the value with `new Date(…)`.

- **`DateTimePickerInput`** (`components/common/inputs/date-time-picker-input.tsx`) is the only
  date-time input (CLI-20).
  - It parses typed `yyyy-MM-dd HH:mm:ss` with `parse(value, DISPLAY_FORMAT, new Date())`
    (`:15-22`).
  - It builds calendar and spinner values with `new Date(y, m, d, h, mi, s)`.
  - It displays with `format(value, DISPLAY_FORMAT)` (`:35,41`).
  - All of that is in the **browser's** zone, with no indicator. A time inside a DST gap is moved
    silently.
  - Call sites:
    - **Misc-expense value date**, `components/common/forms/modify-misc-expense-fields.tsx:147`,
      used by insert (`components/common/forms/insert-misc-expense.tsx:43-54`) and edit
      (`components/common/forms/edit-misc-expense.tsx:46,61-64`). The insert default is
      `new Date(exactEffectiveDate ?? effectiveDate)`
      (`components/common/modals/insert-misc-expense-modal.tsx:83-86`). From `effectiveDate`, a day,
      that is UTC midnight: 03:00 in Israel, 20:00 the day before in New York (CLI-16).
    - **Balance charge records**, `components/common/modals/balance-charge-modal.tsx:315` (zod
      `z.date()` at `:69`). There is no default, so a picked day lands at 00:00 browser time, the
      riskiest possible value.
- **Month and year pickers** (`components/common/inputs/period-picker-input.tsx`,
  `month-picker-input.tsx`, `year-picker-input.tsx`, `components/ui/period-picker.tsx`) work in
  local `Date`s and are ✅ when picked. The bugs come when a call site turns a stored day back into
  the picker value with `new Date(day)`: CLI-8, CLI-9, CLI-10, CLI-11 and CLI-15.
- **Defaults: "today", "this month", "this year"** (CLI-21). They all use the browser clock:
  - **Filters:** `components/charges/charges-filters/constants.ts:57-126`,
    `components/charts/chart-filters.tsx:37`, `components/charts/index.tsx:75`,
    `components/screens/documents/all-documents/documents-filters.tsx:64-65`,
    `components/screens/reports/balance-report/index.tsx:160-162`,
    `components/salaries/salaries-filters.tsx:29-31`.
  - **Months:** `components/reports/vat-monthly-report/utils.ts:11`,
    `components/reports/validations/index.tsx:31-32`,
    `components/screens/documents/issue-documents/index.tsx:25`,
    `components/contracts/issue-documents-modal.tsx:57`,
    `components/business/client/issue-document-from-contract-button.tsx:42`.
  - **Single fields:** the issue-document date
    (`components/common/documents/issue-document/index.tsx:47`), "close deposit"
    (`components/bank-deposits/deposit-dialog.tsx:174`), tax-advance rates
    (`components/business/admin/admin-business-section.tsx:264`), and the charge spread year
    (`components/common/inputs/charge-spread-input.tsx:117`).
  - **Report years:** `components/reports/profit-and-loss-report/index.tsx:147`,
    `components/reports/tax-report/index.tsx:152`, and the corporate tax, yearly ledger, annual
    revenue, depreciation and annual audit screens. Also `maxDate={new Date()}` on the year pickers.
  - **Computed at module load** (CLI-25):
    `components/common/documents/issue-document/index.tsx:42-52`,
    `components/charts/monthly-income-expense/index.tsx:28-32`,
    `components/reports/dynamic-report/index.tsx:255-257`, and
    `components/screens/operations/annual-audit/year-picker.tsx:11`.
- **Two defaults use the UTC day**, which is wrong near midnight on both sides of UTC:
  `new Date().toISOString().slice(0, 10)` (CLI-18) and `.split('T')[0]` (CLI-19).
- **URL and storage.** The date filters live in URL query parameters as `yyyy-mm-dd` strings or
  years, so the stored value has no zone. localStorage holds no date filters.

### 3.6 Day bugs found (CLI-1 to CLI-19)

West of UTC, `new Date('yyyy-mm-dd')` is the previous evening (#4629's R8). The probe confirms
`format(new Date('2026-05-01'), 'yyyy-MM-dd')` is `2026-04-30` in New York.

| Case   | Where                                                                                                                              | Pattern                                                             | Effect                                                                                                                                                                        |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CLI-1  | `components/business/admin/admin-business-section.tsx:157-159`                                                                     | `formatTimelessDateString(new Date(registrationDate))`              | West: **saves** the previous day                                                                                                                                              |
| CLI-2  | `components/clients/contracts/modify-contract-dialog.tsx:251,258,271,278,295,302`                                                  | `format(new Date(values.startDate / endDate), 'yyyy-MM-dd')`        | West: **saves** start and end a day early, on create and update                                                                                                               |
| CLI-3  | `components/transactions-table/download-csv.tsx:93-95`                                                                             | `format(new Date(eventDate / effectiveDate), …)`                    | West: CSV dates a day early                                                                                                                                                   |
| CLI-4  | `components/common/modals/similar-transactions-modal.tsx:152-153` (shown at `:96,102`)                                             | `new Date(eventDate)`                                               | West: previous day                                                                                                                                                            |
| CLI-5  | `components/business/client/contracts-section.tsx:158-159`                                                                         | `new Date(day).toLocaleDateString()`                                | West: previous day; browser locale format                                                                                                                                     |
| CLI-6  | `components/salaries/record-cells/employee.tsx:23`; `components/salaries/record-cells/month-title.tsx:11`                          | `format(new Date('yyyy-MM'), 'MMMM yyyy')`                          | West: previous month (probe: "April 2026" for `2026-05`)                                                                                                                      |
| CLI-7  | `components/common/modals/edit-salary-record-modal.tsx:133`                                                                        | `format(new Date('yyyy-MM'), 'yyyy-MM-dd')` as the query's month    | West: asks for `2026-04-30`; the server slices it to `2026-04` (`packages/server/src/modules/salaries/resolvers/salaries.resolvers.ts:47-48`), so the record is **not found** |
| CLI-8  | `components/common/forms/modify-salary-record.tsx:193-194`                                                                         | `new Date('yyyy-MM')` as the picker default                         | West: previous month preselected                                                                                                                                              |
| CLI-9  | `components/salaries/salaries-filters.tsx:126-129`                                                                                 | `new Date('yyyy-MM-01')`                                            | West: previous month                                                                                                                                                          |
| CLI-10 | `components/common/inputs/charge-spread-input.tsx:64`                                                                              | `new Date('yyyy-01-01')` as the year-picker value                   | West: previous year, and a re-save **writes** it                                                                                                                              |
| CLI-11 | `components/charts/monthly-income-expense/chart-filter.tsx:46,68`                                                                  | `new Date('yyyy-MM-01')`                                            | West: previous month                                                                                                                                                          |
| CLI-12 | `components/charts/monthly-income-expense/index.tsx:65`                                                                            | `format(new Date(from / toDate), "MMM ''yy")`                       | West: previous month (the picker always gives the 1st)                                                                                                                        |
| CLI-13 | `components/charts/index.tsx:116-119`                                                                                              | `new Date(effectiveDate \|\| eventDate)`, then local month and year | West: amounts dated the 1st go into the previous month's bucket                                                                                                               |
| CLI-14 | `components/screens/operations/annual-audit/step-08-ledger-lock/index.tsx:79`                                                      | `format(new Date('yyyy-12-31'), 'MMMM do, yyy')`                    | West: "December 30th" in the confirmation text                                                                                                                                |
| CLI-15 | `components/screens/documents/issue-documents/issue-documents-table.tsx:160`; `components/contracts/issue-documents-modal.tsx:144` | `new Date(issueMonth)`, where the day is today's day of the month   | West, on the 1st: previous month shown                                                                                                                                        |
| CLI-16 | `components/common/modals/insert-misc-expense-modal.tsx:83-86`                                                                     | `new Date(effectiveDate)` fed into a date-time field                | A time nobody chose: 03:00 in Israel, 20:00 the day before in New York                                                                                                        |
| CLI-17 | `components/common/modals/uniform-format-files-modal.tsx:130-141`                                                                  | `new Date('yyyy-mm-dd')` compared with `new Date()`                 | Wrong "future date" check near local midnight                                                                                                                                 |
| CLI-18 | `components/reports/dynamic-report/index.tsx:257`                                                                                  | `new Date().toISOString().slice(0, 10)`                             | The UTC day: wrong in Israel 00:00–02:00/03:00 and in New York after 19:00/20:00                                                                                              |
| CLI-19 | `components/common/forms/issue-document/payment-form.tsx:45`                                                                       | `new Date().toISOString().split('T')[0]`                            | Same as CLI-18                                                                                                                                                                |

### 3.7 Proposed timezone warnings

These are specs for W7. They reuse existing components:

- **Tooltip:** `components/ui/tooltip.tsx`, with the `Info` icon pattern in
  `components/charges/charges-filters/sections/completeness-section.tsx:60-69`.
- **Alert:** `components/ui/alert.tsx`, as used in
  `components/charge-matching/charge-matching-header.tsx:179-187`.
- **Amber warning strip:** `components/reports/dynamic-report/legacy-banner.tsx:8-28`.
- **Field help text:** `components/ui/form.tsx` `FormDescription`.
- **In-field suffix:** `components/ui/input-group.tsx` (`InputGroupAddon`, `InputGroupText`). Both
  date inputs already wrap their field in an `InputGroup`
  (`components/common/inputs/date-picker-input.tsx:76-156`,
  `components/common/inputs/date-time-picker-input.tsx:47-177`), and both render their error line
  under the field (`components/common/inputs/date-picker-input.tsx:157-161`,
  `components/common/inputs/date-time-picker-input.tsx:178-182`).
- **Icons:** `Info`, `Globe`, `Clock` and `AlertTriangle` from lucide-react are already used.
- **Not available:** there is no `HoverCard` component; use `Tooltip` or `Popover`.

| ID   | Where                                                                | What it shows                                                                                                                                                                                                                           | When                                                                           |
| ---- | -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| UI-1 | `DateTimePickerInput`, as an inline suffix                           | The zone the time is read in, e.g. "Israel time (UTC+3)". Once W7 makes the picker read in the tenant zone, this is always the tenant zone.                                                                                             | Always                                                                         |
| UI-2 | `DateTimePickerInput`, as a note under the field (amber)             | "You are in America/New_York. This time is read as Israel time; it falls on **01/05/2026** in the books." Show the tenant day the value maps to: that is the one fact the user needs.                                                   | When the browser zone's offset differs from the tenant's at the picked instant |
| UI-3 | `DateTimePickerInput`, as a note under the field (muted)             | "Close to midnight: the ledger day is 01/05/2026."                                                                                                                                                                                      | When the picked time is within 3 hours of the tenant's midnight                |
| UI-4 | Date-only pickers (`DatePickerInput`, month and year pickers)        | No warning: days have no zone. Make the calendar's "today" follow the tenant (`timeZone` / `today` props), and when the browser's day differs from the tenant's, an info tooltip on the calendar icon: "Today in Israel is 02/05/2026." | Only when the two days differ                                                  |
| UI-5 | App level (header or user menu), dismissible, remembered per browser | "Times are shown in your timezone (America/New_York). Bookkeeping days follow Israel time."                                                                                                                                             | When the browser zone's current offset differs from the tenant's               |
| UI-6 | Every activity instant ([3.2](#32-every-instant-shown-in-the-ui))    | One format (`dd/MM/yyyy HH:mm`), with a tooltip giving the absolute time and the zone. Invitation expiry shows the time.                                                                                                                | Always                                                                         |

UI-2, UI-3 and UI-5 need the tenant zone in the client (D-4).

## 4. Other packages

### 4.1 Intake: cross-check with #4629

Every verdict in #4629's summary still holds on `abd0493`, with three updates:

- **GI-1.** The verdict holds (`documentDate` stays a string) but the mechanism changed. Since Mesh
  v1, `@graphql-mesh/transport-rest` 0.12.2 gives every scalar whose name matches a graphql-scalars
  scalar that scalar's resolvers
  (`node_modules/@graphql-mesh/transport-rest/esm/directives/scalars.js` `processScalarType`). So
  Green Invoice's `Date` is now graphql-scalars 1.26.0's `Date`:
  - outputs pass a `yyyy-mm-dd` string through unchanged;
  - a value that is not `yyyy-mm-dd` now throws instead of passing.
- **GI-4 / M-10.** `firstPayment` is an amount. The client issuing form labels it "First Payment
  Amount", as a number input with `step="0.01"`
  (`packages/client/src/components/common/forms/issue-document/payment-form.tsx:301-305`). The Green
  Invoice schema example is `10`
  (`packages/green-invoice-graphql/json-schemas/greenInvoice.json:2541-2545`). The server sends a
  unix time there (SRV-16).
- **HSV-1.** Hashavshevet, like payper-mesh, has been outside the workspaces since `abd0493`.

New intake cases, continuing #4629's numbering. **Time?** means the value carries a time of day.

| Case          | Source / field                                                                                                                                                                | Time? | Zone known? | Status                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GI-5          | Green Invoice `searchDocuments` / `searchExpenseDrafts` `fromDate` / `toDate` (`format: date`, `packages/green-invoice-graphql/json-schemas/greenInvoice.json:46-55,352-361`) | No    | n/a         | 🔍 The scalar's `parseValue('2026-09-27')` returns a `Date`, and transport-rest builds the body with `JSON.stringify(input)` (`node_modules/@graphql-mesh/transport-rest/esm/directives/httpOperation.js:166`), which gives `"2026-09-27T00:00:00.000Z"` in every zone (probe). The day is kept; whether Green Invoice accepts that, and whether the fusion runtime really calls `parseValue` before the REST call, is not verified. The only caller, `addExpenseDraftByFile` (`packages/server/src/modules/app-providers/green-invoice-client.ts:125-130`), has no callers. |
| VAT-1         | israeli-vat-scraper `reportMonth`, `generationDate`, `reportingDate`, `invoiceDate` (`packages/israeli-vat-scraper/src/VatSchema.json:18-21,36-39,90-93,332-335`)             | No    | Shape       | Not wired to anything. `parseDate` builds process-local `Date`s and uses the 1-based month as a JS month (`packages/israeli-vat-scraper/src/utils/dates.ts:6,8`); only used for sorting. If ever wired: keep the strings.                                                                                                                                                                                                                                                                                                                                                    |
| PAY-1         | payper-mesh `document_date`, `updated_at` and their filters (`packages/payper-mesh/src/json-schemas/payperSchema.json:52-69`)                                                 | ?     | ?           | Not wired; deprecated.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ISR-1a        | Isracard / Amex `debit_date = COALESCE(full_payment_date, charging_date)` (`2026-02-19T17-00-00…:576,820`)                                                                    | No    | n/a         | 🐞 scraper-app deletes `chargingDate` before upload (`packages/scraper-app/src/server/graphql/mutations.ts:891-905`), so the fallback never fires. 🔍 Do rows without `fullPaymentDate` occur?                                                                                                                                                                                                                                                                                                                                                                               |
| ANT-2         | Anthropic OCR date (`packages/server/src/modules/app-providers/anthropic.ts:158-168`)                                                                                         | No    | n/a         | 🐞 The prompt gives no date-order hint. `03/04/2025` is 3 April on an Israeli invoice and 4 March on a US one.                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| EML-2         | Email `Date:` headers (`packages/email-ingestion-gateway/src/forwarded.ts:13,43,162`)                                                                                         | Yes   | Free text   | ✅ Forwarded-block dates are parsed and deliberately not sent; the MIME `Date:` is never read. `receivedAt` comes from the worker's own clock (EML-1).                                                                                                                                                                                                                                                                                                                                                                                                                       |
| DEEL-7        | Deel breakdown `date`, `payment_date` (`packages/server/src/modules/app-providers/deel/schemas.ts:393`)                                                                       | Yes   | Claimed UTC | Parsed but not stored. Include in M-8 if ever used.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| AUTH-1        | Auth0 JWT `exp`                                                                                                                                                               | Epoch | Yes         | ✅ Checked by `jose` (`packages/server/src/modules/auth/providers/auth-context.provider.ts:134`). No Auth0 user timestamps are read.                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| DRV-1 / CLD-1 | Google Drive, Cloudinary                                                                                                                                                      | —     | —           | ✅ No date fields requested or read.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |

There is no server-side Bank of Israel call. Fiat rates come only from the DB
(`packages/server/src/modules/exchange-rates/providers/fiat-exchange.provider.ts:18-36`), filled by
scraper-app (BOI-1).

### 4.2 Outbound: dates we send

| Case   | Target and field                                                                                                                                                                                                                 | Format sent                                                                 | Comes from                                                                                                                                                                                                             | Time? | Zone used / zone the receiver assumes                                 | Status                                             |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- | --------------------------------------------------------------------- | -------------------------------------------------- |
| OUT-1  | Green Invoice document `date`, `dueDate`, `payment[].date` (`packages/server/src/modules/green-invoice/helpers/green-invoice.helper.ts:1299-1300`; `packages/server/src/modules/documents/helpers/issue-document.helper.ts:136`) | `yyyy-mm-dd`, unvalidated `String`                                          | Client: browser "today" for the document (`components/common/documents/issue-document/index.tsx:47`, CLI-21) and the UTC "today" for payments (CLI-19). Server drafts: the latest `debit_date`, or the tenant "today". | No    | Browser / UTC / tenant; Green Invoice presumably reads an Israeli day | ⚠️ P3. GQL-1.                                      |
| SRV-16 | Green Invoice `payment[].firstPayment`                                                                                                                                                                                           | Unix seconds                                                                | `timelessDateToTenantInstant(event_date)`                                                                                                                                                                              | Yes   | Tenant                                                                | 🐞 P1. The field is an amount.                     |
| GI-5   | Green Invoice search `fromDate` / `toDate`                                                                                                                                                                                       | Probably ISO with `Z`                                                       | `todayTimelessDate()`                                                                                                                                                                                                  | No    | Tenant                                                                | 🔍 latent                                          |
| —      | Deel `/payments?date_from&date_to`, `/invoices?issued_from_date` (`packages/server/src/modules/app-providers/deel/deel-client.provider.ts:57-69,133-148`)                                                                        | `yyyy-mm-dd`                                                                | Tenant "today" and a year back                                                                                                                                                                                         | No    | Tenant / Deel's (undocumented, probably UTC)                          | ✅ A rolling window; only the edge day can differ. |
| —      | CoinMarketCap `range=from~to` (`packages/server/src/modules/app-providers/coinmarketcap.ts:11-18`)                                                                                                                               | Unix seconds                                                                | `to` is a day's tenant midnight, or a `debit_timestamp` read in the process zone; `from = to − 23h`                                                                                                                    | Yes   | Epoch on the wire; the instant itself follows SRV-4                   | ⚠️ (SRV-4, CMC-1)                                  |
| ANT-2  | Anthropic OCR prompt                                                                                                                                                                                                             | Asks for ISO `YYYY-MM-DD`; no reference date, no date-order hint            | —                                                                                                                                                                                                                      | No    | —                                                                     | 🐞 P3                                              |
| OUT-2  | Bank and card scrape windows (`packages/modern-poalim-scraper/src/scrapers/*`)                                                                                                                                                   | `yyyyMMdd`, `ddMMyyyy`, `month` + `year`, `yyyy-MM-01`, `dd/MM/yyyy`        | Built from `Date`s in the scraper machine's zone                                                                                                                                                                       | No    | Scraper / the bank's (Israel)                                         | ⚠️ #4629's WIN-1 to WIN-9                          |
| SRV-12 | PCN874 header `generationDate` (`packages/pcn874-generator/src/schemas.ts:53-67`)                                                                                                                                                | `YYYYMMDD`                                                                  | `new Date()` with `getUTC*`; the server never passes it (`packages/server/src/modules/reports/helpers/pcn.helper.ts:337`)                                                                                              | No    | **UTC** / the Tax Authority's (Israel)                                | ⚠️ P2                                              |
| —      | PCN874 `reportMonth`, record `invoiceDate`                                                                                                                                                                                       | `YYYYMM`, `YYYYMMDD`                                                        | Day strings                                                                                                                                                                                                            | No    | —                                                                     | ✅                                                 |
| SRV-13 | Uniform format A000 `processStartDate` / `processStartTime` (`packages/shaam-uniform-format-generator/src/api/generate-report.ts:108-109`)                                                                                       | `YYYYMMDD`, `HHMM`                                                          | `new Date().toISOString()` for the date, `new Date().toTimeString()` for the time                                                                                                                                      | Yes   | **UTC** date, **process** time                                        | ⚠️ P2                                              |
| SRV-11 | Uniform format B100 `entryDate`                                                                                                                                                                                                  | `YYYYMMDD`                                                                  | DB day of `ledger_records.created_at`                                                                                                                                                                                  | No    | **DB**                                                                | ⚠️ P2                                              |
| —      | Uniform format A000 `startDate` / `endDate`, B100 `date` / `valueDate`                                                                                                                                                           | `YYYYMMDD`                                                                  | Day strings                                                                                                                                                                                                            | No    | —                                                                     | ✅                                                 |
| —      | SHAAM 6111 `taxYear`, `ifrsImplementationYear`                                                                                                                                                                                   | `YYYY`                                                                      | Integer years                                                                                                                                                                                                          | No    | —                                                                     | ✅                                                 |
| —      | Email worker → gateway `x-cf-timestamp`, `x-cf-received-at` (`packages/email-ingestion-gateway/src/worker.ts:219,245,251`)                                                                                                       | Epoch seconds; ISO with `Z`                                                 | `Date.now()`, `new Date()`                                                                                                                                                                                             | Yes   | Exact                                                                 | ✅                                                 |
| —      | Kraken, Etherscan, Etana, israeli-vat-scraper requests                                                                                                                                                                           | No dates sent (offset paging, block ranges, a local CSV, a year `<select>`) | —                                                                                                                                                                                                                      | —     | —                                                                     | ✅                                                 |

There is no `opcn1214-generator` package. The client only links to `/reports/1214`.

### 4.3 Cross-package transfer

| Case | Boundary                                                      | Date fields                                                      | Types on each side                                                                                                                                                                                                     | Wire format                             | Time?        | Zone known?                                        | Handled?                 | Recommendation                                                                                                                                                                                                                   |
| ---- | ------------------------------------------------------------- | ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- | ------------ | -------------------------------------------------- | ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| —    | green-invoice-graphql ↔ server                                | `documentDate`                                                   | Mesh `Date`, typed `` `${number}-${number}-${number}` `` (`packages/green-invoice-graphql/codegen.ts:29`) → `documents.date` `TimelessDateString`                                                                      | `yyyy-mm-dd`                            | No           | n/a                                                | ✅                       | Keep. Add a passthrough test.                                                                                                                                                                                                    |
| GI-5 | green-invoice-graphql ↔ server                                | Search `fromDate` / `toDate`                                     | Same template type; runtime `Date`                                                                                                                                                                                     | Probably ISO with `Z`                   | No           | n/a                                                | 🔍                       | Test the request body. If confirmed, override the `Date` scalar for inputs, or drop `format: date` from the request schemas.                                                                                                     |
| —    | green-invoice-graphql ↔ server                                | `creationDate`, `lastUpdateDate`                                 | `integer` epoch → `number`                                                                                                                                                                                             | Epoch                                   | Yes          | Yes                                                | ✅                       | Keep.                                                                                                                                                                                                                            |
| —    | green-invoice-graphql ↔ server                                | Issuing `date`, `dueDate`, payment `date`                        | Plain `string` in the schema; server `String`                                                                                                                                                                          | `yyyy-mm-dd`                            | No           | n/a                                                | Partly (unvalidated)     | GQL-1.                                                                                                                                                                                                                           |
| XP-1 | scraper-app → server                                          | Every bank date; `CurrencyRateInput.exchangeDate: TimelessDate!` | Codegen for scraper-app maps only `FileScalar` and `UUID` (`codegen.ts:246-262`), so `TimelessDate` falls back to codegen's default scalar type; bank dates are `String`                                               | Raw bank strings and `yyyy-mm-dd`       | Mostly no    | n/a                                                | Partly                   | Map `TimelessDate` → `string` (or the shared type) and `DateTime` → `string` in scraper-app's codegen; GQL-8. Max installments (MAX-2) and Otsar Excel serials (OTS-2) are built in process-local time in modern-poalim-scraper. |
| XP-2 | modern-poalim-scraper → scraper-app                           | Range options; outputs                                           | Ranges are `Date` (`cal.ts:335`, `discount.ts:154`, `max.ts:180`, `hapoalim.ts:643` under `packages/modern-poalim-scraper/src/scrapers/`); Otsar takes ISO strings and re-parses them. Outputs are strings or numbers. | In-process                              | No           | Scraper                                            | No (WIN-\*)              | Ranges as `TimelessDateString`, the type exported once; month lists with string arithmetic (with #4629's fixes).                                                                                                                 |
| XP-3 | email-ingestion-gateway → server                              | `receivedAt`, `expiresAt`, alias times                           | Gateway `string`; server `String` (`packages/email-ingestion-gateway/src/server-client.ts:143,212,409`); codegen maps only `UUID` (`codegen.ts:264-276`)                                                               | ISO with `Z`; `receivedAt` as forwarded | Yes          | Yes (our clock)                                    | Partly                   | Validate `receivedAt` as RFC 3339 at the gateway (`packages/email-ingestion-gateway/src/webhook.ts:132`), then GQL-4 and GQL-5.                                                                                                  |
| XP-4 | mcp-server ↔ server                                           | Arguments; charge, ledger, contract and security dates read back | `TimelessDate` and `DateTime` both `string` in mcp-server's codegen; strict `TIMELESS_DATE` validation (`packages/mcp-server/src/tools/dates.ts:16-38`)                                                                | `yyyy-mm-dd`; ISO                       | Some         | Yes                                                | ✅                       | Keep. `ChargeMetadata.createdAt` / `updatedAt` (`packages/mcp-server/src/tools/charge-details.ts:267-268`) inherit SRV-1.                                                                                                        |
| XP-5 | server → pcn874 / shaam-uniform-format / shaam6111 generators | Report period, record dates, header dates                        | pcn874 regex-validated strings; uniform format `z.string().min(1)` for every date (`packages/shaam-uniform-format-generator/src/types/index.ts:26-27,35,43,56,66`), then `.replace(/-/g, '')`; 6111 an integer year    | `YYYYMMDD` / `YYYYMM` / `YYYY` strings  | Headers only | Headers: no                                        | Partly                   | Tighten the uniform-format inputs to `yyyy-mm-dd`; take header dates and times from the caller, in the tenant zone (SRV-12, SRV-13).                                                                                             |
| XP-6 | Kraken, Etherscan, Etana scrapers → DB                        | `value_date`, `event_date`, `time`                               | pg-promise; `timestamp` and `date` columns                                                                                                                                                                             | `to_timestamp(epoch)`; JS `Date`        | Yes          | Epoch yes; stored in the DB zone or scraper's zone | No (KRK-1, ETH-1, ETA-1) | Set the session `TimeZone` on these connections (W1); store instants as `timestamptz` (W2).                                                                                                                                      |
| —    | DB triggers (raw tables → `transactions`)                     | See #4629's per-source cases                                     | `to_date`, `::date`, `::text::date`, `timestamptz::DATE`                                                                                                                                                               | —                                       | Mostly no    | —                                                  | Per #4629                | Plus the `created_at` defaults in SRV-1.                                                                                                                                                                                         |
| —    | client ↔ server                                               | Every `DateTime`                                                 | Codegen says `Date`, runtime is a string (CLI-23)                                                                                                                                                                      | ISO with `Z`                            | Yes          | Yes                                                | Partly                   | Map `DateTime` → `string` in the client codegen and parse explicitly where a `Date` is needed (W4).                                                                                                                              |

Frozen packages (`gmail-listener`, `scraper-local-app`, `old-accounter`) were not reviewed.
`hashavshevet-mesh`, `payper-mesh` and `israeli-vat-scraper` are not wired to anything.

## 5. Work items

These are ordered so that each one makes the next safe. Every item names the cases it closes and the
tests ([section 6](#6-test-plan)) it should land with. None of them is done in this PR.

1. **W1: pin the clocks and make them visible.** Closes SRV-17 and SRV-20, and limits SRV-1 to SRV-6
   until W2.
   - Set the DB session zone to UTC on every connection: `options: '-c TimeZone=UTC'` on the node-pg
     pools (`packages/server/src/index.ts:33-61`, the scripts and the test helper), and the same on
     the pg-promise connections in the Kraken, Etherscan and Etana scrapers.
   - Set `TZ=UTC` for the server process in deployment and CI.
   - Log the process zone and `SHOW TimeZone` at startup.
   - Add `pgTypeParsers` to the two scripts.
   - Depends on D-1: if production writes `timestamp` defaults in a non-UTC session today, changing
     the session zone shifts every row written after the change. Do this together with W2, or after
     reading the production values.
   - Tests: T-CLK-1.
2. **W2: migrate every `timestamp` column to `timestamptz`.** Closes SRV-1, SRV-4, SRV-5, SRV-6,
   SRV-15 and SRV-18.
   - Convert each column with `USING col AT TIME ZONE '<zone it was written in>'`:
     - audit `created_at` / `updated_at`: the DB session zone (D-1);
     - `crypto_exchange_rates`: the production server process zone;
     - `debit_timestamp`, **per source**: `Asia/Jerusalem` for Max rows, the DB zone for Kraken and
       Etherscan rows;
     - the Kraken and Etherscan raw tables.
   - Change the Max trigger to build an instant with `AT TIME ZONE 'Asia/Jerusalem'`, and the crypto
     triggers to derive `event_date` / `debit_date` in the tenant zone (T4).
   - Store the Otsar ILS business and registration days as `date` (GQL-9).
   - Update the ledger-generation test mocks
     (`modules/ledger/resolvers/ledger-generation/__tests__/helpers/ledger-generation-mocks.ts:17-24`),
     which encode today's wall-clock semantics.
   - Tests: T-SRV-1, T-SRV-4, T-SRV-5, T-SRV-6, T-DB-1.
3. **W3: decide what `misc_expenses.value_date` is (D-2), then make every path agree.** Closes
   SRV-2, SRV-3 and CLI-16. Whichever way D-2 goes:
   - the ledger value day is `instantToTimelessDate(valueDate)`;
   - the lock check uses the same day;
   - the stored value is a `timestamptz` (or a `date` plus an optional `timestamptz`).

   Tests: T-SRV-2, T-SRV-3.

4. **W4: harden the scalars and codegen.** Closes SRV-7, SRV-8 and CLI-23.
   - `TimelessDate` rejects a `Date`, or converts it with `instantToTimelessDate`.
   - Client codegen maps `DateTime` to `string`.
   - scraper-app and email-ingestion-gateway codegen map `TimelessDate` and `DateTime` to `string`.
   - Rename `dateToTimelessDateString` to say it is for `timestamp` values only, or delete it after
     W2.

   Tests: T-SCL-1, T-SCL-2.

5. **W5: switch the schema types** GQL-1 to GQL-10. One PR per consumer group. Closes SRV-9, XP-7
   and part of OUT-1. Tests: T-GQL-1.
6. **W6: align the remaining server days to the tenant zone.** Closes SRV-10 to SRV-13 and SRV-19.
   - The email description label.
   - SHAAM `entryDate`, done in SQL with `AT TIME ZONE` after W2.
   - PCN874 `generationDate`: the server passes `todayTimelessDate()`, and the saved-vs-regenerated
     comparison ignores the header.
   - Uniform-format A000: date and time from one instant in the tenant zone, passed in by the
     caller.
   - The salary-month fallback.
   - The Deel day, after M-8.

   Tests: T-SRV-10 to T-SRV-13.

7. **W7: the client.** Closes CLI-1 to CLI-25.
   - Expose the tenant zone (D-4).
   - Add client helpers: the tenant's "today" / "this month" / "this year", and
     `formatInstant(value, kind)` following the [3.4](#34-tenant-or-browser-the-display-policy)
     policy.
   - Fix CLI-1 to CLI-19 by formatting from the string parts, as `formatTimelessDate` already does.
   - Make `DateTimePickerInput` read and show times in the tenant zone and send RFC 3339.
   - Add UI-1 to UI-6.
   - Pass `timeZone` / `today` to the calendar.
   - Move the module-load "today" constants inside components.

   Tests: T-CLI-1 to T-CLI-5.

8. **W8: outbound and cross-package.** Closes SRV-16, GI-5, XP-1 to XP-5 and part of OUT-2.
   - `firstPayment` becomes the amount it is meant to be.
   - Settle GI-5.
   - modern-poalim-scraper range options become strings (with #4629's WIN fixes).
   - The gateway validates `receivedAt`.
   - The generators get tighter input schemas and injected clocks.

   Tests: T-XP-1 to T-XP-4.

9. **W9: guard rails**, so regressions are caught by CI rather than by users. Tests: T-CI-1,
   T-LINT-1.

## 6. Test plan

The building blocks exist: `TEST_TIMEZONES`, `withTimezone` and `useTimezone`
(`packages/server/src/__tests__/helpers/timezones.ts:12-57`), and the
`describe.each(TEST_TIMEZONES)` pattern
(`packages/server/src/__tests__/timeless-dates.integration.test.ts:515-516`). They only switch the
**process** zone. Datetime bugs live in the gap between the process and the DB zone, so the main new
piece is a second axis.

### 6.1 The clock matrix

- **T-CLK-0, helper.** Add `useDbTimezone(zone)` next to `useTimezone`. It creates the test pool
  with `options: '-c TimeZone=<zone>'`, or runs `SET TIME ZONE` on each checked-out client. Run the
  datetime integration tests over
  `process ∈ {UTC, Asia/Jerusalem, America/New_York, Asia/Tokyo} × DB ∈ {UTC, Asia/Jerusalem, America/New_York}`.
  The full `TEST_TIMEZONES` list stays for the process axis in unit tests.
- **T-CLK-1.** The server pool and every script set `TimeZone=UTC` (assert `SHOW TimeZone` on a
  pooled client). Startup logs both zones.
- **Expectation style**, as in #4629: the expected value is the same in every cell of the matrix,
  e.g. "the API returns the instant that was written". Such a test fails today in the cells where
  the zones differ, and passes after the fix. No expectation should encode a machine zone.

### 6.2 Server

| Test     | Case(s)         | Level                                      | What it asserts                                                                                                                                                                                                              | Today                                                    |
| -------- | --------------- | ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| T-SRV-1  | SRV-1           | Integration, clock matrix                  | For every `DateTime` field backed by an audit column: capture `before = new Date()`, create the row through the API or a fixture with `NOW()`, read it through GraphQL. `before ≤ value ≤ after + skew`.                     | Fails where process ≠ DB (e.g. New York process, UTC DB) |
| T-SRV-2  | SRV-2           | Integration, clock matrix                  | `insertMiscExpense(valueDate: "2026-04-30T22:30:00.000Z")`: `MiscExpense.valueDate` returns the same instant, the ledger value date is `2026-05-01` (the tenant day), and the rate is looked up for that instant.            | Fails on a UTC process                                   |
| T-SRV-3  | SRV-3           | Integration                                | `generateBalanceCharge` with a record at `2026-04-30T22:30:00Z` against a ledger locked through `2026-04-30`: the lock check and the generated ledger agree on `2026-05-01`.                                                 | Fails on a UTC process                                   |
| T-SRV-4  | SRV-4           | Trigger integration, clock matrix          | A Max row purchased `2026-05-01 14:30` Israel time gives `exactEffectiveDate = 2026-05-01T11:30:00.000Z`. A Kraken row at epoch `2026-05-01T22:30Z` gives that exact instant, and an effective day of `2026-05-02` (tenant). | Fails (zone depends on the writer)                       |
| T-SRV-5  | SRV-5           | Integration, two process zones in sequence | Asking for the same day's crypto rate under `TZ=UTC` then `TZ=Asia/Jerusalem` hits one row and makes one CoinMarketCap call (mocked).                                                                                        | Fails                                                    |
| T-SRV-6  | SRV-6           | Integration, clock matrix                  | The balance and annual revenue reports pick the same rate row for a transaction at 23:30 Israel time.                                                                                                                        | Fails where process ≠ DB                                 |
| T-SRV-10 | SRV-10          | Unit, fake timers                          | `receivedAt = 2026-05-01T22:30:00Z` gives "Sat May 02 2026" in the description, in every process zone.                                                                                                                       | Fails (gives May 01)                                     |
| T-SRV-11 | SRV-11          | Integration                                | A ledger record created at `2026-05-01T22:30Z` has a SHAAM `entryDate` of `20260502`.                                                                                                                                        | Fails                                                    |
| T-SRV-12 | SRV-12          | Unit, fake timers                          | At `2026-05-01T22:30Z`, the PCN874 header date is `20260502`. Regenerating an unchanged report on another day shows no diff.                                                                                                 | Fails                                                    |
| T-SRV-13 | SRV-13          | Unit, fake timers, every process zone      | A000 `processStartDate` / `processStartTime` at `2026-05-01T22:30Z` are `20260502` / `0130`.                                                                                                                                 | Fails                                                    |
| T-SRV-16 | SRV-16          | Unit                                       | A credit-card payment built from a transaction sends the amount (or nothing) in `firstPayment`, never a timestamp.                                                                                                           | Fails                                                    |
| T-SCL-1  | SRV-8           | Unit                                       | `DateTime` rejects `2026-05-01T10:00:00` and `2026-05-01`, accepts `Z` and offsets, and serializes to the same instant. This locks in the contract from the probe.                                                           | Passes                                                   |
| T-SCL-2  | SRV-7           | Unit                                       | `TimelessDate` rejects a `Date` (or maps it to the tenant day), in every process zone.                                                                                                                                       | Fails                                                    |
| T-GQL-1  | GQL-1 to GQL-10 | Schema test                                | The switched fields have the new scalars, and a bad value is rejected at the boundary.                                                                                                                                       | Fails                                                    |
| T-DB-1   | W2              | Migration test                             | After the migration, each converted column holds the same instant the old column meant, for rows written under each writer zone (fixtures built per source).                                                                 | —                                                        |

### 6.3 Client

- **T-CLI-0, shared zone list.** The client keeps its own list in
  `helpers/__tests__/dates.test.ts:5`. Share one list and the `useTimezone` helper with the server,
  via a small test-utils module and a vitest alias. Setting `process.env.TZ` at runtime already
  works under happy-dom (that test proves it).
- **T-CLI-1, the day bugs.** For each of CLI-1 to CLI-19, a unit test of the extracted helper, or a
  component test, under every zone. The expectation is the same day or month in every zone, e.g. the
  contract dialog submits `startDate: '2026-05-01'` for a picked `2026-05-01`. Today these fail west
  of UTC.
- **T-CLI-2, "today" defaults.** Use `vi.setSystemTime` at instants either side of the tenant's
  midnight, e.g. `2026-05-01T21:30:00Z`, which is 00:30 on 2 May in Israel. Every default should be
  the tenant's day or month (`2026-05-02`), whatever the browser zone. This covers CLI-18, CLI-19,
  CLI-21 and CLI-25. Nothing in the client uses `vi.setSystemTime` today.
- **T-CLI-3, `DateTimePickerInput`.** With the browser on `America/New_York` and the tenant on
  `Asia/Jerusalem`:
  - typing `2026-05-01 01:30:00` submits `2026-04-30T22:30:00.000Z` (Israel time);
  - UI-1 and UI-2 are visible, and UI-2 names `01/05/2026`;
  - with the browser on the tenant zone, UI-2 is hidden.
  - Also: a time inside the 27 March 2026 Israeli spring-forward gap is rejected or flagged, not
    shifted silently.
- **T-CLI-4, instant display.** `formatInstant` gives the same string for the same instant and zone
  setting, and the tooltip names the zone.
- **T-CLI-5, calendar.** The "today" highlight follows the tenant day at `2026-05-01T21:30:00Z`.

### 6.4 Other packages

- **T-XP-1, GI-5.** In `packages/green-invoice-graphql/src/__tests__/mesh-client.test.ts`, mock
  `fetch` and assert the exact request body of `searchExpenseDrafts` for `fromDate: '2026-09-27'`.
  The current tests only check the response.
- **T-XP-2.** scraper-app and the gateway type-check against `string` date scalars after W4. The
  gateway rejects a non-RFC 3339 `receivedAt`.
- **T-XP-3.** The generators take an injected clock. The headers come out the same in every process
  zone.
- **T-XP-4.** modern-poalim-scraper and scraper-app tests run under the zone list. #4629 found 4 of
  the 14 Isracard / Amex tests fail under `TZ=America/New_York` today.

### 6.5 CI and guard rails

- **T-CI-1.**
  - Run the unit suites (`yarn test`) a second time with `TZ=America/New_York`, and a third with
    `TZ=Asia/Tokyo`, as a matrix job. That is cheap, and it is where every "west of UTC" and "east
    of UTC" bug above shows up. CI only uses UTC today, which hides all of them.
  - Run the integration suite once with the DB session on `Asia/Tokyo`.
- **T-LINT-1.** Add ESLint `no-restricted-syntax` rules for the patterns behind most findings:
  - `new Date(<string>)` outside an allow-listed helper;
  - `.toISOString().slice(0, 10)` and `.toISOString().split('T')`;
  - `toLocaleDateString` / `toLocaleString` without a `timeZone` option;
  - date-fns `format` on a string argument.

  Start as warnings, fix the hits, then make them errors.

- **Edge values**, as in #4629:
  - the 1st and last day of a month, 31 December → 1 January, 29 February;
  - instants between 21:00 and 24:00 UTC, which are already the next day in Israel;
  - the Israeli DST changes (27 March and 25 October 2026) and the US ones (8 March and 1 November
    2026).

## 7. Decisions needed

| ID  | Question                                                                                                                                   | Blocks          | Recommendation                                                                                                                                                                                                                                             |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------ | --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D-1 | What `TZ` does the production server run with, and what `TimeZone` do its DB sessions use? (#4629's M-11, the inventory's open question 1) | W1, W2          | Read both in production before W1 (`SHOW TimeZone;` and the process's `Intl.DateTimeFormat().resolvedOptions().timeZone`). The `USING` clauses in W2 depend on the answer.                                                                                 |
| D-2 | Is `misc_expenses.value_date` a day, or an instant?                                                                                        | W3, GQL-6       | The ledger only uses its day and its exchange-rate instant. If the time of day matters only for crypto rates, make it `value_date date` plus an optional `value_time timestamptz`; otherwise a `timestamptz` whose day is always taken in the tenant zone. |
| D-3 | Which zone shows audit and approval instants: the viewer's or the tenant's?                                                                | W7 (UI-6)       | The viewer's, with the zone in a tooltip ([3.4](#34-tenant-or-browser-the-display-policy)). Bookkeeping instants use the tenant's.                                                                                                                         |
| D-4 | How does the client learn the tenant zone?                                                                                                 | W7              | A `timezone: String!` field on `UserContext`, resolved from `getTenantTimeZone()` now and from `user_context` once it is per tenant. The client never hard-codes it.                                                                                       |
| D-5 | Deel: is the "PST sent as UTC" claim true? (#4629's M-8)                                                                                   | SRV-14          | As in #4629: compare with the Deel UI before changing anything.                                                                                                                                                                                            |
| D-6 | Is the Max purchase time (`deal_data_purchase_time`) Israeli local time? (#4629's M-7)                                                     | W2 for Max rows | Confirm with a capture, then convert with `Asia/Jerusalem`.                                                                                                                                                                                                |

## 8. Non-timezone bugs found along the way

None is fixed here. Listed so they aren't lost.

- **`pcnFile` throws "Invalid PCN874 content" when the content is valid.** It checks
  `if (validatePcn874(…))` at `packages/server/src/modules/reports/resolvers/pcn874.resolver.ts:31`,
  where `:85` correctly uses `!validatePcn874(…)`. The error is swallowed, so `pcnFile` never saves
  a snapshot; only `pcnByDate` does.
- **`DocumentDraft.date` is always null for drafts built from a Green Invoice document.**
  `convertGreenInvoiceDocumentToDocumentDraft` never maps `documentDate` to `date`
  (`packages/server/src/modules/green-invoice/helpers/green-invoice.helper.ts:1339-1371`).
- **Both chart "Clear" buttons throw a date-fns `RangeError`**, because they call
  `format(new Date(), 'yyyy-MM-DD')`
  (`packages/client/src/components/charts/chart-filters.tsx:134-135`,
  `packages/client/src/components/charts/monthly-income-expense/chart-filter.tsx:125-126`).
- **The salaries filter default has `fromDate` and `toDate` swapped**
  (`packages/client/src/components/salaries/salaries-filters.tsx:29-31`).
- **The charts page filters on `fromDate` / `toDate`, but its filter form edits `fromAnyDate` /
  `toAnyDate`** (`packages/client/src/components/charts/index.tsx:73-76` vs
  `packages/client/src/components/charts/chart-filters.tsx:43,70`).
- **The client's `TimelessDateString` type only allows the years 2000–2049**
  (`packages/client/src/helpers/dates.ts:19-27`). #4592 replaced the server's copy with a pattern
  type.
- From #4629, still open: Deel's empty `due_date` / `paid_at` values become `"Invalid Date"`, which
  Postgres rejects (DEEL-2, DEEL-3). Also ISR-1a and ANT-2 above.

## Appendix: probes

Run with Node 22, graphql-scalars 2.0.0 (server) and 1.26.0 (under `@graphql-mesh/transport-rest`),
pg 8.23 / pg-types, and date-fns 4. Each line was run under `TZ=UTC`, `Asia/Jerusalem`,
`America/New_York` and `Asia/Tokyo`, with modules resolved from the repo's `node_modules` through
`createRequire`. The script is not committed; each line below is a one-liner.

**`DateTime` scalar (server):**

| Input                                                      | Every zone                          |
| ---------------------------------------------------------- | ----------------------------------- |
| `DateTimeResolver.parseValue('2026-05-01T10:00:00Z')`      | `2026-05-01T10:00:00.000Z`          |
| `DateTimeResolver.parseValue('2026-05-01T10:00:00+03:00')` | `2026-05-01T07:00:00.000Z`          |
| `DateTimeResolver.parseValue('2026-05-01T10:00:00')`       | throws (`invalid date-time-string`) |
| `DateTimeResolver.parseValue('2026-05-01')`                | throws                              |
| `DateTimeResolver.serialize(new Date(…)) instanceof Date`  | `true`                              |

**Mesh `Date` scalar (Green Invoice), GI-5:**

| Input                                                                   | Every zone                                |
| ----------------------------------------------------------------------- | ----------------------------------------- |
| `JSON.stringify({ fromDate: resolvers.Date.parseValue('2026-09-27') })` | `{"fromDate":"2026-09-27T00:00:00.000Z"}` |
| `resolvers.Date.serialize('2026-09-27')`                                | `"2026-09-27"`                            |

**node-pg** (no database needed: these are the type parser and the parameter serializer node-pg
uses):

| Input                                                                         | UTC                             | Asia/Jerusalem                  | America/New_York                | Asia/Tokyo                      |
| ----------------------------------------------------------------------------- | ------------------------------- | ------------------------------- | ------------------------------- | ------------------------------- |
| `timestamp` `'2026-05-01 22:30:00'` read (`getTypeParser(1114)`)              | `2026-05-01T22:30:00.000Z`      | `2026-05-01T19:30:00.000Z`      | `2026-05-02T02:30:00.000Z`      | `2026-05-01T13:30:00.000Z`      |
| `timestamptz` `'2026-05-01 22:30:00+00'` read (`getTypeParser(1184)`)         | `2026-05-01T22:30:00.000Z`      | same                            | same                            | same                            |
| `Date('2026-05-01T22:30Z')` sent as a parameter (`pg/lib/utils.prepareValue`) | `2026-05-01T22:30:00.000+00:00` | `2026-05-02T01:30:00.000+03:00` | `2026-05-01T18:30:00.000-04:00` | `2026-05-02T07:30:00.000+09:00` |

The last row, written into a `timestamp` column, which drops the offset: that is SRV-2.

**Client patterns:**

| Expression                                                                     | UTC                        | Asia/Jerusalem             | America/New_York           | Asia/Tokyo                 |
| ------------------------------------------------------------------------------ | -------------------------- | -------------------------- | -------------------------- | -------------------------- |
| `format(new Date('2026-05-01'), 'yyyy-MM-dd')` (CLI-1 … CLI-4)                 | `2026-05-01`               | `2026-05-01`               | **`2026-04-30`**           | `2026-05-01`               |
| `format(new Date('2026-05'), 'yyyy-MM-dd')` (CLI-7)                            | `2026-05-01`               | `2026-05-01`               | **`2026-04-30`**           | `2026-05-01`               |
| `format(new Date('2026-05'), 'MMMM yyyy')` (CLI-6)                             | May 2026                   | May 2026                   | **April 2026**             | May 2026                   |
| `new Date('2026-05-01')` shown as local time (CLI-16)                          | `2026-05-01 00:00`         | `2026-05-01 03:00`         | **`2026-04-30 20:00`**     | `2026-05-01 09:00`         |
| Instant `2026-05-01T22:30Z`: `toISOString()` day vs local day (CLI-18, CLI-19) | `05-01` / `05-01`          | **`05-01`** / `05-02`      | `05-01` / `05-01`          | **`05-01`** / `05-02`      |
| `parse('2026-05-01 01:30:00', …)` then `toISOString()` (CLI-20)                | `2026-05-01T01:30:00.000Z` | `2026-04-30T22:30:00.000Z` | `2026-05-01T05:30:00.000Z` | `2026-04-30T16:30:00.000Z` |

The same typed time is four different instants, depending only on the browser (CLI-20).

**How the rest was produced.**

- **Server, client and other packages:** read on `main` at `abd0493`. Every `DateTime` /
  `TimelessDate` field, every `new Date(`, `format(`, `toLocale*`, `toISOString`, `now()` /
  `CURRENT_TIMESTAMP` and day / instant helper call was searched for in `packages/server`,
  `packages/client` and the other packages, and each hit was read in context.
- **Column types:** from the migrations.
- **References:** every `path:line` in this doc was checked to point at an existing line.
