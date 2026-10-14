# Manual Ledger Records — Implementation Blueprint & Agent Prompt Plan

Companion to [`spec.md`](./spec.md). The spec's decisions table is binding; this document turns it
into a build order and a series of agent prompts. Each prompt is one reviewable commit that leaves
`main`-quality code behind: green gates, no orphaned code, and something reachable from the API or
the UI.

---

## 1. Blueprint

### 1.1 End-to-end flow

```text
 Charge view (ledger accordion)
   ├─ "+" ──► InsertLedgerRecordModal ─► LedgerRecordForm (zod) ─► useInsertLedgerRecord
   └─ row ✎ ─► EditLedgerRecordModal  ─► LedgerRecordForm (zod) ─► useUpdateLedgerRecord
                                                                     │  GraphQL
 ┌───────────────────────────────────────────────────────────────────▼──────────────────────┐
 │ ledger module                                                                             │
 │  Mutation.insertLedgerRecord / Mutation.updateLedgerRecord   (thin resolvers)            │
 │        │                                                                                  │
 │        ▼                                                                                  │
 │  helpers/manual-ledger-record-mutations.helper.ts   (orchestration, uses the injector)   │
 │    load charge/record → lock checks → validate → derive entity                           │
 │    → TenantAwareDBClient.transaction( insert entity ; insert/update ledger row )         │
 │    → degradeChargesAccountantApproval → { record, charge } | CommonError                │
 │        │ uses                                                                             │
 │        ▼                                                                                  │
 │  helpers/manual-ledger-record.helper.ts   (pure: map / validate / derive — unit tested)  │
 │        │                                                                                  │
 │        ▼                                                                                  │
 │  LedgerProvider · MiscExpensesProvider · DocumentsProvider · FinancialEntitiesProvider   │
 └───────────────────────────────────────────────────────────────────────────────────────────┘
                                                                     │
 Client refetches the charge (onExtendedChange) ◄────────────────────┘
   └─ Ledger.validate compares stored vs generated → Diff / New / Deleted rows (unchanged code)
```

### 1.2 Data mapping

**`LedgerRecordInput` → `ledger_records`** (insert and update; update never touches `charge_id`,
`owner_id`, `locked`)

| Input                              | Column                               |
| ---------------------------------- | ------------------------------------ |
| `{debit,credit}Entity{1,2}`        | `{debit,credit}_entity{1,2}`         |
| `{debit,credit}LocalAmount{1,2}`   | `{debit,credit}_local_amount{1,2}`   |
| `{debit,credit}ForeignAmount{1,2}` | `{debit,credit}_foreign_amount{1,2}` |
| `currency`                         | `currency`                           |
| `invoiceDate` / `valueDate`        | `invoice_date` / `value_date`        |
| `description` / `reference`        | `description` / `reference1`         |

"Slot amount" below means the foreign amount when `currency ≠ local currency`, otherwise the local
amount.

**MISC_EXPENSE → `misc_expenses`**

| Column         | Value                                                                          |
| -------------- | ------------------------------------------------------------------------------ |
| `creditor_id`  | `creditEntity1`                                                                |
| `debtor_id`    | `debitEntity1`                                                                 |
| `amount`       | credit slot-1 amount                                                           |
| `currency`     | `currency`                                                                     |
| `invoice_date` | `invoiceDate`                                                                  |
| `value_date`   | `timelessDateStringToLocalDate(valueDate)` (timestamp; must round-trip by day) |
| `description`  | `description`                                                                  |
| slot 2         | ignored (stays on the ledger row only)                                         |

**DOCUMENT → `documents`**

| Column          | Value                                                                                                            |
| --------------- | ---------------------------------------------------------------------------------------------------------------- |
| counterparty    | the slot-1 entity whose financial-entity `type` is `business` (exactly one must be)                              |
| `creditor_id`   | counterparty if it is on the credit side (expense), else the charge owner                                        |
| `debtor_id`     | counterparty if it is on the debit side (income), else the charge owner                                          |
| `total_amount`  | counterparty's slot-1 amount                                                                                     |
| `currency_code` | `currency`                                                                                                       |
| `vat_amount`    | slot-2 amount on the side opposite the counterparty, if that entity is the input/output VAT tax category; else 0 |
| `type`          | `INVOICE`                                                                                                        |
| `serial_number` | `reference`                                                                                                      |
| `date`          | `invoiceDate`                                                                                                    |
| `description`   | `description`                                                                                                    |
| everything else | `null`                                                                                                           |

### 1.3 Validation rules (identical on client and server)

| Rule        | Detail                                                                                              |
| ----------- | --------------------------------------------------------------------------------------------------- |
| Required    | `debitEntity1`, `creditEntity1`, both slot-1 local amounts, `currency`, both dates                  |
| Slot        | entity ⇒ local amount > 0; foreign currency ⇒ foreign amount > 0; amount without entity is an error |
| Currency    | local currency ⇒ no foreign amounts are sent                                                        |
| Balance     | `abs(Σ debit local − Σ credit local) ≤ 0.005`                                                       |
| Lock date   | `invoiceDate` and `valueDate` strictly after `ledgerLock` (when set)                                |
| Insert only | charge must not be locked (`isChargeLocked`); operation required                                    |
| Edit only   | record must have `locked = false`                                                                   |

### 1.4 Decisions this plan adds on top of the spec

These are implementation choices the spec left open. Change them here before starting if you
disagree.

1. **`LedgerRecord.currency: Currency!`** is exposed alongside `locked`. The edit form needs the
   record's currency to prefill, and today it's only inferable from nullable foreign amounts.
2. **Amounts must be positive (> 0).** The generator always writes absolute values, and the existing
   `validateLedgerRecordParams` already rejects 0.
3. **Document edge cases:**
   - When the counterparty is the charge owner, the insert is rejected.
   - VAT is read only from the slot-2 entity on the side opposite the counterparty: debit2 for an
     expense, credit2 for an income.
4. **Local currency** is the admin context's `defaultLocalCurrency`, the same source
   `insertLedgerRecords` already validates against. Per-owner local currency in multi-business
   setups is out of scope for the POC.
5. **Pure helpers vs. orchestration** live in separate files:
   - `manual-ledger-record.helper.ts` is pure.
   - `manual-ledger-record-mutations.helper.ts` takes the injector.

   Resolvers only delegate.

