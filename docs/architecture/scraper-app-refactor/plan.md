# Scraper App Refactor — Specification

## Overview

Replace `packages/scraper-local-app` with a new `packages/scraper-app` package. The old package
stays in the monorepo, untouched, until the new one is proven in production.

The new app is a Node.js process that:

1. Runs Puppeteer/Chromium locally to scrape bank and credit card data
2. Validates scraped payloads before forwarding anything
3. Pushes raw source-format transactions to the Accounter GraphQL server via API key
4. Serves a React SPA on a local HTTP port for configuration, run control, and history

The Accounter server is responsible for normalizing raw payloads into the unified ledger and for
deduplication. The scraper app never reads from or writes directly to the database.

---

## Architecture

```
Browser UI
    │  WebSocket (task log + OTP)
    ▼
Scraper App  (Node.js + Puppeteer + Express/Fastify)
    │  GraphQL mutations + API key  (HTTPS)
    ▼
Accounter GraphQL Server
    │
    ▼
Postgres (RLS-protected)
```

- **Browser UI** — React SPA served by the scraper app's HTTP server; same stack as `client`
  (React + Vite + shadcn/ui + Tailwind).
- **Scraper App** — Node.js process; runs Puppeteer, holds encrypted vault, exposes WebSocket and
  REST endpoints to the UI.
- **Accounter Server** — receives raw transaction payloads tagged with source type, normalizes,
  deduplicates, and returns a diff of inserted vs. skipped IDs.
- **No direct DB access** from the scraper app at any point.

---

## Package

- **New package**: `packages/scraper-app`
- `packages/scraper-local-app` is kept as-is and excluded from any new work.
- New package name: `@accounter-helper/scraper-app`
- TypeScript ESM, same conventions as the rest of the monorepo.

---

## Screens

### 1. Config screen

Three tabs:

#### Credentials tab

- **Server API key** — text input (stored in vault). A "Test connection" button verifies the key
  against the Accounter server.
- **Sources** — list of configured scraper sources. Each source shows its type, nickname, and status
  (configured / missing credentials).
  - "Add source" button opens a form. Fields vary by source type (see §Sources below).
  - Edit / delete per source.
  - Credentials are stored encrypted in the vault; never shown in plaintext after initial entry
    (masked inputs, optional reveal toggle).

#### Accounts tab

- Per source: list of known account numbers/card numbers discovered by previous scrape runs.
- Each account can be marked **accepted** (include in future scrapes) or **ignored** (skip
  silently).
- If an account is unknown (not yet classified), it appears in a "pending" state with a prompt to
  classify it or open the main Accounter client to set it up.

#### Settings tab

| Setting                  | Type    | Default          | Description                               |
| ------------------------ | ------- | ---------------- | ----------------------------------------- |
| `concurrentScraping`     | boolean | `false`          | Run all source tasks in parallel          |
| `defaultDateRangeMonths` | number  | `3`              | How many months back to scrape by default |
| `fetchCurrencyRates`     | boolean | `true`           | Fetch Bank of Israel exchange rates       |
| `saveHistory`            | boolean | `true`           | Persist run history to local JSON file    |
| `historyFilePath`        | string  | `./history.json` | Path for the history file                 |

---

### 2. Run screen

- **Source selector** — checklist of all configured sources; all checked by default.
- **Date range override** — optional date-range picker. Defaults to "last N months" from settings.
- **Run button** — disabled while a run is in progress.
- **Live task log** — one collapsible row per source task, updated in real time via WebSocket:
  - States: `pending` → `running` → `done` / `error` / `blocked-unknown-account`
  - On `done`: shows count of new transactions inserted and count skipped (duplicates).
  - On `error`: shows error message, expandable stack trace.
  - On `blocked-unknown-account`: shows the unrecognised account identifier with a direct link to
    the Accounts tab to classify it. The source task is marked failed; other sources continue.
- **OTP prompt** — if Puppeteer detects an OTP challenge during a Poalim login, the server sends an
  `otp-required` WebSocket event. The UI renders a modal input field. The user types the OTP and
  submits; the UI sends an `otp-submit` WebSocket message back to the Node.js process, which
  resolves the awaited Puppeteer promise and continues. All other task rows stay visible and active
  during the OTP wait.

---

### 3. History screen

- Table of past runs, newest first.
- Columns: timestamp, duration, sources run, total new transactions, total skipped, errors (count).
- Expandable row: per-source breakdown with the same new/skipped/error detail.
- Persisted to a local JSON file (`historyFilePath`). Can be disabled via `saveHistory: false`.
- History is not sent to the Accounter server.

