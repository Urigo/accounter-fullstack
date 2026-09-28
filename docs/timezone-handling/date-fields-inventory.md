# Date and datetime fields inventory

Part of [#4560](https://github.com/Urigo/accounter-fullstack/issues/4560) (timezone handling). This
covers the first checklist item: list every date-only field and every true datetime field, from the
DB up to the GraphQL API, and flag the ones whose type does not match their meaning.

- **Date-only** means a calendar day (`yyyy-mm-dd`) with no time of day and no timezone. The same
  day must show for every user, wherever they are.
- **Datetime** means a point in time. It should be stored and sent as UTC (or with an explicit
  offset), and converted to local time only for display.

## How the lists were produced

- **DB:** all migrations applied to an empty Postgres, then `information_schema.columns` queried for
  `date`, `timestamp`, `timestamptz` and `time` columns (query at the end). The one migration that
  could not run locally (`2026-09-09T10-00-00.uuidv7-id-defaults`, which needs Postgres 18) only
  changes id defaults. The later `dynamic-report-snapshot-approvals` migration only adds an index.
  Neither touches a date column.
- **GraphQL:** `schema.graphql` from `yarn generate:graphql`, walked with `graphql-js` for every
  field and argument typed `TimelessDate` or `DateTime`, plus `String`/`Int` fields whose name
  suggests a date.

## How dates move today

| Layer            | Date-only (`date` column)                                                                                                                                                                                                                                                                                                                                                                | Datetime (`timestamp` / `timestamptz`)                                                                                |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| DB → server      | node-pg has no custom type parsers and pgtyped has no type overrides (`packages/server/pgconfig.json`), so a `date` becomes a JS `Date` at **server-local midnight** (see [#1924](https://github.com/Urigo/accounter-fullstack/issues/1924)).                                                                                                                                            | `timestamptz` becomes the right instant. `timestamp` (without time zone) is read as **server-local wall time**.       |
| Server → GraphQL | `TimelessDate` scalar (`modules/common/resolvers/timeless-date.ts`) formats the `Date` with `format(date, 'yyyy-MM-dd')` in server-local time. For values read from a `date` column this is correct whatever the server's TZ, because node-pg parses and `format` prints in the same zone. It goes wrong for `Date`s built another way, such as `new Date('yyyy-mm-dd')` (UTC midnight). | `DateTime` (`graphql-scalars`) passes the `Date` through, and JSON serialization turns it into `toISOString()` (UTC). |
| GraphQL → client | The client gets a `yyyy-mm-dd` string. Many components then call `new Date(str)`, which JS reads as **UTC midnight**, and format it in the browser's local time.                                                                                                                                                                                                                         | The client gets an ISO string. Formatting in local time is correct here.                                              |

Result: a date-only value is only safe if it stays a string all the way to the screen. It breaks as
soon as it passes through `new Date('yyyy-mm-dd')` in a browser west of UTC, or through the
`DateTime` scalar.

```text
TZ=UTC               new Date('2026-05-01').getDate() → 1
TZ=Asia/Jerusalem    new Date('2026-05-01').getDate() → 1
TZ=America/New_York  new Date('2026-05-01').getDate() → 30   (April 30)
```

The reported document-date bug matches this exactly. `Document.date` is `TimelessDate` from the DB
to the API, but the documents table renders it with `format(new Date(date), 'dd/MM/yy')`
(`packages/client/src/components/documents-table/cells/date.tsx:17`). The same pattern shows up in
other places, such as
`packages/client/src/components/common/business-trip-report/parts/core-expense-row.tsx:163` and
`packages/client/src/components/reports/vat-monthly-report/index.tsx:132`. A rough grep finds about
80 `new Date(…date…)` calls in the client; auditing them is a later item in
[#4560](https://github.com/Urigo/accounter-fullstack/issues/4560).

## Mismatches and fields that need a decision

These are the main output of this inventory: fields where the storage type, the API type and the
meaning disagree.

### 1. Date-only DB columns exposed as `DateTime` (wrong API type)

Each of these goes through `toISOString()`, so the client gets `…T00:00:00.000Z` from a UTC server,
or `…T21:00:00.000Z` on the day before from a server running in Israel time. Once the client formats
that in local time, browsers west of the server's timezone show the previous day.

| GraphQL field                                                                                 | Source                                                                                                                                                            | Should be      |
| --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| `Charge.minEventDate` / `maxEventDate` (interface + all 11 charge types)                      | `transactions.event_date` (`date`), via `modules/transactions/helpers/common.helper.ts`                                                                           | `TimelessDate` |
| `Charge.minDebitDate` / `maxDebitDate` (same)                                                 | `transactions.debit_date` (`date`); for crypto transactions `debit_timestamp` (`timestamp`) instead, so one field mixes days and instants                         | `TimelessDate` |
| `Charge.minDocumentsDate` / `maxDocumentsDate` (same)                                         | `extended_charges.documents_min_date` / `documents_max_date` (`date`)                                                                                             | `TimelessDate` |
| `LedgerRecord.invoiceDate` / `valueDate`, `SingleSidedLedgerRecord.invoiceDate` / `valueDate` | `ledger_records.invoice_date` / `value_date` (`date`), or the same values built in memory by ledger generation; `modules/ledger/resolvers/ledger.resolver.ts:525` | `TimelessDate` |

The charge dates feed the date column of the charges table
(`packages/client/src/components/charges/cells/date.tsx`, which does `new Date(…)` and then
`format(date, 'dd/MM/yy')`), the charges CSV export and the matching screen
(`packages/client/src/components/charge-matches/index.tsx:91`). The ledger dates feed the
business-ledger CSV export and the yearly ledger report
(`packages/client/src/components/reports/yearly-ledger/`). So these are probably high-traffic
sources of wrong dates.

### 2. Date-only meaning stored as a datetime (wrong DB type)

| DB column                                                                             | DB type             | GraphQL                                                                                 | Notes                                                                                                                                                                                                                                                                                                                                                                          |
| ------------------------------------------------------------------------------------- | ------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `misc_expenses.value_date`                                                            | `timestamp` (no TZ) | `MiscExpense.valueDate: DateTime!`, `Insert/UpdateMiscExpenseInput.valueDate: DateTime` | [#1734](https://github.com/Urigo/accounter-fullstack/issues/1734) reported a one-day shift caused by this being a datetime. The column and API are still datetimes, and the client shows it with `format(new Date(valueDate), 'yyyy-MM-dd')` (`components/charges/extended-info/misc-expenses.tsx:72`). Decide: date-only (like `invoice_date` next to it) or a real datetime. |
| `deel_invoices.due_date`, `contract_start_date`, `deel_workers.contract_start_date`   | `timestamptz`       | —                                                                                       | Calendar dates in meaning. `Mutation.addDeelContract(contractStartDate)` is already `TimelessDate`.                                                                                                                                                                                                                                                                            |
| `otsar_hahayal_ils_account_transactions.date_of_business_day`, `date_of_registration` | `timestamptz`       | scraper input `String`                                                                  | Raw bank data. The business day is date-only.                                                                                                                                                                                                                                                                                                                                  |

### 3. Server-side conversions that depend on a timezone

- `Transaction.effectiveDate` (`TimelessDate`) prefers `debit_date_override`, then
  **`debit_timestamp`** (`timestamp`, no TZ), then `debit_date`
  (`modules/transactions/helpers/effective-date.helper.ts`). `debit_timestamp` is only set for
  crypto transactions: the transactions SQL in the migrations copies it from
  `kraken_ledger_records.value_date` / `etherscan_transactions.event_date` and leaves it `NULL` for
  bank and card rows. It has no offset, so the day it yields is the date part of whatever wall-clock
  time the scraper stored. That may be UTC rather than Israel time, so a transaction late in the
  evening or early in the morning can land on a different day. Turning an instant into a day should
  use one fixed business timezone.
- **VAT / PCN months:** `startOfMonth(new Date(monthDate))` in
  `modules/reports/resolvers/get-vat-records.resolver.ts:57`,
  `modules/reports/resolvers/pcn874.resolver.ts:113` and `modules/reports/helpers/pcn.helper.ts:244`
  reads a `yyyy-mm-dd` string as UTC midnight. On a server west of UTC, the 1st of a month becomes
  the previous month. The VAT report client has the same issue in the browser:
  `vat-monthly-report/index.tsx:132` (report title) and `vat-monthly-report-filters.tsx:47` (month
  picker default).
- `salaries.month` (`text`, `yyyy-MM`): `insert-salary.resolver.ts:31` normalises other inputs with
  `format(new Date(month), 'yyyy-MM')`, which has the same UTC-midnight problem.

### 4. True datetimes stored as `timestamp` without time zone

These are real instants, but the DB does not record their offset. Values written from JS use the
server's timezone, values written by SQL (for example a `now()` default) use the DB session's
timezone, and node-pg reads them back in the server's timezone. That is stable only while all of
these agree and never change. Consider migrating them to `timestamptz`:

- `charges.created_at` / `updated_at` (and `extended_charges.created_at` / `updated_at`)
- `transactions.created_at` / `updated_at` / `debit_timestamp`
- `ledger_records.created_at` / `updated_at`
- `financial_entities.created_at` / `updated_at`
- `dynamic_report_templates.created_at` / `updated_at`
- `etherscan_transactions.event_date`, `kraken_ledger_records.value_date`,
  `kraken_trades.value_date`
- `crypto_exchange_rates.date` / `sample_date`

### 5. Dates typed as `String` / `Int` in GraphQL

These carry no type guarantee. Each should either be `TimelessDate` / `DateTime`, or documented as
raw pass-through.

- **Document issuing:** `DocumentDraft.date` / `dueDate`, `DocumentPaymentRecord.date`,
  `DocumentIssueInput.date` / `dueDate`, `DocumentPaymentRecordInput.date`. All are document dates
  handled as plain strings.
- **System timestamps as `String`:** `EmailIngestionAlias.createdAt` / `updatedAt`,
  `IngestGrant.expiresAt`, `IngestEmailInput.receivedAt`, `IngestControlInput.receivedAt`.
- **Other:** `InsertedTransactionSummary.date` (String), `Salary.month` / `SalaryRecordInput.month`
  (`yyyy-MM` String), `YearOfRelevance.year` (String, while `YearOfRelevanceInput.year` is
  `TimelessDate`).
- **`Int` dates:** `BankFinancialAccount.accountAgreementOpeningDate` / `accountDealDate` /
  `accountUpdateDate` (and their insert/update inputs), backed by `integer` columns in
  `financial_accounts` / `financial_bank_accounts` (most likely `yyyymmdd` from the bank). Also
  `PoalimIlsTransactionInput.originalEventCreateDate`, backed by
  `poalim_ils_account_transactions.original_event_create_date` (`integer`).
- **Year numbers** (`Int` `year`, `reportYear`, `fromYear`, …) are fine as they are: a year has no
  timezone problem.
- **Scraper ingestion inputs** (`AmexTransactionInput`, `IsracardTransactionInput`,
  `CalTransactionInput`, `MaxTransactionInput`, `DiscountTransactionInput`, `Poalim*Input`,
  `OtsarHahayal*Input`) pass raw bank strings on purpose. What matters is how they are parsed into
  the `date` columns above.

### 6. Date-like DB columns that are not `date`

- `employees.birth_date`, `employees.training_fund_start_date`: `text`
- `salaries.month`: `text` (`yyyy-MM`)
- `poalim_securities.expiration_date`, `poalim_securities_transactions.expiry_date`: `text`
- `financial_accounts.*_date`, `financial_bank_accounts.*_date` (opening / deal / update): `integer`
- `poalim_ils_account_transactions.original_event_create_date` (`integer`), `expanded_event_date`
  (`bigint`)
- `etana_account_transactions.time`: named "time" but typed `date`. The Etana scraper parses a full
  `Date` (`packages/etana-scraper/src/etana.ts:44`), and the column keeps only the day.
- Raw scraper tables (`amex_*`, `isracard_*`, `cal_*`, `bank_discount_*`, `poalim_*` `formatted_*`,
  `poalim_swift_*`) keep bank-formatted strings next to the parsed `date` columns.

## Date-only fields (correctly typed)

### DB `date` columns (73 table columns + 12 view columns)

| Area                    | Columns                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Documents               | `documents.date`, `documents.vat_report_date_override`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Charges                 | `charge_spread.year_of_relevance`; view `extended_charges`: `documents_min_date`, `documents_max_date`, `ledger_min/max_invoice_date`, `ledger_min/max_value_date`, `transactions_min/max_debit_date`, `transactions_min/max_event_date`                                                                                                                                                                                                                                                                                                  |
| Transactions            | `transactions.event_date`, `debit_date`, `debit_date_override`                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Ledger                  | `ledger_records.invoice_date`, `value_date`; `user_context.ledger_lock`                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Misc expenses           | `misc_expenses.invoice_date`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| VAT / tax / reports     | `pcn874.month_date` (first day of the VAT month), `vat_value.date`, `corporate_tax_variables.date`, `dynamic_report_templates.from_date` / `to_date`, `dynamic_report_template_snapshots.from_date` / `to_date`                                                                                                                                                                                                                                                                                                                           |
| Business / tenant setup | `businesses_admin.registration_date`, `business_registration_start_date`; `user_context.date_established`; `clients_contracts.start_date` / `end_date`; `employees.start_work_date` / `end_work_date`                                                                                                                                                                                                                                                                                                                                     |
| Assets & finance        | `bank_deposits.open_date` / `close_date`, `depreciation.activation_date`, `dividends.date`, `exchange_rates.exchange_date`                                                                                                                                                                                                                                                                                                                                                                                                                |
| Business trips          | `business_trips_attendees.arrival` / `departure`, `business_trips_employee_payments.date` / `value_date`, `business_trips_tax_variables.date`; view `extended_business_trip_transactions.date` / `value_date`                                                                                                                                                                                                                                                                                                                             |
| Raw bank / card data    | `poalim_{ils,usd,eur,gbp,cad,foreign}_account_transactions` (`event_date`, `value_date`, `executing_date`, `validity_date`), `poalim_deposits_account_transactions` (5 columns), `poalim_securities_transactions` (8 columns), `max_creditcard_transactions` (`purchase_date`, `payment_date`, `deal_data_processing_date`), `otsar_hahayal_creditcard_transactions` (`date`, `charge_date`), `otsar_hahayal_foreign_account_transactions` (`date`, `value_date`), `etherscan_transactions.value_date`, `etana_account_transactions.time` |

Month and year values are date-only too: `pcn874.month_date` and the VAT `monthDate` arguments use
the first of the month; `salaries.month` is a `yyyy-MM` string;
`user_context.initial_accounter_year`, `annual_audit_step_status.year` and `recovery.year` are
integers.

### GraphQL `TimelessDate` (71 output fields, 74 input fields, 34 arguments, 7 interface fields)

<details>
<summary>Output and interface fields</summary>

- **Documents:** `FinancialDocument.date` / `vatReportDateOverride` and each document type
  (`Invoice`, `InvoiceReceipt`, `Receipt`, `CreditInvoice`, `Proforma`, `OtherDocument`,
  `Unprocessed`)
- **Transactions:** `Transaction.eventDate` / `effectiveDate` / `sourceEffectiveDate` (on
  `CommonTransaction`, `ConversionTransaction`), `BusinessTransaction.invoiceDate`,
  `BalanceTransactions.date`
- **Business trips:** `BusinessTripExpense.date` / `valueDate` and all five expense types,
  `BusinessTripAttendee.arrivalDate` / `departureDate`
- **Reports:** `VatReportRecord.documentDate` / `chargeDate`, `Pcn874Records.date`,
  `DynamicReportInfo`, `DynamicReportSnapshot`, `DynamicReportSnapshotMeta` `fromDate` / `toDate`,
  `IncomeExpenseChart.fromDate` / `toDate`, `IncomeExpenseChartMonthData.date`,
  `AnnualRevenueReportClientRecord.date`, `DepreciationReportRecord.activationDate` /
  `purchaseDate`, `DateRange.start` / `end`
- **Tax & rates:** `CorporateTax.date`, `TaxAdvancesRate.date`, `ExchangeRates.date`
- **Assets & securities:** `BankDeposit.openDate` / `closeDate`,
  `BankDepositMetadata.potentialCloseDate`, `DepreciationRecord.activationDate`,
  `SecurityExecution.tradeDate` / `valueDate` / `settlementDate` / `paymentDate`,
  `SecurityPosition.historyStartDate` / `lastExecutionDate`
- **Setup:** `AdminBusiness.registrationDate`, `AdminContextInfo.dateEstablished` / `ledgerLock`,
  `UserContext.ledgerLock`, `Contract.startDate` / `endDate`, `MiscExpense.invoiceDate`

</details>

<details>
<summary>Inputs and arguments</summary>

- **Filters:** `ChargeFilter` (`fromDate`, `toDate`, `fromAnyDate`, `toAnyDate`),
  `TransactionsFilters` (`from/toEventDate`, `from/toDebitDate`, `from/toAnyDate`),
  `LedgerRecordsFilters` (`from/toInvoiceDate`, `from/toValueDate`, `from/toAnyDate`),
  `DocumentsFilters`, `BusinessTransactionsFilter`, `IncomeExpenseChartFilters`,
  `SecurityExecutionsFilter` (`from/toTradeDate`), `VatReportFilter.monthDate`
- **Mutation inputs:** `InsertDocumentInput` / `UpdateDocumentFieldsInput` (`date`,
  `vatReportDateOverride`), `UpdateTransactionInput.effectiveDate`,
  `Insert/UpdateMiscExpenseInput.invoiceDate`, all `Add/Update BusinessTrip*ExpenseInput` (`date`,
  `valueDate`), `InsertBusinessTripAttendeeInput` / `BusinessTripAttendeeUpdateInput`
  (`arrivalDate`, `departureDate`), `InsertBusinessTripInput` (`fromDate`, `toDate`),
  `Create/UpdateContractInput`, `Insert/UpdateDepreciationRecordInput.activationDate`,
  `Create/UpdateAdminBusinessInput.registrationDate`, `AdminContextInput` (`dateEstablished`,
  `ledgerLock`), `BootstrapClientInput.dateEstablished`, `CurrencyRateInput.exchangeDate`,
  `TaxAdvancesRateInput.date`, `DynamicReportSnapshotInput`, `YearOfRelevanceInput.year`
- **Arguments:** `ledgerRecordsByDates`, `salaryRecordsByDates`, `transactionsForBalanceReport`,
  `uniformFormat`, `chargesAwaitingMatchQueue`, `accountantApprovalStatus` (`from` / `to` pairs);
  `pcnByDate`, `pcnFile`, `updatePcn874` (`monthDate`); `periodicalDocumentDrafts*`,
  `clientMonthlyChargeDraft` (`issueMonth`); `exchangeRates`, `corporateTaxByDate`,
  `generateFinancialCharges`, `generateRevaluationCharge`, `generateBankDepositsRevaluationCharge`,
  `lockLedgerRecords` (`date`); `annualFinancialCharges`, `generateDepreciationCharge`,
  `generateRecoveryReserveCharge`, `generateTaxExpensesCharge`, `generateVacationReserveCharge`
  (`year`); `createDeposit` / `updateDeposit` (`openDate`, `closeDate`);
  `addDeelContract(contractStartDate)`

</details>

## True datetime fields

### DB `timestamptz` (52 columns, correct)

- **Audit / system columns:** `created_at` / `updated_at` on `annual_audit_step_status`,
  `bank_discount_transactions`, `business_users`, `businesses_securities`,
  `cal_creditcard_transactions`, `documents`, `email_ingestion_alias_routing`,
  `email_ingestion_quarantine`, `provider_credentials`; `created_at` only on
  `api_key_permission_overrides`, `api_keys`, `audit_logs`, `deel_invoices`,
  `dynamic_report_template_snapshots`, `email_ingestion_dedup_fingerprints`,
  `email_ingestion_grants`, `email_ingestion_idempotency_keys`, `email_ingestion_replay_nonces`,
  `invitations`, `permissions`, `roles`, `security_identifiers`, `super_admins`,
  `user_permission_overrides`; `users.created`; `migration.date`
- **Lifecycle events:** `annual_audit_step_status.completed_at`, `api_keys.last_used_at` /
  `revoked_at`, `invitations.accepted_at` / `expires_at`, `email_ingestion_grants.consumed_at` /
  `expires_at`, `email_ingestion_replay_nonces.expires_at`, `deel_invoices.issued_at` / `paid_at` /
  `approve_date`
- **Bank data:** `poalim_securities.as_of_date`, the quote time the bank sends (for example
  `2024-01-15T17:14:14.1886720+02:00`), exposed as `Security.asOfDate: DateTime!`
- Also `timestamptz` but date-only in meaning: see mismatch section 2.

### DB `timestamp` without time zone (17 table columns + 2 view columns)

Listed in mismatch section 4 (real instants stored without an offset), plus
`misc_expenses.value_date` in section 2.

### DB `time`

- `max_creditcard_transactions.deal_data_purchase_time`: time of day of a card purchase, next to the
  date-only `purchase_date`.

### GraphQL `DateTime` (100 output fields, 13 interface fields, 2 input fields)

Correct use (real instants): `createdAt` / `updatedAt` on `Business`, `FinancialEntity`,
`LtdFinancialEntity`, `PersonalFinancialEntity`, `TaxCategory`, `Transaction` (+ implementations),
`ChargeMetadata`; `BusinessUser.createdAt`, `ApiKey.createdAt` / `lastUsedAt`,
`Invitation.expiresAt`, `InvitationPayload.expiresAt`, `AnnualAuditStepStatusInfo.completedAt` /
`updatedAt`, `DynamicReportInfo.created` / `updated`, `DynamicReportLeafApproval.setAt`,
`DynamicReportSnapshot.createdAt`, `DynamicReportSnapshotMeta.createdAt`,
`ProviderCredentialResult.configuredAt`, `ProviderCredentialStatus.configuredAt`,
`Security.asOfDate`, `Transaction.exactEffectiveDate` (from `transactions.debit_timestamp`). The API
type is right for these, but several are stored as `timestamp` without time zone (section 4).

Incorrect use (date-only in meaning): the charge min/max dates, the ledger record dates and
`MiscExpense.valueDate`. See mismatch sections 1 and 2.

## Open questions

1. **What `TZ` does the production server run with, and what is the DB session `TimeZone`?** Nothing
   in the repo sets either (no `TZ` in the compose file, workflows or code). Today the server-side
   conversions in section 3, and every read and write of `timestamp` without time zone, quietly
   depend on them.
2. **Which timezone defines the calendar day** when an instant is turned into a date (for example
   `debit_timestamp` → effective date)? `Asia/Jerusalem` is the natural choice for Israeli
   bookkeeping, but it should be a single named constant.
3. **`misc_expenses.value_date`:** should it become date-only, or does it need a time of day?

## Reproducing the DB list

```sql
select c.table_name, c.column_name, c.data_type, t.table_type
from information_schema.columns c
join information_schema.tables t using (table_schema, table_name)
where c.table_schema = 'accounter_schema'
  and c.data_type in ('date', 'timestamp with time zone', 'timestamp without time zone',
                      'time without time zone', 'time with time zone')
order by t.table_type, c.data_type, c.table_name, c.column_name;
```