6. **Errors** come back as `CommonError` and are never thrown, matching
   `regenerateSingleChargeLedgerRecords`. Validation collects every problem (a `string[]`) so the
   user sees them all at once.
7. **One changeset** is grown across steps: `.changeset/manual-ledger-records.md`, a patch bump for
   `@accounter/server` and `@accounter/client`.

---

## 2. Breaking it down

### 2.1 Round 1 — milestones

| #   | Milestone  | Outcome                                                                         |
| --- | ---------- | ------------------------------------------------------------------------------- |
| M1  | Edit API   | `updateLedgerRecord` mutation with full validation                              |
| M2  | Insert API | `insertLedgerRecord` for misc expense and document, atomic, tested against a DB |
| M3  | Insert UI  | "+" in the charge ledger section creates records                                |
| M4  | Edit UI    | pencil on unlocked rows edits records; diffs show up                            |
| M5  | Verify     | gates, QA, docs                                                                 |

### 2.2 Round 2 — first split (too fine, by layer)

```text
M1: a) expose locked/currency   b) fix update SQL        c) input→params mapper
    d) updateLedgerRecord        e) validation rules
M2: f) misc-expense derivation   g) insert orchestration  h) document derivation
    i) integration tests
M3: j) insert hook   k) zod schema   l) form component   m) insert modal   n) charge-view wiring
    o) currency + foreign amounts    p) secondary slots + balance
M4: q) fragment fields   r) record→form mapper   s) actions column   t) edit modal + hook
    u) charge-view wiring
M5: v) QA + docs
```

### 2.3 Round 3 — review and right-sizing

Problems with round 2:

- **Orphans.** b, c, f, h, j, k, l and r would each land code with no caller, which breaks the "no
  orphaned code" rule. A pure helper is only safe to merge when its first consumer arrives in the
  same step.
- **Too small.** a, b and c are each about 20 lines: not worth a review cycle on their own, and
  they're only meaningful together with d.
- **Too big if merged naively.** Folding all of M3 into one step would mean about 700 lines across
  schema, form, modal, hook and wiring, too much for one safe step.

Fixes:

- **Vertical slices.** Every step ends with a working, reachable increment.
  - M1 becomes **Step 1**: the mutation plus the fields, SQL and mapper it needs.
  - **Step 2** tightens validation on that already-wired mutation.
  - M2 becomes **Step 3**, insert with misc expense end to end.
  - **Step 4** adds document as a second branch of the same mutation.
  - **Step 5** adds the DB tests.
- **M3 split by capability, not by layer:**
  - **Step 6** is a fully working insert for the simplest case: slot 1, local currency.
  - **Step 7** adds the currency selector and foreign amounts, and extracts a reusable slot
    component.
  - **Step 8** adds slot 2 and the four-slot balance.

  Each one ships to users.

- **M4 is a single step (Step 9).** Every piece is small, and none is usable without the others.
- **Step 10** is the end-to-end wiring check, QA and docs.

### 2.4 Final steps

| Step | Title                                | Est. size | Wired at end of step                                         | Main risk                           |
| ---- | ------------------------------------ | --------- | ------------------------------------------------------------ | ----------------------------------- |
| 1    | Server: edit API foundation          | ~250 LOC  | `updateLedgerRecord` callable; `locked`/`currency` queryable | owner match in the update `WHERE`   |
| 2    | Server: manual record validation     | ~200 LOC  | update rejects invalid input                                 | rule boundaries                     |
| 3    | Server: insert with MISC_EXPENSE     | ~350 LOC  | `insertLedgerRecord(MISC_EXPENSE)` atomic insert             | transaction scope, TZ round-trip    |
| 4    | Server: DOCUMENT operation           | ~250 LOC  | `insertLedgerRecord(DOCUMENT)`                               | counterparty and VAT derivation     |
| 5    | Server: DB integration tests         | ~250 LOC  | integration project covers both mutations                    | fixture setup                       |
| 6    | Client: insert flow (slot 1, local)  | ~400 LOC  | "+" creates records from the charge view                     | accordion and dialog event bubbling |
| 7    | Client: currency and foreign amounts | ~150 LOC  | foreign-currency inserts                                     | stale foreign values                |
| 8    | Client: secondary slots and balance  | ~150 LOC  | VAT-style four-slot records                                  | multi-slot balance UX               |
| 9    | Client: edit flow                    | ~350 LOC  | pencil edits unlocked rows; diff appears                     | prefill fidelity                    |
| 10   | Verify, polish, docs                 | small     | feature complete                                             | —                                   |

Dependencies are strictly sequential except that **Step 5 can run in parallel with Steps 6–8**,
since it only touches server tests.

---

## 3. Shared preamble (every agent reads this first)

```text
You are implementing ONE step of the "manual ledger records" POC in the accounter-fullstack monorepo
(Yarn 4 workspaces; server = graphql-modules + Postgres + pgtyped; client = React + urql + shadcn/ui).

Read before coding:
- docs/manual-ledger-records/spec.md            (agreed spec — the decisions table is binding)
- docs/manual-ledger-records/prompt-plan.md     (this plan: blueprint §1, your step only)
- CLAUDE.md, packages/server/CLAUDE.md, packages/client/CLAUDE.md, .claude/rules/*.md

Conventions:
- yarn only (never npm / npx / pnpm). ESM imports with a `.js` suffix. TypeScript strict.
- Never edit generated files (`__generated__/`, `packages/client/src/gql/`, `schema.graphql`).
  Run `yarn generate` after any typeDefs, SQL or client-operation change. SQL codegen (pgtyped)
  needs Postgres: `docker compose -f docker/docker-compose.dev.yml up -d db` then
  `yarn workspace @accounter-helper/migrations migration:run`.
- Server: resolvers stay thin and reach providers via `injector.get(...)`; DB access only through
  providers; charge-mutating operations call `degradeChargesAccountantApproval` after success.
  GraphQL types/fields get a description string like their neighbours.
- Client: every mutation lives in a hook under `src/hooks/` built on `useApiMutation`; forms use
  react-hook-form + zod (`zodResolver`) + the shadcn `Form` components; named exports returning
  `ReactElement`; no @testing-library (render with `createRoot` + `act`).
- Write the tests the step lists before the implementation, and watch them fail first.
- Stay inside your step: don't start the next step, don't refactor unrelated code, don't change
  the spec's decisions. If something in the plan is wrong, stop and explain instead of improvising.
- No orphans: by the end of the step every new export has a production caller (schema, resolver,
  or UI) or is test code for one.

Gates — all must pass before you finish (paste the output of any you could not get green):
  yarn generate
  yarn lint
  yarn prettier:check
  yarn build:tools && yarn workspace @accounter/server typecheck    # if server code changed
  yarn workspace @accounter/client tsc --noEmit                     # if client code changed
  yarn test
  yarn test:integration                                             # Step 5 and later, if a DB is available

Finish with ONE commit: `feat(ledger): <step title>`, and a short summary covering what changed,
which tests you added, any deviation from the plan, and anything you couldn't verify.
```