---

## Vault & Credential Storage

- All sensitive data (bank credentials, API key, per-source configs) is stored in a single
  AES-256-GCM encrypted JSON file on disk (e.g. `vault.enc`).
- A **master password** is required to decrypt the vault. It is entered in the UI on first open of a
  session (or whenever the vault is locked/process restarted). The decrypted vault is held in-memory
  for the lifetime of the Node.js process; it is never written to disk in plaintext.
- The vault file path is configurable via an environment variable or CLI flag at startup.
- There is **no app-level authentication** beyond the vault password. Network-level security
  (running on `localhost` or behind a VPN) is relied upon for deployment.
- The vault schema:

```typescript
type Vault = {
  serverUrl: string // Accounter GraphQL server URL
  apiKey: string // Scraper API key
  settings: Settings // See Settings table above
  sources: SourceConfig[] // Per-source credentials + options
  accounts: AccountRecord[] // Known account classifications
}
```

---

## Sources

Supported source types (matching the existing scraper implementations):

| Type       | Credentials fields                                                                                                                                          |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `poalim`   | `nickname`, `userCode`, `password`, `isBusinessAccount`, `acceptedAccountNumbers`, `acceptedBranchNumbers`, `ignoredAccountNumbers`, `ignoredBranchNumbers` |
| `isracard` | `nickname`, `ownerId`, `password`, `last6Digits`, `acceptedCardNumbers`, `ignoredCardNumbers`                                                               |
| `amex`     | `nickname`, `ownerId`, `password`, `last6Digits`, `acceptedCardNumbers`, `ignoredCardNumbers`                                                               |
| `cal`      | `nickname`, credentials per existing `CalCredentials` type, `acceptedCardNumbers`, `ignoredCardNumbers`                                                     |
| `discount` | `nickname`, credentials per existing `DiscountCredentials` type                                                                                             |
| `max`      | `nickname`, `username`, `password`, `acceptedCardNumbers`, `ignoredCardNumbers`                                                                             |

Effective set rule: `effectiveAccepted = (accepted?.length ? accepted : all) \ ignored`. If both
lists are empty, all accounts are included.

Currency rates (Bank of Israel) are not a "source" in the credentials sense — they are controlled by
the `fetchCurrencyRates` settings toggle.

---

## Scrape Run Flow

```
1. User selects sources + optional date range override → clicks Run
2. UI sends `run-start` WebSocket message to scraper app
3. App decrypts vault (already in memory), builds task list from selected sources
4. For each source task (concurrent or sequential per setting):
   a. Invoke the appropriate scraper (Puppeteer / HTTP)
   b. If OTP required (Poalim): emit `otp-required` WS event → wait for `otp-submit` WS message
      → pass code to Puppeteer → continue
   c. Validate the scraped response against the expected schema for that source type
      - If validation fails: emit `task-error` WS event with details; do NOT forward to server
   d. Filter the validated payload using the source's `accepted` / `ignored` lists in vault credentials:
      - creditcard sources (isracard, amex, cal, max): keep only cards in
        `(acceptedCardNumbers?.length ? acceptedCardNumbers : all) \ ignoredCardNumbers`
      - bank sources (poalim): apply same logic for accountNumbers and branchNumbers separately
      - discount: no filter options — payload unchanged
   e. Check remaining account/card identifiers against `vault.bankAccounts`:
      - If unknown account found: emit `task-blocked` WS event; mark task failed; continue other tasks
   f. POST raw payload to Accounter server via GraphQL mutation (tagged with source type + account)
   g. Server responds with extended UploadResult (inserted, skipped, insertedTransactions, changedTransactions)
   h. Emit `task-done` WS event with full UploadResult
5. When all tasks complete: emit `run-complete` WS event with aggregate summary
6. If saveHistory is true: append run record to history JSON file
```

---

## WebSocket Protocol

All messages are JSON. Direction noted as `S→C` (server to client) or `C→S` (client to server).

