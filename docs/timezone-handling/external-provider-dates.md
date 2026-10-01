# External provider dates: intake map

Part of [#4560](https://github.com/Urigo/accounter-fullstack/issues/4560) (timezone handling). The
[date fields inventory](./date-fields-inventory.md) (added in
[#4568](https://github.com/Urigo/accounter-fullstack/pull/4568)) lists where dates are stored and
how the API types them. This doc covers the other end: every date that **arrives from an external
provider**, followed from the raw payload to the column it ends up in.

Each case is checked against the two rules below. The doc maps and classifies; it does not propose
fixes. When the timezone a provider's date carries is not proven, the case is flagged for a **manual
check** (M-1 … M-12) instead of being given a guessed answer, and it should only be fixed once that
check is done.

Covered:

- every scraper-app source: Bank Hapoalim, Isracard, Amex, Cal, Discount, Max and Otsar Hahayal (all
  through modern-poalim-scraper), and Bank of Israel exchange rates
- every date-carrying provider under `packages/server/src/modules/app-providers`: Green Invoice,
  Deel, Anthropic (OCR) and CoinMarketCap
- Hashavshevet
- in less detail: the Kraken, Etherscan and Etana scrapers, email ingestion, and the MCP server

There is no Coinbase integration in the repo (`'coinbase'` only appears as a Deel payment-method
value). The crypto rate source under `app-providers` is CoinMarketCap, covered as CMC-1.

## The two checks

- **A. Date-only values.** A calendar day must be stored as that same day, whatever timezone the
  scraper machine, the server or the database runs in.
  - Passes if the value stays a `yyyy-mm-dd` string (`TimelessDateString`) or reaches a Postgres
    `date` by a path that cannot shift it.
  - Fails if the value goes through a JS `Date` built at UTC midnight, through `toISOString()`, or
    into a `timestamp` / `timestamptz` column.
- **B. Values with a time.** The instant must be stored as the instant the provider meant.
  - Passes if the source's timezone is proven (see the next section) and kept all the way into a
    `timestamptz` column.
  - Fails, or needs a manual check, when:
    - the value has no offset and our code or the database fills one in;
    - a `Z` from a third party may really be Israel local time;
    - the answer depends on where the request came from.

Turning an instant into a day also needs a timezone: a debit timestamp into a debit date, or an
invoice time into a document date. The doc records which clock does that today. Which zone _should_
define the day is a decision, listed as M-12.

## How a source's timezone is established

| Evidence        | What it means                                                                                                                       | How the doc treats it                                                                                                                       |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| **Shape**       | A date-only shape: `yyyymmdd`, `dd/mm/yyyy`, `yyyy-mm-dd`, or a datetime whose time the schema forces to `00:00:00`.                | A calendar day. No zone is involved as long as we keep the digits.                                                                          |
| **Contract**    | The provider's schema declares the shape, e.g. Green Invoice `format: date`.                                                        | As declared.                                                                                                                                |
| **Offset**      | The value carries an explicit offset that follows the source's local time, e.g. Poalim's `+02:00` in winter and `+03:00` in summer. | Proven.                                                                                                                                     |
| **Epoch**       | Unix seconds or milliseconds.                                                                                                       | A proven UTC instant.                                                                                                                       |
| **Our clock**   | Accounter code created the value, e.g. the email worker's `new Date().toISOString()`.                                               | Proven.                                                                                                                                     |
| **Claimed UTC** | A value ending in `Z` that comes from a third party.                                                                                | Not proof on its own: a `Z` on what is really Israel local time is the distortion #4560 is about. 🔍 until compared with the provider's UI. |
| **None**        | No offset and a free time of day, or an unknown format.                                                                             | 🔍                                                                                                                                          |

Marks used on every case (a case can carry several):

- ✅ **Safe:** the code, checked against the conversion rules below, shows that no clock can shift
  the value.
- ⚠️ **Our code depends on a clock**, named in the case. This is certain from our own code, whatever
  the source means.
- 🔍 **Manual check:** the source's timezone, format or meaning is not proven. Do not fix it until
  the check is done.
- 🐞 **Wrong for a reason other than timezone.**

## The clocks our code can depend on

Nothing in the repo pins a timezone. A repo-wide search finds no `TZ`, `PGTZ`, session `TimeZone`,
pg `parseInputDatesAsUTC` or pg type parser, and no scraper calls Puppeteer's
`page.emulateTimezone`. So each of these four clocks is whatever its machine has:

- **Scraper machine.** scraper-app and its Chromium run on the user's own computer. This is the
  "requester location": the same scrape run from Tel Aviv and from New York can request different
  ranges and store different days.
- **Server process:** the `TZ` of the GraphQL server.
- **DB session:** the `TimeZone` of the Postgres connection, which is the server's default when the
  connection doesn't set one.
- **Browser:** only matters where a client form feeds a provider, e.g. Green Invoice document
  issuing.

## Conversion rules

These are the behaviours of our own stack that the cases refer to. Each was run with Node's `TZ`, or
the Postgres session `TimeZone`, set to `UTC`, `Asia/Jerusalem`, `America/New_York` and
`Asia/Tokyo`. The versions were Postgres 16.13, node-pg 8.23.0, pg-promise 12.7.1, date-fns 4.4.0
and Node 22. CI and the dev compose file use Postgres 18, so re-run the probes in the
[appendix](#appendix-probes) there before relying on R1–R6 and R11.

| Rule | Behaviour                                                                                                                                                                                                         | Observed                                                                                                                                                                                                    |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1   | A `'yyyy-mm-dd'` string into a `date` column keeps the day.                                                                                                                                                       | `2024-01-15` in every session zone.                                                                                                                                                                         |
| R2   | node-pg sends a JS `Date` parameter as **process-local time with an offset**. pg-promise, used by the Kraken, Etherscan and Etana scrapers, calls the same serializer (`pgUtils.prepareValue`).                   | `new Date('2024-01-15')` is sent as `2024-01-15T02:00:00.000+02:00` (Jerusalem) and as `2024-01-14T19:00:00.000-05:00` (New York).                                                                          |
| R3   | A string with a time, with or without an offset or `Z`, cast to `date`, keeps the **date part as written** and drops the rest. Together with R2, a `Date` sent into a `date` column stores the process-local day. | `2024-01-15T00:00:00+02:00` and `2024-01-15T00:00:00` give `2024-01-15`, and `2024-01-14T22:00:00Z` gives `2024-01-14`, in every session zone.                                                              |
| R4   | A string with an offset, cast to `timestamp` (without time zone), drops the offset.                                                                                                                               | `2024-01-14T22:00:00Z` gives `2024-01-14 22:00:00`.                                                                                                                                                         |
| R5   | A string with no offset, cast to `timestamptz`, is read in the **DB session zone**.                                                                                                                               | `2024-01-15T00:00:00` is `00:00Z` (UTC), `22:00Z` on the 14th (Jerusalem), `05:00Z` (New York), `15:00Z` on the 14th (Tokyo).                                                                               |
| R6   | `timestamptz::date`, and `to_timestamp(epoch)` stored into a `timestamp` column, both follow the **DB session zone**.                                                                                             | Epoch `1705271400` (`2024-01-14T22:30Z`) gives day 14 in UTC and New York, and day 15 in Jerusalem and Tokyo.                                                                                               |
| R7   | node-pg reads `date` as process-local midnight, `timestamp` as process-local wall-clock time, and `timestamptz` as the exact instant.                                                                             | The `timestamp` `2024-01-15 00:30` is read as `00:30Z` in UTC and as `22:30Z` on the 14th in Jerusalem.                                                                                                     |
| R8   | `new Date('yyyy-mm-dd')` is UTC midnight. `new Date('yyyy-mm-ddT00:00:00')` (no offset) and `new Date(y, m, d)` are process-local. Impossible dates roll over instead of failing.                                 | `new Date('2024-01-15')` falls on the 14th in New York. `new Date('2026-02-30')` gives 2 March.                                                                                                             |
| R9   | date-fns v4 `format`, `startOfMonth`, `addMonths` and `parse(…, new Date())` work in process-local time, and a string argument goes through `new Date(str)` (R8).                                                 | `startOfMonth('2024-01-01')` gives `2023-12-01` in New York.                                                                                                                                                |
| R10  | `toISOString()` and `getUTC*` give the UTC day.                                                                                                                                                                   | Local midnight on the 15th gives `2024-01-14` in Jerusalem and Tokyo.                                                                                                                                       |
| R11  | `to_date(text, 'DD/MM/YYYY')` does not depend on timezone, but it does depend on the input's shape.                                                                                                               | `15/01/2024`, `05/01/2024` and `5/1/2024` parse correctly. `15/01/24` gives **`0024-01-15`**, with no error. `2024-01-15`, `20240115` and `2024-01-15T00:00:00` raise `date/time field value out of range`. |
| R12  | The scraper's Chromium runs in the scraper machine's zone, because nothing calls `page.emulateTimezone`.                                                                                                          | Not probed. Covered by M-1.                                                                                                                                                                                 |

Two shared helpers in `packages/server/src/shared/helpers/misc.ts` show up in many cases:

- `dateToTimelessDateString` (`packages/server/src/shared/helpers/misc.ts:200-202`) is
  `format(date, 'yyyy-MM-dd')`, in process-local time.
- `timelessDateStringToLocalDate` (`packages/server/src/shared/helpers/misc.ts:211-214`) builds
  process-local midnight.

Together they round-trip in every zone. Fed a UTC-midnight `Date` instead,
`dateToTimelessDateString(new Date('2024-01-15'))` gives `2024-01-14` in New York (R8 + R9).

## Summary

Priority: **P1** means the stored data can be wrong or missing today in a realistic setup (an
Israel-time or western scraper machine). **P2** means it is wrong only under a server, DB or scraper
clock that nothing pins, or it is blocked on a manual check. **P3** means only reports, change
detection or labels are affected. The "Check" column is A, B, "range" for the request windows, or
"?" when the value's meaning is not known yet.

| Case   | Source and field                                                                  | Check | Evidence    | Marks    | What can go wrong                                                                                                              | Manual check | Priority |
| ------ | --------------------------------------------------------------------------------- | ----- | ----------- | -------- | ------------------------------------------------------------------------------------------------------------------------------ | ------------ | -------- |
| WIN-1  | scraper-app UI default "from" date                                                | range | Our clock   | ⚠️       | The scraper machine's clock: Israel and Tokyo send the previous day.                                                           | —            | P3       |
| WIN-2  | scraper-app server range parse                                                    | range | Our clock   | ⚠️       | The scraper machine's clock: `new Date('yyyy-mm-dd')` (R8) feeds WIN-3 to WIN-8.                                               | —            | P2       |
| WIN-3  | Isracard / Amex / Cal / Discount month lists                                      | range | Our clock   | ⚠️       | West of UTC, a custom range ending on the 1st **drops its last month**, and every range gets an extra month at the start.      | —            | P2       |
| WIN-4  | Poalim account window                                                             | range | Our clock   | ⚠️       | UTC days: between 00:00 and 02:00/03:00 Israel time the end date is yesterday.                                                 | —            | P3       |
| WIN-5  | Poalim securities window                                                          | range | Our clock   | ⚠️       | West of UTC both ends move a day earlier: an extra day at the start, and a custom end loses its last day.                      | —            | P2       |
| WIN-6  | Max month list                                                                    | range | Our clock   | ⚠️       | West of UTC one extra month at the start.                                                                                      | —            | P3       |
| WIN-7  | Otsar ILS / foreign range                                                         | range | Our clock   | ⚠️       | West of UTC a custom range **drops its last day** and starts a day early.                                                      | —            | P2       |
| WIN-8  | Bank of Israel "today" and range filter                                           | range | Our clock   | ⚠️       | The edge days follow the scraper machine's clock.                                                                              | —            | P3       |
| WIN-9  | Bank answers vs the machine's zone                                                | B     | None        | 🔍       | Whether any bank's response changes with the scraper machine's zone (R12).                                                     | M-1          | P2       |
| POA-1  | Poalim ILS `eventDate`, `valueDate`                                               | A     | Shape       | ✅ ⚠️    | Stored correctly. The change report breaks on a server west of UTC.                                                            | —            | P3       |
| POA-2  | Poalim foreign `executingDate`, `valueDate`, `validityDate`                       | A     | Shape       | ✅ ⚠️    | Same as POA-1.                                                                                                                 | —            | P3       |
| POA-3  | Poalim SWIFT `formattedStartDate`                                                 | A     | Claimed UTC | 🔍       | Stored as the UTC date part. Is the `Z` real UTC, or Israel midnight?                                                          | M-2          | P2       |
| POA-4  | Poalim securities info `-AsOfDate`                                                | B     | Offset      | ✅ ⚠️ 🔍 | Stored correctly when the offset is present, but the schema doesn't require one. The summary label uses the server's clock.    | M-3          | P3       |
| POA-5  | Poalim securities transaction dates                                               | A     | Offset      | ✅       | The reference pattern.                                                                                                         | —            | —        |
| ISR-1  | Isracard / Amex `fullPurchaseDate`, `fullPurchaseDateOutbound`, `fullPaymentDate` | A     | Shape       | ✅ 🐞 🔍 | `dd/mm/yyyy` is fine. `dd/mm/yy`, which the schema allows, becomes year 0024 (R11).                                            | M-4          | P2       |
| CAL-1  | Cal `trnPurchaseDate`, `debCrdDate`                                               | A     | None        | 🔍       | The trigger only accepts `dd/mm/yyyy`; any other shape is rejected (R11).                                                      | M-5          | P1       |
| DSC-1  | Discount `OperationDate`, `ValueDate`                                             | A     | None        | 🔍       | Same as CAL-1.                                                                                                                 | M-6          | P1       |
| MAX-1  | Max `purchaseDate`, `paymentDate`, `processingDate`                               | A     | None        | ✅ 🔍    | Fine if the time is always `00:00:00`. The schema does not force that.                                                         | M-7          | P3       |
| MAX-2  | Max installment `purchaseDate` rewrite                                            | A     | Our clock   | ⚠️       | **A day early on machines east of UTC, Israel included.** Duplicates when machines in different zones scrape the same account. | —            | P1       |
| MAX-3  | Max `debit_timestamp`                                                             | B     | None        | 🔍       | Combines the debit date with the purchase time of day, and has no zone.                                                        | M-7          | P3       |
| OTS-1  | Otsar ILS `dateOfBusinessDay`, `dateOfRegistration`                               | A     | Shape       | ⚠️       | Stored as `timestamptz`. The day and the dedup key depend on the DB session; the lookups depend on the server.                 | —            | P2       |
| OTS-2  | Otsar foreign `valueDate`, `date`                                                 | A     | Shape       | ⚠️       | Excel-serial values come out a day early on a machine west of UTC. The lookups depend on the server.                           | —            | P2       |
| OTS-3  | Otsar credit card month request (`date`, `chargeDate`)                            | A     | Shape       | ✅ ⚠️ 🐞 | West of UTC it **requests the previous billing month**. The change report always flags `charge_date`.                          | —            | P1       |
| BOI-1  | Bank of Israel `@_TIME_PERIOD`                                                    | A     | Shape       | ✅ ⚠️    | Stored correctly. The change report breaks on a server west of UTC.                                                            | —            | P3       |
| GI-1   | Green Invoice `documentDate`                                                      | A     | Contract    | ✅       | A string from end to end.                                                                                                      | —            | —        |
| GI-2   | Green Invoice `creationDate`, `lastUpdateDate`                                    | B     | Epoch       | ✅       | Only used for sorting and filtering.                                                                                           | —            | —        |
| GI-3   | Green Invoice `payment[].date`                                                    | A     | None        | ✅       | Passed through as a string to the issuing draft.                                                                               | —            | —        |
| GI-4   | Dates we send when issuing (they come back as GI-1)                               | A     | Our clock   | ⚠️ 🔍    | "Today" defaults follow the server's or the browser's clock. `firstPayment` gets a unix time.                                  | M-10, M-12   | P2       |
| DEEL-1 | Deel `issued_at` (into `deel_invoices` and `documents.date`)                      | B     | Claimed UTC | 🔍 ⚠️    | A fixed +7h "fix" is applied on top of an unverified source claim.                                                             | M-8          | P2       |
| DEEL-2 | Deel `due_date`                                                                   | B     | Claimed UTC | 🔍 🐞    | Same as DEEL-1. An empty value becomes `"Invalid Date"`, which Postgres rejects.                                               | M-8          | P2       |
| DEEL-3 | Deel `created_at`, `paid_at`, `approve_date`                                      | B     | Claimed UTC | 🔍 🐞    | Stored as sent. An empty `paid_at` is rejected by Postgres.                                                                    | M-8          | P2       |
| DEEL-4 | Deel `contract_start_date`, and `addDeelContract`                                 | A     | Claimed UTC | ⚠️ 🔍    | A day stored as `timestamptz`. Our own `TimelessDate` input is read in the DB session zone (R5).                               | M-8          | P3       |
| DEEL-5 | Deel receipt `timezone`                                                           | —     | Offset      | —        | Ignored today. Input for M-8.                                                                                                  | M-8          | —        |
| DEEL-6 | Deel invoice lookup by document date                                              | A     | Our clock   | ⚠️       | Matches only when the server's day equals the stored UTC day.                                                                  | —            | P3       |
| HSV-1  | Hashavshevet                                                                      | —     | —           | —        | Not wired up; no dates arrive.                                                                                                 | —            | —        |
| ANT-1  | Anthropic OCR `date`                                                              | A     | None        | ⚠️ 🐞    | A day early on a server west of UTC. Impossible dates roll over (R8).                                                          | —            | P2       |
| CMC-1  | CoinMarketCap rate points                                                         | B     | Epoch       | ⚠️ 🔍    | The window and the stored key follow the server's clock and the caller's style.                                                | M-12         | P2       |
| KRK-1  | Kraken ledger and trade time                                                      | B     | Epoch       | ⚠️ 🔍    | Wall-clock time and the transaction day follow the DB session.                                                                 | M-12         | P2       |
| ETH-1  | Etherscan `timeStamp`                                                             | B     | Epoch       | ⚠️ 🔍    | Two different clocks for one row: the DB session and the scraper machine.                                                      | M-12         | P2       |
| ETA-1  | Etana CSV time                                                                    | ?     | None        | ⚠️ 🔍    | Unknown format, parsed in the scraper machine's zone.                                                                          | M-9          | P2       |
| EML-1  | Email `receivedAt`                                                                | B     | Our clock   | ✅ 🔍    | The instant is right. The description label shows the UTC day.                                                                 | M-12         | P3       |
| MCP-1  | MCP server date arguments                                                         | A     | Shape       | ✅       | Strict calendar-date validation, forwarded as strings.                                                                         | —            | —        |

## Manual checks

Each check names what to capture, how to decide, and what waits on the answer. Use rows near
midnight, rows on the 1st and last day of a month, and rows around Israel and US daylight-saving
changes. Store any captured sample redacted, as a test fixture.

- **M-1 Does any bank answer differently depending on the machine's zone?**
  - Capture: on the same day, run every scraper-app source twice with the same accounts and an
    explicit range, once under `TZ=Asia/Jerusalem` and once under `TZ=America/New_York`. Diff the
    raw payloads.
  - Decides: any difference other than the requested window means the bank's answer depends on the
    browser's zone (R12).
  - Waits on it: WIN-9, and whether scraper-app should pin its own `TZ` and call
    `page.emulateTimezone`.
- **M-2 Poalim SWIFT `formattedStartDate`.**
  - Capture: a few transfers, especially ones started late in the evening. Compare the raw string
    with the date the bank UI shows.
  - Decides:
    - If the raw value is `…T00:00:00Z` on the same date the UI shows, it is a calendar day with a
      `Z` attached, and storing its date part is right.
    - If it is `…T21:00:00Z` or `…T22:00:00Z` on the day before the UI's date, it is Israel midnight
      as a real UTC instant, and storing its date part (R3) gives the previous day.
    - Any other pattern needs a closer look before anything changes.
  - Also capture the foreign account's `formattedValueDate`. The fee-matching trigger compares the
    two as text, and the synthetic fixtures use `dd/mm/yyyy` for that field.
  - Waits on it: POA-3.
- **M-3 Poalim securities `-AsOfDate`.** Confirm it always carries an offset. The schema accepts any
  string, and a value without an offset would be read in the DB session zone (R5). Waits on it:
  POA-4.
- **M-4 Isracard / Amex 2-digit years.** Does the bank ever send `fullPurchaseDate` as `dd/mm/yy`?
  The schema allows it, and the trigger would store year 0024 (R11). Waits on it: ISR-1.
- **M-5 Cal date format.**
  - Capture the raw `trnPurchaseDate` and `debCrdDate`. Check whether Cal uploads succeed today.
  - The test fixtures use `yyyy-mm-dd`, and the legacy app wrote `yyyy-MM-dd`, but the trigger only
    accepts `dd/mm/yyyy` and rejects ISO and `yyyymmdd` with an error (R11).
  - Waits on it: CAL-1.
- **M-6 Discount date format.** Same as M-5, for `OperationDate` and `ValueDate`. The fixtures use
  `yyyymmdd`. Waits on it: DSC-1.
- **M-7 Max times.**
  - Is the time part of `purchaseDate`, `paymentDate` and `processingDate` ever anything other than
    `00:00:00`?
  - Which zone is `purchaseTime` (`HH:MM`) in?
  - What should `debit_timestamp` mean for Max?
  - Waits on it: MAX-1, MAX-3.
- **M-8 Deel timestamps.**
  - Compare `issued_at`, `due_date`, `paid_at`, `created_at`, `approve_date` and
    `contract_start_date` with the Deel UI and the invoice PDFs, for invoices issued late in the
    day. Use the receipt `timezone` field (DEEL-5) as a hint.
  - Decides: whether the code comment "Deel API returning PST dates as UTC dates" is true. If it is
    true, a fixed +7h is right only in US summer time (PDT is UTC−7) and an hour short in winter
    (PST is UTC−8). If it is false, the +7h shifts correct values.
  - Also decide whether `contract_start_date` is a day or an instant.
  - Waits on it: DEEL-1 to DEEL-4.
- **M-9 Etana CSV time column.** Capture the raw column-3 value: its format, and whether it has an
  offset. Waits on it: ETA-1.
- **M-10 Green Invoice `firstPayment`.** The Green Invoice schema describes it as "Credit card's
  first payment", a number with the example `10`. Our code sends a unix time there. Check the Green
  Invoice API docs to see whether it is an amount or a date. Waits on it: GI-4.
- **M-11 Production clocks.** Read the production server's `TZ` and the database's `TimeZone` (the
  same open question as in the inventory). The ⚠️ server and DB-session cases depend on them in
  different ways:
  - some break only west of UTC (POA-1, POA-2, BOI-1, ANT-1);
  - some break whenever the zone isn't UTC (CMC-1);
  - some break whenever the server and DB zones differ, or the DB zone changes (OTS-1).
- **M-12 Which zone defines the day?** This is a decision, not a payload check. When an instant
  becomes a day, which zone should decide the day? This applies to:
  - the Kraken and Etherscan transaction day
  - the day a CoinMarketCap sample counts for
  - the Deel `issued_at` used as `documents.date`
  - the Max `debit_timestamp`
  - the email description label
  - "today" as a default document date

  Waits on it: CMC-1, KRK-1, ETH-1, EML-1, GI-4.

## Cases

### scraper-app sources (modern-poalim-scraper)

#### Scrape windows: what we ask the provider for

These decide which rows arrive at all. All of them run on the scraper machine.

- **WIN-1: UI default "from" date.** `packages/scraper-app/src/ui/screens/run.tsx:91-93` builds
  local midnight _months_ ago, then sends `toISOString().split('T')[0]`, which is the UTC day (R10).
  East of UTC that is always the previous day: on 1 Oct 2026, with 3 months, it sends `2026-06-30`
  from Jerusalem and Tokyo, and `2026-07-01` from UTC and New York. ⚠️ scraper machine.
- **WIN-2: server-side parse.** `packages/scraper-app/src/server/websocket.ts:817-825` turns the
  strings into `new Date(msg.dateTo)` / `new Date(msg.dateFrom)`, which are UTC midnight (R8). The
  fallback builds the range with local getters. In New York, `2026-07-01` becomes 30 June, 20:00
  local time, and every scraper below receives that. ⚠️ scraper machine.
- **WIN-3: month lists** for Isracard, Amex, Cal and Discount:
  - Code: `buildMonthList` in `packages/scraper-app/src/server/scrapers/isracard.ts:17-26`,
    `packages/scraper-app/src/server/scrapers/amex.ts:18-27`,
    `packages/scraper-app/src/server/scrapers/cal.ts:13-22` and
    `packages/scraper-app/src/server/scrapers/discount.ts:13-22`. It runs the local `startOfMonth`
    and `addMonths` (R9) on WIN-2's UTC-midnight dates.
  - Observed for 1 Jan – 1 Mar 2024: Isracard asks for `2024-01…2024-04` in UTC and for
    `2023-12…2024-03` in New York. Amex, Cal and Discount ask for `2024-01…2024-03` in UTC and for
    `2023-12…2024-02` in New York.
  - So west of UTC, **when a custom range ends on the 1st, its last month is not requested.** The
    default range ends now, in local time, so that end is not affected. ⚠️ scraper machine.
- **WIN-4: Poalim account window.**
  - `packages/scraper-app/src/server/scrapers/poalim.ts:93-98` only turns the range into a number of
    months.
  - The bank window itself is built in
    `packages/modern-poalim-scraper/src/scrapers/hapoalim.ts:224-228` from `now`, with
    `toISOString()` days (R10).
  - At 00:30 Israel time the end date is yesterday (`20260930` on 1 Oct). ⚠️ scraper machine.
- **WIN-5: Poalim securities window.** `toMytradeDateString`
  (`packages/modern-poalim-scraper/src/scrapers/hapoalim.ts:232-233`) formats WIN-2's dates with
  local getters. In New York both ends move one day earlier: `2024-01-01` becomes `31122023`, an
  extra day, and a custom end date loses its last day. ⚠️ scraper machine.
- **WIN-6: Max month list.** `getAllMonthDates`
  (`packages/modern-poalim-scraper/src/scrapers/max.ts:229-245`) runs the local `startOfMonth` (R9)
  on WIN-2's date, ignores `dateTo`, and always adds 2 future months. ⚠️ scraper machine; the window
  only gets wider.
- **WIN-7: Otsar Hahayal ILS and foreign range.**
  - `packages/scraper-app/src/server/scrapers/otsar-hahayal.ts:79-80` sends `toISOString()`.
  - `packages/modern-poalim-scraper/src/scrapers/otsar-hahayal/ils-transactions.ts:119-125` and
    `packages/modern-poalim-scraper/src/scrapers/otsar-hahayal/foreign-transactions.ts:165-171`
    parse it back and `format` it in local time.
  - In New York, `2024-01-01` becomes `2023-12-31`, and a custom end date of `2024-03-31` becomes
    `2024-03-30`, so **the last day is dropped.** ⚠️ scraper machine.
- **WIN-8: Bank of Israel rates.** `packages/scraper-app/src/server/scrapers/currency-rates.ts:36`
  computes `today` in local time and drops rates dated today or later. `:54-56` filters by the
  local-formatted range. ⚠️ scraper machine; only the edge days are affected.
- **WIN-9: the bank's own answers.** No scraper pins the browser's zone (R12). Whether any bank's
  web app computes or filters dates in the browser is unknown. 🔍 M-1.

#### Bank Hapoalim

- **POA-1: ILS `eventDate`, `valueDate`.**
  - Raw: integer `yyyymmdd`, e.g. `20240115`
    (`packages/modern-poalim-scraper/src/zod-schemas/hapoalim-ils-checking-transactions-schema.ts:58,79`).
    Evidence: shape.
  - Path: `convertNumberDateToString` slices the digits
    (`packages/scraper-app/src/server/utils.ts:13-22`, called at
    `packages/scraper-app/src/server/graphql/mutations.ts:450,471`). The result goes into `date`
    columns (R1). The trigger sets both `event_date` and `debit_date` from
    `new.event_date::text::date`
    (`packages/migrations/src/actions/2026-07-08T17-00-00.poalim-ils-trigger-fix.ts:81-82`). ✅
  - The `formatted*` strings, `expandedEventDate` and `originalEventCreateDate` are stored as
    received and not converted.
  - Change report:
    - The server looks up existing rows with `new Date(eventDate)`, which is UTC midnight (R8), and
      builds its match keys with `dateToTimelessDateString` on the same value
      (`packages/server/src/modules/scraper-ingestion/providers/poalim-scraper-ingestion.provider.ts:1299,1337`).
    - On a server west of UTC, the lookup asks for the previous day (R2 + R3) and the keys don't
      match, so `changedTransactions` misses changes.
    - Inserts are unaffected, because deduplication uses the unique index on the stored values.
    - ⚠️ server.
- **POA-2: foreign `executingDate`, `valueDate`, `validityDate`.**
  - Raw: integer `yyyymmdd`
    (`packages/modern-poalim-scraper/src/zod-schemas/hapoalim-foreign-transactions-business-schema.ts:98,113-114`,
    `packages/modern-poalim-scraper/src/zod-schemas/hapoalim-foreign-transactions-personal-schema.ts:61,73-74`).
  - Path: the same slicing (`packages/scraper-app/src/server/graphql/mutations.ts:573,586-587`), and
    the trigger does `::text::date`
    (`packages/migrations/src/actions/2026-07-06T17-00-00.enhance-conversion-recognition.ts:83-84`).
    ✅
  - The change report has the same issue as POA-1
    (`packages/server/src/modules/scraper-ingestion/providers/poalim-scraper-ingestion.provider.ts:1371,1407`).
    ⚠️ server.
- **POA-3: SWIFT `formattedStartDate`.**
  - Raw: an ISO datetime that must end in `Z` (`z.string().datetime()`,
    `packages/modern-poalim-scraper/src/zod-schemas/swift-transactions-schema.ts:23`). Evidence:
    claimed UTC.
  - Path: stored as text. The trigger uses `NEW.formatted_start_date::DATE` for both dates, which
    keeps the UTC date part (R3)
    (`packages/migrations/src/actions/2026-02-19T17-00-00.update-scraper-triggers-according-to-rls-restrictions.ts:347-348`).
  - The trigger also matches the fee to a foreign-account row by comparing
    `s.formatted_value_date = NEW.formatted_start_date` as text (`:319`).
  - 🔍 M-2.
- **POA-4: securities info `-AsOfDate`.**
  - Raw: an instant with an offset, e.g. `2024-01-15T10:00:00.000+02:00` in the tests. The schema is
    a plain `z.string()`
    (`packages/scraper-app/src/server/payload-schemas/poalim-securities-info.schema.ts:39`).
  - Stored in `as_of_date TIMESTAMPTZ`
    (`packages/migrations/src/actions/2026-08-11T12-00-00.add-poalim-securities-table.ts:23`). ✅
    when the offset is present; 🔍 M-3.
  - The upload summary formats it with `dateToTimelessDateString`
    (`packages/server/src/modules/scraper-ingestion/providers/poalim-scraper-ingestion.provider.ts:1552`).
    ⚠️ server; label only.
- **POA-5: securities transaction dates**, which include `TradeDate`, `ValueDate` and
  `ExecutionDate`.
  - Raw: .NET timestamps such as `2026-08-11T00:00:00.0000000+03:00`. The schema comment records
    that every observed value is midnight, and the migration below records that the offset is the
    Israel one for that date. The offset is optional in the regex, and `ExecutionDate` uses the
    offset-less sentinel `0001-01-01…`
    (`packages/modern-poalim-scraper/src/zod-schemas/hapoalim-securities-transactions-schema.ts:83-90`).
    Evidence: offset.
  - Stored in `date` columns, so the bank's date part is kept (R3); see
    `packages/migrations/src/actions/2026-08-14T10-00-00.poalim-securities-transactions-calendar-dates.ts`.
  - The server compares them as strings with `toCalendarDate`
    (`packages/server/src/modules/scraper-ingestion/providers/poalim-scraper-ingestion.provider.ts:1076-1079,1616-1618`).
  - ✅ This is the **reference pattern** for the other cases.
  - One inaccuracy: the comment at `:1613-1615` says a `Date` "is serialised as a UTC instant"; it
    is actually sent as local time with an offset (R2). The conclusion it draws still holds.
- Poalim deposits: modern-poalim-scraper has schemas for them, but scraper-app doesn't upload them.

#### Isracard and Amex

- **ISR-1: `fullPurchaseDate`, `fullPurchaseDateOutbound`, `fullPaymentDate`.**
  - Raw: `dd/mm/yyyy`. For Israeli purchases, `fullPurchaseDate` may also be `dd/mm/yy`
    (`datePatternFlexible`,
    `packages/modern-poalim-scraper/src/zod-schemas/isracard-cards-transactions-list-schema.ts:8-10,134`).
    Evidence: shape.
  - Path: stored raw as text (`packages/scraper-app/src/server/graphql/mutations.ts:849,856,863`).
    The trigger uses `to_date(…, 'DD/MM/YYYY')`, for Isracard at
    `packages/migrations/src/actions/2026-02-19T17-00-00.update-scraper-triggers-according-to-rls-restrictions.ts:573-576`
    and for Amex at `:817-820`.
  - ✅ for `dd/mm/yyyy`. 🐞 `dd/mm/yy` is stored as year 0024 without any error (R11); 🔍 M-4.
  - The short `dd/mm` fields (`purchaseDate`, `paymentDate`) are stored as text and not used by the
    trigger.

#### Cal

- **CAL-1: `trnPurchaseDate`, `debCrdDate`.**
  - Raw: a string whose format isn't declared
    (`packages/modern-poalim-scraper/src/scrapers/types/cal/get-card-transactions-details.ts:36,41`).
    Evidence: none.
  - Path: forwarded unchanged into `varchar` columns
    (`packages/scraper-app/src/server/graphql/mutations.ts:959`,
    `packages/migrations/src/actions/2024-12-12T12-15-43.visa-cal.ts:16,21`). The trigger uses
    `to_date(…, 'DD/MM/YYYY')`
    (`packages/migrations/src/actions/2026-02-19T17-00-00.update-scraper-triggers-according-to-rls-restrictions.ts:656-657`).
  - The test fixtures use `yyyy-mm-dd`. The deprecated scraper-local-app wrote `yyyy-MM-dd`
    (`packages/scraper-local-app/src/scrapers/cal/cal-month.ts:122,127`).
  - Either shape makes the trigger fail with an error (R11). So either the real format is
    `dd/mm/yyyy`, or Cal rows are rejected today. 🔍 M-5.

#### Discount

- **DSC-1: `OperationDate`, `ValueDate`.**
  - Raw: a string whose format isn't declared
    (`packages/scraper-app/src/server/payload-schemas/discount.schema.ts:6-7`). The fixtures use
    `yyyymmdd`. Evidence: none.
  - Path: stored raw in `varchar` (`packages/scraper-app/src/server/graphql/mutations.ts:980-981`,
    `packages/migrations/src/actions/2024-12-26T12-15-43.bank-discount.ts:10-11`). The trigger uses
    `to_date(…, 'DD/MM/YYYY')`
    (`packages/migrations/src/actions/2026-02-19T17-00-00.update-scraper-triggers-according-to-rls-restrictions.ts:722-723`).
  - `yyyymmdd` would be rejected (R11). 🔍 M-6.

#### Max

- **MAX-1: `purchaseDate`, `paymentDate`, `processingDate`.**
  - Raw: ISO datetimes without an offset, e.g. `2024-01-01T00:00:00`. The schema is
    `z.iso.datetime({ local: true })`, which doesn't force midnight
    (`packages/scraper-app/src/server/payload-schemas/max.schema.ts:32,95,101`).
  - Stored in `date` columns, which keep the date part as written (R3); see
    `packages/migrations/src/actions/2025-01-21T21-50-26.add-max-creditcard-source.ts:47,82,88`. The
    trigger copies them into `event_date` / `debit_date`
    (`packages/migrations/src/actions/2026-02-19T17-00-00.update-scraper-triggers-according-to-rls-restrictions.ts:478-479`).
  - ✅ if the time is always midnight; 🔍 M-7.
- **MAX-2: installment purchase date.**
  - Code: for installment number _n_ > 1, `fixInstallments`
    (`packages/modern-poalim-scraper/src/scrapers/max.ts:115-129`, called from `prepareTransactions`
    at `:386-391`) runs `new Date(purchaseDate)` (process-local, R8), then `addMonths`, then
    `toISOString()` (R10).
  - The result keeps its `Z` through the payload schema and goes into the `date` column, which keeps
    the UTC date part (R3).
  - Observed for `2024-01-15T00:00:00`, third installment, expected `2024-03-15`:

    | Scraper machine zone | Sent                       | Stored       |
    | -------------------- | -------------------------- | ------------ |
    | UTC                  | `2024-03-15T00:00:00.000Z` | `2024-03-15` |
    | New York             | `2024-03-15T04:00:00.000Z` | `2024-03-15` |
    | Jerusalem            | `2024-03-14T22:00:00.000Z` | `2024-03-14` |
    | Tokyo                | `2024-03-14T15:00:00.000Z` | `2024-03-14` |

  - The column is part of the dedup key `(uid, arn, purchase_date, payment_date, original_amount)`
    (`packages/migrations/src/actions/2026-05-04T12-00-00.update-scraper-ingestion-unique-constraints.ts:42-43`).
    So the same installment scraped from machines in two zones is stored twice.
  - Rows that are not installments keep the bank's day.
  - The deprecated scraper-local-app re-formatted these strings in local time before storing them
    (`packages/scraper-local-app/src/scrapers/max.ts:316`); scraper-app forwards them raw.
  - ⚠️ scraper machine. This is certain from our own code, whatever the bank means.
- **MAX-3: `debit_timestamp`.** The trigger sets `NEW.payment_date + NEW.deal_data_purchase_time`
  (`packages/migrations/src/actions/2026-02-19T17-00-00.update-scraper-triggers-according-to-rls-restrictions.ts:484-485`).
  That is the debit day plus the purchase time of day (`HH:MM`), with no zone, stored in a
  `timestamp`. 🔍 M-7.

#### Otsar Hahayal

- **OTS-1: ILS `dateOfBusinessDay`, `dateOfRegistration`.**
  - Raw: `yyyy-mm-ddT00:00:00`. The schema forces midnight
    (`packages/modern-poalim-scraper/src/scrapers/otsar-hahayal/schemas.ts:3-5,511-512`), so the
    shape shows a calendar day.
  - Path: forwarded raw (`packages/scraper-app/src/server/graphql/mutations.ts:1110-1111`) into
    `TIMESTAMPTZ` columns
    (`packages/migrations/src/actions/2026-05-18T12-00-00.add-otsar-hahayal-tables.ts:25-26`). They
    are read in the DB session zone (R5).
  - The trigger casts them back with `::DATE`
    (`packages/migrations/src/actions/2026-06-02T10-00-00.otsar-hahayal-fee-flagging.ts:73-74`) in
    the same session, so the day survives (R6).
  - Check A fails on the column type, though:
    - The unique dedup index includes both `timestamptz` values
      (`packages/migrations/src/actions/2026-05-18T12-00-00.add-otsar-hahayal-tables.ts:55-56`). So
      a re-scrape after the DB session zone changes stores duplicates.
    - The server's lookups and keys use `new Date(…)` in the server's zone
      (`packages/server/src/modules/scraper-ingestion/providers/otsar-hahayal-scraper-ingestion.provider.ts:413,496-497`),
      so the change report breaks whenever the server and DB zones differ.
  - ⚠️ DB session, ⚠️ server.
- **OTS-2: foreign `valueDate`, `date`.**
  - Raw: an Excel serial number, or a `dd/MM/yyyy` string.
  - Path: `toTimelessDate`
    (`packages/modern-poalim-scraper/src/scrapers/otsar-hahayal/foreign-transactions.ts:31-43`)
    turns a serial into a UTC-midnight `Date` and then `format`s it in local time (`:36-37`).
    Observed: serial `45306` gives `2024-01-15` in UTC, Jerusalem and Tokyo, and `2024-01-14` in New
    York. ⚠️ scraper machine.
  - The string path (`:40`) is ✅. The values are stored as `DATE`
    (`packages/migrations/src/actions/2026-05-18T12-00-00.add-otsar-hahayal-tables.ts:78,84`).
  - The server's change lookups use `new Date('yyyy-mm-dd')`
    (`packages/server/src/modules/scraper-ingestion/providers/otsar-hahayal-scraper-ingestion.provider.ts:538,600-601`).
    ⚠️ server.
- **OTS-3: credit card `date`, `chargeDate`, and the billing-month request.**
  - Raw: `yyyy-mm-dd`
    (`packages/modern-poalim-scraper/src/scrapers/otsar-hahayal/schemas.ts:690-691`), stored as
    `DATE`. ✅
  - Billing-month request:
    - `monthsBetween` (`packages/scraper-app/src/server/scrapers/otsar-hahayal.ts:55-66`) builds
      month strings with local getters.
    - Each one is requested with `format(startOfMonth(month), 'yyyy-MM-dd')`
      (`packages/modern-poalim-scraper/src/scrapers/otsar-hahayal/credit-card-transactions.ts:38`).
      That runs `new Date('yyyy-mm-01')` (R9), so in New York every month asks for the one before.
    - For 1 Jan – 31 Mar it requests November to February: **March is never fetched.** ⚠️ scraper
      machine.
  - 🐞 The change report compares `String(Date)` with `'yyyy-mm-dd'`
    (`packages/server/src/modules/scraper-ingestion/providers/otsar-hahayal-scraper-ingestion.provider.ts:268`,
    `packages/server/src/modules/scraper-ingestion/helpers/utils.helper.ts:1-8`), so `charge_date`
    always shows as changed.
  - The change lookup uses `new Date('yyyy-mm-dd')`
    (`packages/server/src/modules/scraper-ingestion/providers/otsar-hahayal-scraper-ingestion.provider.ts:637`).
    ⚠️ server.

#### Bank of Israel exchange rates (scraper-app)

- **BOI-1: `@_TIME_PERIOD`.**
  - Raw: `yyyy-mm-dd` from the bank's SDMX XML
    (`packages/scraper-app/src/server/scrapers/currency-rates.ts:49`). Evidence: shape.
  - Path: pivoted as a string (`packages/scraper-app/src/server/graphql/mutations.ts:1180-1194`),
    passed as `CurrencyRateInput.exchangeDate: TimelessDate!`
    (`packages/server/src/modules/scraper-ingestion/typeDefs/scraper-ingestion.graphql.ts:593-594`),
    and stored in `exchange_rates.exchange_date date`. ✅
  - The change report uses `new Date(r.exchangeDate)`
    (`packages/server/src/modules/scraper-ingestion/providers/scraper-ingestion.provider.ts:532,567`).
    ⚠️ server.
  - The range filter has the WIN-8 issue.

### app-providers

#### Green Invoice

- **GI-1: `documentDate`.**
  - Raw: declared `format: date`
    (`packages/green-invoice-graphql/json-schemas/greenInvoice.json:2779-2783`). Evidence: contract.
  - The Mesh JSON-schema handler maps `format: date` to a `Date` scalar whose serialize and parse
    functions return the validated string unchanged. That is `getJSONSchemaStringFormatScalarMap.js`
    in `@omnigraph/json-schema`, and the generated types read
    `Date: { input: string; output: string }`.
  - Path: inserted as the string into `documents.date`
    (`packages/server/src/modules/green-invoice/helpers/green-invoice.helper.ts:1160`, R1). ✅
- **GI-2: `creationDate`, `lastUpdateDate`.** These are unix seconds
  (`packages/green-invoice-graphql/json-schemas/greenInvoice.json:2684-2688`).
  - `creationDate` is only used as a sort key
    (`packages/server/src/modules/green-invoice/helpers/green-invoice.helper.ts:1217`).
  - `addExpenseDraftByFile` also compares it with the upload time
    (`packages/server/src/modules/app-providers/green-invoice-client.ts:107,137`). That method has
    no callers.
  - ✅
- **GI-3: `payment[].date`.** A plain string, passed through into the issuing draft
  (`DocumentDraft`, GraphQL `String`). ✅ No conversion is applied.
- **GI-4: dates we send when issuing.** These come back to us as GI-1.
  - The issuing inputs `date`, `dueDate` and `payment.date` are GraphQL `String`, so they are not
    validated
    (`packages/server/src/modules/documents/typeDefs/documents-issuing.graphql.ts:54-55,87,165-166,225`).
  - The server fills "today" in its own zone:
    - `getDocumentDateOutOfTransactions` falls back to `dateToTimelessDateString(new Date())`
      (`packages/server/src/modules/documents/helpers/issue-document.helper.ts:255`).
    - `dueDate` uses `endOfMonth(new Date())`
      (`packages/server/src/modules/documents/resolvers/documents-issuing.resolver.ts:197,352`).
    - ⚠️ server.
  - The client defaults a new payment row to `new Date().toISOString().split('T')[0]`
    (`packages/client/src/components/common/forms/issue-document/payment-form.tsx:45`), which is the
    UTC day (R10). ⚠️ browser.
  - Payment dates taken from transactions use `dateToTimelessDateString(debit_date ?? event_date)`
    on pg `date` values
    (`packages/server/src/modules/documents/helpers/issue-document.helper.ts:132`). ✅
  - `firstPayment` is filled with `transaction.event_date.getTime() / 1000`
    (`packages/server/src/modules/documents/helpers/issue-document.helper.ts:93`), the unix time of
    a server-local midnight. The schema describes the field as "Credit card's first payment", a
    number with the example `10`
    (`packages/green-invoice-graphql/json-schemas/greenInvoice.json:2541-2545`). 🔍 M-10.
  - Which zone "today" should be is part of M-12.

#### Deel

- **DEEL-1: `issued_at`.**
  - Raw: ISO ending in `Z` (`z.iso.datetime()`,
    `packages/server/src/modules/app-providers/deel/schemas.ts:64-65`). Evidence: claimed UTC.
  - Path:
    - `timeZoneFix` (`packages/server/src/modules/app-providers/deel/deel-client.provider.ts:31-35`,
      applied at `:173-174`) adds a fixed 7 hours and returns `toUTCString()`, e.g.
      `Tue, 24 May 2022 16:38:46 GMT`. Postgres reads that correctly.
    - It goes into `deel_invoices.issued_at timestamptz`
      (`packages/migrations/src/actions/2025-03-19T12-05-43.deel-api-tables.ts:21`).
    - It also goes, as the same string, into `documents.date`
      (`packages/server/src/modules/deel/helpers/deel.helper.ts:197`), which keeps its UTC date part
      (R3).
  - 🔍 M-8. ⚠️ The fixed offset ignores daylight-saving time; see M-8.
- **DEEL-2: `due_date`.** Same path
  (`packages/server/src/modules/app-providers/deel/schemas.ts:22-23`,
  `packages/migrations/src/actions/2025-03-19T12-05-43.deel-api-tables.ts:19`). 🔍 M-8. 🐞 The
  schema allows `''`, which `timeZoneFix` turns into `"Invalid Date"`, and Postgres rejects that for
  a `NOT NULL timestamptz` column.
- **DEEL-3: `created_at`, `paid_at`, `approve_date`.**
  - Stored as sent in `timestamptz`
    (`packages/server/src/modules/deel/helpers/deel.helper.ts:249,261,278`). 🔍 M-8.
  - 🐞 `paid_at` may be `''` (`packages/server/src/modules/app-providers/deel/schemas.ts:74-75`) and
    is not turned into null, so Postgres rejects it for the `NOT NULL` column
    (`packages/migrations/src/actions/2025-03-19T12-05-43.deel-api-tables.ts:23`).
- **DEEL-4: `contract_start_date`.**
  - It means a day, but it arrives as an ISO instant
    (`packages/server/src/modules/app-providers/deel/schemas.ts:382-384`). It is stored in
    `timestamptz` in both `deel_invoices` and `deel_workers`
    (`packages/migrations/src/actions/2025-03-19T12-05-43.deel-api-tables.ts:35,69`).
  - `addDeelContract(contractStartDate: TimelessDate!)`
    (`packages/server/src/modules/deel/typeDefs/deel.graphql.ts:7`) inserts our own `yyyy-mm-dd`
    into that column (`packages/server/src/modules/deel/providers/deel-contracts.provider.ts:39`),
    so it becomes midnight in the DB session zone (R5).
  - ⚠️ DB session, 🔍 M-8.
- **DEEL-5: receipt `timezone`** ("Timezone offset in ISO 8601 format",
  `packages/server/src/modules/app-providers/deel/schemas.ts:332-335`). Parsed but not used. It is
  the best available hint for M-8.
- **DEEL-6: invoice lookup.**
  - `getDeelEmployeeId` queries invoices between the local `startOfDay` / `endOfDay` of the
    document's date.
  - It then compares `dateToTimelessDateString(r.issued_at)` (the server-local day) with that date
    (`packages/server/src/modules/deel/helpers/deel.helper.ts:64,67`), which is the UTC day from
    DEEL-1.
  - ⚠️ server.
- The outbound windows `date_from`, `date_to` and `issued_from_date` are computed from "today" in
  the server's zone (today, and a year before it)
  (`packages/server/src/modules/app-providers/deel/deel-client.provider.ts:63-64,142`). ⚠️ server;
  only the edge days are affected.

#### Hashavshevet

- **HSV-1.**
  - `@accounter/hashavshevet-mesh` is not a dependency of any other package, so no Hashavshevet date
    reaches Accounter today. On the server, `hashavshevet_name` is only a label on tax categories.
  - The package's query arguments take `yyyy/mm/dd` strings with defaults
    (`packages/hashavshevet-mesh/src/helpers/raw-input-adjuster.ts:234-263`).
  - If it is ever wired up: confirm the format, and keep its dates as strings (check A).

#### Anthropic (OCR)

- **ANT-1: `date` extracted from a document.**
  - Raw: whatever the model returns, checked only against `^\d{4}-\d{2}-\d{2}$`
    (`packages/server/src/modules/app-providers/anthropic.ts:59-65`). Evidence: none, but the value
    is meant as a day.
  - Path: `validateDate` does `new Date(value)`, which is UTC midnight (R8)
    (`packages/server/src/modules/documents/helpers/upload.helper.ts:132-136,165`). The `Date` is
    then sent into `documents.date` (`:266`), which stores the process-local day (R2 + R3).
  - Observed: `2024-01-15` is stored as `2024-01-15` in UTC, Jerusalem and Tokyo, and as
    `2024-01-14` in New York. ⚠️ server.
  - 🐞 `new Date('2026-02-30')` gives 2 March instead of failing, so an impossible date is moved
    rather than rejected.
  - The same path serves file uploads
    (`packages/server/src/modules/documents/resolvers/documents.resolver.ts:112,149`), imports from
    URLs and Google Drive (`:193,305`), and email ingestion
    (`packages/server/src/modules/email-ingestion/providers/email-ingestion-ingest.provider.ts:620,772`).

#### CoinMarketCap ("coinbase")

- **CMC-1: rate points.**
  - Raw: the points are keyed by unix seconds
    (`packages/server/src/modules/app-providers/coinmarketcap.ts:15-17,31`). Evidence: epoch. ✅
  - Request window: `to = date.getTime() / 1000` and `from = to − 23h`
    (`packages/server/src/modules/exchange-rates/providers/crypto-exchange.provider.ts:100-102`).
    The last point at or before `to` is used.
  - The callers' `date` differs in kind:
    - the exchange-rate resolver passes `new Date(timelessDate)`, which is UTC midnight
      (`packages/server/src/modules/exchange-rates/resolvers/exchange.resolver.ts:50,62,74`);
    - ledger generation passes pg `date` values, which are local midnight, e.g.
      `packages/server/src/modules/ledger/helpers/common-charge-ledger.helper.ts:109`.
  - In Jerusalem those two windows are two hours apart, so the same calendar day can get different
    samples.
  - Storage: the rate is stored with `date` and `sample_date` as `timestamp` without time zone
    (`packages/migrations/src/actions/2024-01-29T13-15-23.initial.ts:778,784`), so it keeps the
    server-local wall-clock time (R2 + R4). It is looked up by exact `date = $date` and cached by
    `date.getTime()`
    (`packages/server/src/modules/exchange-rates/providers/crypto-exchange.provider.ts:19-23,183-184`).
  - ⚠️ server. Which day a sample belongs to is part of M-12.

#### Google Drive and Cloudinary

No date fields. Drive is asked for `id,name,mimeType,kind`
(`packages/server/src/modules/app-providers/google-drive/google-drive.provider.ts:140`), and the
folder listing uses the default fields. Documents fetched from Drive go through ANT-1.

### Other sources

- **KRK-1: Kraken** (a standalone scraper that writes straight to the DB).
  - Raw: unix time. It is converted in SQL with `to_timestamp($n)`
    (`packages/kraken-scraper/src/store.ts:238,293`) and stored in `value_date TIMESTAMP`
    (`:187,211`), which keeps the DB session's wall-clock time (R6).
  - The trigger, which this package creates at runtime, sets `event_date` / `debit_date` from
    `value_date::text::date` and `debit_timestamp` from `value_date` (`:97-98,106,126-127,136`).
  - ⚠️ DB session. Which zone the day should come from is M-12.
- **ETH-1: Etherscan** (standalone).
  - Raw: `timeStamp` in unix seconds.
  - `event_date` is stored with `to_timestamp($11)` (`packages/etherscan-scraper/src/store.ts:204`),
    so it follows the DB session (R6).
  - `value_date` comes from `new Date(timeStamp * 1000)`
    (`packages/etherscan-scraper/src/etherscan.ts:59`), sent through pg-promise into a `DATE`, so it
    follows the scraper machine (R2 + R3).
  - The trigger takes the transaction dates from `value_date` and `debit_timestamp` from
    `event_date` (`packages/etherscan-scraper/src/store.ts:71-72,79,100-101,106`). ⚠️ Two clocks for
    one row.
  - M-12.
  - A latent issue, not about timezones: the scraper's own `CREATE TABLE IF NOT EXISTS` names the
    column `eventDate` (`:164`), while the insert writes `event_date` (`:191`). The migrations
    already create the table with `event_date`
    (`packages/migrations/src/actions/2024-01-29T13-15-23.initial.ts:596`), so this only matters on
    a database the migrations didn't set up.
- **ETA-1: Etana** (standalone).
  - Raw: CSV column 3, parsed with `new Date(input[3])` (`packages/etana-scraper/src/etana.ts:44`).
    Evidence: none.
  - Stored in `time DATE` (`packages/etana-scraper/src/store.ts:153`), which keeps the scraper
    machine's day (R2 + R3), and copied by the trigger with `::text::date` (`:99-100`).
  - ⚠️ scraper machine, 🔍 M-9.
- **EML-1: email ingestion.**
  - `receivedAt` is set by our own Cloudflare worker as `new Date().toISOString()`
    (`packages/email-ingestion-gateway/src/worker.ts:251`) and forwarded as a string. ✅
  - It is only used in the charge description, formatted with `timeZone: 'UTC'`
    (`packages/server/src/modules/email-ingestion/providers/email-ingestion-ingest.provider.ts:195-210`),
    so the label shows the UTC day. M-12.
  - Document dates from email come from ANT-1.
  - The `Date:` line of forwarded messages is parsed but deliberately not sent
    (`packages/email-ingestion-gateway/src/server-client.ts:87-90`).
- **MCP-1: MCP server arguments.**
  - Date arguments must match a strict `YYYY-MM-DD` (`TIMELESS_DATE`,
    `packages/mcp-server/src/tools/dates.ts:16-38`).
  - `parseCalendarDate` (same file) rejects impossible dates by round-tripping the parts through
    `Date.UTC`, e.g. in `packages/mcp-server/src/tools/charges.ts:169,176`.
  - The value is forwarded as a string. ✅
- **Not wired up, or rollback only:**
  - `israeli-vat-scraper` has no consumers. Its `parseDate` treats the 1-based month as a JS month
    (`packages/israeli-vat-scraper/src/utils/dates.ts:6,8`), but the result is only used for
    sorting.
  - `payper-mesh` is not a dependency of any package.
  - `gmail-listener` is rollback only.

## Test plan

Nothing here is implemented yet. It describes the tests each fix should land with, and the setup
they need.

### 1. Run the same tests in several timezones

- Add four projects to the root `vitest.config.ts`: `tz-utc`, `tz-jerusalem`, `tz-new-york` and
  `tz-tokyo`.
  - Each sets `test.env: { TZ: … }` and `include: ['packages/**/*.tz.test.ts']`.
  - None of them gets a `globalSetup`, so they run without a database, like the `client` project.
  - Exclude `**/*.tz.test.ts` from `unit`, so these tests don't also run in the host zone.
- Add a guard test that fails when the zone didn't apply:
  - `Intl.DateTimeFormat().resolvedOptions().timeZone` must match the project.
  - The January / July `getTimezoneOffset()` values must be `0/0` (UTC), `-120/-180` (Jerusalem),
    `300/240` (New York) and `-540/-540` (Tokyo).
  - If `test.env` turns out to apply too late, set `process.env.TZ` at the top of a per-project
    setup file instead. The guard shows which one works.
- Scripts and CI:
  - Add `test:tz` (`vitest run --project 'tz-*'`), and add the projects to `test` and
    `test:integration`.
  - CI picks them up on PRs through `yarn test:integration`
    (`.github/workflows/server-tests.yml:167`). The push-to-main command lists its projects
    explicitly (`:181`), so they have to be added there.
- Optional: add the extremes `Pacific/Kiritimati` (+14) and `Pacific/Pago_Pago` (−11). They catch
  code that only breaks more than three hours away from UTC.

### 2. How to write the expectations

- **⚠️ cases:** the expected value is the same in every zone, e.g. "the stored day is the day the
  provider sent". That needs no assumption about the source. The test fails in the zones where our
  code shifts the value today, and passes after the fix.
- **🔍 cases:** no test until the manual check is done. Then store the redacted sample as a fixture
  and take the expected value from it. The existing scraper tests use synthetic fixtures only; keep
  that rule for anything not captured this way.
- Use these edge values throughout:
  - the 1st and last day of a month, 31 Dec → 1 Jan, and 29 Feb 2024
  - Israel's DST changes (29 Mar and 27 Oct 2024) and the US ones (10 Mar and 3 Nov 2024)
  - instants between 21:00 and 23:59 UTC (already the next day in Israel), and between 00:00 and
    03:00 Israel time

### 3. Database rules and triggers

- **Rules:** add one integration test that runs the R1, R3–R6 and R11 probes from the appendix under
  `SET TIME ZONE` for each of the four zones.
- **Triggers:** every scraper-ingestion integration test disables triggers today:
  - `packages/server/src/modules/scraper-ingestion/providers/__tests__/poalim-scraper-ingestion.integration.test.ts:111`
  - `packages/server/src/modules/scraper-ingestion/providers/__tests__/isracard-amex-scraper-ingestion.integration.test.ts:52`
  - `packages/server/src/modules/scraper-ingestion/providers/__tests__/otsar-hahayal-scraper-ingestion.integration.test.ts:52`
  - `packages/server/src/modules/scraper-ingestion/providers/__tests__/scraper-ingestion.integration.test.ts:66`

  So none of the raw-row → `transactions` date conversions is covered. Add tests with triggers
  enabled that insert one raw row per source and check `transactions.event_date`, `debit_date` and
  `debit_timestamp`, under each session zone.

- **Node side:** R2 and R7 need the integration project run once under a non-UTC `TZ`, e.g.
  `TZ=America/New_York yarn test:integration` in a nightly job, because it needs Postgres.

### 4. Existing tests that already depend on the host zone

- The Isracard and Amex scraper tests build their ranges with `new Date('2024-01-01')`
  (`packages/scraper-app/src/server/scrapers/__tests__/isracard.test.ts:62-66`,
  `packages/scraper-app/src/server/scrapers/__tests__/amex.test.ts:62-66`).
  - They all pass under `TZ=UTC`. Under `TZ=America/New_York`, 4 of their 14 tests fail, because the
    scrapers fetch an extra December 2023 (WIN-3). For example, Amex fails with
    `expected "vi.fn()" to be called 3 times, but got 4 times`.
  - Command:
    `TZ=America/New_York yarn vitest run --config vitest.config.ts src/server/scrapers/__tests__/isracard.test.ts src/server/scrapers/__tests__/amex.test.ts`,
    run from `packages/scraper-app`.
- `packages/server/src/shared/helpers/__tests__/misc.test.ts:14` is titled "regardless of timezone",
  but it only runs in the host zone.

Moving these into the matrix unchanged makes them show the bug instead of hiding it.

### 5. Per-case tests

"Module-private" means the function would need an `export`, or to move into a helper, before it can
be tested directly.

| Test      | Case         | Level                                           | Blocked by                               | What it asserts                                                                                                                 |
| --------- | ------------ | ----------------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| T-WIN-3   | WIN-3        | unit, mocked scraper (as in `isracard.test.ts`) | `buildMonthList` is module-private       | The same month list in every zone, for ranges that end on the 1st and on the last day.                                          |
| T-WIN-7   | WIN-7        | unit, mocked page                               | —                                        | The Otsar `startDate` / `endDate` request strings for 1 Jan – 31 Mar.                                                           |
| T-WIN-4/5 | WIN-4, WIN-5 | unit, fake timers                               | —                                        | The Poalim window at 00:30 Israel time, and the securities `ddMMyyyy` strings.                                                  |
| T-POA-1   | POA-1, POA-2 | unit, plus integration under New York           | —                                        | `convertNumberDateToString`, and the change report finding an existing row.                                                     |
| T-POA-5   | POA-5        | unit                                            | `toCalendarDate` is module-private       | Keeps the date part, and leaves `0001-01-01…` untouched.                                                                        |
| T-ISR-1   | ISR-1        | trigger integration                             | M-4, for the expectation on `dd/mm/yy`   | `dd/mm/yyyy` gives the day.                                                                                                     |
| T-CAL-1   | CAL-1        | trigger integration                             | M-5                                      | The real raw shape gives the day.                                                                                               |
| T-DSC-1   | DSC-1        | trigger integration                             | M-6                                      | As T-CAL-1.                                                                                                                     |
| T-MAX-2   | MAX-2        | unit                                            | `fixInstallments` is module-private      | `2024-01-15T00:00:00`, third installment, gives `2024-03-15` in every zone. Also covers month ends (31 Jan + 1) and DST months. |
| T-OTS-1   | OTS-1        | trigger integration, all session zones          | —                                        | `2024-01-15T00:00:00` gives day 15. A second upload under another session zone does not duplicate.                              |
| T-OTS-2   | OTS-2        | unit                                            | `toTimelessDate` is module-private       | Serial `45306` and `15/01/2024` both give `2024-01-15`.                                                                         |
| T-OTS-3   | OTS-3        | unit, mocked `page.evaluate`                    | —                                        | Month `2024-01-01` requests `2024-01-01`. `charge_date` is not reported as changed.                                             |
| T-BOI-1   | BOI-1        | integration under New York                      | —                                        | The change report finds the existing rate.                                                                                      |
| T-GI-1    | GI-1         | unit                                            | —                                        | The Mesh `Date` scalar keeps `2024-01-15`, and the document row gets `2024-01-15`.                                              |
| T-GI-4    | GI-4         | unit, fake timers                               | M-10, M-12                               | The "today" defaults at 23:30 and at 00:30 Israel time.                                                                         |
| T-DEEL    | DEEL-1 to 4  | unit, mocked fetch                              | M-8                                      | The sample's instants and days, plus empty `due_date` / `paid_at`.                                                              |
| T-ANT-1   | ANT-1        | unit                                            | `validateDate` lives inside `getOcrData` | `2024-01-15` is stored as `2024-01-15`, and `2026-02-30` is rejected.                                                           |
| T-CMC-1   | CMC-1        | unit, mocked CoinMarketCap                      | M-12                                     | Both caller styles use one window and one stored key for the same day.                                                          |
| T-KRK/ETH | KRK-1, ETH-1 | integration                                     | M-12                                     | The transaction day of a trade made between 22:00 and 00:00 UTC.                                                                |
| T-ETA-1   | ETA-1        | unit                                            | M-9                                      | The real CSV value gives the right day.                                                                                         |
| T-EML-1   | EML-1        | unit                                            | M-12                                     | The day in the description label.                                                                                               |

### 6. Order

Start with the P1 cases: MAX-2 and OTS-3, which store wrong or missing data from ordinary machines,
and M-5 / M-6, since Cal or Discount rows may be rejected today. M-1 and M-11 decide how much the ⚠️
cases matter in practice, so they are worth doing early too.

## Related findings outside intake

These don't involve dates arriving from a provider, so they belong to the inventory's follow-ups:

- PCN874's default `generationDate` uses `getUTC*`
  (`packages/pcn874-generator/src/schemas.ts:62-64`), so a file generated between 00:00 and 03:00
  Israel time is dated the day before.
- The uniform-format generator combines `toISOString()` for the date with `toTimeString()` for the
  time (`packages/shaam-uniform-format-generator/src/api/generate-report.ts:108-109`), mixing UTC
  and local time.
- `entryDate` formats `created_at` in the server's zone
  (`packages/server/src/modules/reports/helpers/uniform-format.helper.ts:97`).
- The fiat exchange-rate helpers parse `new Date(timelessDate)`
  (`packages/server/src/modules/exchange-rates/helpers/exchange.helper.ts:97,120`).

## Appendix: probes

Postgres: run with `PGTZ=<zone> psql -f …` for each zone.

```sql
select '2024-01-15'::date                        as r1,
       '2024-01-15T00:00:00+02:00'::date         as r3_offset,
       '2024-01-15T00:00:00'::date               as r3_offsetless,
       '2024-01-14T22:00:00Z'::date              as r3_z,
       '2024-01-14T22:00:00Z'::timestamp         as r4,
       ('2024-01-15T00:00:00'::timestamptz at time zone 'UTC') as r5,
       ('2024-01-14T22:30:00Z'::timestamptz)::date as r6_tstz_date,
       to_timestamp(1705271400)::timestamp       as r6_epoch;

select to_date('15/01/2024', 'DD/MM/YYYY');  -- 2024-01-15
select to_date('15/01/24', 'DD/MM/YYYY');    -- 0024-01-15
select to_date('2024-01-15', 'DD/MM/YYYY');  -- error: date/time field value out of range
select to_date('20240115', 'DD/MM/YYYY');    -- error: date/time field value out of range
```

Node: run with `TZ=<zone> node probe.mjs` from the repo root.

```js
import { createRequire } from 'node:module'

const require = createRequire(`${process.cwd()}/package.json`)
const { prepareValue } = require('pg/lib/utils')
const { addMonths, format, startOfMonth } = require('date-fns')

console.log(prepareValue(new Date('2024-01-15'))) // R2
console.log(format(new Date('2024-01-15'), 'yyyy-MM-dd')) // R8 + R9
console.log(format(startOfMonth('2024-01-01'), 'yyyy-MM-dd')) // R9, OTS-3
console.log(addMonths(new Date('2024-01-15T00:00:00'), 2).toISOString()) // MAX-2
console.log(format(new Date((45306 - 25_569) * 86_400_000), 'yyyy-MM-dd')) // OTS-2
```