---

## 4. Steps

### Step 1 — Server: edit API foundation

**Builds on:** nothing; this is the first step. **Wired at end:** `updateLedgerRecord` is callable
through GraphQL; `locked` and `currency` are queryable on every `LedgerRecord`.

```text
STEP 1 — Server: edit API foundation (`updateLedgerRecord`)
(Read the shared preamble in docs/manual-ledger-records/prompt-plan.md §3 first.)

Goal
A GraphQL mutation that overwrites one stored, unlocked ledger record in place, plus the record
fields the client needs to edit it. Only the EXISTING minimal param validation applies in this
step; Step 2 adds the full rules.

Context (packages/server/src/modules/ledger/)
- providers/ledger.provider.ts: `updateLedgerRecord` method (~L414) exists but has no callers
  (confirm with grep). Its SQL (~L108-187) wraps every column in COALESCE, so a value can never be
  cleared — editing must be able to clear debit2/credit2. The method already throws LedgerLockError
  for locked rows and calls `reassureOwnerIdExists(params, adminOwnerId)`.
- helpers/ledger-validation.helper.ts: `validateLedgerRecordParams(record, defaultLocalCurrency)`.
- src/shared/errors.ts: `LedgerLockError`.
- Union-result pattern: `GeneratedLedgerRecords` in resolvers/ledger.resolver.ts (~L709) and
  `InsertDocumentResult` / `InsertDocumentSuccessfulResult` in modules/documents (note the
  graphql-eslint disable comment on the id-less success type).
- Unit-test injector mocks: `makeInjector` in
  resolvers/ledger-generation/__tests__/helpers/ledger-generation-mocks.ts.

Tasks
1. typeDefs/ledger.graphql.ts
   a. On `LedgerRecord` add `locked: Boolean!` and `currency: Currency!` (with descriptions).
   b. Add:
        " the editable content of a manual ledger record "
        input LedgerRecordInput {
          debitEntity1: UUID!
          debitLocalAmount1: Float!
          debitForeignAmount1: Float
          creditEntity1: UUID!
          creditLocalAmount1: Float!
          creditForeignAmount1: Float
          debitEntity2: UUID
          debitLocalAmount2: Float
          debitForeignAmount2: Float
          creditEntity2: UUID
          creditLocalAmount2: Float
          creditForeignAmount2: Float
          currency: Currency!
          invoiceDate: TimelessDate!
          valueDate: TimelessDate!
          description: String
          reference: String
        }
   c. `type UpdateLedgerRecordSuccessfulResult { record: LedgerRecord!  charge: Charge! }` and
      `union UpdateLedgerRecordResult = UpdateLedgerRecordSuccessfulResult | CommonError`.
   d. Mutation:
        updateLedgerRecord(ledgerRecordId: UUID!, input: LedgerRecordInput!): UpdateLedgerRecordResult!
          @requiresAuth
          @requiresAnyRole(roles: ["business_owner", "accountant"])
2. providers/ledger.provider.ts — rewrite the `updateLedgerRecord` SQL as a plain `SET col = $param`
   for every editable column: the four entities, the eight foreign/local amounts, currency,
   description, invoice_date, reference1 (from $reference), value_date. Do NOT set charge_id,
   owner_id or locked. Keep `WHERE id = $ledgerId AND owner_id = $ownerId RETURNING *` and keep the
   method's locked check. Run `yarn generate` and fix the generated-type fallout.
3. NEW helpers/manual-ledger-record.helper.ts (pure, no injector):
   - `ledgerRecordInputToParams(input: LedgerRecordInput)` → the column-shaped object shared by
     insert and update, typed as
     `Omit<IInsertLedgerRecordsParams['ledgerRecords'][number], 'chargeId' | 'ownerId'>`;
     optional inputs that are null/undefined become `null`.
4. NEW helpers/manual-ledger-record-mutations.helper.ts:
   - `updateManualLedgerRecord(injector, { ledgerRecordId, input })` →
     `Promise<ResolversTypes['UpdateLedgerRecordResult']>`:
     a. Load the record with `LedgerProvider.getLedgerRecordsByIdLoader.load(id)`; missing →
        CommonError; `locked` → CommonError carrying the LedgerLockError message.
     b. `params = ledgerRecordInputToParams(input)`; run
        `validateLedgerRecordParams(params, defaultLocalCurrency)` (admin context) — a throw becomes
        a CommonError with its message.
     c. `LedgerProvider.updateLedgerRecord({ ...params, ledgerId: id, ownerId: record.owner_id })`
        — pass the record's own owner so multi-business records match the WHERE clause. No row
        returned → CommonError.
     d. `degradeChargesAccountantApproval(injector, [record.charge_id])`; load the charge with
        `ChargesProvider.getChargeByIdLoader`; return
        `{ record: updatedRow, charge: degraded.get(chargeId) ?? charge }`.
     e. Unexpected errors: `console.error` + CommonError — never throw.
5. resolvers/ledger.resolver.ts
   - `Mutation.updateLedgerRecord` → delegates to the helper (one line).
   - `UpdateLedgerRecordResult.__resolveType` (mirror GeneratedLedgerRecords).
   - `LedgerRecord.locked: r => r.locked ?? false`; `LedgerRecord.currency: r => r.currency` (cast to
     the GraphQL Currency type the way neighbouring code does).
6. Tests FIRST, in helpers/__tests__/:
   - manual-ledger-record.helper.test.ts: every input field maps to the right param; absent
     optionals → null.
   - manual-ledger-record-mutations.helper.test.ts (makeInjector mocks for LedgerProvider,
     AdminContextProvider, ChargesProvider, AccountantApprovalProvider or a vi.mock of the degrade
     helper): missing record → CommonError; locked → CommonError and `updateLedgerRecord` never
     called; `validateLedgerRecordParams` failure (e.g. foreign amount with local currency) →
     CommonError; happy path → `updateLedgerRecord` called with `ledgerId`, `record.owner_id` and
     null slot-2 values, degrade called with the charge id, success shape returned.
7. Create `.changeset/manual-ledger-records.md` with `'@accounter/server': patch`, describing
   `updateLedgerRecord` and the new `LedgerRecord.locked` / `currency` fields (style: see other files
   in .changeset/).

Out of scope: insert mutation, new validation rules, any client code.
```