| Event          | Direction | Payload                                                                                                                                                                                     |
| -------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `run-start`    | C→S       | `{ sourceIds: string[], dateFrom?: string, dateTo?: string }`                                                                                                                               |
| `task-pending` | S→C       | `{ sourceId: string }`                                                                                                                                                                      |
| `task-running` | S→C       | `{ sourceId: string }`                                                                                                                                                                      |
| `task-done`    | S→C       | `{ sourceId, inserted, skipped, insertedIds, insertedTransactions: [{id, date, description, amount, account}], changedTransactions: [{id, changedFields: [{field, oldValue, newValue}]}] }` |
| `task-error`   | S→C       | `{ sourceId: string, message: string, stack?: string }`                                                                                                                                     |
| `task-blocked` | S→C       | `{ sourceId: string, unknownAccounts: string[] }`                                                                                                                                           |
| `otp-required` | S→C       | `{ sourceId: string }`                                                                                                                                                                      |
| `otp-submit`   | C→S       | `{ sourceId: string, otp: string }`                                                                                                                                                         |
| `run-complete` | S→C       | `{ totalInserted: number, totalSkipped: number, errors: number }`                                                                                                                           |

---

## Server-Side Changes (Accounter GraphQL Server) — In Scope

New GraphQL mutations are required to accept raw scraped data. These are authenticated via the
existing scraper API key mechanism.

### New mutations (one per source type)

```graphql
uploadPoalimTransactions(accountNumber: String!, branchNumber: String!, transactions: [PoalimIlsTransactionInput!]!): UploadResult!
uploadPoalimForeignTransactions(...): UploadResult!
uploadPoalimSwiftTransactions(...): UploadResult!
uploadIsracardTransactions(cardNumber: String!, transactions: [IsracardTransactionInput!]!): UploadResult!
uploadAmexTransactions(cardNumber: String!, transactions: [AmexTransactionInput!]!): UploadResult!
uploadCalTransactions(...): UploadResult!
uploadDiscountTransactions(...): UploadResult!
uploadMaxTransactions(...): UploadResult!
uploadCurrencyRates(rates: [CurrencyRateInput!]!): UploadResult!
```

```graphql
type UploadResult {
  inserted: Int!
  skipped: Int!
  insertedIds: [String!]!
  changedTransactions: [ChangedTransaction!]!
  insertedTransactions: [InsertedTransactionSummary!]!
}

type ChangedTransaction {
  id: String!
  changedFields: [FieldChange!]!
}

type FieldChange {
  field: String!
  oldValue: String
  newValue: String
}

type InsertedTransactionSummary {
  id: String!
  date: String
  description: String
  amount: String
  account: String
}
```

### Server behavior per mutation

1. Validate the input shape (Zod or existing schema validation).
2. Normalize raw fields into the existing source-specific table format.
3. Before INSERT: SELECT existing rows by conflict key. Partition input into:
   - `toInsert` — no existing row with that key
   - `changed` — existing row found, at least one non-key field differs (returned in
     `changedTransactions`, never written)
   - `duplicate` — existing row found, all fields identical (counted in `skipped`)
4. `INSERT toInsert rows ... ON CONFLICT DO NOTHING RETURNING id + display fields`.
5. Return extended `UploadResult` with inserted/skipped counts, inserted row summaries, and changed
   diffs.
6. Any downstream normalization (ledger record generation) follows the same path as the existing
   direct-insert triggers — no change to that logic.

### GraphQL input types

Input types mirror the existing TypeScript types in `modern-poalim-scraper` and the other scraper
packages. Codegen will generate them from the schema; the scraper app consumes the generated client
types.

---

## Unknown Account Handling

- On each task, after scraping and before uploading, the scraper app inspects all account/card
  numbers in the response.
- It checks them against `vault.accounts` (the accepted/ignored list).
- If any are not found:
  - The task is marked `blocked`; no data is uploaded for that source.
  - The user is shown the unrecognized account identifier in the Run screen.
  - A direct link opens the Accounts tab in the Config screen to classify the account.
  - After classification (accepted or ignored), the user can re-run just that source.
- Ignored accounts: transactions for that account/card are silently filtered out before upload.

---

## Error Handling

| Scenario                               | Behaviour                                                                  |
| -------------------------------------- | -------------------------------------------------------------------------- |
| Vault file missing on startup          | App refuses to start; UI shows "No vault found — create one" setup wizard  |
| Wrong master password                  | Decryption fails; UI shows error and re-prompts; app stays locked          |
| Scraper returns unexpected schema      | Validation error logged; task marked failed; nothing sent to server        |
| Server returns non-2xx / GraphQL error | Task marked error; full error shown in UI; run continues for other sources |
| OTP timeout (no response within 5 min) | Task marked error; Puppeteer session closed for that source                |
| Unknown account found                  | Task blocked (see §Unknown Account Handling)                               |
| Concurrent Puppeteer crash             | That task is marked error; other tasks unaffected                          |

