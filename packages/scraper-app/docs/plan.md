# Plan: Auto-register discovered accounts into vault.accountRecords

## TL;DR

When a scrape completes successfully, account identifiers extracted from payloads should be
auto-registered in `vault.accountRecords` as `pending` if not already known. `checkAccounts` should
then treat `pending` as blocking (same as unknown today), prompting the user to classify before
upload proceeds.

## Steps

### Phase 1 — Fix `checkAccounts` to treat `pending` as blocking (1 file)

- In `check-accounts.ts`, the `else` branch in `checkAccounts` currently accepts both `'accepted'`
  and `'pending'`. Split it into explicit `accepted` vs. `pending`→`unknown` so pending accounts
  block the task.

### Phase 2 — New `registerDiscoveredAccounts` helper (new file or check-accounts.ts)

- Create a function `registerDiscoveredAccounts(sourceType, sourceId, payloads, updateVaultFn)`:
  1. Call `extractAccountIdentifiers` for each payload to collect all identifiers.
  2. Read current `vault.accountRecords` via `getVault()`.
  3. For each identifier not already present (by `sourceType + accountNumber`), create a new
     `AccountRecord` with a `crypto.randomUUID()` id, the sourceId, sourceType, accountNumber, and
     `status: 'pending'`.
  4. If any new records were created, call `updateVault` to persist them.
- This can live in a new `account-discovery.ts` file to keep check-accounts.ts read-only.

### Phase 3 — Integrate into `websocket.ts` (2 call sites)

**Poalim path** (around line 81):

- After `filteredIls` is built, before `checkAccounts`, call
  `registerDiscoveredAccounts('poalim', src.id, filteredIls)`.
- Re-read `vault.accountRecords` via `getVault().accountRecords` for the `checkAccounts` call (the
  closure `vault` is stale after `updateVault`).

**Non-Poalim path** (around line 194):

- After filtering payloads and before `checkAccounts(src.type, payloads[0]!, ...)`, call
  `registerDiscoveredAccounts(src.type, src.id, payloads)`.
- Same stale-vault concern: use `getVault().accountRecords` for the check.

### Phase 4 — No change needed to `accounts-routes.ts`

- `GET /api/vault/accounts` already returns all records including `pending`.
- `PUT /api/vault/accounts/:id` already handles status updates (pending→accepted/ignored).

## Relevant files

- `packages/scraper-app/src/server/check-accounts.ts` — fix `pending` branch
- `packages/scraper-app/src/server/account-discovery.ts` — new file with
  `registerDiscoveredAccounts`
- `packages/scraper-app/src/server/websocket.ts` — 2 call sites to add discovery + stale-vault fix
- `packages/scraper-app/src/server/vault-store.ts` — `updateVault` / `getVault` (read-only
  reference)
- `packages/scraper-app/src/server/vault.ts` — `AccountRecord` type (read-only reference)

## Verification

1. Run `yarn workspace @accounter-helper/scraper-app test` — existing tests must pass.
2. Manual: run a scrape with empty `accountRecords`; confirm new `pending` records appear in
   `GET /api/vault/accounts`.
3. Manual: task should be blocked with the pending account IDs shown.
4. Manual: classify an account via `PUT /api/vault/accounts/:id` (status=accepted); re-run; confirm
   upload proceeds.
5. Manual: re-run with same accounts; confirm no duplicate `accountRecords` are created.

## Decisions

- `pending` is treated identically to "not found" from the task's perspective (blocks upload).
- Discovery runs on the filtered payload (after accepted/ignored filter), so ignored-credential
  accounts are never registered.
- One `updateVault` call per task (batch all new records), not one per identifier.
- `branchNumber` is populated for Poalim (from `retrievalTransactionData`); left undefined for card
  sources.