---

### Step 2 — Server: manual ledger record validation

**Builds on:** Step 1 (`updateManualLedgerRecord`, `LedgerRecordInput`). **Wired at end:**
`updateLedgerRecord` enforces every rule in blueprint §1.3 that applies to edits, and returns
readable messages.

```text
STEP 2 — Server: manual ledger record validation rules
(Read the shared preamble in docs/manual-ledger-records/prompt-plan.md §3 first.)

Goal
One pure validator, shared by update now and insert in Step 3, that enforces the spec's form rules
on the server.

Context
- helpers/manual-ledger-record.helper.ts and helpers/manual-ledger-record-mutations.helper.ts
  (from Step 1).
- Admin context: `AdminContextProvider.getVerifiedAdminContext()` → `defaultLocalCurrency`,
  `ledgerLock` (TimelessDateString | undefined).
- Timeless-date helpers: `compareTimelessDates` in src/shared/helpers/timeless-date.ts.

Tasks
1. In helpers/manual-ledger-record.helper.ts add
     export const LEDGER_BALANCE_TOLERANCE = 0.005;
     export function validateManualLedgerRecord(
       input: LedgerRecordInput,
       ctx: { localCurrency: Currency; ledgerLock?: TimelessDateString | null },
     ): string[]
   It returns ALL problems found (empty array = valid). Rules:
   a. Per slot (debit1, credit1, debit2, credit2): an entity requires a local amount > 0; a local or
      foreign amount without an entity is an error.
   b. Currency: if `currency !== localCurrency`, every filled slot needs a foreign amount > 0; if it
      equals localCurrency, no slot may carry a foreign amount.
   c. Balance: |Σ debit local − Σ credit local| ≤ LEDGER_BALANCE_TOLERANCE.
   d. Lock date: when ledgerLock is set, invoiceDate and valueDate must each be strictly after it.
   Messages are end-user readable and name the slot ("Debit 2: amount is required", "Invoice date
   must be after the ledger lock date (2025-12-31)", …).
2. In `updateManualLedgerRecord`, after the locked check: read `defaultLocalCurrency` and
   `ledgerLock`, run the validator, and on errors return a CommonError whose message is the errors
   joined with "\n". Keep the existing `validateLedgerRecordParams` call (it guards provider
   invariants); it must run after the new validator, so users get the friendlier messages first.
3. Tests FIRST (table-driven, helpers/__tests__/manual-ledger-record.helper.test.ts):
   - each slot rule (entity w/o amount, amount w/o entity, zero / negative amount);
   - currency rules both ways;
   - balance boundaries: diff exactly 0.005 passes, 0.006 fails; a four-slot balance
     (credit1 117 = debit1 100 + debit2 17) passes;
   - lock date: equal to lock → error, day after → ok, no lock set → no date errors;
   - several problems at once are all reported.
   Add one case to manual-ledger-record-mutations.helper.test.ts: invalid input → CommonError
   listing the problems, provider not called.
4. Update the changeset text.

Out of scope: insert, client.
```

---

### Step 3 — Server: insert with the MISC_EXPENSE operation

**Builds on:** Steps 1–2 (input type, mapper, validator, mutations helper file). **Wired at end:**
`insertLedgerRecord(operation: MISC_EXPENSE)` creates a misc expense and the typed ledger record
atomically.

