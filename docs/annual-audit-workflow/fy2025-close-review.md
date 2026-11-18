# Annual Audit Workflow: Review for Closing FY2025

- **Scope:** the Annual Audit workflow screen (`/workflows/annual-audit/:year`), the server code
  behind its 21 steps, and the report pages it links to.
- **Basis:** `main` at `85507ae` (18 Nov 2026).
- **Method:** I reviewed the client and server code behind every step and checked every link against
  the router. I also reproduced key behaviours (the lock-date comparison, the 6111 validation). This
  was not a live run against real books.
- **Path roots:**
  - **Client:** relative to `packages/client/src/components/`; `AA/` stands for
    `screens/operations/annual-audit/`.
  - **Server:** relative to `packages/server/src/modules/`.

## Summary

The workflow covers the bookkeeping side of the close:

- charge review;
- ledger-drift detection;
- year-end charges;
- the ledger lock;
- Balance Sheet and P&L template management;
- the review reports.

It does not yet take a year to filing:

- **9 of the 21 steps are placeholders.** They link to pages that don't exist and can't be marked
  done, so progress can never pass 12/21 (57%).
- **Filing outputs.**
  - The 1214, 1214ב and 973/901א outputs don't exist.
  - The 6111 screen produces a valid upload file, but its content still needs manual work before
    filing.
- **Four calculations or controls are wrong.** They either put wrong numbers into the statements or
  let them change after the close:
  - the tax expense in a loss year;
  - the vacation reserve;
  - sort code 931 in the tax computation;
  - the ledger lock.
- **No reconciliations.** None of the ones an annual close needs (bank, VAT, payroll, withholding,
  tax advances, balances) is part of the flow.

## The screen, step by step

| #     | Step                                                 | Current state                                                                                                                                                                        |
| ----- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1     | Validate all charges                                 | Works: counts the year's charges by approval status and links to the open ones. A saved manual status stops the automatic check and always wins (B2)                                 |
| 2     | Pending ledger changes                               | Works: regenerates every charge of the year and compares it to the stored ledger. Same manual-status behaviour                                                                       |
| 3     | Opening balance                                      | Partial: a link plus manual approval (B5)                                                                                                                                            |
| 4     | Financial charges                                    | Generates the six year-end charges, with calculation bugs (A1–A3) and order/duplication issues (B3)                                                                                  |
| 5     | Audit main process                                   | For each report (Balance Sheet, P&L): last year's final template as the baseline, plus this year's working template. Links to the trial balance and tax report; manual approval (B4) |
| 6     | Shareholders data                                    | Links to pages that don't exist; can't be completed                                                                                                                                  |
| 7     | Revalidate pending items                             | Mirrors steps 1 and 2, including their manual statuses                                                                                                                               |
| 8     | Lock ledger                                          | Works, but leaks and can't be undone (A4)                                                                                                                                            |
| 9     | Final templates                                      | Locks this year's working templates as the final Balance Sheet and P&L; complete when both are locked. Freezes the layout, not the numbers (B4)                                      |
| 10    | Export year-end trial balance                        | Exports the year's movements, not closing balances (A6)                                                                                                                              |
| 11    | Depreciation report                                  | Works; no disposals; image PDF only (B6)                                                                                                                                             |
| 12    | Financial reports                                    | Page doesn't exist                                                                                                                                                                   |
| 13    | Tax report                                           | Works; disagrees with the ledger in a loss year (A1); no loss carry-forward; image PDF only                                                                                          |
| 14    | Tax-ruling compliance                                | Works; see B7                                                                                                                                                                        |
| 15    | 973 / 901א                                           | Pages don't exist                                                                                                                                                                    |
| 16    | 6111                                                 | Opens the year, validates and downloads the upload file; content gaps (A5); can't be marked done                                                                                     |
| 17–21 | 1214ב, 1214, tax-expense comparison, signing, filing | Pages don't exist                                                                                                                                                                    |
| –     | Quick Actions (3 buttons)                            | No handlers                                                                                                                                                                          |

Steps 6, 7, 12 and 15–21 are `SimpleStep`s, which never read a saved status
(`AA/step-simple.tsx:18-22`). Only step 7 gets a status, derived from steps 1 and 2.

## 1. Missing and crucial for the annual reports

### Filing package

