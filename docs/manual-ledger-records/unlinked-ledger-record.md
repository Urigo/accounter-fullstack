# Ledger Records Without a Charge — Implementation Blueprint & Agent Prompt Plan

Follow-up to the manual ledger records POC (`docs/manual-ledger-records/spec.md`, `prompt-plan.md`;
shipped in Urigo/accounter-fullstack#4697). That POC can only insert a ledger record **under an
existing charge**. This feature lets a user create a ledger record from places that have no charge
(a business's ledger tab, and a financial entity's expanded row in the trial balance report). The
action **first creates a new charge**, then the backing misc expense or document, then the ledger
record, all in one database transaction.

Everything the POC established still applies: the record is stored exactly as typed, the backing
entity is derived on a best-effort basis, validation rules are identical on client and server, and
errors come back as `CommonError`.

---

## 1. Blueprint

### 1.1 End-to-end flow

```text
 Business page → Ledger tab (business/ledger-section.tsx)
   └─ "+" ─┐
 Trial balance → expand entity (business-ledger/business-extended-info.tsx, opt-in)
   └─ "+" ─┤
           ▼
   InsertLedgerRecordModal (no chargeId; defaultEntityId = the entity in view)
     └─ LedgerRecordForm (insert mode, unchanged rules) ─► useInsertLedgerRecord
                                                             │ GraphQL
 ┌───────────────────────────────────────────────────────────▼───────────────────────────────┐
 │ Mutation.insertLedgerRecord(chargeId: UUID, operation, input)   ← chargeId now OPTIONAL   │
 │   insertManualLedgerRecord(injector, { chargeId?, operation, input })                     │
 │     chargeId given  → today's path, unchanged                                              │
 │     chargeId absent → no charge to load / lock-check / owner-check; owner = write target   │
 │     validate → own entities → derive entity (all BEFORE the transaction, as today)        │
 │     TenantAwareDBClient.transaction(                                                       │
 │        [new] ChargesProvider.generateCharge(...)  → chargeId                               │
 │        insert misc expense | document  (chargeId)                                          │
 │        insert ledger record            (chargeId)                                          │
 │        degradeAndLoadCharge            (existing path only; a new charge is UNAPPROVED)    │
 │     ) → { record, charge }                                                                 │
 └────────────────────────────────────────────────────────────────────────────────────────────┘
           │
 Client refetches the host view (business ledger query / trial balance + expanded rows)
```

### 1.2 New-charge mapping

| Column              | Value                                                                   |
| ------------------- | ----------------------------------------------------------------------- |
| `owner_id`          | admin context `ownerId` (the request's write-target business)           |
| `type`              | `null` (default; let the charge's type be inferred like other charges)  |
| `user_description`  | `input.description` if non-empty, else `input.reference`, else `null`   |
| `accountant_status` | provider default (`UNAPPROVED`)                                         |
| everything else     | `generateCharge` defaults (`optional_vat`/`documents_optional` false …) |

### 1.3 Rule changes vs. the POC (insert without a charge)

| Rule                        | With `chargeId` (unchanged) | Without `chargeId` (new)                   |
| --------------------------- | --------------------------- | ------------------------------------------ |
| Charge exists               | required                    | n/a — created                              |
| Charge owner = write target | required                    | n/a — the charge is created for the target |
| Charge locked               | rejected                    | n/a — a new charge has nothing locked      |
| Lock date on both dates     | enforced                    | enforced (same validator)                  |
| Entities owned by target    | enforced                    | enforced                                   |
| Accountant re-flag          | inside the transaction      | skipped (new charge is already UNAPPROVED) |
| Rollback                    | entity + record + re-flag   | charge + entity + record                   |

### 1.4 Decisions this plan makes (confirm before starting)

1. **One mutation, optional `chargeId`**, rather than a second mutation. Making a required argument
   optional is a non-breaking GraphQL change, it keeps one validation/derivation path, and the
   result type already returns the charge. Alternative:
   `insertLedgerRecordWithNewCharge(operation, input)`.
2. **New charge description** = record description, falling back to reference (§1.2).
3. **Context entity prefill**: the modal receives `defaultEntityId` (the business/entity in view)
   and prefills **Debit 1** with it. The user can change or swap it. (Alternative: no prefill.)
4. **Trial balance only, opt-in**: `BusinessExtendedInfo` is rendered in 5 places (business ledger
   list and single view, business balance section, dynamic report tree node, trial balance). The "+"
   is an opt-in prop and only the trial balance turns it on, as requested.
5. **No new changeset file**: add a paragraph per step to a new
   `.changeset/unlinked-ledger-records.md` (`@accounter/server` and `@accounter/client` patch),
   grown across steps like the POC's.

---

## 2. Steps

| Step | Title                                            | Est. size | Wired at end of step                                     | Main risk                      |
| ---- | ------------------------------------------------ | --------- | -------------------------------------------------------- | ------------------------------ |
| 1    | Server: insert without a charge                  | ~250 LOC  | `insertLedgerRecord` without `chargeId` creates a charge | charge creation inside the tx  |
| 2    | Server: DB integration tests                     | ~150 LOC  | rollback removes the new charge too                      | fixture cleanup of new charges |
| 3    | Client: modal without a charge + business ledger | ~200 LOC  | "+" on the business Ledger tab                           | refetch of the business ledger |
| 4    | Client: trial balance entry point                | ~150 LOC  | "+" in an expanded trial-balance entity                  | refreshing report totals       |
| 5    | Verify, polish, docs                             | small     | feature complete                                         | —                              |

Strict order 1 → 2 → 3 → 4 → 5, except **Step 2 can run in parallel with Step 3** (server tests
only), and **Step 3 can start once Step 1's schema change is pushed** (it only needs the optional
argument). Use the same linear stacked-branch layout as the POC:
`claude/unlinked-ledger-records-step-N`, each based on the previous step, Step 1 based on `main` (or
on the POC branch if it is not merged yet).

---

## 3. Shared preamble (every agent reads this first)

```text
You are implementing ONE step of the "ledger records without a charge" follow-up in the
accounter-fullstack monorepo (Yarn 4; server = graphql-modules + Postgres + pgtyped; client = React +
urql + shadcn/ui). It extends the manual ledger records POC.

Read before coding:
- docs/manual-ledger-records/spec.md (incl. its "Implementation status" section — what shipped)
- docs/manual-ledger-records/unlinked-ledger-records-plan.md (this plan: §1, and your step in §4)
- CLAUDE.md, packages/server/CLAUDE.md, packages/client/CLAUDE.md, .claude/rules/*.md

Key existing code (from the POC):
- packages/server/src/modules/ledger/helpers/manual-ledger-record-mutations.helper.ts
  (`insertManualLedgerRecord`, `checkManualLedgerRecord`, `loadOwnedEntityTypes`,
  `writeTargetMismatchError`, `degradeAndLoadCharge`, the exhaustive operation switch, the single
  `TenantAwareDBClient.transaction`)
- packages/server/src/modules/ledger/helpers/manual-ledger-record.helper.ts (pure validators/derivers)
- packages/client/src/components/common/modals/insert-ledger-record-modal.tsx,
  components/common/forms/ledger-record-form/*, hooks/use-insert-ledger-record.ts

Conventions: yarn only; ESM `.js` imports; TS strict; never edit generated files (`yarn generate`
after typeDefs/SQL/client operations); thin resolvers; DB only via providers; errors as CommonError,
never thrown; client mutations in hooks on `useApiMutation`; react-hook-form + zod; no
@testing-library (createRoot + act). Tests first; watch them fail. Stay inside your step; if the
plan is wrong, stop and explain. No orphans.

Environment (cloud container): run `bash <scratchpad>/dev-setup.sh <checkout>` once, then pass the
vars from `<scratchpad>/db.env` to yarn commands. Postgres 16 with a uuidv7() stand-in; the 2
migrations tests `rls-all-tables` and `uuidv7-id-defaults` fail only for that reason. The server
typecheck has 2 pre-existing errors in email-ingestion-control.resolver.test.ts. Ignore the
pre-existing Hive schema check failure. For real-browser QA, see `<scratchpad>/qa/` (dev-auth bypass
`ALLOW_DEV_AUTH=1`, seeded `accounter_qa` DB, Playwright scripts).

Gates: yarn generate · yarn lint · yarn prettier:check · yarn build:tools && server typecheck (if
server changed) · client tsc --noEmit (if client changed) · yarn test · yarn test:integration
(Step 2 and later).

Deliver: one commit `feat(ledger): <step title>`; add to `.changeset/unlinked-ledger-records.md`;
branch `claude/unlinked-ledger-records-step-N` from the previous step; PR against the previous
step's branch, assigned to the user; report PR URL, SHA, changes, tests, gates, deviations, and
anything unverified.
```

---

## 4. Steps

### Step 1 — Server: insert a ledger record without a charge

**Builds on:** the POC. **Wired at end:** `insertLedgerRecord(operation, input)` with no `chargeId`
creates a charge, its misc expense or document, and the ledger record atomically.

```text
STEP 1 — Server: `insertLedgerRecord` without a charge
(Read the shared preamble in docs/manual-ledger-records/unlinked-ledger-records-plan.md §3 first.)

Goal
Make `chargeId` optional. When it is absent, create a new charge for the write-target business in the
same transaction as the backing entity and the ledger record.

Context
- typeDefs/ledger.graphql.ts: `insertLedgerRecord(chargeId: UUID!, operation, input)`.
- ChargesProvider.generateCharge (modules/charges/providers/charges.provider.ts ~L1316): calls
  `this.auth.canWriteCharge()`, inserts via `this.db` (the request's TenantAwareDBClient, so inside
  `transaction()` it runs on the transaction's connection), primes getChargeByIdLoader.
  Precedent for creating a charge inside a transaction: modules/email-ingestion/resolvers/
  email-ingestion.resolver.ts ~L100.
- insertManualLedgerRecord today: load charge → admin ctx → writeTargetMismatchError → isChargeLocked
  → checkManualLedgerRecord → loadOwnedEntityTypes → derive (switch) → transaction(entity → record →
  degradeAndLoadCharge).

Tasks
1. Schema: `chargeId: UUID` (nullable) on `insertLedgerRecord`; update its description to say a new
   charge is created when it is omitted. Run `yarn generate`.
2. helpers/manual-ledger-record.helper.ts (pure): `deriveNewChargeFromLedgerInput(input)` →
   `{ userDescription: string | null }` per plan §1.2 (trimmed description, else trimmed reference,
   else null).
3. insertManualLedgerRecord:
   a. Restructure so the charge is optional. With a chargeId, behaviour is byte-for-byte unchanged
      (existing tests must pass untouched).
   b. Without one: skip the charge load, the owner-mismatch check and the lock check; ownerId = admin
      context `ownerId`. Validation, entity ownership and derivation run exactly as today, before the
      transaction. `checkManualLedgerRecord` needs a chargeId for `validateLedgerRecordParams` —
      check what it uses it for and pass a placeholder only if it is purely structural; otherwise
      split the call so the provider-invariant check runs with the real id inside the transaction.
   c. Inside the existing transaction, first `generateCharge({ ownerId, ...deriveNewCharge... })`;
      throw if no row. Use its id for the entity insert and the ledger record. Do NOT call
      degradeAndLoadCharge for a new charge; return the created charge (load it through the loader,
      which generateCharge primed, or return the row if the result type accepts it).
   d. Error messages: keep "Failed to insert ledger record …" but don't print `undefined` for a
      missing chargeId.
4. Tests FIRST:
   - derive helper: description / reference fallback / null, trimming.
   - orchestration (existing mocks + a ChargesProvider.generateCharge mock):
     no chargeId + MISC_EXPENSE → generateCharge, then insertExpense, then insertLedgerRecords, all
     inside the transaction, with the new charge's id and the admin owner; degrade NOT called;
     no chargeId + DOCUMENT → same with insertDocuments; generateCharge returns nothing → rollback,
     CommonError, no entity insert; ledger insert throws → rollback (charge creation inside the
     callback, so it rolls back too); validation / entity-ownership errors → no transaction opened,
     no charge created; existing chargeId tests unchanged.
5. Changeset: create `.changeset/unlinked-ledger-records.md` (`'@accounter/server': patch`).

Out of scope: client, DB-backed tests.
```

---

### Step 2 — Server: DB-backed integration tests

**Builds on:** Step 1. Can run in parallel with Step 3.

```text
STEP 2 — Server: integration tests for inserting without a charge
(Read the shared preamble first.)

Extend modules/ledger/__tests__/manual-ledger-records.integration.test.ts (reuse its fixtures,
own-owner business, cleanup per owner with app.current_business_id, and its shared-pool rule):
1. MISC_EXPENSE without chargeId → exactly one new charge owned by the suite owner with the derived
   user_description and UNAPPROVED status, one misc_expenses row and one ledger_records row on it.
2. DOCUMENT without chargeId → new charge + INVOICE document + ledger record, as derived.
3. Rollback: spy LedgerProvider.insertLedgerRecords to reject → CommonError and NO new charge, misc
   expense or document persisted (count charges by owner before/after).
4. Lock date: invoiceDate on the lock date → CommonError, no charge created.
5. Entity of another business → CommonError, no charge created.
Clean up every charge you create (the cleanup must find charges created by the mutation itself, not
only fixture ones — delete by owner). Run the file and the full `yarn test:integration` twice.

Out of scope: production code. If a test exposes a bug in Step 1, report it rather than fixing it here.
```

---

### Step 3 — Client: insert modal without a charge, on the business Ledger tab

**Builds on:** Step 1's schema. **Wired at end:** a "+" on the business page's Ledger tab creates a
record (and its charge) and the tab refreshes.

```text
STEP 3 — Client: InsertLedgerRecordModal without a charge + business Ledger tab
(Read the shared preamble first.)

Context
- components/common/modals/insert-ledger-record-modal.tsx: `InsertLedgerRecordModal({ chargeId,
  onDone })`, trigger is a "+" icon with Tooltip "Add ledger record".
- components/business/ledger-section.tsx: Card with a read-only LedgerTable fed by
  `BusinessLedgerSection($businessId)`; no refetch today.
- The form (ledger-record-form/*) already supports defaultValues; empty/null rules from the POC
  (cleared fields are `null`; NumberInput ignores `undefined`).

Tasks
1. Modal: `chargeId?: string` and `defaultEntityId?: string`. Without a chargeId the hook is called
   without it, the dialog title/description say a new charge will be created, and the tooltip reads
   "Add ledger record (new charge)". `defaultEntityId` prefills Debit 1 (plan decision 3). Existing
   charge-view usage is unchanged.
2. Hook: `chargeId` optional in the operation variables (`$chargeId: UUID`). Run `yarn generate`.
3. ledger-section.tsx: put the modal in the CardHeader (right-aligned), with
   `defaultEntityId={businessId}`; on done, re-execute the query with `requestPolicy:
   'network-only'`. Hide it when the business is not owned by the write target? — check what the
   server returns and how other business-page actions gate themselves; mirror that.
4. Tests FIRST:
   - modal: without chargeId the hook receives no chargeId; Debit 1 is prefilled with
     defaultEntityId; with chargeId behaviour unchanged (existing tests pass).
   - ledger-section: renders the "+", and a successful insert re-executes the query (mock urql).
5. Changeset: add `'@accounter/client': patch` and a paragraph.

Out of scope: trial balance.
```

---

### Step 4 — Client: trial balance entry point

**Builds on:** Step 3. **Wired at end:** expanding a financial entity in the trial balance report
shows a "+" that creates a record; the expanded rows and the report totals refresh.

```text
STEP 4 — Client: "+" in the trial balance's expanded entity
(Read the shared preamble first.)

Context
- components/business-ledger/business-extended-info.tsx: `BusinessExtendedInfo({ businessID,
  filter })`, query `BusinessLedgerInfo`, toolbar with search / columns / DownloadCSV. Rendered in 5
  places: business-ledger/index.tsx, business-ledger-single.tsx, business/balance-section.tsx,
  reports/dynamic-report/tree-node.tsx, reports/trial-balance-report/trial-balance-report-account.tsx.
- reports/trial-balance-report/index.tsx owns the `TrialBalanceReport` query (the totals).

Tasks
1. BusinessExtendedInfo: optional `onInsertLedgerRecord?: () => void`. When provided, render the
   modal (no chargeId, `defaultEntityId={businessID}`) in the toolbar; on done re-execute its own
   query (`network-only`) and call the callback. Without the prop nothing changes (other 4 hosts).
2. Thread a refresh callback from reports/trial-balance-report/index.tsx (re-execute
   `TrialBalanceReport` network-only) through the table/group/sort-code/account components to
   `BusinessExtendedInfo`. Keep prop drilling minimal; a small context is fine if the chain is long.
3. If the record's dates fall outside the report's filter range, the new row won't show — accept it,
   but make the success toast say "Ledger record created" so the user isn't confused.
4. Tests FIRST: BusinessExtendedInfo shows the "+" only with the prop; success re-executes its query
   and calls the callback; the trial balance account row passes the callback.
5. Update the changeset.

Out of scope: the other BusinessExtendedInfo hosts.
```

---

### Step 5 — Verify, polish and document

```text
STEP 5 — End-to-end verification and docs
(Read the shared preamble first.)

1. All gates, plus `yarn graphql:validate` and `yarn test:integration`.
2. Real-browser QA (see <scratchpad>/qa/): from the business Ledger tab and from an expanded trial
   balance entity, insert a misc expense and a document; check the new charge exists (DB), the row
   appears, the trial balance totals change; a validation error keeps the dialog open; the
   charge-view "+" still works unchanged.
3. Dead-code sweep and changeset wording.
4. docs/manual-ledger-records/spec.md "Implementation status": add a short "Ledger records without a
   charge" subsection (what shipped, decisions §1.4, anything deferred).
```

---

## 5. Definition of done

- `insertLedgerRecord` works with or without a charge; without one, a charge is created in the same
  transaction and rolls back with it.
- The business Ledger tab and an expanded trial balance entity both offer "+", prefilled with the
  entity, and refresh after success.
- All other `BusinessExtendedInfo` hosts and the charge-view flow are unchanged.
- Unit and integration tests cover both paths; gates green; changeset and spec updated.
