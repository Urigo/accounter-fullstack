# Scraper App Refactor — Implementation Blueprint

## Reference

- Specification: `docs/scraper-app-refactor/plan.md`
- Existing app for reference (do not modify): `packages/scraper-local-app/`
- New package target: `packages/scraper-app/`

---

## High-Level Build Order

The project has two independent tracks that converge at the end:

**Track A — Server** (Accounter GraphQL server mutations that accept raw scraped data)  
**Track B — Scraper App** (Node.js process + React UI)

Track A must be complete before Track B can do an end-to-end run against a real server. However,
Track B can be developed and tested against a mock server stub until Track A is ready. The two
tracks can therefore be developed in parallel by different developers, converging in the final
integration step.

---

## Iterative Chunks

### Chunk 0 — Package scaffold

Set up `packages/scraper-app` with correct `package.json`, `tsconfig.json`, `tsup.config.ts`,
`vite.config.ts`, ESM conventions, and workspace registration. No logic yet — just a buildable empty
shell with a "hello world" HTTP server and a placeholder React page. Proves the toolchain.

### Chunk 1 — Vault: types, encrypt/decrypt, Zod schema

Pure library code: `vault.ts` with AES-256-GCM encrypt/decrypt, the `Vault` Zod schema, and
`loadVault` / `saveVault` helpers. No HTTP, no UI. Fully unit-tested.

### Chunk 2 — Vault HTTP API + unlock flow

REST endpoints: `POST /api/vault/unlock`, `POST /api/vault/create`, `GET /api/vault/status`. The
in-memory vault singleton. Session lifetime tied to the Node.js process. Unit tests for the routes
using a mock vault file.

### Chunk 3 — Vault UI: unlock screen + setup wizard

React: `VaultUnlock` component shown when vault is locked; `VaultSetup` wizard for first run (create
vault, set master password, enter server URL + API key). Wired to the Chunk 2 API. Tests with React
Testing Library.

### Chunk 4 — Config UI: sources + settings

React: Config screen with Sources tab (list, add, edit, delete) and Settings tab (all settings
toggles). Reads from and writes to vault via REST. No scraping yet. Tests for form validation and
save/load round-trip.

### Chunk 5 — Config UI: accounts tab

React: Accounts tab showing known accounts per source with accept/ignore/pending classification.
REST endpoints for reading and updating account records in vault. Tests.

### Chunk 6 — WebSocket server + protocol types

Node.js: WebSocket server (`ws` via Fastify plugin). Shared TypeScript types for all WS message
shapes (the full protocol table from the spec). A simple ping/pong smoke test to verify the WS
connection lifecycle.

### Chunk 7 — Scrape runner: orchestrator skeleton

`scrape-runner.ts`: accepts a run request, builds the task list, emits `task-pending` /
`task-running` / `task-done` / `task-error` / `run-complete` WS events. All actual scraping is
stubbed (returns hardcoded mock data). Concurrent and sequential modes both tested.

### Chunk 8 — Payload validation layer

Zod schemas for each source's raw response shape (Poalim ILS, Poalim Foreign, Poalim SWIFT,
Isracard, Amex, CAL, Discount, Max, currency rates). Pure library code. `validatePayload(type, raw)`
returns typed data or throws. Unit tests with valid and invalid fixture payloads.

### Chunk 9 — Unknown account detection

`checkAccounts(sourceType, payload, knownAccounts)` pure function: extracts account/card identifiers
from a validated payload, checks against the vault's account list, returns
`{ accepted, ignored, unknown }`. Integrated into the scrape runner (Chunk 7) — runner emits
`task-blocked` when unknown accounts are found. Unit tests.

### Chunk 10 — OTP flow

Runner waits on a `Promise` that the WebSocket `otp-submit` handler resolves. 5-minute timeout that
rejects with an error. Integrated into the Poalim scraper wrapper. Unit tests with a mock WS client
that sends `otp-submit` after a short delay, and a timeout test.

### Chunk 11 — Poalim scraper wrapper

Real Puppeteer integration: thin wrapper over `@accounter/modern-poalim-scraper` that conforms to
the runner's interface (takes credentials + date range, returns validated raw payload, hooks into
the OTP wait from Chunk 10). Integrated into runner to replace the Poalim stub.

### Chunk 12 — Remaining scraper wrappers

Same pattern as Chunk 11 for: Isracard, Amex, CAL, Discount, Max, currency rates. Each wrapper
replaces its stub in the runner.

### Chunk 13 — GraphQL client + mock server (scraper-app side)

`graphql/client.ts`: typed `graphql-request` client with API key header. Mock GraphQL server (MSW or
a lightweight in-process stub) for all upload mutations.
`uploadTransactions(type, accountId, payload)` function that calls the correct mutation and returns
`UploadResult`. Tests against the mock server.

### Chunk 14 — Run history

`history.ts`: `appendRun`, `readHistory` (last 100), `clearHistory`. JSON file on disk. Wired into
the runner's `run-complete` handler. `saveHistory: false` skips the write. Unit tests including
file-missing graceful handling.

### Chunk 15 — Run screen UI

React: source selector checklist, date range override picker, Run button, live task log (one
collapsible row per source, updating via WebSocket events), OTP modal, aggregate summary on
completion. Tests with a mock WebSocket.

### Chunk 16 — History screen UI

React: table of past runs from `GET /api/history`, expandable rows, newest-first. Tests.

### Chunk 17 — Server: UploadResult type + `uploadPoalimIlsTransactions` mutation

**Track A starts here.** Add `UploadResult` GraphQL type and the first upload mutation
(`uploadPoalimIlsTransactions`) to the Accounter server. Input type mirrors the Poalim ILS
transaction shape. Server-side Zod validation, `INSERT ... ON CONFLICT DO NOTHING`, returns
`inserted` / `skipped` / `insertedIds`. Authenticated via existing API key (`scraper` role).
Integration tests.

### Chunk 18 — Server: remaining upload mutations

Same pattern for all remaining source types: Poalim Foreign, Poalim SWIFT, Isracard, Amex, CAL,
Discount, Max, currency rates. Each gets its own mutation, input type, provider method, and
integration test.

### Chunk 19 — End-to-end integration

Replace the mock GraphQL server in the scraper app (Chunk 13) with calls to the real Accounter
server (running locally). Run a full scrape cycle (one source) against the dev database. Verify
transactions appear in the Accounter client. Fix any integration seams.

### Chunk 20 — Hardening + polish

Error boundary in the UI, loading/disabled states, "Test connection" button for the API key, vault
export hint in settings, README for the new package, and removal of all `TODO` stubs.

---

## Step-by-Step Breakdown

### Step 0 — Package scaffold

0a. Create `packages/scraper-app/package.json` with name `@accounter-helper/scraper-app`, ESM,
dependencies: `fastify`, `@fastify/websocket`, `@fastify/static`, `ws`, `zod`, `graphql-request`,
`@accounter/modern-poalim-scraper` (workspace), `react`, `react-dom`, `date-fns`. Dev deps: `vite`,
`@vitejs/plugin-react`, `tsup`, `vitest`, `@testing-library/react`, `@testing-library/user-event`,
`typescript`.  
0b. Create `tsconfig.json` (extends root, `"module": "NodeNext"`).  
0c. Create `tsup.config.ts` (entry: `src/server/index.ts`, format: `esm`, target: `node22`).  
0d. Create `vite.config.ts` (React plugin, output to `dist/ui`).  
0e. Create `src/server/index.ts` — Fastify instance listening on port 3001, one `GET /healthz` route
returning `{ ok: true }`.  
0f. Create `src/ui/main.tsx` and `index.html` — minimal React "Scraper App" heading.  
0g. Add package to root `package.json` workspaces.  
0h. **Test**: `GET /healthz` returns 200; Vite dev server starts without errors.

### Step 1 — Vault types and crypto

1a. Create `src/server/vault.ts`: - Export `VaultSchema` (Zod) and `Vault` type matching the spec
schema. - Export `encryptVault(vault: Vault, password: string): string` — JSON → AES-256-GCM →
base64 string (IV + auth tag + ciphertext concatenated). - Export
`decryptVault(blob: string, password: string): Vault | null` — returns null on wrong password /
tampered data (catches `crypto` errors). - Export `defaultVault(): Vault` — empty vault with default
settings.  
1b. **Tests** (`src/server/__tests__/vault.test.ts`): - encrypt→decrypt round-trip returns original
vault. - Wrong password returns null (does not throw). - Tampered ciphertext returns null. -
`VaultSchema` rejects missing required fields.