- **1214:** no generator. The `opcn1214-generator` package listed in `CLAUDE.md` doesn't exist.
- **1214ב (dividend distribution):** no report. The dividends module's GraphQL schema is an empty
  placeholder. This is needed if dividends were distributed in 2025.
- **973 / 901א:** the Preferred Technology Enterprise attachments, required in each benefit year.
  Not produced.
- **1344 (losses carried forward):** there is no loss carry-forward data or logic anywhere.
- **1385 (international related-party transactions):** not covered. It is required if the company
  transacts with related parties abroad; 1485 and 1585 likewise.
- **1342 (depreciation):** the depreciation report has the right shape but no disposals (B6).

### Tax computation

`calculateTaxAmounts` (`reports/helpers/tax.helper.ts`) handles:

- R&D §20A spreading;
- fines and gifts;
- business-trip and salary excess;
- reserves;
- non-deductible linkage;
- the preferred/regular rate split.

Missing:

- losses carried forward, and a floor at zero (see A1);
- deferred taxes;
- partly deductible expenses: tax categories carry only an all-or-nothing `tax_excluded` flag, while
  refreshments, vehicles, phones and gifts are partly deductible;
- the section 46 donations credit;
- prior-year tax differences;
- the final payable after advances and withholding credits.

6111 mirrors these gaps: adjustment lines 120/130, 140, 160, 181, 182, 183 and 480 are never filled.

### Reconciliations (none are part of the flow)