```text
STEP 3 — Server: `insertLedgerRecord` with the MISC_EXPENSE operation
(Read the shared preamble in docs/manual-ledger-records/prompt-plan.md §3 first.)

Goal
Insert a manual ledger record under a charge and, in the same DB transaction, create its backing
misc expense. The ledger record is stored exactly as typed (spec decision 1).

Context
- Misc expense insert: MiscExpensesProvider.insertExpense (modules/misc-expenses/providers/
  misc-expenses.provider.ts ~L176), resolver precedent misc-expenses.resolver.ts `insertMiscExpense`.
- Ledger insert: LedgerProvider.insertLedgerRecords (bulk, runs validateLedgerRecordParams).
- Charge lock: helpers/ledger-lock.ts `isChargeLocked(charge, injector, ledgerLock)`.
- Transactions: `injector.get(TenantAwareDBClient).transaction(async () => …)` — precedent
  modules/email-ingestion/resolvers/email-ingestion.resolver.ts ~L100; inside the scope, provider
  queries run on the transaction's client (modules/app-providers/tenant-db-client.ts ~L294).
  Confirm that MiscExpensesProvider and LedgerProvider use TenantAwareDBClient (not a separate pool).
- Dates: `misc_expenses.value_date` is a timestamp; the ledger generator reads it back with
  `dateToTimelessDateString` (local format). Build it with `timelessDateStringToLocalDate`
  (src/shared/helpers/misc.ts) so the day round-trips in every timezone.
- TZ test helpers: `TEST_TIMEZONES`, `useTimezone` (src/__tests__/helpers/timezones.ts); example in
  helpers/__tests__/misc-expenses-ledger.helper.test.ts.

Tasks
1. typeDefs/ledger.graphql.ts:
     " the business operation a manually inserted ledger record represents "
     enum LedgerRecordOperation { MISC_EXPENSE }          # DOCUMENT arrives in Step 4
     type InsertLedgerRecordSuccessfulResult { record: LedgerRecord!  charge: Charge! }
     union InsertLedgerRecordResult = InsertLedgerRecordSuccessfulResult | CommonError
     insertLedgerRecord(chargeId: UUID!, operation: LedgerRecordOperation!, input: LedgerRecordInput!):
       InsertLedgerRecordResult! @requiresAuth @requiresAnyRole(roles: ["business_owner", "accountant"])
2. helpers/manual-ledger-record.helper.ts:
   `deriveMiscExpenseFromLedgerInput(input, { localCurrency })` → insertExpense params without
   chargeId/ownerId: creditorId = creditEntity1; debtorId = debitEntity1; amount = credit slot-1
   amount (foreign when currency ≠ local, else local); currency; description ?? null; invoiceDate;
   valueDate = timelessDateStringToLocalDate(input.valueDate). Slot 2 is intentionally ignored.
3. helpers/manual-ledger-record-mutations.helper.ts:
   `insertManualLedgerRecord(injector, { chargeId, operation, input })` →
   `Promise<ResolversTypes['InsertLedgerRecordResult']>`:
   a. Load the charge (ChargesProvider.getChargeByIdLoader); missing → CommonError.
   b. Admin context → defaultLocalCurrency, ledgerLock. `isChargeLocked` → CommonError
      ("The charge's ledger is locked").
   c. `validateManualLedgerRecord` → CommonError on errors.
   d. Derive the entity with an exhaustive `switch (operation)` (only MISC_EXPENSE today). Derive
      BEFORE opening the transaction.
   e. In one `TenantAwareDBClient.transaction`: insertExpense({ ...derived, chargeId,
      ownerId: charge.owner_id }) then insertLedgerRecords({ ledgerRecords: [{
      ...ledgerRecordInputToParams(input), chargeId, ownerId: charge.owner_id }] }). Throw inside
      the callback if either returns no row so everything rolls back.
   f. After commit: degradeChargesAccountantApproval(injector, [chargeId]); return
      `{ record, charge: degraded.get(chargeId) ?? charge }`.
   g. Any error → console.error + CommonError (never throw).
4. resolvers/ledger.resolver.ts: `Mutation.insertLedgerRecord` delegates;
   `InsertLedgerRecordResult.__resolveType`.
5. Tests FIRST:
   - derive helper: local and foreign currency mapping; slot 2 ignored; under
     `describe.each(TEST_TIMEZONES)` + `useTimezone`, `dateToTimelessDateString(derived.valueDate)`
     equals `input.valueDate`.
   - orchestration (makeInjector + a TenantAwareDBClient mock whose `transaction(fn)` invokes `fn`;
     `vi.mock('../ledger-lock.js')` to control isChargeLocked): charge missing; charge locked;
     validation errors; happy path — expense inserted before the ledger row, both inside the
     transaction callback, degrade called, success shape; ledger insert throws → CommonError.
6. Update the changeset text.

Out of scope: DOCUMENT (Step 4), DB-backed tests (Step 5), client.
```

---

### Step 4 — Server: the DOCUMENT operation

**Builds on:** Step 3 (`insertManualLedgerRecord`, the operation switch, transaction). **Wired at
end:** `insertLedgerRecord(operation: DOCUMENT)` creates an INVOICE document derived from the
record.

```text
STEP 4 — Server: DOCUMENT operation for `insertLedgerRecord`
(Read the shared preamble in docs/manual-ledger-records/prompt-plan.md §3 first.)

Goal
Add the second operation. The document is derived per blueprint §1.2 and plan decision 3.

Context
- Document insert: DocumentsProvider.insertDocuments (modules/documents/providers/
  documents.provider.ts ~L580; it applies Math.abs to amount). The full param object is built in
  documents.resolver.ts `insertDocument` (~L496) — mirror its null defaults.
- `DocumentType` enum: src/shared/enums.ts.
- Entity types: FinancialEntitiesProvider.getFinancialEntityByIdLoader (modules/financial-entities/
  providers/financial-entities.provider.ts ~L129); rows carry `type` ('business' | 'tax_category' | …).
- VAT tax categories: `adminContext.authorities.inputVatTaxCategoryId` / `outputVatTaxCategoryId`.

Tasks
1. Add `DOCUMENT` to `LedgerRecordOperation`.
2. helpers/manual-ledger-record.helper.ts:
   `deriveDocumentFromLedgerInput(input, ctx)` where ctx = { ownerId, localCurrency,
   entityTypes: Map<string, string>, inputVatTaxCategoryId?: string | null,
   outputVatTaxCategoryId?: string | null } → document params without chargeId/ownerId, or throws
   `Error` with a user-readable message:
   - Counterparty: exactly one of debitEntity1 / creditEntity1 has type 'business'. Both or neither
     → "A document needs exactly one business among the main debit and credit entities".
     Counterparty === ownerId → error.
   - Credit-side counterparty (expense): creditorId = creditEntity1, debtorId = ownerId.
     Debit-side counterparty (income): debtorId = debitEntity1, creditorId = ownerId.
   - amount = counterparty slot-1 amount (foreign when currency ≠ local, else local);
     currencyCode = currency.
   - vat: take the slot-2 entity on the side OPPOSITE the counterparty (expense → debit2,
     income → credit2). If it equals the input or output VAT tax category id, vat = that slot's
     amount (foreign/local as above); otherwise 0.
   - documentType = DocumentType.Invoice; serialNumber = reference ?? null; date = invoiceDate;
     description = description ?? null; image, file, vatReportDateOverride, noVatAmount,
     allocationNumber, exchangeRateOverride, fileHash, remarks = null.
3. insertManualLedgerRecord: DOCUMENT branch — before the transaction, load
   `getFinancialEntityByIdLoader.loadMany([debitEntity1, creditEntity1])` (an Error or missing
   entry → CommonError), build the type map, derive (a throw → CommonError). Inside the existing
   transaction call `DocumentsProvider.insertDocuments({ documents: [{ ...derived, chargeId,
   ownerId: charge.owner_id }] })` instead of the misc-expense insert. Keep the switch exhaustive.
4. Tests FIRST:
   - derive: expense; income; VAT from the input category on debit2; VAT from the output category
     on credit2; VAT = 0 when slot 2 is another tax category; slot 2 on the counterparty side never
     becomes VAT; foreign currency uses foreign amounts; both-business, neither-business and
     counterparty-is-owner errors.
   - orchestration: DOCUMENT happy path calls insertDocuments (not insertExpense) inside the
     transaction; entity lookup failure → CommonError; derivation error → CommonError and no
     transaction opened.
5. Update the changeset text.

Out of scope: DB-backed tests, client, the TRANSACTION operation.
```