### Step 2 — Vault file I/O and HTTP API

2a. Add `loadVaultFile(path: string, password: string): Promise<Vault | null>` and
`saveVaultFile(path: string, vault: Vault, password: string): Promise<void>` to `vault.ts`.  
2b. Create `src/server/vault-store.ts` — in-memory singleton: -
`unlockVault(password: string): Promise<'ok' | 'wrong-password' | 'not-found'>`. -
`getVault(): Vault` — throws if locked. - `updateVault(fn: (v: Vault) => Vault): Promise<void>` —
mutate + re-encrypt + save. - `isLocked(): boolean`.  
2c. Register routes on Fastify: - `GET /api/vault/status` →
`{ locked: boolean, hasFile: boolean }`. - `POST /api/vault/unlock` body `{ password }` →
`{ ok: true }` or 401. - `POST /api/vault/create` body `{ password, serverUrl, apiKey }` → creates
new vault file, unlocks, returns `{ ok: true }`.  
2d. **Tests**: route tests using `fastify.inject()` — unlock with correct password, unlock with
wrong password returns 401, status reflects locked state.

### Step 3 — Vault unlock UI

3a. Create `src/ui/contexts/vault-context.tsx` — React context holding `{ locked, hasFile }`,
`unlock(password)`, `create(password, serverUrl, apiKey)`.  
3b. Create `src/ui/screens/vault-unlock.tsx` — password input + submit; shows error on wrong
password.  
3c. Create `src/ui/screens/vault-setup.tsx` — 3-step wizard: (1) choose master password, (2) enter
server URL + API key, (3) confirm. Calls `create`.  
3d. Update `App.tsx` — if `locked && hasFile` show `VaultUnlock`; if `!hasFile` show `VaultSetup`;
otherwise show main nav.  
3e. **Tests**: `VaultUnlock` renders, submits, shows error; `VaultSetup` completes wizard.

### Step 4 — Config: sources REST + UI

4a. Add vault REST routes: - `GET /api/vault/sources` → `SourceConfig[]`. -
`POST /api/vault/sources` body `SourceConfig` → appends, returns updated list. -
`PUT /api/vault/sources/:id` body `Partial<SourceConfig>` → updates. -
`DELETE /api/vault/sources/:id` → removes.  
4b. Create `src/ui/screens/config/sources-tab.tsx` — list of sources with add/edit/delete. Each
source type has its own form component (`PoalimForm`, `IsracardForm`, etc.) showing only relevant
fields; password fields masked with reveal toggle.  
4c. **Tests**: CRUD routes via `fastify.inject()`; `SourcesTab` renders list, opens form, saves.

### Step 5 — Config: settings + accounts tab

5a. Add vault REST routes: - `GET /api/vault/settings` / `PUT /api/vault/settings` body
`Partial<Settings>`. - `GET /api/vault/accounts` / `PUT /api/vault/accounts/:id` body
`{ status: 'accepted'|'ignored' }`.  
5b. Create `src/ui/screens/config/settings-tab.tsx` — toggle/number inputs for each setting.  
5c. Create `src/ui/screens/config/accounts-tab.tsx` — grouped by source, accept/ignore/pending
badges, link to classify unknown.  
5d. Assemble `config.tsx` with three tabs.  
5e. **Tests**: settings round-trip; accounts status update; tab navigation renders correct panel.

### Step 6 — WebSocket server + shared protocol types

6a. Create `src/shared/ws-protocol.ts` (imported by both server and UI): all WS message union types
as per the spec protocol table.  
6b. Register `@fastify/websocket`; add `GET /ws` WebSocket route in `src/server/websocket.ts`. On
connection: send a `connected` ack; on message: parse JSON, validate against protocol discriminated
union (zod), log unknown message types.  
6c. **Tests**: connect a `ws` client, verify `connected` ack received; send unknown message type,
verify no crash.

### Step 7 — Scrape runner skeleton (stubs)

7a. Create `src/server/scrape-runner.ts`: -
`startRun(ws: WebSocket, request: RunStartMessage): Promise<void>`. - Builds task list from
`request.sourceIds` (looks up vault sources). - Runs tasks concurrently or sequentially per
`settings.concurrentScraping`. - Each task: emits `task-pending`, then `task-running`, then calls a
stub that resolves `{ inserted: 2, skipped: 1, insertedIds: ['a', 'b'] }` after 50ms, then emits
`task-done`. - Emits `run-complete` when all tasks finish. - Handles `run-start` WS messages in
`websocket.ts` by calling `startRun`. - Guards: rejects second `run-start` if a run is already in
progress.  
7b. **Tests**: mock WS, send `run-start` with two sourceIds; assert event sequence
`task-pending × 2 → task-running × 2 → task-done × 2 → run-complete`; test concurrent and sequential
modes; test in-progress guard.

### Step 8 — Payload validation schemas

8a. Create `src/server/payload-schemas/` — one file per source type. Each exports a Zod schema for
the raw response from that scraper: - `poalim-ils.schema.ts`, `poalim-foreign.schema.ts`,
`poalim-swift.schema.ts` - `isracard.schema.ts`, `amex.schema.ts`, `cal.schema.ts`,
`discount.schema.ts`, `max.schema.ts` - `currency-rates.schema.ts` Types mirror the TypeScript types
in `@accounter/modern-poalim-scraper` and the other packages.  
8b. Create `src/server/validate-payload.ts`:
`validatePayload(type: SourceType, raw: unknown): ValidatedPayload` — calls the correct schema,
throws `PayloadValidationError` with Zod issues on failure.  
8c. Integrate into the stub runner (Chunk 7): pass raw stub data through `validatePayload` before
emitting `task-done`. If validation throws, emit `task-error`.  
8d. **Tests**: valid fixture for each source type parses successfully; invalid fixture (wrong field
type) throws with meaningful error message; runner emits `task-error` on validation failure.

### Step 9 — Unknown account detection

9a. Create `src/server/check-accounts.ts`:
`checkAccounts(type: SourceType, payload: ValidatedPayload, known: AccountRecord[])` →
`{ accepted: string[], ignored: string[], unknown: string[] }`. Extracts account/card identifiers
per source type. Checks each against `known` list by `sourceType + accountId` composite key.  
9b. Integrate into runner: after `validatePayload`, call `checkAccounts`. If `unknown.length > 0`,
emit `task-blocked` with `unknownAccounts`, skip upload, mark task done as blocked. Filter ignored
account transactions from payload before upload.  
9c. **Tests**: known accepted returns empty `unknown`; known ignored filters transactions;
unrecognised account identifier returns in `unknown`; runner emits `task-blocked` and continues
other tasks.

### Step 9b — Post-validation payload filtering

9b-1. Add `ignoredCardNumbers` to `IsracardAmexAccountSchema`, `CalAccountSchema`, and
`MaxAccountSchema` options in `src/server/vault.ts`. Add `ignoredAccountNumbers` and
`ignoredBranchNumbers` to `PoalimAccountSchema` options.

9b-2. Create `src/server/filter-payload.ts`:

```ts
export function filterPayload(
  type: SourceType,
  payload: ValidatedPayload,
  creds: PoalimAccount | IsracardAmexAccount | CalAccount | MaxAccount | DiscountAccount
): ValidatedPayload
```

Effective set rule:
`effectiveCards = (acceptedCardNumbers?.length ? acceptedCardNumbers : allCards) \ ignoredCardNumbers`.

- **Isracard / Amex** (`IsracardPayload`): for each `Index*` in `CardsTransactionsListBean`, keep
  only `CurrentCardTransactions` entries whose `@cardTransactions` is in effective set; remove
  `txnIsrael`/`txnAbroad` for excluded cards.
- **Cal** (`CalPayload`): filter array entries where `entry.card` is in effective set.
- **Max** (`MaxPayload`): filter array entries where `entry.accountNumber` is in effective set.
- **Poalim ILS/Foreign/Swift**: if `accountNumber` or `branchNumber` fails the effective filter,
  zero out the transactions array.
- **Discount**: no options — return payload unchanged.

9b-3. In `websocket.ts` `buildTask()`, call `filterPayload(type, validatedPayload, creds)` AFTER
`validatePayload()` and BEFORE `checkAccounts()`.

9b-4. **Tests** (`src/server/__tests__/filter-payload.test.ts`):