---

## Run History Format

```typescript
type RunRecord = {
  id: string // UUID
  startedAt: string // ISO 8601
  completedAt: string // ISO 8601
  sources: SourceRunRecord[]
  totalInserted: number
  totalSkipped: number
  errorCount: number
}

type SourceRunRecord = {
  sourceId: string
  nickname: string
  type: string
  status: 'done' | 'error' | 'blocked'
  inserted: number
  skipped: number
  error?: string
  blockedAccounts?: string[]
}
```

Stored as a JSON array appended to `historyFilePath`. On read, the file is parsed and the last 100
runs are shown; older records are preserved in the file but not displayed.

---

## Package Structure

```
packages/scraper-app/
  package.json
  tsconfig.json
  vite.config.ts          # builds the UI SPA
  tsup.config.ts          # builds the Node.js server
  src/
    server/
      index.ts            # Express/Fastify entry point; serves UI, mounts WS + REST
      websocket.ts        # WebSocket server + run orchestrator
      vault.ts            # AES-256-GCM encrypt/decrypt helpers
      scheduler.ts        # (stub for future scheduling, not implemented)
      history.ts          # read/write history JSON
      scrape-runner.ts    # orchestrates task list, calls scrapers, emits WS events
      scrapers/           # thin wrappers over existing scraper packages
        poalim.ts
        isracard-amex.ts
        cal.ts
        discount.ts
        max.ts
        currency-rates.ts
      graphql/
        client.ts         # typed GraphQL client (urql or graphql-request + API key header)
        mutations/        # upload* mutation documents
    ui/
      main.tsx            # React entry
      App.tsx             # router (Config / Run / History)
      screens/
        Config.tsx
        Run.tsx
        History.tsx
      components/
        TaskRow.tsx
        OtpModal.tsx
        SourceForm.tsx
        VaultUnlock.tsx
```

---

## Tech Stack

| Concern                      | Choice                                                     |
| ---------------------------- | ---------------------------------------------------------- |
| Node.js server framework     | Fastify                                                    |
| WebSocket                    | `ws` library via Fastify plugin                            |
| Encryption                   | Node.js built-in `crypto` (AES-256-GCM)                    |
| Puppeteer                    | `modern-poalim-scraper` (existing workspace dep)           |
| UI                           | React + Vite + shadcn/ui + Tailwind (same as `client`)     |
| GraphQL client (UI + server) | `graphql-request` with API key header                      |
| Build                        | `tsup` for server, `vite` for UI                           |
| Type safety                  | End-to-end via shared codegen types from the server schema |

---

## Testing Plan

### Unit tests

- `vault.ts` — encrypt/decrypt round-trip; wrong password returns null not throws.
- `scrape-runner.ts` — mock scrapers; assert WS events emitted in correct order; assert upload not
  called when validation fails; assert upload not called when unknown account detected.
- `history.ts` — append, read last 100, file missing gracefully returns empty array.
- Unknown account detection logic — unit test with sample payloads.

### Integration tests

- WebSocket protocol — connect a test WS client, send `run-start`, assert event sequence against
  mock scraper and mock GraphQL server.
- OTP flow — assert `otp-required` emitted; assert scraper unblocks after `otp-submit`.
- GraphQL upload mutations (server side) — insert new rows; re-insert same rows; assert
  inserted/skipped counts correct; assert idempotency.

### Manual smoke test checklist

- [ ] First-run vault creation wizard works end-to-end
- [ ] Wrong master password is rejected cleanly
- [ ] Poalim OTP prompt appears and resolves correctly
- [ ] Unknown account blocks the right source task and other tasks continue
- [ ] New transactions appear in the Accounter client after a run
- [ ] Re-run on the same date range produces `inserted: 0, skipped: N`
- [ ] `saveHistory: false` produces no history file
- [ ] Concurrent and sequential modes both complete without race conditions

---

## Open Questions / Future Work

- **Notifications**: should the app send an OS notification or email when a scheduled/manual run
  completes? (Deferred — manual-only for now, no scheduling.)
- **Multi-user vault**: vault is single-user by design; if multiple team members need to run
  scrapes, each has their own instance.
- **Vault backup/export**: no mechanism today; user must manage the `.enc` file manually.
- **`scraper-local-app` deprecation**: once `scraper-app` is in production use, open a PR to remove
  `scraper-local-app` from the monorepo.