---

### Step 5 — Server: DB-backed integration tests

**Builds on:** Steps 1–4. It can run in parallel with Steps 6–8. **Wired at end:** the integration
project exercises both mutations against Postgres.

```text
STEP 5 — Server: DB-backed integration tests for manual ledger records
(Read the shared preamble in docs/manual-ledger-records/prompt-plan.md §3 first.)

Goal
Prove the real SQL, the transaction rollback and the lock behaviour against Postgres.

Context
- Integration project: `yarn test:integration`; run a single file with
  `yarn vitest run --project integration <path>`.
- Harness: TestDatabase (src/__tests__/helpers/db-setup.ts), fixtures/seeding
  (src/__tests__/helpers/fixture-loader.ts, seed-helpers.ts), injector
  `createLedgerTestContext` (src/test-utils/ledger-injector.ts).
- Pattern to copy: modules/ledger/__tests__/ledger-scenario-a.integration.test.ts — note its
  afterEach cleanup with `app.current_business_id`, and do NOT close the shared pool.

Tasks — new modules/ledger/__tests__/manual-ledger-records.integration.test.ts:
1. MISC_EXPENSE insert → exactly one misc_expenses row and one ledger_records row on the charge;
   ledger values are exactly as typed; `locked` is false.
2. DOCUMENT insert (supplier business on credit1, expense tax category on debit1, input-VAT tax
   category on debit2) → one INVOICE document: creditor = supplier, debtor = owner, total and VAT
   as derived, serial number = reference.
3. Rollback: `vi.spyOn` the context's LedgerProvider.insertLedgerRecords to reject →
   CommonError, and NO misc_expenses row persisted.
4. Update: clearing slot 2 leaves NULL columns; changing the invoice date persists.
5. Update of a row set `locked = true` via SQL → CommonError; the row is unchanged.
6. Lock date: set the admin ledger lock, insert with invoiceDate equal to it → CommonError and
   nothing persisted.
7. Best effort, the spec's core promise:
   - Insert a local-currency misc-expense record that matches what the generator would produce.
   - Assert `ledgerRecordsGenerationFullMatchComparison` (helpers/ledgrer-storage.helper.ts),
     comparing `ledgerGenerationByCharge` output with the stored rows, reports a full match.
   - Update the record's invoice date and assert it no longer fully matches.
   - If the generator needs more fixtures than is reasonable, leave this case out with a comment
     explaining why.
Clean up every row you create in afterEach. If Postgres isn't available in your environment, still
write the tests, run `yarn test` plus the server typecheck, and state plainly that the
integration tests were NOT executed.

Out of scope: production code changes. If a test exposes a bug, fix it in the smallest possible way
and call it out in your summary.
```

---

### Step 6 — Client: insert flow (main lines, local currency)

**Builds on:** Steps 1–4 (`insertLedgerRecord` exists). **Wired at end:** a "+" in every charge's
ledger section opens a form that creates a record plus its entity, and the section refreshes.

```text
STEP 6 — Client: insert flow (slot 1, local currency)
(Read the shared preamble in docs/manual-ledger-records/prompt-plan.md §3 first.)

Goal
The simplest useful insert: Debit 1 / Credit 1 in the local currency, operation Misc expense or
Document. Later steps grow the same form; build it so they can.

Context (packages/client/src/)
- Charge view: components/charges/charge-extended-info.tsx.
  - The ledger AccordionItem (~L554) renders only when `hasLedgerRecords`.
  - `RegenerateLedgerRecordsButton` sits inside the AccordionTrigger and is hidden when
    `charge.metadata.isLedgerLocked`.
  - Refetch with `onExtendedChange` (~L180).
  - Default-open logic (~L286).
- Button and modal pattern: components/common/buttons/regenerate-ledger-records-button.tsx
  (Tooltip + ConfirmationModal around an icon Button).
- Form pattern: components/common/modals/balance-charge-modal.tsx (zod + ComboBox +
  DatePickerInput). Inputs live in components/common/inputs/: ComboBox, NumberInput,
  DatePickerInput, CurrencyCodeInput.
- Entity options: hooks/use-get-financial-entities.ts → `selectableFinancialEntities`.
- Ledger lock date and local currency come from `UserContext` (providers/user-provider.tsx); usage
  example: components/common/business-trip-report/buttons/add-expense-fields.tsx ~L64.
- Union-result mutation hook: hooks/use-update-business.ts (`commonErrorPath`).
- Zod schema tests: components/charges/charges-filters/__tests__/schema.test.ts. Codegen enums are
  const objects, so use `z.enum(Obj)`.

Tasks
1. hooks/use-insert-ledger-record.ts — operation
     mutation InsertLedgerRecord($chargeId: UUID!, $operation: LedgerRecordOperation!,
                                 $input: LedgerRecordInput!) {
       insertLedgerRecord(chargeId: $chargeId, operation: $operation, input: $input) {
         __typename
         ... on InsertLedgerRecordSuccessfulResult { record { id } }
         ... on CommonError { message }
       }
     }
   built on useApiMutation (commonErrorPath 'insertLedgerRecord', loading/success/error toasts).
   Run `yarn generate`.
2. NEW components/common/forms/ledger-record-form/schema.ts:
   - `export const LEDGER_BALANCE_TOLERANCE = 0.005;`
   - `buildLedgerRecordFormSchema({ mode: 'insert' | 'edit', localCurrency, ledgerLock })`
     returns a zod object with these fields:
     - `operation`: `LedgerRecordOperation`; required in insert mode, absent in edit mode.
     - `invoiceDate`, `valueDate`: TIMELESS_DATE_REGEX from helpers/consts.ts, each strictly after
       ledgerLock when set ("Date must be after <lock>").
     - `description`, `reference`: optional strings.
     - `debitEntity1`, `creditEntity1`: required.
     - `debitLocalAmount1`, `creditLocalAmount1`: required numbers > 0.
     - A `superRefine` checks |debit − credit| ≤ tolerance, with the error on a "balance" path.
   - `type LedgerRecordFormValues`.
   - `formValuesToLedgerRecordInput(values, { localCurrency }): LedgerRecordInput`:
     currency = localCurrency for now; '' → null; every slot-2 and foreign field → null.
3. NEW components/common/forms/ledger-record-form/index.tsx —
   `LedgerRecordForm({ mode, defaultValues?, submitting, onSubmit })`, using react-hook-form +
   zodResolver + the shadcn Form components. Fields:
   - **Operation** select, insert mode only: Misc expense, Document, and a DISABLED
     "Transaction (coming soon)" option.
   - **Currency**, shown read-only as the local currency.
   - **Invoice date**, **Value date**, **Description**, **Reference**.
   - A **Debit** row and a **Credit** row, each with an entity ComboBox and a local amount
     NumberInput.
   - Balance error message, and a submit button showing `<Spinner />` while submitting.
4. NEW components/common/modals/insert-ledger-record-modal.tsx —
   `InsertLedgerRecordModal({ chargeId, onDone })`:
   - **Trigger:** an icon Button (lucide `Plus`) with the Tooltip "Add ledger record", sized like
     RegenerateLedgerRecordsButton.
   - **Dialog:** a shadcn Dialog containing LedgerRecordForm in insert mode.
   - **Submit:** call the hook with `formValuesToLedgerRecordInput(...)`.
     - Success: close the dialog and call `onDone()`.
     - CommonError: keep the dialog open; the hook already toasts.
   - **Events:** the trigger renders inside an AccordionTrigger, and React events bubble through
     portals. Make sure neither the trigger nor clicks inside the dialog toggle the accordion.
     Check how ConfirmationModal handles this and stop propagation where needed.
   - **Export:** through the components/common barrel, like sibling modals.
5. components/charges/charge-extended-info.tsx:
   - Render the ledger AccordionItem for every charge: remove the `hasLedgerRecords` gate and the
     trigger's `disabled`. Keep the default-open behaviour tied to hasLedgerRecords.
   - Render `<InsertLedgerRecordModal chargeId={charge.id} onDone={onExtendedChange} />` next to the
     Regenerate button, under the same `!charge.metadata?.isLedgerLocked` condition.
   - Check that a charge with 0 stored records renders sensibly. Generated rows showing as "New" is
     expected.
6. Tests FIRST — ledger-record-form/__tests__/schema.test.ts:
   - A minimal valid input passes.
   - Operation is required in insert mode and ignored in edit mode.
   - Lock date: a date equal to the lock is rejected, the next day accepted, and no lock set
     accepts anything.
   - Balance: an unbalanced record is rejected; a difference of exactly 0.005 is accepted.
   - An amount ≤ 0 is rejected.
   - Mapper output: currency is the local one, and slot 2 and foreign fields are null.
7. Changeset: add `'@accounter/client': patch` to .changeset/manual-ledger-records.md and describe
   the "+" flow.

Out of scope: currency selection and foreign amounts (Step 7), slot 2 (Step 8), editing (Step 9).
```