- `acceptedCardNumbers = ['1234']` → only card 1234 txns survive
- `ignoredCardNumbers = ['1234']`, no accepted list → card 1234 excluded, others kept
- `accepted = ['1234', '5678'], ignored = ['5678']` → only 1234 survives
- empty accepted + empty ignored → all cards kept
- Poalim: account not in accepted → transactions array is empty

### Step 10 — OTP wait/timeout

10a. Create `src/server/otp-manager.ts`: -
`waitForOtp(sourceId: string, timeoutMs: number): Promise<string>` — stores a `resolve` callback
keyed by `sourceId`. - `submitOtp(sourceId: string, otp: string): void` — resolves the waiting
promise. - `cancelOtp(sourceId: string): void` — rejects (used on timeout). OTP manager emits
`otp-required` via the passed WS sender before starting the wait. On timeout (5 min), rejects with
`OtpTimeoutError`. WebSocket handler routes `otp-submit` messages to `submitOtp`.  
10b. **Tests**: `waitForOtp` resolves when `submitOtp` called; `waitForOtp` rejects after timeout;
calling `submitOtp` for unknown sourceId is a no-op; concurrent OTPs for different sourceIds are
independent.

### Step 11 — Poalim scraper wrapper

11a. Create `src/server/scrapers/poalim.ts`: -
`scrapePoalim(creds: PoalimSourceConfig, dateFrom: Date, dateTo: Date, otpManager: OtpManager, emit: Emitter): Promise<PoalimRawPayload>`. -
Initialises `@accounter/modern-poalim-scraper`, calls `hapoalim`. - Hooks into the OTP challenge by
passing a callback that calls `otpManager.waitForOtp` and emits `otp-required` first. - Returns
validated raw payload (runs `validatePayload` internally).  
11b. Replace the Poalim stub in the runner with `scrapePoalim`.  
11c. **Tests** (unit, Puppeteer mocked via `vi.mock`): OTP hook calls `waitForOtp`; validation error
propagates as `task-error`; successful scrape returns correct shape.

### Step 12 — Remaining scraper wrappers

12a–12f. One commit per source: `scrapers/isracard.ts`, `scrapers/amex.ts`, `scrapers/cal.ts`,
`scrapers/discount.ts`, `scrapers/max.ts`, `scrapers/currency-rates.ts`. Each follows the same
pattern as Step 11. Each replaces its stub in the runner. Unit tests with mocked underlying
scrapers.

### Step 13 — GraphQL client + mock server

13a. Create `src/server/graphql/mutations.ts` — `graphql-request` document strings for all upload
mutations (typed against the server's generated schema once Chunk 17 is done; typed against a local
stub schema until then).  
13b. Create `src/server/graphql/client.ts`: `createUploadClient(serverUrl: string, apiKey: string)`
→ object with one method per source type, each calling the correct mutation and returning
`UploadResult` (including `insertedTransactions` and `changedTransactions`).  
13c. Create `src/server/__tests__/graphql-client.test.ts` — use MSW (Mock Service Worker in Node
mode) to intercept GraphQL requests. Test: correct mutation sent, correct `Authorization` header,
`UploadResult` returned.  
13d. Integrate upload client into the runner: after `checkAccounts`, call the appropriate upload
method, emit `task-done` with full `UploadResult` (inserted/skipped counts + transaction details).
In `src/shared/ws-protocol.ts`, extend `TaskDoneSchema` with optional `insertedTransactions` and
`changedTransactions` arrays.

### Step 14 — Run history

14a. Create `src/server/history.ts`: -
`appendRun(record: RunRecord, filePath: string): Promise<void>`. -
`readHistory(filePath: string): Promise<RunRecord[]>` — returns last 100, empty array if file
missing. Types from spec.  
14b. Wire into runner's `run-complete` handler: if `settings.saveHistory`, call `appendRun`.  
14c. Add REST route `GET /api/history` → last 100 `RunRecord[]`.  
14d. **Tests**: append + read round-trip; file missing returns `[]`; only last 100 returned from a
file with 150 records; `saveHistory: false` does not write file.

### Step 15 — Run screen UI

15a. Create `src/ui/contexts/run-context.tsx` — holds WS connection, current run state
(idle/running/complete), task states map keyed by sourceId.  
15b. Create `src/ui/components/task-row.tsx` — displays source nickname, status badge, inserted/
skipped/changed counts or error message; collapsible for stack trace. On `done`: shows "↑ N new / M
skipped / K changed". Clicking "↑ N new" expands a list of `insertedTransactions` (date ·
description · amount · account). "K changed" expands a diff table (field / was / now) using
amber/warning colour. `TaskState` holds `insertedTransactions` and `changedTransactions` from the
`task-done` message.  
15c. Create `src/ui/components/otp-modal.tsx` — modal rendered when any task has status
`otp-required`; input + submit sends `otp-submit` WS message.  
15d. Create `src/ui/screens/run.tsx` — source checklist, date picker, Run button, task rows, summary
panel.  
15e. **Tests**: mock WS emitting a sequence of events; assert task rows update correctly; OTP modal
appears on `otp-required`, disappears after submission; Run button disabled while running.

### Step 16 — History screen UI

16a. Create `src/ui/screens/history.tsx` — fetches `GET /api/history`, renders table with expandable
rows.  
16b. **Tests**: renders rows from mock API response; empty state message when no history; expandable
row shows per-source detail.

### Step 17 — Server: UploadResult + first upload mutation (Poalim ILS)

17a. In `packages/server/src/modules/scraper-ingestion/`, add: - `UploadResult`,
`ChangedTransaction`, `FieldChange`, `InsertedTransactionSummary` GraphQL types. -
`uploadPoalimIlsTransactions(transactions)` mutation. - Input type `PoalimIlsTransactionInput`
mirroring the raw Poalim ILS transaction shape. - Provider method: two-phase select+insert: SELECT
rows by conflict key, partition into `toInsert`/`changed`/`duplicate`, INSERT only `toInsert`,
RETURNING id + display fields. Auth directive: `@requiresRole(role: "scraper")`.  
17b. Run `yarn generate`.  
17c. **Integration tests**: insert new rows →
`inserted > 0, skipped = 0, insertedTransactions populated`; re-insert same rows →
`inserted = 0, skipped = N`; re-insert with changed non-key field → `changedTransactions populated`;
unauthorized request (no API key) → error.

### Step 18 — Server: remaining upload mutations

18a–18h. One commit per source: Poalim Foreign, Poalim SWIFT, Isracard, Amex, CAL, Discount, Max,
currency rates. Each follows the same two-phase pattern as Step 17. All integration-tested. Display
column mapping per source:

| Source         | date col           | amount col       | description col        | account col    |
| -------------- | ------------------ | ---------------- | ---------------------- | -------------- |
| poalim_ils     | event_date         | event_amount     | activity_description   | account_number |
| poalim_foreign | executing_date     | event_amount     | activity_description   | account_number |
| poalim_swift   | start_date         | amount           | charge_party_name      | account_number |
| isracard/amex  | full_purchase_date | payment_sum      | full_supplier_name_heb | card           |
| cal            | trn_purchase_date  | trn_amt          | merchant_name          | card           |
| discount       | operation_date     | operation_amount | operation_description  | account_number |
| max            | purchase_date      | original_amount  | merchant_name          | card_index     |
| exchange_rates | exchange_date      | usd              | —                      | —              |

### Step 19 — End-to-end integration