- **Bank and credit cards:** balances at 31/12 against statements.
- **VAT:**
  - turnover per PCN874 vs revenue;
  - VAT balance vs the Nov–Dec return;
  - drift of filed PCN874s (the existing _Validate Reports_ page shows it, but isn't linked).
- **Payroll:** vs forms 126 and 102.
- **Withholding at source:** form 856.
- **Tax advances:** vs the Tax Authority account statement.
- **Balances:** customer, supplier and intercompany confirmations.

### Year-end adjustments that aren't generated

- **Foreign-currency balances:** open receivables, payables and intercompany balances aren't
  revalued. Step 4 revalues only the company's own bank and card accounts and deposits.
- **Marketable securities:** not taken to market value; only FX is revalued.
- **Doubtful debts.**
- **Severance liability,** where employees aren't under section 14.
- **Accruals and cut-off review:** charge spreading exists, but nothing prompts a review of
  post-year-end documents.
- **Fixed-asset disposals.**

### Financial statements

- **Comparatives:**
  - The dynamic report shows each line's change against a saved snapshot ("Compare to" defaults to
    last year's snapshot of the same kind). The P&L report shows other years when they are added by
    hand.
  - There's no two-column (2025 / 2024) statement for presentation.
  - The comparison needs last year's report saved as a snapshot.
- **Missing statements:** no cash-flow statement and no statement of changes in equity.
- **Notes:** nothing feeds them (fixed-asset roll-forward, taxes-on-income reconciliation, related
  parties).

### Shareholders and equity

- No shareholder register, so step 6 has nowhere to go.
- No section 3(ט) imputed interest, and no 3(ט1) check on shareholder balances.

### Audit trail

- `annual_audit_step_status` doesn't record who approved a step, and there's nowhere to attach
  evidence.

## 2. Exists, but partial or not working

### A. Wrong numbers or broken controls: fix or work around before closing

**A1. Tax expense in a loss year.**

- The tax-expense charge books `Math.abs(annualTaxExpenseAmount)` as an expense
  (`ledger/resolvers/ledger-generation/financial-ledger-generation/tax-expenses-ledger-generation.resolver.ts:129-133`).
- A loss year therefore records a positive tax expense equal to the would-be tax benefit, while the
  tax report shows a negative figure.
- 6111 then validates with wrong tax-expense (5600) and equity (9980) lines.

**A2. Vacation reserve.**

- `ledger/helpers/vacation-reserve.helper.ts:130-155` sums the "Vacation Days Balance" of every
  payslip since the employee started, adds a statutory accrual on top, and never subtracts days
  taken. The salary form labels that field as the running balance, so the reserve is overstated. The
  usual basis is the 31/12 balance × daily wage, plus employer costs.
- The entry always debits the expense and credits the reserve with the absolute amount
  (`ledger/resolvers/ledger-generation/financial-ledger-generation/vacation-reserve-ledger-generation.resolver.ts:72-76`),
  so a decrease is booked as an increase. The recovery-pay reserve handles the sign correctly.

**A3. Sort code 931 added back twice.**

- 931 is part of R&D (`reports/helpers/profit-and-loss.helper.ts:66`), which is added back in full
  before the ⅓ spread.
- It is then added back again as "reserves" (`reports/helpers/tax.helper.ts:72-76`).
- Reserves coded 931 therefore overstate taxable income. This flows into 6111 lines 150 and 400.

**A4. Ledger lock.**

- **2025 charges still post after the lock.** After step 8 locks 31/12/2025, the tax, depreciation,
  recovery and vacation generators still post into 2025.
  - They compare `` `${year}-12-31` `` with `year` already a full date, i.e.
    `'2025-12-31-12-31' <= '2025-12-31'`, which is false
    (`charges/resolvers/financial-charges.resolver.ts:168,197,229,261`).
  - A newly created charge isn't caught by `isChargeLocked` either, since it has no dates yet.
- **The lock can't be undone.** `lockLedgerRecords` sets `locked = TRUE` on every record up to the
  date (`ledger/providers/ledger.provider.ts:256-263`), and nothing ever clears it.
  - Moving the admin lock date back doesn't help: locked records can't be updated or deleted.
  - So auditor adjustments to existing 2025 charges can't be posted.
- **The lock comes too early.** It sits before the tax-expense comparison (19) and signing (20), so
  a correction found there can't be booked.
- **The button state is stale.** It reads the lock date from the login-time context
  (`AA/step-08-ledger-lock/index.tsx:62-73`), so it stays enabled until reload.

**A5. 6111: valid file, content not ready to file.**

What works:

- The year comes from the URL, and step 16 passes it.
- The server validates the report, and the screen lists blocking errors and warnings.
- The download produces the official upload file (`DKASPI.DAT`, Windows-1255, CRLF, end-of-file
  marker), and only when there are no blocking errors.
- Rounding differences are absorbed within a tolerance.
- An entity without a 6111 code falls back to its sort code's default; one with neither is flagged.

Still needs work:

- **Hard-coded header** (`reports/helpers/shaam6111.helper.ts:310-330`): industry 6201, business
  type "more than one business", audit opinion always "unqualified", software registration 99999999,
  and the description text.
- **Adjustment lines never filled:** 120/130 (depreciation differences), 140, 160, 181, 182 (linkage
  on tax debts, currently inside 190), 183 (donations) and 480 (losses carried forward).
- **Line 510** (income at the preferred rate) is all non-991 taxable income. It depends entirely on
  sort-code-991 tagging (B7).
- **Wrong-side balances** (overdraft, VAT refund due, tax advances) fail validation instead of being
  reclassified. The only fix is to change the entity's single 6111 code, which applies to every
  year.
- **No in-app override:** `updateShaam6111` and `shaam6111ByYear` are declared
  (`reports/typeDefs/shaam6111-report.graphql.ts:8,14`) without implementations.
- **Users with several businesses:** the tax-adjustment inputs come from the logged-in business,
  while the books come from the selected one.
- **Description alignment:** the business description is left-aligned
  (`packages/shaam6111-generator/src/generators/generate-header.ts:17`); the spec right-aligns it.
- **A1 and A3** flow straight into the file.

**A6. Step 10's "year-end trial balance" is the year's movement.**

- With `fromDate` = 1 January, ledger records before that date are skipped
  (`financial-entities/resolvers/business-transactions-sum-from-ledger-records.resolver.ts:99-101`).
- So balance-sheet accounts show the year's movement, not closing balances, and the export is
  unusable as next year's baseline.
- The CSV (`reports/trial-balance-report/download-csv.tsx`):
  - has no account ID;
  - prints `undefined` in empty debit/credit cells (line 71);
  - leaves out zero-balance accounts unless "show zeroed accounts" is on.

### B. Statuses and process

**B1. Progress and dead UI.**

- 9 steps can never be completed, so progress caps at 12/21.
- The three Quick Actions buttons have no handlers.

**B2. A saved manual status beats the live check.**

- **Steps 1 and 2:** saving any status (even "Pending") stops the automatic check
  (`AA/step-01-validate-charges/index.tsx:90`, `AA/step-02-ledger-changes/index.tsx:87`).
- **Steps 1, 2 and 4:** the saved status wins over the live result from then on (`step-01` line 106,
  `step-02` line 80, `step-04` line 145). Step 1 shows "Not checked" until Refresh is clicked, and
  even then the manual status decides.
- **Step 7** inherits those manual statuses, so "revalidate" checks nothing new.
- **Progress counter:** when step 7 turns complete, it isn't recalculated (`AA/index.tsx:105-140`),
  so it can show one step fewer than reality.
- **Overrides aren't tracked:** approvals don't record who approved, and nothing requires a note to
  override a failing check.

**B3. Step 4 (year-end charges).**

- **The tax expense goes stale.** It is listed second and computed from the ledger at that moment,
  so it goes stale as soon as depreciation, reserves or revaluation are posted. Steps 2 and 7 flag
  it, but only if they run.
- **Nothing prevents duplicates.**
  - Each "Generate" inserts a new charge.
  - `generateFinancialCharges` is declared in the schema without a resolver
    (`charges/typeDefs/financial-charges.graphql.ts:32`).
- **The revaluation check can be fooled.** The required "Revaluation" line can be satisfied by the
  bank-deposits revaluation charge, since both carry the revaluation category
  (`charges/resolvers/financial-charges.resolver.ts:64-92`).
- **"Optional" labels mislead.** Depreciation and the reserves are marked "optional" even when there
  are assets and employees.

**B4. Report templates (steps 5 and 9).**

- **No coverage check.** Nothing checks that every account with a balance is placed in the working
  template before step 5 is approved or step 9 locks. Unplaced accounts show only in the dynamic
  report's side panel, outside the report totals; new ones are marked against last year's snapshot.
- **Step 5's approval isn't tied to the figures.** It is manual, and stays approved if the template
  or the numbers change afterwards. The dynamic report's per-line approvals aren't used by the
  workflow (issue #4544).
- **Step 9 locks templates, not numbers.** No snapshot is saved at lock time, so the "final"
  statements keep moving if the ledger changes.

**B5. Step 3 (opening balances).**

- **Continuing business:** a link to the prior-year trial balance plus manual approval. There's no
  automatic comparison with the filed prior-year numbers, and no check that the prior year is
  locked.
- **Business migrating into Accounter:**
  - The opening-balance charge is found only if it's a financial charge whose description contains
    "balance" and whose ledger spans exactly 31/12 of the prior year
    (`annual-audit/providers/annual-audit.provider.ts:158-193`).
  - A 1 January date or a Hebrew description leaves the step pending.
  - "Upload Dynamic Report" is disabled.
- **Missing settings:** if `initialAccounterYear` / `dateEstablished` aren't set, the server returns
  `userType: 'BLOCKED'`, which isn't a valid enum value (line 223). The query errors instead of
  showing a clear blocked state.

**B6. Depreciation.**

- No disposal date, so sold or scrapped assets keep depreciating.
- One accumulated-depreciation account for all asset classes, with no per-class split for the notes
  or 6111.
- Fully depreciated assets drop off the report while still owned
  (`depreciation/providers/depreciation.provider.ts:36-46`).
- Asset amounts are used without currency conversion
  (`reports/helpers/depreciation-report.helper.ts:167-173`). Check that every asset is recorded in
  ILS.

**B7. Step 14 (tax-ruling compliance).**

- **The 7% test runs per year.** It tests R&D ≥ 7% of income for each year on its own
  (`reports/resolvers/reports/corporate-tax-ruling-compliance-report.ts:124-154`). As I read the
  law, the statutory condition is an average over the three preceding years; check this against the
  ruling's wording.
- **Rigid inputs:** income is every 8xx sort code, the thresholds are hard-coded, and a zero
  denominator gives an invalid result.
- **The rate split hangs on 991.** The 12% / 23% split (and 6111 line 510) depends entirely on sort
  code 991. Check that interest, FX gains and capital gains are coded 991.

### Smaller issues

- Step 1 counts the logged-in primary business, not the selected one
  (`accountant-approval/resolvers/accountant-approval.resolver.ts:15`).
- Step 14's description says "For Yossi's review", and steps 14 and 15 have near-identical titles.
- Step 21 says it files with the "companies government office". The filing that matters is the 1214
  to the Tax Authority; the Registrar of Companies annual report and fee are a separate item.
- The depreciation, tax and compliance reports export only as image PDFs, with no CSV or Excel.
- The dynamic report's CSV is debit-positive, while the trial balance is credit-positive.
- Issues #3345 and #3346 appear implemented and can be closed.

## 3. Insights on the flow

1. **Order the steps by dependency.**
   1. Readiness check: tax categories, the year's corporate tax rate, the recovery-pay day value,
      depreciation categories, 6111 codes, `initialAccounterYear` / `dateEstablished`.
   2. Opening balances: confirm the prior year is locked, and compare against its saved closing
      snapshot.
   3. Completeness and cut-off: bank feeds to 31/12, documents, post-year-end review.
   4. Charge approvals and ledger drift (steps 1–2).
   5. Reconciliations.
   6. Year-end adjustments, in order: FX revaluation → securities → depreciation → reserves and
      accruals → (deferred tax) → current tax expense last.
   7. Review the statements with comparatives; tax computation and 6111 mapping.
   8. The auditor's adjustments and the tax true-up.
   9. Then lock, snapshot, generate the filings, sign and file.
2. **Make each status a computed check that you approve.** The dynamic report already has per-line
   approvals that reset when the underlying ledger changes. The same pattern fits every step:
   - show the computed result;
   - let the accountant approve it with a note;
   - record who approved and when;
   - reset the approval when the data changes.

   Step 16, for example, can simply be "done when 6111 validates with no blocking errors".

3. **Mark steps "not applicable" from the data.** For example:
   - no employees → no reserves;
   - no dividends → no 1214ב;
   - no tax ruling → no 973/901א;
   - no deposits → no deposit revaluation.

   Then 100% becomes reachable and meaningful.

4. **Compute the tax number once.**
   - 6111 line 400 already uses the tax report's taxable income.
   - The ledger charge should come from the same computation, including its sign.
   - Step 19 should be an automatic comparison, not a link.
5. **One charge per year and type.** Year-end charges should be updated in place ("regenerate")
   rather than inserted again, and the screen should enforce their order.
6. **Two kinds of lock.**
   - A soft close after the internal review, which warns.
   - A hard close after the auditor signs, which blocks everything in the period, including new
     charges.
   - A logged way to reopen.
7. **Connect the years.** At the hard close, save the cumulative closing trial balance and the final
   statements as a snapshot, and have next year's step 3 compare against it automatically.
8. **Wire in the tools that already exist:**
   - _Validate Reports_ (PCN874 drift);
   - _Missing info_ charges;
   - _IRS Codes_ report (6111 mapping review);
   - _Balance_ report;
   - _Annual revenue_;
   - _Securities semi-annual_;
   - _Accountant approvals_.

## 4. What to do for FY2025 now

- Generate the tax expense last, then rerun step 2 and refresh step 1.
- If 2025 is a loss year, reverse the tax-expense charge.
- Check the vacation reserve against the December payslips, and check what's coded 931.
- If they're material, revalue open foreign-currency receivables and payables by hand.
- Run _Validate Reports_ on the 2025 PCN874 reports.
- Before locking the final templates (step 9), make sure the dynamic report's side panel holds no
  accounts with balances.
- Don't lock the ledger (step 8) until the auditor's adjustments and the tax true-up are posted.
- Prepare the 1214, 1214ב and 973/901א outside the app, from a trial balance that runs from
  inception to 31/12/2025 (not from 1 January).
- For 6111, use the app's file as the draft:
  1. Review the mapping in the IRS Codes report, and fix every entity the validation panel flags.
  2. Fix wrong-side balances and set the withholding file number.
  3. Correct the header and add the missing adjustment lines in the CPA's software or the Tax
     Authority's online form. The app can't override them.

## Sources

- [Tax Authority: 2025 annual return for companies (1214)](https://www.gov.il/he/service/reporting-and-payment-annual-tax-report-2025-companies)
- [BDO: 1214 attachments guide (973, 901א, 1214ב)](https://bdo.co.il/getattachment/430d1736-f58e-4f40-a24f-3d29f0e8d58b/Service_Pages_Income_tax_annual-report-2023_1214-2023.pdf)
- [Form 1385: international transactions declaration](https://www.gov.il/he/service/itc-1385)
- [Form 6111 (2024)](https://www.gov.il/BlobFolder/service/reporting-and-payment-annual-tax-report-2024-companies/he/Service_Pages_Income_tax_annual-report-2024_itc6111-2024.pdf)
- [PwC: technology enterprise conditions](https://www.pwc.com/il/he/events/assets/2017/15-2/sugiot-lediun.pdf)