---

### Step 7 — Client: currency and foreign amounts

**Builds on:** Step 6 (form, schema, mapper, modal). **Wired at end:** users can insert
foreign-currency records through the existing "+" flow.

```text
STEP 7 — Client: currency selector and foreign amounts
(Read the shared preamble in docs/manual-ledger-records/prompt-plan.md §3 first.)

Goal
Support non-local currencies, and extract the per-line UI into a reusable component that Step 8
reuses for slot 2.

Context
- components/common/forms/ledger-record-form/{index.tsx, schema.ts} from Step 6.
- CurrencyCodeInput: components/common/inputs/currency-input.tsx.

Tasks
1. NEW components/common/forms/ledger-record-form/ledger-slot-fields.tsx —
   `LedgerSlotFields({ side: 'debit' | 'credit', index: 1 | 2, showForeign: boolean,
   required: boolean })`.
   - Uses useFormContext.
   - Field names: `${side}Entity${index}`, `${side}LocalAmount${index}`,
     `${side}ForeignAmount${index}`.
   - Replace the two inline slot-1 rows in LedgerRecordForm with it. Slot-1 behaviour must not
     change.
2. Replace the read-only currency with CurrencyCodeInput bound to `currency`, defaulting to
   localCurrency.
3. Set showForeign = (currency !== localCurrency). When the user switches back to the local
   currency, clear any foreign amounts (setValue) so stale values can't be submitted.
4. schema.ts:
   - Add `currency` (z.enum(Currency)) and optional `debitForeignAmount1` / `creditForeignAmount1`.
   - superRefine: in a foreign currency, both slot-1 foreign amounts are required and > 0; in the
     local currency they're ignored.
   - Mapper: send `values.currency`, and send foreign amounts only when currency ≠ local (else null).
5. Tests FIRST:
   - Schema cases for both currency modes.
   - The mapper drops foreign amounts for the local currency and keeps them for a foreign one.
6. Update the changeset text.

Out of scope: slot 2, editing.
```

---

### Step 8 — Client: secondary lines and four-line balance

**Builds on:** Step 7 (`LedgerSlotFields`, currency-aware schema). **Wired at end:** VAT-style
records (for example a document with input VAT on Debit 2) can be entered, and the server derives
the VAT from them.

```text
STEP 8 — Client: secondary lines (Debit 2 / Credit 2) and balance across all lines
(Read the shared preamble in docs/manual-ledger-records/prompt-plan.md §3 first.)

Goal
Complete the form's slot model and match the server's validator (blueprint §1.3).

Tasks
1. Render optional "Debit 2" and "Credit 2" rows with LedgerSlotFields (index 2, required false).
   Each row gets a clear (×) action that resets the line's entity and amounts.
2. schema.ts:
   - Slot-2 fields are optional.
   - Per-slot superRefine for all four lines:
     - an entity needs a local amount > 0, plus a foreign amount > 0 in a foreign currency;
     - an amount without an entity is an error, reported on the entity field.
   - Balance: Σ debit local (1+2) vs Σ credit local (1+2) within LEDGER_BALANCE_TOLERANCE.
3. Totals summary below the lines, driven by useWatch:
   - Debit total, Credit total and Difference.
   - The difference turns destructive-coloured when it exceeds the tolerance.
   - The balance error renders here.
4. Mapper: an empty slot 2 sends entity, local and foreign as null; a filled one sends its values,
   with foreign values only in a foreign currency.
5. Tests FIRST:
   - Slot-2 rules.
   - Balance across four lines: credit1 117 = debit1 100 + debit2 17 passes; off by 0.01 fails.
   - Mapper nulls an empty slot 2.
6. Update the changeset text.

Out of scope: editing.
```