19a. Update scraper-app's GraphQL client (`client.ts`) to use real mutation documents generated from
the server schema (import from the server's generated types or re-run a local codegen against the
server's `schema.graphql`).  
19b. Remove MSW mock from the default test setup; keep it only for unit tests.  
19c. Manual smoke test checklist (see spec) — run against local dev server.  
19d. Fix any type mismatches or protocol seams discovered during integration.

### Step 20 — Hardening + polish

20a. Add React `ErrorBoundary` around each screen.  
20b. Add "Test connection" button on Config Credentials tab — calls `GET /api/vault/test-connection`
which makes a lightweight GraphQL introspection or `whoAmI` query to the Accounter server.  
20c. Add loading skeletons and disabled states on all async operations.  
20d. Write `packages/scraper-app/README.md` covering: install, first-run vault setup, running,
environment variables.  
20e. Remove all `TODO` stubs and leftover mock data.

---

## LLM Implementation Prompts

The prompts below are designed to be handed to a code-generation LLM one at a time, in order. Each
prompt is self-contained: it states what already exists, what to build, and how to verify. All
prompts assume the monorepo conventions in `CLAUDE.md` are followed.

---

### Prompt 0 — Package scaffold

```

You are working in the`accounter-fullstack`Yarn Berry v4 monorepo. Conventions: ESM only,`.js`import
extensions in TypeScript source,`yarn workspace` for deps, strict TypeScript, no CommonJS.

Task: create the `packages/scraper-app` package from scratch.

1. Create `packages/scraper-app/package.json`:
   - name: `@accounter-helper/scraper-app`
   - version: `0.0.0`
   - type: `module`
   - private: true
   - scripts: `dev:server`, `dev:ui`, `build:server`, `build:ui`, `typecheck`, `test`
   - dependencies (exact versions):
     - fastify 5.x latest
     - @fastify/websocket latest
     - @fastify/static latest
     - ws 8.x latest
     - zod 3.x (match version in other packages)
     - graphql-request 7.x latest
     - date-fns 4.x (match version in other packages)
     - @accounter/modern-poalim-scraper workspace:^
   - devDependencies: vite 6.x, @vitejs/plugin-react latest, tsup 8.x, vitest 3.x,
     @testing-library/react latest, @testing-library/user-event latest, typescript 6.x

2. Create `packages/scraper-app/tsconfig.json` extending `../../tsconfig.json` with:
   - `compilerOptions.module: "NodeNext"`, `moduleResolution: "NodeNext"`
   - `include: ["src"]`

3. Create `packages/scraper-app/tsup.config.ts`:
   - entry: `{ server: 'src/server/index.ts' }`
   - format: `['esm']`, target: `node22`, dts: false

4. Create `packages/scraper-app/vite.config.ts`:
   - React plugin, root: `src/ui`, build.outDir: `../../dist/scraper-app/ui`

5. Create `packages/scraper-app/src/server/index.ts`:
   - Fastify server on port 3001 (or `PORT` env var)
   - One route: `GET /healthz` returning `{ ok: true }`
   - `export async function buildServer()` that returns the Fastify instance (for testing)
   - `if (import.meta.url === pathToFileURL(process.argv[1]).href)` guard for direct execution

6. Create `packages/scraper-app/index.html` and `packages/scraper-app/src/ui/main.tsx`:
   - Minimal React app rendering `<h1>Scraper App</h1>`

7. Add `packages/scraper-app` to the root `package.json` workspaces array.

8. Create `packages/scraper-app/src/server/__tests__/healthz.test.ts`:
   - Import `buildServer`, call `fastify.inject({ method: 'GET', url: '/healthz' })`
   - Assert status 200 and body `{ ok: true }`

Verify: `yarn workspace @accounter-helper/scraper-app typecheck` passes,
`yarn workspace @accounter-helper/scraper-app test` passes.

```

---

### Prompt 1 — Vault crypto

````

Package`@accounter-helper/scraper-app` now exists with a passing healthz test.

Task: implement the vault encryption/decryption module.

Create `packages/scraper-app/src/server/vault.ts`:

1. Define and export Zod schemas:

   ```ts
   export const SettingsSchema = z.object({
     concurrentScraping: z.boolean().default(false),
     defaultDateRangeMonths: z.number().int().positive().default(3),
     fetchCurrencyRates: z.boolean().default(true),
     saveHistory: z.boolean().default(true),
     historyFilePath: z.string().default('./history.json'),
   });

   export const AccountRecordSchema = z.object({
     id: z.string().uuid(),        // UUID v4
     sourceId: z.string(),
     sourceType: z.string(),
     accountIdentifier: z.string(),
     status: z.enum(['accepted', 'ignored', 'pending']),
   });

   // SourceConfigSchema: discriminated union on `type` field.
   // Include all six source types from the spec: poalim, isracard, amex, cal, discount, max.
   // Each variant has `id: z.string().uuid()`, `type`, `nickname: z.string()`, and
   // type-specific credential fields (all z.string() since they are user-entered).
   export const SourceConfigSchema = z.discriminatedUnion('type', [ ... ]);

   export const VaultSchema = z.object({
     serverUrl: z.string().url(),
     apiKey: z.string().min(1),
     settings: SettingsSchema,
     sources: z.array(SourceConfigSchema),
     accounts: z.array(AccountRecordSchema),
   });

   export type Vault = z.infer<typeof VaultSchema>;
   export type Settings = z.infer<typeof SettingsSchema>;
   export type SourceConfig = z.infer<typeof SourceConfigSchema>;
   export type AccountRecord = z.infer<typeof AccountRecordSchema>;
   ```

2. Export `defaultVault(): Vault` — valid empty vault with default settings, empty arrays,
   placeholder `serverUrl: 'http://localhost:4000/graphql'` and `apiKey: ''`.

3. Export `encryptVault(vault: Vault, password: string): string`:
   - Derive a 32-byte key from password using `crypto.scryptSync(password, salt, 32)` where salt is
     a random 16-byte buffer generated per call.
   - Encrypt with AES-256-GCM. Random 12-byte IV.
   - Return a single base64 string encoding: `salt(16) + iv(12) + authTag(16) + ciphertext`.

4. Export `decryptVault(blob: string, password: string): Vault | null`:
   - Slice salt, IV, auth tag, ciphertext from the decoded buffer.
   - Derive key from password + salt.
   - Attempt GCM decrypt. Return null (do not throw) on any crypto error.
   - Parse the decrypted JSON through `VaultSchema.parse`. Return null on parse failure.

Create `packages/scraper-app/src/server/__tests__/vault.test.ts`:

- encrypt→decrypt round-trip returns original vault value.
- Wrong password returns null.
- Tampered ciphertext (flip one byte in the ciphertext portion) returns null.
- `VaultSchema.parse` throws on missing `serverUrl`.
- `defaultVault()` passes `VaultSchema.parse`.

Verify: all vault tests pass.

````

---

### Prompt 2 — Vault file I/O and HTTP API

```

`vault.ts` with `encryptVault` / `decryptVault` / `VaultSchema` exists and is tested.

Task: add vault file persistence and expose it via HTTP routes.

1. Add to `vault.ts`:
   - `loadVaultFile(filePath: string, password: string): Promise<Vault | null>`: reads the file,
     calls `decryptVault`. Returns null if file not found or decryption fails.
   - `saveVaultFile(filePath: string, vault: Vault, password: string): Promise<void>`: calls
     `encryptVault`, writes the result to `filePath` (creates directories if needed).

2. Create `src/server/vault-store.ts` — module-level singleton (not a class):
   - Internal state: `vault: Vault | null`, `password: string | null`, `filePath: string`.
   - `initVaultStore(filePath: string): void` — sets the file path (called at server startup from
     env var `VAULT_PATH` defaulting to `./vault.enc`).
   - `isLocked(): boolean` — true when `vault === null`.
   - `hasVaultFile(): Promise<boolean>` — checks if `filePath` exists on disk.
   - `unlockVault(pw: string): Promise<'ok' | 'wrong-password' | 'not-found'>`: loads vault file;
     sets in-memory state on success.
   - `createVault(pw: string, serverUrl: string, apiKey: string): Promise<void>`: creates a
     `defaultVault()` with provided serverUrl/apiKey, saves, unlocks.
   - `getVault(): Vault` — throws `Error('Vault is locked')` if locked.
   - `updateVault(fn: (v: Vault) => Vault): Promise<void>`: applies fn to in-memory vault, validates
     with VaultSchema, saves, updates in-memory state.

3. In `src/server/index.ts`, call `initVaultStore(process.env.VAULT_PATH ?? './vault.enc')` before
   starting to listen.

4. Register vault routes (create `src/server/routes/vault.ts`, register in `index.ts`):
   - `GET /api/vault/status` → `{ locked: boolean, hasFile: boolean }`
   - `POST /api/vault/unlock` body `{ password: string }` → 200 `{ ok: true }` or 401
     `{ error: 'wrong-password' }` or 404 `{ error: 'not-found' }`
   - `POST /api/vault/create` body `{ password: string, serverUrl: string, apiKey: string }` → 201
     `{ ok: true }` or 409 if vault file already exists

Create `src/server/__tests__/vault-routes.test.ts`:

- `GET /api/vault/status` returns `{ locked: true, hasFile: false }` with no vault file.
- `POST /api/vault/create` creates vault and returns 201.
- `GET /api/vault/status` after create returns `{ locked: false, hasFile: true }`.
- `POST /api/vault/unlock` with wrong password returns 401.
- `POST /api/vault/unlock` with correct password after locking returns 200.

Use `tmp` directory per test (pass vault path via env or a test helper that overrides the store).

Verify: all tests pass.

```

---

### Prompt 3 — Vault unlock UI

```

Vault HTTP API (`/api/vault/status`, `/api/vault/unlock`, `/api/vault/create`) is implemented and
tested.

Task: build the React vault gate — the first thing the user sees.

1. Create `src/ui/lib/api.ts` — typed fetch helpers: `vaultStatus()`, `vaultUnlock(password)`,
   `vaultCreate(password, serverUrl, apiKey)`. Each returns the JSON body or throws on non-2xx.

2. Create `src/ui/contexts/vault-context.tsx`:
   - State: `{ status: 'loading' | 'locked' | 'no-file' | 'unlocked', error: string | null }`.
   - `unlock(password: string): Promise<void>` — calls `vaultUnlock`, updates state.
   - `create(password: string, serverUrl: string, apiKey: string): Promise<void>`.
   - `useVault()` hook.
   - Polls `vaultStatus()` once on mount to determine initial state.

3. Create `src/ui/screens/vault-unlock.tsx`:
   - Password field (type="password") + "Unlock" button.
   - Shows inline error message when `vault.error` is set.
   - Shows a spinner while request is in flight.

4. Create `src/ui/screens/vault-setup.tsx`:
   - Step 1: choose master password + confirm (client-side match validation).
   - Step 2: enter Accounter server URL + API key.
   - Step 3: review summary + "Create Vault" button.
   - Calls `vault.create(...)` on final step.

5. Update `src/ui/app.tsx`:
   - Wrap everything in `<VaultProvider>`.
   - If status `loading`: show full-page spinner.
   - If status `no-file`: show `<VaultSetup>`.
   - If status `locked`: show `<VaultUnlock>`.
   - If status `unlocked`: show main app shell with nav. Main app shell: three nav items (Config /
     Run / History) with placeholder `<div>` content for each screen (to be replaced in later
     steps).

Create `src/ui/__tests__/vault-unlock.test.tsx` and `vault-setup.test.tsx` using
`@testing-library/react` with fetch mocked via `vi.fn()`:

- `VaultUnlock`: renders, fills password, submits, calls `vaultUnlock`; shows error on rejection.
- `VaultSetup`: completes all three steps, calls `vaultCreate` on final step.

Verify: all UI tests pass (`yarn workspace @accounter-helper/scraper-app test`).

```

---

### Prompt 4 — Config: sources CRUD

```

The vault gate UI works. Main app shell renders after unlock.

Task: implement source configuration — the heart of the Config screen.

SERVER side:

1. Create `src/server/routes/config.ts`. Register under `/api/vault/` prefix. Routes using
   `vault-store.updateVault`:
   - `GET /api/vault/sources` → `SourceConfig[]`
   - `POST /api/vault/sources` body: `Omit<SourceConfig, 'id'>` → generates UUID id, appends,
     returns full updated `SourceConfig[]`, status 201
   - `PUT /api/vault/sources/:id` body: `Partial<SourceConfig>` (never changes `id` or `type`) →
     merges, returns updated item, 404 if not found
   - `DELETE /api/vault/sources/:id` → removes, returns `{ ok: true }`, 404 if not found All routes:
     401 if vault is locked.

2. Tests in `src/server/__tests__/config-routes.test.ts`:
   - CRUD round-trip: create → list → update → delete → list (empty).
   - 401 on all routes when vault locked.
   - 404 on update/delete with unknown id.

UI side:

3. Create `src/ui/lib/api.ts` additions: `getSources()`, `createSource(data)`,
   `updateSource(id, data)`, `deleteSource(id)`.

4. Create per-source-type form components in `src/ui/components/source-forms/`: `poalim-form.tsx`,
   `isracard-form.tsx`, `amex-form.tsx`, `cal-form.tsx`, `discount-form.tsx`, `max-form.tsx`. Each
   accepts `defaultValues?: SourceConfig` and `onSubmit(data)`. Password/credential fields:
   `type="password"` with a show/hide toggle button. Use controlled inputs; validate required fields
   before calling `onSubmit`.

5. Create `src/ui/screens/config/sources-tab.tsx`:
   - Lists sources with nickname, type badge, edit/delete icon buttons.
   - "Add source" button: shows a source-type selector, then the matching form in a dialog.
   - Edit icon: opens the matching form pre-filled.
   - Delete icon: confirm dialog, then calls `deleteSource`.

Create `src/ui/__tests__/sources-tab.test.tsx`:

- Renders empty state with "Add source" button.
- Adds a new Isracard source: opens dialog, fills form, saves, list updates.
- Deletes a source after confirmation.

Verify: all new server and UI tests pass.

```

---

### Prompt 5 — Config: settings and accounts tabs

```

Sources CRUD works. Task: implement the Settings and Accounts tabs, then assemble the full Config
screen.

SERVER:

1. Add to `src/server/routes/config.ts`:
   - `GET /api/vault/settings` → `Settings`
   - `PUT /api/vault/settings` body `Partial<Settings>` → merges, saves, returns `Settings`
   - `GET /api/vault/accounts` → `AccountRecord[]`
   - `PUT /api/vault/accounts/:id` body `{ status: 'accepted' | 'ignored' | 'pending' }` → updates
     status, returns updated `AccountRecord`, 404 if not found

2. Tests: settings round-trip update; account status change; 404 for unknown account id.

UI:

3. Create `src/ui/screens/config/settings-tab.tsx`:
   - Toggle for each boolean setting, number input for `defaultDateRangeMonths`, text input for
     `historyFilePath`.
   - Auto-saves on blur / toggle change.

4. Create `src/ui/screens/config/accounts-tab.tsx`:
   - Groups accounts by `sourceType + sourceId`.
   - Each row: account identifier, status badge (accepted = green, ignored = grey, pending =
     yellow), dropdown to change status.
   - "pending" rows show a notice: "Visit the Accounter client to set up this account".

5. Assemble `src/ui/screens/config/index.tsx` (the Config screen):
   - Three tabs: "Credentials" (sources list), "Accounts", "Settings".
   - "Credentials" tab also shows the server URL + API key fields at the top (edit in place, "Test
     connection" button stub that shows a TODO toast for now).

6. Wire `Config` into `app.tsx` replacing the Config placeholder.

Tests: `SettingsTab` saves on toggle change; `AccountsTab` renders status badges and changes status
via dropdown.

Verify: all tests pass.

```

---

### Prompt 6 — WebSocket server + protocol types

```

Config screen is complete. Task: establish the WebSocket channel.

1. Create `src/shared/ws-protocol.ts` (importable by both server and UI):

   Define discriminated union types for every message in the spec protocol table:
   - Client → Server: `RunStartMessage`, `OtpSubmitMessage`
   - Server → Client: `TaskPendingMessage`, `TaskRunningMessage`, `TaskDoneMessage`,
     `TaskErrorMessage`, `TaskBlockedMessage`, `OtpRequiredMessage`, `RunCompleteMessage`,
     `ConnectedMessage`

   Export `ClientMessage = RunStartMessage | OtpSubmitMessage`. Export
   `ServerMessage = TaskPendingMessage | ... | ConnectedMessage`. Export Zod schemas for both:
   `ClientMessageSchema`, `ServerMessageSchema`.

2. Register `@fastify/websocket`. Create `src/server/websocket.ts`:
   - Export `registerWebSocket(fastify: FastifyInstance): void`.
   - Route: `GET /ws` (WebSocket).
   - On connection: send `{ type: 'connected' }`.
   - On message: parse JSON → validate with `ClientMessageSchema`. If invalid, send
     `{ type: 'error', message: 'Unknown message type' }`. If valid, call the appropriate handler
     (stubs for now: log and do nothing).
   - On close: clean up any in-progress state for that connection. Call `registerWebSocket` from
     `index.ts`.

3. Create `src/server/__tests__/websocket.test.ts`:
   - Start the server, connect a real `ws` client to `ws://localhost:PORT/ws`.
   - Assert `connected` message received within 500ms.
   - Send a malformed message (not JSON); assert no crash.
   - Send a valid `run-start` message; assert no crash (stub handler).
   - Close connection; assert server state is clean.

Verify: all tests pass.

```

---

### Prompt 7 — Scrape runner skeleton

````

WebSocket server is live with the full protocol type system.

Task: implement the scrape runner with stubbed scrapers.

1. Create `src/server/scrape-runner.ts`:

   ```ts
   export type ScrapeTask = {
     sourceId: string
     nickname: string
     type: SourceType
     // run() is the stub/real scraper function; injected for testability
     run: () => Promise<{ inserted: number; skipped: number; insertedIds: string[] }>
   }

   export async function startRun(
     tasks: ScrapeTask[],
     concurrent: boolean,
     emit: (msg: ServerMessage) => void
   ): Promise<RunRecord>
   ```

- Emits `task-pending` for every task upfront.
- Runs tasks concurrently (`Promise.all`) or sequentially (for-loop) based on `concurrent`.
- For each task: emit `task-running`, await `task.run()`, emit `task-done` with counts. On thrown
  error: emit `task-error` with message + stack.
- After all tasks: emit `run-complete` with totals.
- Returns a `RunRecord` (uses current timestamps, generates a UUID run id).

2. In `websocket.ts`: handle `run-start` messages:
   - Guard: if a run is already in progress for this connection, send `task-error` type message with
     message "Run already in progress".
   - Build `ScrapeTask[]` from `message.sourceIds` looking up vault sources (stubs: each `run()`
     returns `{ inserted: 2, skipped: 1, insertedIds: ['stub-1', 'stub-2'] }` after a 10ms delay).
   - Call `startRun(tasks, settings.concurrentScraping, emit)`.

3. Create `src/server/__tests__/scrape-runner.test.ts`:
   - Two tasks, sequential: assert event order is
     `pending×2 → running task1 → done task1 → running task2 → done task2 → run-complete`.
   - Two tasks, concurrent: assert both `running` events arrive before either `done`.
   - One task throws: assert `task-error` emitted, other task still completes, `run-complete`
     reflects 1 error.
   - In-progress guard: calling startRun while one is running rejects.

Verify: all tests pass.

````

---

### Prompt 8 — Payload validation schemas

````

Scrape runner skeleton works with stubs. Task: build the payload validation layer so invalid bank
responses are caught before anything reaches the server.

1. Create `src/server/payload-schemas/` directory with one file per source type. Each file exports a
   Zod schema named after its source type, and an inferred TypeScript type.

   Base these schemas on the TypeScript types exposed by `@accounter/modern-poalim-scraper` and the
   existing scraper implementations in `packages/scraper-local-app/src/scrapers/`.

   Files to create:
   - `poalim-ils.schema.ts` — ILS transaction array schema
   - `poalim-foreign.schema.ts` — foreign currency transaction array schema
   - `poalim-swift.schema.ts` — SWIFT transaction array schema
   - `isracard.schema.ts` — Isracard month data schema
   - `amex.schema.ts` — Amex month data schema
   - `cal.schema.ts` — CAL data schema
   - `discount.schema.ts` — Discount data schema
   - `max.schema.ts` — Max data schema
   - `currency-rates.schema.ts` — currency rate array schema

   Use `z.unknown()` for fields whose exact type is unclear from the source — prefer permissive
   schemas over overly strict ones that would break on minor bank API changes. Add `.passthrough()`
   to object schemas where extra fields may be present.

2. Create `src/server/validate-payload.ts`:

   ```ts
   export type SourceType = 'poalim-ils' | 'poalim-foreign' | 'poalim-swift' |
     'isracard' | 'amex' | 'cal' | 'discount' | 'max' | 'currency-rates';

   export class PayloadValidationError extends Error {
     constructor(public sourceType: SourceType, public issues: z.ZodIssue[]) { ... }
   }

   export function validatePayload(type: SourceType, raw: unknown): ValidatedPayload
   ```

Calls the correct schema; throws `PayloadValidationError` on failure.

3. Integrate into the scrape runner's stub `run()` functions: wrap the stub return value in
   `validatePayload(type, stubData)`. This proves the validation path is exercised even with stubs.

4. Create `src/server/__tests__/validate-payload.test.ts`:
   - For each source type: a valid fixture (minimal valid object) parses without error.
   - For each source type: an invalid fixture (missing required field or wrong type) throws
     `PayloadValidationError` with at least one Zod issue.
   - Runner emits `task-error` (not a crash) when `validatePayload` throws.

Verify: all tests pass.

````

---

### Prompt 9 — Unknown account detection

````

Payload validation layer is in place. Task: detect unknown accounts before uploading.

1. Create `src/server/check-accounts.ts`:

   ```ts
   export type AccountCheckResult = {
     accepted: string[] // account identifiers cleared for upload
     ignored: string[] // account identifiers to filter out
     unknown: string[] // account identifiers not in vault
   }

   export function extractAccountIdentifiers(type: SourceType, payload: ValidatedPayload): string[]
   // Returns the unique account/card numbers present in the payload for this source type.
   // e.g. for poalim-ils: unique `accountNumber` values; for isracard: unique card numbers.

   export function checkAccounts(
     type: SourceType,
     payload: ValidatedPayload,
     known: AccountRecord[]
   ): AccountCheckResult
   ```

2. Update `src/server/scrape-runner.ts` task execution: After `validatePayload`, before upload
   (currently stubbed):
   - Call `checkAccounts(type, payload, vault.accounts)`.
   - If `result.unknown.length > 0`: emit `task-blocked` with `unknownAccounts`, skip upload, record
     task as blocked in run record.
   - If upload proceeds: filter `ignored` account transactions from payload first.

3. Create `src/server/__tests__/check-accounts.test.ts`:
   - Known accepted account: `unknown = []`, `accepted = [accountId]`.
   - Known ignored account: `ignored = [accountId]`, no upload assertion.
   - Unknown account: `unknown = [accountId]`.
   - Multiple accounts in payload, one unknown: only unknown account is in `unknown` list.
   - Runner emits `task-blocked` when `unknown.length > 0`.
   - Runner continues remaining tasks after a blocked task.

Verify: all tests pass.

````

---

### Prompt 10 — OTP wait/timeout

````

Unknown account detection is integrated. Task: implement the OTP flow for Poalim login.

1. Create `src/server/otp-manager.ts`:

   ```ts
   export class OtpManager {
     // waitForOtp(sourceId, timeoutMs): emits `otp-required` via provided emit fn,
     //   then returns a Promise<string> that resolves when submitOtp is called for this
     //   sourceId, or rejects with OtpTimeoutError after timeoutMs.
     waitForOtp(
       sourceId: string,
       emit: (msg: ServerMessage) => void,
       timeoutMs?: number
     ): Promise<string>

     // submitOtp: resolves the promise created by waitForOtp for this sourceId.
     // No-op if no pending OTP for this sourceId.
     submitOtp(sourceId: string, otp: string): void

     // cancelOtp: rejects with OtpTimeoutError. Used internally by timeout.
     cancelOtp(sourceId: string): void

     hasPendingOtp(sourceId: string): boolean
   }

   export class OtpTimeoutError extends Error {}
   ```

2. In `websocket.ts`, route `otp-submit` messages to `otpManager.submitOtp(...)`. One `OtpManager`
   instance per active run (created in `startRun`, passed to scrapers).

3. Create `src/server/__tests__/otp-manager.test.ts`:
   - `waitForOtp` resolves with correct string when `submitOtp` called.
   - `waitForOtp` rejects with `OtpTimeoutError` after timeout (use a very short timeout like 100ms
     in tests).
   - `submitOtp` for unknown sourceId does not throw.
   - Two concurrent `waitForOtp` calls for different sourceIds are independent.
   - After resolution, `hasPendingOtp` returns false.

Verify: all tests pass.

````

---

### Prompt 11 — Poalim scraper wrapper

````

OTP manager is implemented and tested. Task: wire up the real Poalim scraper.

1. Create `src/server/scrapers/poalim.ts`:

   ```ts
   export async function scrapePoalim(
     creds: Extract<SourceConfig, { type: 'poalim' }>,
     dateFrom: Date,
     dateTo: Date,
     otpManager: OtpManager,
     emit: (msg: ServerMessage) => void
   ): Promise<{
     ils: PoalimIlsPayload[]
     foreign: PoalimForeignPayload[]
     swift: PoalimSwiftPayload[]
   }>
   ```

   - Calls `init()` from `@accounter/modern-poalim-scraper` with `headless: true`.
   - Calls `scraper.hapoalim(creds, { validateSchema: true, isBusiness })`.
   - The `hapoalim` call may invoke an OTP callback — hook this by passing a callback that calls
     `await otpManager.waitForOtp(creds.id, emit)`.
   - Fetches ILS transactions, foreign transactions, SWIFT transactions for each accepted account
     number within the date range.
   - Runs each raw result through `validatePayload` before returning.
   - On `'Unknown Error'` from hapoalim: throw a descriptive Error.

2. Replace the Poalim stub in `websocket.ts`/runner with a call to `scrapePoalim`. The task `run()`
   function for a Poalim source now calls `scrapePoalim` and returns combined counts (stub the
   upload counts for now since the GraphQL client isn't built yet — return
   `{ inserted: 0, skipped: 0, insertedIds: [] }`).

3. Create `src/server/scrapers/__tests__/poalim.test.ts`: Mock `@accounter/modern-poalim-scraper`
   with `vi.mock`. Tests:
   - Happy path: mock scraper returns valid fixture data → function resolves with typed payload.
   - OTP path: mock scraper calls the OTP callback → `waitForOtp` called → OTP resolved → mock
     scraper continues.
   - `'Unknown Error'` from hapoalim → function throws.
   - Invalid payload shape from mock → `PayloadValidationError` thrown.

Verify: all tests pass.

````

---

### Prompt 12 — Remaining scraper wrappers

```

Poalim scraper wrapper is in place. Task: add wrappers for all remaining source types.

Create one file per source, each following the same pattern as `scrapers/poalim.ts`:

- `src/server/scrapers/isracard.ts` — `scrapeIsracard(creds, dateFrom, dateTo, emit)`
- `src/server/scrapers/amex.ts` — `scrapeAmex(creds, dateFrom, dateTo, emit)`
- `src/server/scrapers/cal.ts` — `scrapeCal(creds, dateFrom, dateTo, emit)`
- `src/server/scrapers/discount.ts` — `scrapeDiscount(creds, dateFrom, dateTo, emit)`
- `src/server/scrapers/max.ts` — `scrapeMax(creds, dateFrom, dateTo, emit)`
- `src/server/scrapers/currency-rates.ts` — `scrapeCurrencyRates(emit)` (no credentials)

Each:

- Calls the correct underlying scraper from `packages/scraper-local-app/src/scrapers/` as a
  reference for the call pattern.
- Runs results through `validatePayload`.
- Has a corresponding test file mocking the underlying scraper library.

Replace the remaining stubs in the runner with calls to these wrappers.

Verify: all tests pass. `yarn workspace @accounter-helper/scraper-app typecheck` passes.

```

---

### Prompt 13 — GraphQL upload client + mock server

````

All scraper wrappers are implemented. Task: build the typed GraphQL client that sends scraped data
to the Accounter server.

NOTE: The server-side upload mutations (Prompts 17–18) do not exist yet. Use a local stub schema and
MSW (Mock Service Worker in Node mode) to test against. The client will be re-pointed to the real
server schema in Prompt 19.

1. Create `src/server/graphql/stub-schema.graphql` — minimal schema stub with `UploadResult` type
   and one mutation per source type (identical shapes to what the real server will expose, based on
   the spec).

2. Create `src/server/graphql/mutations.ts`: One `gql` document per source type. Import and use
   TypeScript types generated from `stub-schema.graphql` (use `graphql-codegen` inline or hand-write
   the minimal types).

3. Create `src/server/graphql/client.ts`:

   ```ts
   export type UploadResult = { inserted: number; skipped: number; insertedIds: string[] };

   export function createUploadClient(serverUrl: string, apiKey: string) {
     return {
       uploadPoalimIls(accountNumber, branchNumber, transactions): Promise<UploadResult>,
       uploadPoalimForeign(...): Promise<UploadResult>,
       uploadPoalimSwift(...): Promise<UploadResult>,
       uploadIsracard(...): Promise<UploadResult>,
       uploadAmex(...): Promise<UploadResult>,
       uploadCal(...): Promise<UploadResult>,
       uploadDiscount(...): Promise<UploadResult>,
       uploadMax(...): Promise<UploadResult>,
       uploadCurrencyRates(...): Promise<UploadResult>,
     };
   }
   ```

   Sets `Authorization: Bearer <apiKey>` header on every request.

4. Integrate into the scrape runner: replace the `{ inserted: 0, skipped: 0 }` stub with real calls
   to `uploadClient.*`. The client instance is created once per run from vault `serverUrl` +
   `apiKey`.

5. Create `src/server/__tests__/graphql-client.test.ts` using `msw` in Node mode:
   - Intercept each mutation → return mock `UploadResult`.
   - Assert correct `Authorization` header present.
   - Assert correct mutation name and variables sent.
   - Assert `UploadResult` returned by the client function.
   - Assert 4xx/5xx response from server → client throws a descriptive error.

Verify: all tests pass.

````

---

### Prompt 14 — Run history

````

GraphQL upload client is wired into the runner. Task: persist run history.

1. Create `src/server/history.ts`:

   ```ts
   export async function appendRun(record: RunRecord, filePath: string): Promise<void>
   // Reads existing file (or starts with []), appends record, writes back.

   export async function readHistory(filePath: string): Promise<RunRecord[]>
   // Returns the last 100 records newest-first. Returns [] if file missing.

   export async function clearHistory(filePath: string): Promise<void>
   ```

Use `RunRecord` and `SourceRunRecord` types from `src/shared/types.ts` (create this shared types
file with the run record shapes from the spec).

2. Wire into the runner: after `run-complete` event, if `settings.saveHistory`, call
   `appendRun(runRecord, settings.historyFilePath)`. Errors from `appendRun` are logged but do not
   affect the WS response.

3. Add REST route `GET /api/history` → last 100 `RunRecord[]` from `readHistory`.

4. Create `src/server/__tests__/history.test.ts` using a temp file path per test:
   - Append 3 records → `readHistory` returns all 3 newest-first.
   - File missing → `readHistory` returns `[]`.
   - Append 150 records → `readHistory` returns last 100.
   - `saveHistory: false` in settings → `appendRun` not called (test via spy).

Verify: all tests pass.

````

---

### Prompt 15 — Run screen UI

```

Run orchestration is fully wired server-side. Task: build the Run screen UI.

1. Create `src/ui/lib/ws.ts`: WebSocket client hook `useRunSocket()`:
   - Connects to `ws://localhost:PORT/ws` (or relative `/ws`).
   - Parses incoming messages using `ServerMessageSchema` from `ws-protocol.ts`.
   - Returns
     `{ send(msg: ClientMessage): void, taskStates: Map<string, TaskState>, runStatus: 'idle' | 'running' | 'complete', summary: RunCompleteMessage | null }`.
   - `TaskState`: `{ status, inserted?, skipped?, error?, blockedAccounts? }`.

2. Create `src/ui/components/task-row.tsx`:
   - Props: `{ sourceId: string, nickname: string, state: TaskState }`.
   - Status badge: pending=grey, running=blue spinner, done=green, error=red, blocked=yellow.
   - done: shows "↑ N new / N skipped".
   - error: collapsible; shows error message, stack trace on expand.
   - blocked: shows unknown account identifiers + "Go to Accounts tab" link.

3. Create `src/ui/components/otp-modal.tsx`:
   - Appears when any task has `status === 'otp-required'` (add this state to the protocol).
   - Controlled input for OTP code.
   - Submit: calls `ws.send({ type: 'otp-submit', sourceId, otp })`.

4. Create `src/ui/screens/run.tsx`:
   - Source checklist (fetched from `GET /api/vault/sources`).
   - Date range: "Last N months" picker (number input) and optional explicit from/to date range.
   - "Run" button: disabled while `runStatus === 'running'`.
   - On click: sends `run-start` WS message.
   - List of `<TaskRow>` for each selected source.
   - `<OtpModal>` rendered when relevant.
   - Summary panel (shown after run-complete): total new / total skipped / errors.

5. Wire `Run` into `app.tsx` replacing the Run placeholder.

6. Create `src/ui/__tests__/run.test.tsx` with a mock WebSocket:
   - "Run" button fires `run-start` message.
   - `task-pending` + `task-running` → TaskRow shows correct states.
   - `task-done` → TaskRow shows green with counts.
   - `task-error` → TaskRow shows red with message.
   - `task-blocked` → TaskRow shows yellow with account IDs.
   - `otp-required` → OtpModal appears; submit closes modal and sends `otp-submit`.
   - `run-complete` → summary panel renders; Run button re-enabled.

Verify: all UI tests pass.

```

---

### Prompt 16 — History screen UI

```

Run screen is complete. Task: build the History screen.

1. Add `getHistory()` to `src/ui/lib/api.ts` — fetches `GET /api/history`.

2. Create `src/ui/screens/history.tsx`:
   - On mount: calls `getHistory()`, stores result in local state.
   - Table columns: Date/Time, Duration, Sources (count), New Transactions, Skipped, Errors.
   - Each row is expandable to show per-source breakdown: source nickname, type, status badge,
     inserted/skipped/error detail.
   - Newest first.
   - Empty state: "No scrape runs recorded yet." message.
   - A "Refresh" button to re-fetch.

3. Wire `History` into `App.tsx` replacing the History placeholder.

4. Create `src/ui/__tests__/history.test.tsx`:
   - Renders correct number of rows from mock API response.
   - Empty state message when response is `[]`.
   - Expanding a row shows per-source detail.
   - Duration is calculated and displayed as "Xm Ys".

Verify: all tests pass. Full UI now navigable: Config / Run / History.

```

---

### Prompt 17 — Server: UploadResult type + Poalim ILS upload mutation

````

You are working in the `accounter-fullstack` monorepo, in the `packages/server` package.
Conventions: GraphQL Modules, `@Injectable()` providers, resolvers access DB only through providers,
`graphql-codegen` generates types.

Task: add the first scraper upload mutation to the Accounter server.

1. Determine the appropriate GraphQL module for scraper ingestion. Create a new module
   `packages/server/src/modules/scraper-ingestion/` if one does not exist, with the standard
   structure: `typeDefs/`, `resolvers/`, `providers/`, `index.ts`.

2. In `typeDefs/scraper-ingestion.graphql.ts`, add:

   ```graphql
   type UploadResult {
     inserted: Int!
     skipped: Int!
     insertedIds: [String!]!
   }

   input PoalimIlsTransactionInput {
     # Include all fields from the Poalim ILS transaction shape in modern-poalim-scraper.
     # Use the existing DB column names from the poalim_ils_transactions table as a reference.
     # All fields nullable except transactionId and eventDate.
   }

   type Mutation {
     uploadPoalimIlsTransactions(
       accountNumber: String!
       branchNumber: String!
       transactions: [PoalimIlsTransactionInput!]!
     ): UploadResult! @auth(role: SCRAPER)
   }
   ```

3. Create `providers/scraper-ingestion.provider.ts` with `@Injectable()`: Method
   `uploadPoalimIlsTransactions(accountNumber, branchNumber, transactions)`:
   - Maps input objects to DB row format.
   - Bulk
     `INSERT INTO accounter_schema.poalim_ils_transactions (...) VALUES ... ON CONFLICT (transaction_id, account_number, branch_number) DO NOTHING`.
   - Returns `{ inserted: number, skipped: number, insertedIds: string[] }`.

4. Create the resolver in `resolvers/scraper-ingestion.resolver.ts`. Authenticates via existing
   `@auth(role: SCRAPER)` directive (no extra auth code needed).

5. Register the module in `packages/server/src/modules/app.module.ts`.

6. Run `yarn generate`.

7. Create integration test `providers/__tests__/poalim-ils-upload.test.ts`:
   - Insert 3 new transactions → `inserted: 3, skipped: 0, insertedIds` has 3 entries.
   - Re-insert the same 3 → `inserted: 0, skipped: 3`.
   - Insert 2 new + 1 duplicate → `inserted: 2, skipped: 1`.
   - Request with no API key → returns GraphQL auth error.

Verify: all tests pass, `yarn generate` produces no errors.

````

---

### Prompt 18 — Server: remaining upload mutations

```

`uploadPoalimIlsTransactions` is implemented and tested. Task: add upload mutations for all
remaining source types, following exactly the same pattern.

Add one mutation + input type + provider method + integration test for each:

1. `uploadPoalimForeignTransactions` (foreign currency transactions table)
2. `uploadPoalimSwiftTransactions` (SWIFT transactions table)
3. `uploadIsracardTransactions` (Isracard transactions table)
4. `uploadAmexTransactions` (Amex transactions table)
5. `uploadCalTransactions` (CAL transactions table)
6. `uploadDiscountTransactions` (Discount transactions table)
7. `uploadMaxTransactions` (Max transactions table)
8. `uploadCurrencyRates` (currency rates table)

For each:

- Add the GraphQL `input` type mirroring the raw scraper output shape.
- Add the `Mutation` field with `@auth(role: SCRAPER)`.
- Add a provider method with bulk insert + ON CONFLICT DO NOTHING.
- Add integration tests: new rows → inserted; re-insert → skipped; mixed → correct counts.

After all mutations are added:

- Run `yarn generate`.
- Verify all integration tests pass.
- Verify `yarn typecheck` passes in the server package.

```

---

### Prompt 19 — End-to-end integration

```

All scraper-app source wrappers (Prompts 11–12) and all server upload mutations (Prompts 17–18) are
in place. Task: wire the real server into the scraper app and validate end-to-end.

1. In `packages/scraper-app/src/server/graphql/mutations.ts`: Replace the stub schema document
   strings with real mutation documents targeting the actual Accounter server schema. Import or
   reference the generated GraphQL types from the server's `schema.graphql` (located at the repo
   root). Run a local codegen if needed: add a `generate` script to `scraper-app/package.json` that
   runs `graphql-codegen` pointing at `../../schema.graphql` and outputting to
   `src/server/graphql/__generated__/`.

