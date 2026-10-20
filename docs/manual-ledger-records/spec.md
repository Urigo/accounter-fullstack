# Spec: Manual ledger record editing & insertion (POC)

## Context

Users want to edit stored ledger records directly and to insert new ones manually under a charge.

- **Edits** change `accounter_schema.ledger_records` directly. The charge view already compares
  stored records with a freshly generated set (`Ledger.validate`), so a manual edit appears as a
  diff that suggests regenerating back. Example: invoice date changed from 2025-01-01 to 2025-02-02.
- **Inserting** a record also creates a backing entity (document or misc expense) derived from the
  record's fields.

This is a POC, so the implementation is minimal and up front: no new tables, no migrations, no
changes to regeneration or diff logic.

## Decisions (agreed in Q&A)

Superseded in places by [_Implementation status_](#implementation-status) below.

| #   | Topic            | Decision                                                                                                                                                                                                                                                                                              |
| --- | ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Insert model     | Save the ledger record **exactly as typed**, and also create the backing entity. There is no link column between them. If the regenerated ledger differs, the existing diff UI shows it.                                                                                                              |
| 2   | Operations       | **Document** and **Misc expense** only. **Transaction is deferred**: there is no manual transaction source, and adding one needs a migration plus an account picker.                                                                                                                                  |
| 3   | Document fields  | type = `INVOICE`. VAT = the entity2 amount when entity2 is the admin context's `inputVatTaxCategoryId`/`outputVatTaxCategoryId`, else 0. serial number = reference. date = invoice date. Amount and currency come from the record.                                                                    |
| 4   | Document parties | Auto-resolve: the side whose entity1 is a `business` (not a `tax_category`) is the counterparty, and the charge owner is the other party. Counterparty on credit → creditor = counterparty, debtor = owner. On debit → the reverse. If both or neither entity1 is a business, the insert is rejected. |
| 5   | Slots & amounts  | debit1 and credit1 required; debit2 and credit2 optional. A local amount is required for each filled slot. The foreign amount is shown and required only when currency ≠ local currency. Debit and credit local totals must balance (±0.005).                                                         |
| 6   | Locking          | No `locked` input. Inserted records are unlocked. Invoice date and value date must be **after** the ledger lock date. Only unlocked records can be edited.                                                                                                                                            |
| 7   | UI placement     | A "+" button in the ledger accordion header, which now renders even with 0 records. Edit through an optional row-actions column in `LedgerTable` (charge view only, never in reports).                                                                                                                |
| 8   | Misc expense     | Entity1 pair only: creditor = credit1, debtor = debit1, amount = credit1 amount (foreign if present, else local). Invoice date, value date (midnight), currency and description come from the record. entity2 is kept on the ledger record only.                                                      |
| 9   | Delete           | Out of scope.                                                                                                                                                                                                                                                                                         |

**Defaults derived from the above** (I set these; flag any you disagree with):

- **Edit validation:** edit uses the same rules as insert (balanced, both dates after the lock
  date). Edit changes the ledger record only and never touches any entity.
- **Locked charges:** insert is blocked when the charge's ledger is locked (`isChargeLocked`). The
  "+" button is hidden when `metadata.isLedgerLocked`, mirroring the Regenerate button.
- **Charge types:** insert is allowed on every charge type; mismatches show as diffs.
- **Atomic insert:** the entity and the ledger record are written in a single DB transaction.
- **No auto-regenerate:** neither mutation regenerates the ledger. The UI only refetches the charge.
- **Approval:** both mutations call `degradeChargesAccountantApproval` after success (repo rule).
- **Roles:** `@requiresAuth @requiresAnyRole(roles: ["business_owner", "accountant"])`, as for
  `insertMiscExpense` and `insertDocument`.

## Server changes (`packages/server/src/modules/ledger/`)

### Schema (`typeDefs/ledger.graphql.ts`)

- Add `locked: Boolean!` to `LedgerRecord`. The field resolver maps to `locked ?? false`.
- Add two mutations:
  ```graphql
  insertLedgerRecord(chargeId: UUID!, input: LedgerRecordInput!, operation: LedgerRecordOperation!): InsertLedgerRecordResult!
  updateLedgerRecord(ledgerRecordId: UUID!, input: LedgerRecordInput!): UpdateLedgerRecordResult!
  ```
- `enum LedgerRecordOperation { DOCUMENT MISC_EXPENSE }`. Add `TRANSACTION` later, when it is
  supported.
- `input LedgerRecordInput`:
  - `debitEntity1: UUID!`, `creditEntity1: UUID!`, `debitEntity2: UUID`, `creditEntity2: UUID`
  - per slot: `{debit,credit}LocalAmount{1,2}: Float` and `{debit,credit}ForeignAmount{1,2}: Float`
  - `currency: Currency!`, `invoiceDate: TimelessDate!`, `valueDate: TimelessDate!`,
    `description: String`, `reference: String`
- Result unions follow the repo convention:
  `InsertLedgerRecordResult = InsertLedgerRecordSuccess | CommonError`, where the success type
  carries `record: LedgerRecord!` and `charge: Charge!`. The update result is analogous.

### Validation helper (new, in `helpers/manual-ledger-record.helper.ts`)

`validateManualLedgerRecord(input, { defaultLocalCurrency, ledgerLock })` runs these checks:

- `validateLedgerRecordParams` (`helpers/ledger-validation.helper.ts`, reused as-is).
- debit1 and credit1 are present.
- Each filled slot has a local amount.
- Foreign amounts are present exactly when currency ≠ local currency.
- Debit and credit local totals are equal (±0.005).
- `invoiceDate > ledgerLock` and `valueDate > ledgerLock` when `ledgerLock` is set.

### Entity derivation helpers (same file, pure functions, unit-tested)

- `deriveMiscExpenseFromLedgerInput(input, chargeId)` returns `InsertMiscExpenseInput`-shaped
  params, per decision 8.
- `deriveDocumentFromLedgerInput(input, { ownerId, chargeId, entityTypes, inputVatId, outputVatId })`
  returns `DocumentsProvider.insertDocuments` params, per decisions 3 and 4. It throws a validation
  error when the counterparty can't be resolved.
- Entity types (`business` / `tax_category`) come from the financial-entities provider's by-id
  loader (`modules/financial-entities/providers/financial-entities.provider.ts`).

### Resolvers (`resolvers/ledger.resolver.ts`)

**`insertLedgerRecord`**

1. Load the charge (charges provider by-id loader) and reject if it's not found.
2. Read the admin context: `defaultLocalCurrency`, `ledgerLock`, and the VAT tax category ids.
3. Reject if `isChargeLocked` (`helpers/ledger-lock.ts`).
4. Validate with the helper, then derive the entity.
5. Inside `injector.get(TenantAwareDBClient).transaction(async () => { … })`:
   - Insert the entity with `MiscExpensesProvider.insertExpense(...)` or
     `DocumentsProvider.insertDocuments(...)`.
   - Insert the record with
     `LedgerProvider.insertLedgerRecords({ ledgerRecords: [{ …input, chargeId, ownerId: charge.owner_id }] })`.
   - Pattern: `email-ingestion.resolver.ts:100`. Provider queries inside the scope run on the
     transaction client (`tenant-db-client.ts:294`).
6. Call `degradeChargesAccountantApproval(injector, [chargeId])` and return the record and the fresh
   charge.

**`updateLedgerRecord`**

1. Load the record. Reject if it's missing or `locked` (`LedgerLockError`).
2. Validate with the same helper.
3. Call `LedgerProvider.updateLedgerRecord`.
4. Degrade approval for the record's charge and return it.

### Provider (`providers/ledger.provider.ts`)

- Change the unused `updateLedgerRecord` SQL (lines 108-187) from `COALESCE` to a plain `SET` for
  every editable column. With `COALESCE`, clearing debit2/credit2 on edit would silently keep the
  old values.
- Leave `charge_id` and `owner_id` untouched. Keep the existing locked check in the method (line
  414).
- `insertLedgerRecords` is reused unchanged.

Then run `yarn generate` to refresh the pgtyped and GraphQL types.

## Client changes (`packages/client/src/`)

**Form:** a new `components/common/forms/ledger-record-form.tsx`, shared by insert and edit.

- Uses react-hook-form and zod (`zodResolver`). Mirror `common/modals/balance-charge-modal.tsx`.
- Fields:
  - **Operation** select (Document / Misc expense), shown in insert mode only. Transaction is shown
    disabled with the hint "coming soon".
  - **Currency:** `CurrencyCodeInput`.
  - **Invoice date** and **value date:** `DatePickerInput`, with zod `refine` requiring each to be
    after `userContext.context.ledgerLock`. Pattern:
    `business-trip-report/buttons/add-expense-fields.tsx:64`.
  - **Description** and **reference:** text inputs.
  - **Four slot rows** (Debit 1, Credit 1, Debit 2, Credit 2), each with:
    - entity `ComboBox` fed by `useGetFinancialEntities().selectableFinancialEntities`
    - local amount `NumberInput`
    - foreign amount `NumberInput`, shown only when currency ≠
      `userContext.context.defaultLocalCurrency`
- A zod `superRefine` checks the balance and the required slot amounts. Show the running
  debit/credit totals.
- `chargeId` and `ownerId` come from props and are not shown in the form.

**Modals:** `common/modals/insert-ledger-record-modal.tsx` and
`common/modals/edit-ledger-record-modal.tsx`.

- Each uses a shadcn `Dialog` around the form; the edit modal prefills from the row.
- On success, call `onChange`, which the charge view wires to `onExtendedChange`.

**Hooks:** `hooks/use-insert-ledger-record.ts` and `hooks/use-update-ledger-record.ts`, built on
`hooks/use-api-mutation.ts`. Template: `hooks/use-insert-misc-expense.ts`.

**Ledger table** (`components/ledger-table/index.tsx` and `columns.tsx`):

- Add `locked` to the `LedgerRecordsTableFields` fragment.
- Add an optional `onEditRecord?: (record) => void` prop. When it's set, append an actions column.
- Show the edit icon only on stored rows that are not `locked`; generated "New" rows never get one.
- `report-sub-commentary-row.tsx` doesn't pass the prop, so reports stay read-only.

**Charge view** (`components/charges/charge-extended-info.tsx`):

- Render the "Ledger Records" accordion item even when `ledgerCount === 0`.
- Add `InsertLedgerRecordModal` (+ button) next to `RegenerateLedgerRecordsButton` (around L562),
  hidden when `metadata.isLedgerLocked`.
- Pass `onEditRecord` to `LedgerTable`, which opens `EditLedgerRecordModal`.
- Refetch through `onExtendedChange`.

## Out of scope (POC)

- The Transaction operation.
- Deleting ledger records.
- A link between a ledger record and its source entity.
- Changing regeneration so it skips locked or manual records.
- Editing entities from the ledger form.
- A `locked` input.

## Verification

- **Unit tests** (`yarn test`): new `helpers/__tests__/manual-ledger-record.helper.test.ts`.
  - Validation cases: unbalanced, missing slot amount, foreign amount in local currency, missing
    foreign amount, dates on or before the lock date.
  - Misc expense derivation.
  - Document derivation: credit-side counterparty → expense; debit-side → income; VAT from entity2
    only when it's a VAT category; reject when both or neither entity1 is a business.
- **Integration** (`yarn test:integration`), if time permits:
  - Insert with each operation creates exactly one ledger row plus one entity.
  - A forced entity failure leaves no ledger row (transaction rollback).
  - Updating a locked record fails.
- **Codegen and lint:** `yarn generate`, `yarn lint`, `yarn workspace @accounter/server typecheck`.
- **Manual check** (`yarn server:dev` + `yarn client:dev`):
  1. On a charge with no ledger, the ledger section appears with a "+".
  2. Insert a misc expense record. The record appears, the misc expense appears in its tab, and the
     diff shows any mismatch.
  3. Insert a document record with a VAT tax category in debit2. The document is created as INVOICE
     with VAT.
  4. Edit a record's invoice date. The row shows a yellow Diff suggesting the original date, and
     Regenerate restores it.
  5. Locked rows show no edit icon, and a locked charge shows no "+".

## Implementation status

The POC shipped as ten stacked PRs forming one linear chain, steps 1 → 10 (step 6 is based on step
5). The plan is in [`prompt-plan.md`](./prompt-plan.md).

### What shipped

| Step | PR    | What it added                                                                                                                                                                                                                                                    |
| ---- | ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | #4689 | `updateLedgerRecord(ledgerRecordId, input)`, `LedgerRecordInput`, and `locked` and `currency` on `LedgerRecord`. The provider's update SQL now uses a plain `SET`, so an edit can clear Debit 2 / Credit 2.                                                      |
| 2    | #4692 | `validateManualLedgerRecord` in `helpers/manual-ledger-record.helper.ts`. It reports every problem at once and names the slot.                                                                                                                                   |
| 3    | #4693 | `insertLedgerRecord(chargeId, operation: MISC_EXPENSE, input)`. The record and its misc expense are written in one transaction, from `helpers/manual-ledger-record-mutations.helper.ts`.                                                                         |
| 4    | #4695 | `operation: DOCUMENT`. It creates the INVOICE document: the counterparty comes from the slot-1 business, and the VAT from the opposite slot 2.                                                                                                                   |
| 5    | #4696 | DB-backed integration tests (`manual-ledger-records.integration.test.ts`) for both mutations. They cover stored rows, rollback, lock rules, approval re-flagging, other-business rejection and matching the generated ledger.                                    |
| 6    | #4701 | The client insert flow. The charge's ledger section always renders, with a "+" beside "Regenerate Ledger" that opens `LedgerRecordForm` (`components/common/forms/ledger-record-form/`) in `InsertLedgerRecordModal`. Includes the `useInsertLedgerRecord` hook. |
| 7    | #4703 | A currency selector. A foreign currency adds a foreign amount to each line; switching back to the local currency clears them.                                                                                                                                    |
| 8    | #4705 | Optional Debit 2 / Credit 2 lines with a clear (×) action, plus live debit and credit totals and a difference that turns red while unbalanced.                                                                                                                   |
| 9    | #4708 | The edit flow. A pencil in an "Actions" column of the charge's ledger table (unlocked stored rows only, including Diff and Deleted rows) opens `EditLedgerRecordModal`, prefilled with every field. Includes the `useUpdateLedgerRecord` hook.                   |
| 10   | #4709 | End-to-end verification, this section, and the final changeset wording.                                                                                                                                                                                          |

Small differences from the client section above: the form is a folder (`index.tsx`, `schema.ts`,
`ledger-slot-fields.tsx`) rather than one file. The main lines are labelled "Debit" and "Credit",
and the secondary ones "Debit 2" and "Credit 2".

### Decisions added by the plan (prompt-plan.md §1.4)

1. `LedgerRecord.currency: Currency!` is exposed alongside `locked`, so the edit form can prefill
   the record's currency.
2. Amounts must be greater than 0, on the client and the server.
3. Document edge cases:
   - An insert whose counterparty is the charge owner is rejected.
   - VAT is read only from the slot-2 entity on the side opposite the counterparty: Debit 2 for an
     expense, Credit 2 for an income.
4. The local currency is the admin context's `defaultLocalCurrency`.
5. Pure helpers (`manual-ledger-record.helper.ts`) are kept apart from orchestration
   (`manual-ledger-record-mutations.helper.ts`, which takes the injector). Resolvers only delegate.
6. Errors come back as `CommonError` and are never thrown. Validation collects every problem.
7. One changeset, `.changeset/manual-ledger-records.md`, is a patch for `@accounter/server` and
   `@accounter/client`.

### Deviations decided during review

- **Approval is degraded inside the write transaction**, not after commit. The ledger write, the
  backing entity and the charge's re-flagging to PENDING commit or roll back together.
- **The charge or record owner must equal the write-target business.** `insertLedgerRecord` rejects
  a charge of another business in the read scope with a message asking to narrow the business scope.
  `updateLedgerRecord` loads the record scoped to the write target, so a record of another business
  is reported as "Ledger record with id … not found".
- **Every referenced financial entity must be owned by the write-target business.** This covers the
  entities of both insert operations and of an edit. An entity of another business is reported as
  not found in this business.
- **Section header actions moved out of `AccordionTrigger`.** `LedgerSectionHeader` renders
  Regenerate and "+" beside the trigger, so they aren't buttons nested in its `<button>`, and their
  dialogs don't toggle the section.

### Derived entities (as shipped)

Both inserts write the backing entity, the ledger record and the charge's approval re-flagging in
one `TenantAwareDBClient` transaction. If any write fails, none is kept.

- **`MISC_EXPENSE`:**
  - creditor = the Credit 1 entity, debtor = the Debit 1 entity;
  - amount = the Credit 1 amount in the record's currency (foreign if the record is in a foreign
    currency, else local);
  - invoice date, value date (midnight), currency and description come from the record;
  - slot 2 stays on the ledger record only.