---

### Step 9 — Client: edit flow

**Builds on:** Step 1 (`updateLedgerRecord`, `locked` and `currency` fields) and Steps 6–8 (the
complete form). **Wired at end:** a pencil on unlocked stored rows opens a prefilled form; saving
updates the row, and the diff view then shows the yellow Diff suggesting the generated values.

```text
STEP 9 — Client: edit ledger records from the charge's ledger table
(Read the shared preamble in docs/manual-ledger-records/prompt-plan.md §3 first.)

Goal
Edit unlocked stored records in place, reusing LedgerRecordForm in edit mode.

Context
- Ledger table: components/ledger-table/index.tsx (fragment LedgerRecordsTableFields, data
  assembly, the `LedgerRecordRow` type with matchingStatus 'New' | 'Diff' | 'Deleted') and
  columns.tsx (`ColumnDef<PaginatedTableFeaturesConfig, LedgerRecordRow>[]`). Read the Tables
  section of packages/client/CLAUDE.md.
- Read-only consumer that must stay read-only:
  components/reports/shared/report-sub-commentary-row.tsx.
- Charge view: `ChargeLedgerTable` at the bottom of components/charges/charge-extended-info.tsx.

Tasks
1. Fragment LedgerRecordsTableFields: add `locked`, `currency`, and `raw` on
   debitAmount1/2 and creditAmount1/2. Run `yarn generate`.
2. ledger-record-form/schema.ts: add `ledgerRecordToFormValues(record): LedgerRecordFormValues`.
   - Entities come from `*Account*.id`.
   - Local amounts come from `localCurrency*.raw`; foreign amounts from `*Amount*.raw`.
   - Copy currency and both dates; null description or reference becomes ''.
3. hooks/use-update-ledger-record.ts — mutation UpdateLedgerRecord($ledgerRecordId, $input).
   Select it as a union, mirroring the insert hook, with commonErrorPath 'updateLedgerRecord'.
4. NEW components/common/modals/edit-ledger-record-modal.tsx — controlled
   `EditLedgerRecordModal({ record, onClose, onDone })`:
   - Open while `record != null`.
   - Renders LedgerRecordForm in edit mode (no operation field), with defaultValues from the mapper.
   - Submit → `formValuesToLedgerRecordInput` → hook. On success, call onClose and onDone.
5. LedgerTable:
   - Add an optional prop `onEditRecord?: (record: LedgerRecordRow) => void`.
   - When it's provided, append an "Actions" display column, building the column list in a useMemo.
     The exported static `columns` stays unchanged for read-only callers.
   - The column renders a pencil icon button only when `!row.original.locked`,
     `row.original.matchingStatus !== 'New'` and `row.original.id !== EMPTY_UUID`.
   - Diff and Deleted rows are stored records and stay editable.
6. charge-extended-info.tsx: ChargeLedgerTable takes `onChange` (pass `onExtendedChange`) and holds
   `editingRecord` state. It passes `onEditRecord={setEditingRecord}` to LedgerTable, and renders
   EditLedgerRecordModal with `onClose={() => setEditingRecord(null)}` and `onDone={onChange}`.
7. Tests FIRST:
   - **Mapper:** cover a local-currency record, a foreign-currency record, and a record with an
     empty slot 2.
   - **LedgerTable render test** (createRoot + act; build fragment data with `makeFragmentData`
     from src/gql or with typed plain objects). The pencil appears for an unlocked stored row, and
     is absent for:
     - a locked row;
     - a "New" (EMPTY_UUID) row;
     - any row when `onEditRecord` is omitted.
8. Update the changeset text.

Out of scope: deleting records, editing the backing entities.
```

---

### Step 10 — Verify, polish and document

**Builds on:** Steps 1–9. **Wired at end:** the POC is complete, and the spec records what actually
shipped.

```text
STEP 10 — End-to-end verification, polish and docs
(Read the shared preamble in docs/manual-ledger-records/prompt-plan.md §3 first.)

Tasks
1. Run every gate, plus `yarn graphql:validate` (client operations vs schema) and
   `yarn test:integration`. Fix anything red.
2. Manual QA with `yarn server:dev` and `yarn client:dev` (auth per README):
   - The five-step checklist in spec.md §Verification.
   - A foreign-currency insert.
   - A document with input VAT on Debit 2: the document is created as INVOICE, with that VAT.
   - An edit that clears Debit 2 / Credit 2.
   - Regenerate after an edit restores the generated values.
   - A locked row shows no pencil, and a locked charge shows no "+".
   - The client blocks unbalanced records and lock-date violations.
   - A server-side CommonError (e.g. sent directly via GraphiQL) surfaces as a toast.
   If you can't run the app, say so and list what was verified by tests only.
3. Dead-code sweep:
   - Every new export has a caller (grep).
   - No stray TODOs or console logs beyond the error-logging pattern.
   - The static `columns` export is still used by the read-only report table.
4. docs/manual-ledger-records/spec.md: add an "Implementation status" section covering what
   shipped, the decisions this plan added (prompt-plan.md §1.4), and what is still deferred:
   - the TRANSACTION operation;
   - deleting ledger records;
   - regeneration-safe locking;
   - per-owner local currency.
5. Final pass on .changeset/manual-ledger-records.md wording, covering both packages.

Out of scope: new behaviour. Anything beyond fixes goes into the spec's deferred list instead.
```

---

## 5. Definition of done (POC)

- Both mutations ship with unit tests. Integration tests are green wherever Postgres is available.
- From a charge you can insert a misc expense or document ledger record, in local or foreign
  currency, with one or two lines per side. The backing entity is created in the same transaction.
- Unlocked stored records can be edited, and the existing diff view reflects every manual change.
- Lock rules hold in both UI and API:
  - no edits to locked records;
  - no inserts on locked charges;
  - no dates on or before the lock date.
- All gates are green, the changeset is written, and the spec's "Implementation status" section is
  filled in.