2. In `src/server/__tests__/graphql-client.test.ts`: Keep MSW mocks for unit tests. Add a separate
   integration test file `src/server/__tests__/graphql-client.integration.test.ts` (excluded from
   the default `vitest` run; run via `yarn test:integration`):
   - Requires a running local Accounter server with a valid scraper API key (from `.env`).
   - Calls `uploadPoalimIlsTransactions` with one fixture transaction.
   - Asserts `inserted === 1` on first call, `skipped === 1` on second call.

3. Manual smoke test checklist from the spec:
   - [ ] First-run vault creation wizard completes without errors.
   - [ ] Wrong master password is rejected.
   - [ ] Configure one Poalim source, click Run — Puppeteer launches headlessly.
   - [ ] After a successful scrape, open the Accounter client and confirm transactions appear.
   - [ ] Re-run on the same date range → `inserted: 0, skipped: N`.
   - [ ] Introduce an unknown account number → `task-blocked` appears in the UI.
   - [ ] Classify the account in the Accounts tab → re-run succeeds.
   - [ ] History screen shows the completed run with correct counts.

Fix any type mismatches or integration seams surfaced during this step.

Verify: all unit + integration tests pass. Smoke checklist completed manually.

```

---

### Prompt 20 — Hardening and polish

```

End-to-end integration is verified. Task: harden the app for real use.