- **`DOCUMENT`:** an `INVOICE`.
  - The counterparty is the one slot-1 entity that is a business.
    - On the credit side the document is an expense: creditor = counterparty, debtor = charge owner.
    - On the debit side it is an income, the reverse.
  - The total is the counterparty's slot-1 amount in the record's currency.
  - The serial number is the reference, and the date is the invoice date.
  - VAT is the slot-2 amount on the side opposite the counterparty (Debit 2 for an expense, Credit 2
    for an income), when that slot holds the admin context's input or output VAT tax category.
    Otherwise it is 0.
  - The insert is rejected when neither or both slot-1 entities are businesses, or when the
    counterparty is the charge owner.
- An edit changes the ledger record only. Its misc expense or document is never touched.

### Verification (step 10)

- All gates are green: `yarn generate`, `yarn lint`, `yarn prettier:check`, the server and client
  type checks, `yarn test`, `yarn graphql:validate`, and `yarn test:integration` (which includes
  step 5's DB tests).
- Manual QA ran against the real app: `server:dev` and `client:dev` with the dev auth bypass
  (`ALLOW_DEV_AUTH=1`) on a demo-seeded database. Every item passed:
  - The five checks above.
  - A foreign-currency insert.
  - A document with input VAT on Debit 2, stored as an INVOICE with that VAT.
  - An edit that clears Debit 2.
  - The client blocking unbalanced records and lock-date violations.
  - A server `CommonError` shown as a toast while the dialog stays open.
  - The server rejecting a locked record edit, an insert on a locked charge, and an invalid record
    when called directly.

### Ledger records without a charge

A follow-up planned in [`unlinked-ledger-record.md`](./unlinked-ledger-record.md) and shipped as
five stacked PRs: step 1 is based on the POC's step 10 branch, step 2 and step 3 on step 1, step 4
on step 3, and step 5 on step 4.

| Step | PR    | What it added                                                                                                                                                                                                  |
| ---- | ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | #4712 | `insertLedgerRecord`'s `chargeId` is optional. Without it, a new charge of the write-target business is created in the same transaction as the backing entity and the record, so all three roll back together. |
| 2    | #4713 | DB-backed tests for inserting without a charge: the stored charge and rows, rollback of the new charge, the lock date, and an entity of another business.                                                      |
| 3    | #4714 | `InsertLedgerRecordModal` without a `chargeId` (with `defaultEntityId` prefilling Debit 1), and a "+" on the business page's Ledger tab that refetches the tab.                                                |
| 4    | #4715 | An opt-in "+" in `BusinessExtendedInfo`, turned on only by the trial balance report's expanded entity rows. An insert refetches the expanded records and the report totals, keeping expanded rows open.        |
| 5    | —     | Verification and this section.                                                                                                                                                                                 |

Decisions (`unlinked-ledger-record.md` §1.4), as shipped:

1. **One mutation with an optional `chargeId`**, not a second mutation. Making the argument optional
   is a non-breaking schema change.
2. **The new charge** belongs to the admin context's `ownerId` and is `UNAPPROVED`, with
   `generateCharge`'s other defaults. Its `user_description` is the record's trimmed description,
   else its trimmed reference, else `null`.
3. **Debit 1 is prefilled** with the entity in view (the business, or the trial balance entity). The
   user can change it.
4. **Only the trial balance opts in** among `BusinessExtendedInfo`'s five hosts.
5. **One changeset**, `.changeset/unlinked-ledger-records.md`, grown across the steps.

Rule changes without a charge:

- There is no charge to load, owner-check or lock-check.
- The lock date and entity-ownership rules still apply, and are checked before anything is written.
- The new charge isn't re-flagged for approval, since it starts out `UNAPPROVED`.

Other choices made during implementation:

- `validateLedgerRecordParams` reads only the record's content, so a record whose charge doesn't
  exist yet passes an empty placeholder `chargeId` to it.
- The "+" is not gated by business ownership, matching the business page's other actions. An entity
  outside the write target is rejected by the server as "not found in this business", and the dialog
  stays open.
- Without a charge, the success toast reads "Ledger record created on a new charge". A record dated
  outside the trial balance's range doesn't show in it.
- Refreshing the trial balance after an insert keeps the table mounted rather than showing the
  spinner, so expanded rows stay open. The trial balance provides its refresh through a small
  context (`trial-balance-refresh-context.ts`) instead of drilling it through four components.

Verification:

- Unit, client and integration tests ran against a local Postgres, and the full
  `yarn test:integration` passed twice.
- Lint, prettier, the client type check, the server type check (except its 2 existing errors) and
  `graphql:validate` all pass.
- Real-browser QA of the two new entry points has **not** been run yet.

Deferred:

- "+" in the other `BusinessExtendedInfo` hosts (business ledger list and single views, business
  balance section, dynamic report tree node).
- Choosing an existing charge from those entry points instead of always creating one.

### Deferred

- **The TRANSACTION operation.** It needs a manual transaction source, a migration and an account
  picker. The form shows it disabled ("coming soon").
- **Deleting ledger records.**
- **Regeneration-safe locking.** Regenerate still replaces manual inserts and edits with the
  generated set. Making it skip locked or manual records, and linking a record to its source entity,
  are both left for later.
- **Per-owner local currency.** Multi-business setups use the admin context's `defaultLocalCurrency`
  for every owner.
- Follow-ups found in review:
  - The other charge sections still nest their header buttons inside `AccordionTrigger`. Only the
    ledger section was moved out.
  - `RegenerateLedgerRecordsButton` wraps its `ConfirmationModal` trigger in a `Tooltip` trigger,
    which nests a `<button>` in a `<button>`. React logs this on every charge page.
  - In step 3, the write-target check in `updateLedgerRecord` can't be reached: the record loader
    already filters by owner, so another business's record comes back as "not found" first.
  - The form's difference display rounds 0.005 up to 0.01. A record inside the ±0.005 tolerance can
    therefore show a non-zero difference while still being accepted.
- Found in manual QA:
  - The pencil follows the record's own `locked` flag. On a charge whose ledger is locked by date
    (no "+"), a stored record whose `locked` flag is false still shows the pencil. Saving it then
    requires moving both dates past the lock date.
