# Plan: securities semi-annual tax report (דיווח חצי-שנתי על רווחי הון מניירות ערך)

## Context

The company must file a semi-annual report on its securities income with the Tax Authority and pay
an advance (H1 due 31 Jul, H2 due 31 Jan). A late report accrues index linkage + 4%/yr interest on
the advance.

The accountant's requests, over three meetings:

- **Meeting 1:** total sale value (ILS); dividend income by the ledger's tax categories; total
  capital gain; tax liability incl. credited foreign tax; "מקדמת מס בסך ___".
- **Meeting 2:** sales turnover, capital gains, dividend income, **interest income**.
- **Meeting 3: the exact letter she sends.**
  ```
  מחזור המכירות לתקופה 1/1 - 30/6 היה ____
  סך רווחי ההון ממכירות ניירות ערך היה ____
  סך ההכנסות מדיוידנדים היה ____
  סך ההכנסות מריבית היה ____
  חבות המס מאירועים אלו היא ____
  מקדמה לתשלום ____ — או, אם אין: "הרווחים קוזזו מול הפסדים מועברים ולכן אין חבות מס"
  ```
- **Her assessment:** "the only issue is sales — a sale has no logic that reflects it in the
  ledger". This is confirmed in the code. On main, a SELL books only bank ↔ securities account, with
  no gain. Dividends and interest already sit on ledger tax categories. PR #4791 adds the sale logic
  (since split into #4824 and #4829–#4832, all on main).

The goal is a simple, well-designed page that produces her letter for a chosen half-year, with the
calculation behind it, and exports to PDF.

## 1. Formal requirement

**Income Tax Ordinance**

- **§91(א):** a company is taxed on **real** capital gain at the §126(א) rate (23%).
- **§91(ד)(2ג):** on traded securities from which tax was not withheld at source (§164), report on
  31 Jul / 31 Jan for the preceding 6 months' sales, and pay an advance of the tax on the gain.
- **§91(ד)(6):** tax withheld at source counts against the advance.
- **§88:** real gain = nominal gain − CPI-based inflationary amount. The exchange-rate-as-index rule
  is for individuals only. A loss is nominal.
- **§92:** losses offset gains (foreign losses first against foreign gains); a securities loss may
  also offset securities dividends and interest (§92(א)(4)); unused losses carry forward against
  capital gains (§92(ב)).

**Tax Authority guidance (July 2006, still operative).** There is no form: you send a notice to the
collection department and pay. The notice must contain:

- (א) total consideration;
- (ב) total gains;
- (ג) total losses;
- (ד) net gain or loss after offset, by tax rate;
- (ה) the advance.

## 2. Gap analysis and how the report maps her letter

| #   | Her letter line                  | Report figure                                                                                                                |
| --- | -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| 1   | מחזור המכירות לתקופה …           | (א) gross consideration of SELL + REDEMPTION; cancelled pairs dropped; buys never count                                      |
| 2   | סך רווחי ההון ממכירות ניירות ערך | the half's net **real** gain = (ב) gains − (ג) losses. The ב/ג breakdown is printed beneath                                  |
| 3   | סך ההכנסות מדיוידנדים            | ledger dividend-income categories, local + foreign                                                                           |
| 4   | סך ההכנסות מריבית                | ledger interest-income categories (securities interest), local + foreign                                                     |
| 5   | חבות המס מאירועים אלו            | tax after carried-forward losses and foreign tax credit (see §3 formula); "of which foreign tax credited ___" shown under it |
| 6   | מקדמה לתשלום / "הרווחים קוזזו…"  | advance = liability − Israeli tax withheld at source; if 0, the reason sentence(s)                                           |

**Gaps closed by the report (beyond her letter):**

1. **Real, CPI-indexed gain.** The bank's `real_profit_loss_nis` uses the individual's exchange-rate
   rule, and the ledger's sale gain (after #4791) is an accounting figure: its currency part is
   measured from the carrying rate, and may stay in the year-end revaluation. #4791's
   `getSecurityCapitalGain` gives the tax figure: cost at the original purchase rate, plus the CPI
   inflationary amount.
2. **Carried-forward losses** (§92(ב)). Her "no-advance" sentence depends on them, but they aren't
   in the books, so the page takes a manual input. For H2, the H1 unused loss carries automatically.
3. **Gross gains (ב) and losses (ג)** are required by the guidance, which her single line 2 merges.
   They are printed in the breakdown so she can add them if needed.
4. **Tax treatment for a company:**
   - local dividends are exempt (§126(ב)), labelled "by issuer country — verify";
   - foreign dividends and all interest are taxed at the corporate rate;
   - foreign tax is credited, capped at the Israeli tax on the same income bucket.
5. **Notes on the page:**
   - commissions are excluded (booked as deductible fees);
   - scope is Poalim traded securities only (crypto and unlisted fall under the 30-day Form 1399);
   - §92(א)(4) loss-vs-income offset is not modelled;
   - double-advance relief is available if the regular advances already include securities profits.

**Decisions:**

- **Advance** covers capital gains + foreign dividends + interest, net of foreign tax credits and
  Israeli withholding, floored at 0. The §91(ד)-only tax is shown as its own line.
- **Interest:** securities interest only.
- **PDF:** browser print → Save as PDF.
- **Document:** bilingual, Hebrew RTL with English subtitles.
- **Base:** stacked on PR #4791; now on main, after the FIFO cancellation fix (#4835).

**Finding in PR #4791 (fix first; now #4835).** `calculateFifoCostBasis` drops only the cancellation
row (`is_cancel_transaction='כן'`). The original it cancels still takes units out of FIFO and skews
later sales' cost. Fix: pair cancellations with their originals, as `findCancelledPayment` does in
`ledger/helpers/foreign-securities-ledger.helper.ts`, and drop both.

## 3. Implementation

### Base

Builds on the securities-sale series (#4824, #4829–#4832, on `main`) for the per-sale capital gain,
and on the FIFO cancellation fix, which landed as its own PR, #4835.

### Server: `reports` module

The report goes in `reports`: the ledger module already imports `foreign-securities`, so placing a
ledger-reading report there would create an import cycle.

- **`foreign-securities/helpers/security-withheld-tax.helper.ts`** (new)
  - `getWithheldTaxParts(execution)` returns `{ foreign, israeli }`, signed, in the settlement
    currency.
  - Israeli =
    `israel_tax_value_by_payments_settlement_currency || capital_tax_value_settlement_currency`.
  - Reuse it in the ledger's `getWithheldTax`.
- **`foreign-securities/providers/foreign-securities.provider.ts`**
  - New pgtyped query and method
    `getOwnerExecutionsByTradeDates({ ownerId, fromDate, toDate, tradeTypes })`.
  - Columns as in `getSecurityExecutionsByBusinessIds`; `LEFT JOIN security_identifiers` (nullable
    `security_business_id`); filtered by owner, an inclusive trade-date range and `trade_type IN`.
  - `getSecurityExecutionsPage` is unsuitable: no owner filter, an inner join, OFFSET paging.
- **`reports/typeDefs/securities-semi-annual-report.graphql.ts`**
  - `securitiesSemiAnnualReport(year: Int!, half: YearHalf!, priorYearsLosses: Float, businessId: UUID)`.
  - Directives: `@requiresAuth @requiresAnyRole(roles: ["business_owner","accountant"])`.
  - Enums:
    - `YearHalf { H1 H2 }`
    - `SecuritiesIncomeKind { DIVIDEND INTEREST }`
    - `SecurityLocality` (reuse if it exists)
    - `SemiAnnualAdvanceNote { CAPITAL_GAINS_OFFSET_BY_CARRIED_FORWARD_LOSSES, CAPITAL_LOSS_IN_PERIOD, INCOME_TAX_COVERED_BY_FOREIGN_TAX, LIABILITY_COVERED_BY_WITHHOLDING, NO_TAXABLE_EVENTS }`
  - `SecuritiesSemiAnnualReport` fields (letter lines as `FinancialIntAmount`, whole ₪):
    - **Header:** id, owner (`AdminBusiness`), year, half, fromDate, toDate, dueDate, taxRate.
    - **Line 1:** `salesTurnover` (א).
    - **Line 2:** `periodNetRealCapitalGain` = ב − ג; the breakdown fields `totalRealGains` (ב),
      `totalLosses` (ג), `inflationaryAmount`.
    - **Losses:** `priorYearsLosses`, `lossesCarriedForward` (used this half), `netRealCapitalGain`
      (ד, after carried-forward; may be negative).
    - **Lines 3–4:** `dividendIncome`, `interestIncome` (totals), plus `incomeSummary[]`.
      - One `SecuritiesIncomeSummary` per kind × locality: gross, foreignTaxWithheld,
        israeliTaxWithheld, taxable, tax, foreignTaxCredit.
    - **Line 5:** `capitalGainsTax` (§91(ד) subtotal), `dividendsTax`, `interestTax`, `grossTax`,
      `foreignTaxCredit`, `taxLiability`.
    - **Line 6:** `israeliTaxWithheldOnSales`, `israeliTaxWithheldOnIncome` (taxable income),
      `israeliTaxWithheldOnExemptIncome` (not credited), `taxAdvance`, `excessCredits`,
      `advanceNotes: [SemiAnnualAdvanceNote!]!`. These are the report's totals; the per-bucket,
      per-sale and per-record figures are each row's own `israeliTaxWithheld`.
    - **Lists:** `sales[]`, `incomeItems[]`, `issues[]`.
  - Row types (each with an `id` and descriptions, per lint):
    - **Sale** (id = execution id): date, type, security, quantity, consideration, cost,
      nominalGain, inflationaryAmount, realGain, israeliTaxWithheld, error.
    - **Income item** (id = ledger record id): kind, chargeId, date, locality, security, gross,
      foreignTaxWithheld, israeliTaxWithheld.
    - **Issue:** message, plus optional executionId / chargeId.
- **`reports/helpers/securities-semi-annual-report.helper.ts`** (pure, unit-tested)
  - `getSemiAnnualPeriod(year, half)`: H1 runs 01-01 to 06-30, due 07-31. H2 runs 07-01 to 12-31,
    due 01-31 of the next year. Built with `timelessDateFromParts`.
  - `ledgerEntityAmount(record, entityId)`: credits − debits across all 4 slots.
  - `splitIncomeWithholding(...)`: apportions the record's withholding line by the execution's
    foreign and Israeli shares, so it adds up to the line; the execution's tax at the record's rate
    only checks the line.
  - `computeSemiAnnualDeclaration(...)`: rounds each line to whole ₪ first, so the sheet adds up.
    - C = Σ consideration. G = Σ positive real gains. L = Σ |losses|. N = G − L (line 2).
    - P = prior-years losses. carried = P for H1; `max(0, P + L₁ − G₁)` for H2.
    - D = N − carried. CGT = rate × max(0, D).
    - Per income bucket b (kind × locality), taxable unless it is a local dividend: tax_b = rate ×
      max(0, gross_b), and FTC_b = min(max(0, foreign tax_b), tax_b). The cap is per bucket.
    - grossTax = CGT + Σ tax_b. FTC = Σ FTC_b. **liability = grossTax − FTC** (line 5).
    - IL = Israeli withholding on sales + taxable income (withholding on exempt local dividends is
      left for the annual return). **advance = max(0, liability − IL)** (line 6). excessCredits =
      max(0, IL − liability).
    - `advanceNotes`, set when the advance is 0 or reduced:
      - `CAPITAL_GAINS_OFFSET_BY_CARRIED_FORWARD_LOSSES` when N > 0 and carried > 0 absorbs some of
        it (rendered with her sentence when it absorbs all of it);
      - `CAPITAL_LOSS_IN_PERIOD` when N < 0 and there are sales (a net of exactly 0 is no loss: line
        2 shows the 0, and nothing is due on it);
      - `INCOME_TAX_COVERED_BY_FOREIGN_TAX` when FTC = Σ tax_b > 0;
      - `LIABILITY_COVERED_BY_WITHHOLDING` when IL ≥ liability > 0;
      - `NO_TAXABLE_EVENTS` when nothing happened.
    - Taxes, advance and notes are null/empty when there is no rate (which raises an issue).
- **`reports/helpers/securities-semi-annual-report-data.helper.ts`** (IO collectors)
  - **`collectHalfDisposals`**
    1. `getOwnerExecutionsByTradeDates` for SELL and REDEMPTION, then `pairCancellations`
       (`foreign-securities`, #4835) drops cancelled pairs; an orphan cancellation becomes an issue.
    2. Per sale, `getSecurityCapitalGain(injector, row)`. It is already cheap: owner history is
       memoized per operation, and rates and CPI go through DataLoaders.
    3. On success: consideration = proceeds × saleRate; cost = Σ `lots.costLocal`.
    4. On failure: an issue, and the consideration still counts, from the first source that works:
       `getDisposalProceeds` × the Bank of Israel trade-date rate; else the bank's
       `|trade_gross_value_nis|`; else 0 plus an issue.
    5. Israeli withholding = `getWithheldTaxParts(row).israeli` × the sale's rate. Foreign tax on a
       sale becomes an issue.
  - **`collectHalfSecuritiesIncome`**: dividends and interest, per ledger record (both are booked by
    `buildIncomeEntry`).
    1. Keys come from `INCOME_TAX_CATEGORY_KEYS` / `WITHHOLDING_TAX_CATEGORY_KEYS`
       (`ledger/helpers/foreign-securities-ledger.helper.ts`), resolved via
       `adminContext.foreignSecurities.taxCategories`. A missing category becomes an issue.
    2. One
       `LedgerProvider.getLedgerRecordsByFilters({ financialEntityIds: [4 income categories], ownerIds, fromInvoiceDate, toInvoiceDate })`.
    3. Bucket = the income category the record touches. Gross =
       `ledgerEntityAmount(record, incomeId)`. Withholding =
       −`ledgerEntityAmount(record, bucketWithholdingId)`. Reversals net out.
       - Reading withholding only from income records keeps **redemption** tax, which shares the
         bond withholding category, out.
    4. Foreign vs Israeli split via the ledger's own pairing:
       - record → transaction: `reference1 === origin_key`, via
         `TransactionsProvider.transactionsByChargeIDLoader`;
       - transaction → execution: `ForeignSecuritiesProvider.getChargeExecutionsByTransactionId`;
       - converted with the record's own rate.
    5. Mismatch above ₪1 → issue. Unmatched withholding → issue, treated as Israeli for LOCAL and
       foreign for FOREIGN. Income executions with no ledger record → issue.
- **`reports/resolvers/securities-semi-annual-report.resolver.ts`** (thin)
  1. Validate the inputs.
  2. Resolve the owner as `shaam6111.resolver.ts` does (`ScopeProvider.getReadScope`).
  3. Load:
     - `adminContextByOwnerIdLoader`;
     - the admin business;
     - the rate: `CorporateTaxesProvider.getCorporateTaxesByCorporateIdLoader`, first row with date
       ≤ fromDate, `original_tax_rate / 100` — the regular rate, as `tax.helper.ts` uses.
  4. Collect the half (plus H1 for H2), compute, and format with `formatFinancialIntAmount` /
     `formatFinancialAmount`.
  5. Add an issue if the half hasn't ended yet. Register in `reports/index.ts`.
- **`.changeset/securities-semi-annual-report.md`** (server and client, minor).

### Client: `components/screens/reports/securities-semi-annual-report/`

- **`index.tsx`**
  - `/* GraphQL */` query `SecuritiesSemiAnnualReportScreen`, built from fragments.
  - `useUrlFilterState` with a module-level zod schema
    (`{ year, half, priorYearsLosses?, businessId? }`).
  - Owner via `useGetAdminBusinesses`.
  - `PageLayout` with a **Print / Save PDF** button (`window.print()`).
- **`helpers.ts`**
  - Schema.
  - `defaultSemiAnnualFilter(today)`: Jul–Dec gives this year's H1; Jan–Jun gives last year's H2.
  - `semiAnnualFileName` returns `securities-semi-annual-2026-H1`.
  - Bilingual labels.
  - `ADVANCE_NOTE_TEXT`: each enum value → Hebrew sentence + English subtitle. Her exact sentence
    "הרווחים קוזזו מול הפסדים מועברים ולכן אין חבות מס" is used for the carried-forward note.
  - `formatWholeShekels`, built on `formatStringifyAmount`.
- **`report-controls.tsx`** (`print:hidden`)
  - Year `Select`.
  - H1/H2 toggle (the `ModeToggle` pattern from `price-index-calculator`).
  - Owner select.
  - "Losses carried forward from prior years" number input, committed on blur or Enter.
- **`report-issues.tsx`**: an `Alert` listing the issues, with links to charges; `print:hidden`.
- **`declaration-document.tsx`** and **`declaration-line.tsx`**: an A4 sheet,
  `<article dir="rtl" lang="he">`, `max-w-[210mm]`.
  1. **Header:** company name, ח.פ., tax file number, period, due date, prepared date.
  2. **The letter** — her six lines, verbatim wording with the period filled in ("לתקופה 1/1/2026 –
     30/6/2026"), each with an English subtitle and a `dir="ltr" tabular-nums` amount:
     - line 5 has a sub-line "מתוכו קוזז מס זר בסך ___";
     - line 6 shows "מקדמה לתשלום: ₪X" (boxed) when the advance is above 0, otherwise the note
       sentence(s).
  3. **"פירוט החישוב / Calculation details":**
     - capital gains: (ב) gains, (ג) losses, line 2's net, carried-forward used (H2 shows H1's
       contribution), (ד) after offset, inflationary amount (exempt);
     - an income table, 4 rows (dividends local/foreign, interest local/foreign) × gross, foreign
       tax, Israeli tax, tax, with subtotals;
     - the tax computation: §91(ד) tax line, + dividend tax, + interest tax, − FTC = liability, −
       Israeli withholding = advance.
  4. **Notes** (statutory references, commissions, scope, double-advance relief) and a signature
     line.
- **`sales-appendix.tsx`** and **`income-appendix.tsx`**
  - Plain `<table>`s; header rows repeat on each printed page; rows get `break-inside-avoid`; each
    appendix starts with `print:break-before-page`.
  - Sales link to the security business page.
- **`hooks/use-print-document-title.ts`** (new): sets `document.title` to the filename on
  `beforeprint`, restores it on `afterprint` and on unmount. That title becomes the default PDF
  filename.
- **Routing**
  - `router/routes.ts`: `SECURITIES_SEMI_ANNUAL: '/reports/securities-semi-annual'`.
  - `router/config.tsx`: lazy child of `reports` with `<ReportSkeleton />`.
  - `layout/sidelinks.tsx`: a Reports entry.
- **Print CSS** (Tailwind v4 `print:` variants)
  - `index.css`: `@page { size: A4; margin: 12mm }`, a white body, hide the toaster.
  - `layout/dashboard-layout.tsx`: `print:block print:h-auto print:overflow-visible` on the outer
    container and the scroller; hide the breadcrumbs.
  - `print:hidden` on `header.tsx`, `footer.tsx`, `sidebar.tsx`, `navigation-progress.tsx`.
  - `page-layout.tsx`: an opt-in `hideHeaderInPrint` prop.
  - `[print-color-adjust:exact]` on shaded cells.

## Follow-up: accountant review of the first draft

- **Header:** the advances file number (תיק מקדמות) is removed.
- **Line 5, securities expenses** (lines 6–7 are now the liability and the advance). The categories
  come from the securities settings, not a sort code:
  - the `FOREIGN_SECURITIES_FEES` slot, where the securities ledger books commissions;
  - a new `FINANCIAL_CONSULTANCY` slot.

  A missing slot is an issue with a button to set it. The expenses come off the capital gain left
  after carried-forward losses, then off the dividends and interest. Whatever they exceed is left
  for the annual return.

- **Capital loss offset (s.92(a)(4)).** The year's capital loss offsets capital gains first; the
  rest offsets the securities dividends and interest, the buckets with the least foreign tax first.
  In H2, the H1 loss counts only for what H1's own income didn't absorb. Prior-year losses offset
  capital gains only.
- **The advance always shows an amount, 0 included.** A capital loss is noted under it with its full
  amount, what it offset, and that there is no tax liability.

## 4. Verification

```sh
yarn generate
yarn build:tools && yarn workspace @accounter/server typecheck
yarn workspace @accounter/client tsc --noEmit && yarn workspace @accounter/client build
yarn vitest run --project unit packages/server/src/modules/{reports,foreign-securities,ledger}
yarn test:client && yarn test # test count must not drop vs. the base branch
yarn lint && yarn prettier:check
```

- **Server unit tests** (`reports/helpers/__tests__/securities-semi-annual-report.helper.test.ts`):
  - H1/H2 ranges and due dates (H2 → 31 Jan of the next year).
  - Buy/sell/re-buy/re-sell: only sells count; cancelled pairs dropped; orphan cancellation becomes
    an issue.
  - Line 2 = ב − ג.
  - Net loss → advance 0 with `CAPITAL_LOSS_IN_PERIOD`.
  - Carried-forward losses: fully absorbing a gain → advance 0 with the carried-forward note. Partly
    absorbing. The H2 carry of H1 loss + unused prior-year losses.
  - FTC cap per bucket (25% foreign tax vs 23% rate; excess on dividends doesn't absorb interest
    tax).
  - Local dividends not taxed; local interest taxed.
  - Israeli withholding: credit, covering the whole liability, and excess credits.
  - No rate → nulls.
  - Rounding: the sheet adds up exactly.
  - `ledgerEntityAmount` signs incl. reversals and slot 2.
  - `splitIncomeWithholding` cases.
  - Redemption withholding is not counted as interest withholding.
- **Other tests:**
  - a `getWithheldTaxParts` unit test;
  - the FIFO cancellation-pairing test (#4835);
  - optionally, an integration test for `getOwnerExecutionsByTradeDates`;
  - client: default period on 2026-10-26 → 2026 H1 and on 2027-01-15 → 2026 H2; filename; schema;
    `ADVANCE_NOTE_TEXT` covers every enum value; `use-print-document-title` (`createRoot` + `act`).
- **Visual:** `yarn mock:client` → `/reports/securities-semi-annual`. Check both halves, the RTL
  letter, and the advance-0 vs advance-due rendering. Chrome print preview → Save as PDF: A4, no app
  chrome, selectable Hebrew, filename `securities-semi-annual-2026-H1`.
- **Figures on real data:** reconcile line 1 and the per-sale gains with the bank's Form 867 and
  `nominal_profit_loss_nis` (real gain differs from the bank's by design), and lines 3–4 with the
  ledger's tax-category balances for the half. Then the accountant reviews the H1 PDF.

## Sources

- Income Tax Ordinance §§88, 91, 92 — [Wikisource](https://he.wikisource.org/wiki/פקודת_מס_הכנסה)
- Capitax, "דיווח חצי-שנתי ותשלום מקדמות בגין רווחים בשוק ההון" (2026; quotes the July 2006 Tax
  Authority guidance) — [capitax.co.il/content/2/3629](https://www.capitax.co.il/content/2/3629)
- Form 1399 (30-day report, non-traded assets) —
  [gov.il](https://www.gov.il/en/service/declaration-assets-sale-itc1399)