1. Add a React `ErrorBoundary` component wrapping each screen in `App.tsx`. On error, show a
   "Something went wrong" message with a "Reload" button.

2. Implement the "Test connection" button on the Config Credentials tab:
   - Add `GET /api/vault/test-connection` route in the server: makes a lightweight GraphQL query
     (`{ __typename }`) to the configured server URL with the stored API key. Returns
     `{ ok: true, latencyMs: number }` or `{ ok: false, error: string }`.
   - In `CredentialsTab`: clicking "Test connection" calls this endpoint, shows a green checkmark
     - latency or a red error message inline next to the API key field.

3. Add loading skeleton states:
   - `SourcesTab`: skeleton rows while `GET /api/vault/sources` is loading.
   - `Run` screen: skeleton task rows while initial source list loads.
   - `History` screen: skeleton table rows while `GET /api/history` is loading.

4. Add a vault export hint to `SettingsTab`:
   - A readonly text field showing the current vault file path.
   - A copy-to-clipboard button.
   - A static note: "Back up this file to preserve your credentials."

5. Write `packages/scraper-app/README.md` covering:
   - Prerequisites (Node.js version, having a running Accounter server with a scraper API key)
   - How to start: `yarn workspace @accounter-helper/scraper-app dev:server` + open browser
   - First-run vault setup walkthrough
   - Environment variables: `PORT`, `VAULT_PATH`
   - How to build for production

6. Remove all `// TODO` comments, leftover stub data, and console.log debug statements. Replace with
   proper error logging.

Verify: `yarn lint` passes across the repo. All tests pass. README covers first-run setup.

```
