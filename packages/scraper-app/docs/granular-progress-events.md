# Granular Scrape Progress Events

## Goal

Replace the legacy `scrape-progress` message (removed from the WS union) with 10 precisely-typed
messages that give the user real-time per-month and per-account visibility during a scrape run.
Per-month scrapers emit progress as each month is fetched and uploaded. A failed month is non-fatal
— the task continues with remaining months. Poalim emits per-account, per-transaction-type events.
The UI renders collapsible sub-rows under each task, expanded while running, auto-collapsed on
completion.

---

## Phase 1 — WS Protocol (`src/shared/ws-protocol.ts`)

Add 10 new Zod schemas and register them in `ServerMessageSchema`. Also remove the three dead legacy
schemas (`ScrapeStartedSchema`, `ScrapeProgressSchema`, `ScrapeCompleteSchema`) from both their
definitions and the union.

### New schemas

**Per-month scrapers (Isracard, Amex, Discount, Cal):**

| Type                   | Fields                                                     |
| ---------------------- | ---------------------------------------------------------- |
| `task-month-fetching`  | `sourceId: string`, `month: string` (yyyy-MM)              |
| `task-month-fetched`   | `sourceId`, `month`, `transactionCount: number`            |
| `task-month-error`     | `sourceId`, `month`, `error: string`                       |
| `task-month-uploading` | `sourceId`, `month`, `transactionCount: number`            |
| `task-month-uploaded`  | `sourceId`, `month`, `inserted: number`, `skipped: number` |

**Poalim (per-account, per-transaction-type):**

| Type                          | Fields                                                                                        |
| ----------------------------- | --------------------------------------------------------------------------------------------- |
| `task-accounts-found`         | `sourceId`, `accounts: { accountNumber: string, branchNumber: number, bankNumber: number }[]` |
| `task-account-vault-checked`  | `sourceId`, `accountId: string`, `status: 'accepted' \| 'ignored' \| 'blocked' \| 'unknown'`  |
| `task-account-txns-fetching`  | `sourceId`, `accountId: string`, `txnType: 'ils' \| 'foreign' \| 'swift'`                     |
| `task-account-txns-uploading` | `sourceId`, `accountId`, `txnType`, `count: number`                                           |
| `task-account-txns-done`      | `sourceId`, `accountId`, `txnType`, `inserted: number`, `skipped: number`                     |

---

## Phase 2 — Isracard/Amex payload type (`IsracardCardsTransactionsList` wrapper)

`IsracardCardsTransactionsList` (from `@accounter/modern-poalim-scraper`) has no `month` field.
Rather than modifying the external type, the scrapers will return a wrapper type that pairs each
payload with its month string.

### New return type (`src/server/scrapers/isracard.ts` and `amex.ts`)

```ts
export type MonthlyIsracardPayload = {
  month: string // 'yyyy-MM', e.g. '2024-01'
  data: IsracardCardsTransactionsList
}
```

Both `scrapeIsracard` and `scrapeAmex` change their return type from
`Promise<IsracardCardsTransactionsList[]>` to `Promise<MonthlyIsracardPayload[]>`.

### Per-month loop changes (both scrapers)

Wrap each month fetch in try/catch:

```ts
for (const month of months) {
  const monthStr = format(month, 'yyyy-MM')
  emit({ type: 'task-month-fetching', sourceId: creds.id, month: monthStr })
  try {
    const { data, isValid } = await scraper.getMonthTransactions(month)
    if (!data) continue
    if (!isValid) throw new Error(`Invalid data for ${monthStr}`)
    if (data.Header?.Status !== '1')
      throw new Error(`Login/password issue (Status=${data.Header?.Status}) for ${monthStr}`)

    const validated = validatePayload('isracard' /* or 'amex' */, data)
    const txnCount = countIsracardTransactions(validated)
    emit({
      type: 'task-month-fetched',
      sourceId: creds.id,
      month: monthStr,
      transactionCount: txnCount
    })
    results.push({ month: monthStr, data: validated })
  } catch (err) {
    emit({
      type: 'task-month-error',
      sourceId: creds.id,
      month: monthStr,
      error: err instanceof Error ? err.message : String(err)
    })
    // continue — non-fatal
  }
}
if (results.length === 0) throw new Error('All months failed to scrape')
```

`countIsracardTransactions`: counts `CurrentCardTransactions` entries across all `Index*` keys in
`CardsTransactionsListBean`.

---

## Phase 3 — Discount / Cal scraper changes

Same non-fatal month loop pattern.

### Discount (`src/server/scrapers/discount.ts`)

```ts
// before fetch
emit({ type: 'task-month-fetching', sourceId: creds.id, month: monthStr });
// on success
emit({ type: 'task-month-fetched', ..., transactionCount: data.transactions.length });
// on failure
emit({ type: 'task-month-error', ... });  // continue
```

Return type unchanged (`DiscountPayload`, already an array of month entries with `.month` string).

### Cal (`src/server/scrapers/cal.ts`)

Same pattern; `transactionCount: transactions.length` from the `getMonthTransactions` result.

Return type unchanged (`CalPayload`).

---

## Phase 4 — Poalim scraper changes (`src/server/scrapers/poalim.ts`)

After `getAccountsData()`:

```ts
emit({
  type: 'task-accounts-found',
  sourceId: creds.id,
  accounts: accounts.map(a => ({
    accountNumber: String(a.accountNumber),
    branchNumber: a.branchNumber,
    bankNumber: a.bankNumber
  }))
})
```

Before each fetch call, add the appropriate emit:

```ts
// ILS
emit({ type: 'task-account-txns-fetching', sourceId: creds.id,
       accountId: String(account.accountNumber), txnType: 'ils' });
const { data: ilsData } = await scraper.getILSTransactions(accountRef);

// Foreign
emit({ type: 'task-account-txns-fetching', ..., txnType: 'foreign' });
const { data: foreignData } = await scraper.getForeignTransactions(accountRef, isBusiness);

// Swift
emit({ type: 'task-account-txns-fetching', ..., txnType: 'swift' });
const { data: swiftData } = await scraper.getForeignSwiftTransactions(accountRef);
```

`accountId` convention: `String(account.accountNumber)`.

---

## Phase 5 — `buildTask` in `websocket.ts`

### Isracard/Amex: update call sites for new return type

`scrapeIsracard` / `scrapeAmex` now return `MonthlyIsracardPayload[]`. `checkAccounts` still
receives `payloads[0].data`; `filterPayload` receives `payload.data`.

### Isracard/Amex: split batch upload into per-month

Replace single `uploadClient.uploadIsracard(allPayloads)` with:

```ts
for (const { month, data: monthData } of filteredPayloads) {
  const txnCount = countIsracardTransactions(monthData)
  emit({ type: 'task-month-uploading', sourceId: src.id, month, transactionCount: txnCount })
  const r = await uploadClient.uploadIsracard([monthData]) // single-element array
  emit({
    type: 'task-month-uploaded',
    sourceId: src.id,
    month,
    inserted: r.inserted,
    skipped: r.skipped
  })
  // accumulate totals
}
```

Same pattern for Amex.

### Cal / Discount: per-month upload wrapping

CalPayload / DiscountPayload are already arrays of month-level entries with `.month` string. Wrap
each existing upload loop iteration with `task-month-uploading` / `task-month-uploaded` emits.

### Poalim: vault-check emits + per-type upload emits

After `checkAccounts` resolves for each account, emit `task-account-vault-checked` with the computed
status (`accepted` / `ignored` / `blocked` / `unknown`).

Wrap each `uploadPoalimIls` / `uploadPoalimForeign` / `uploadPoalimSwift` call:

```ts
const count = countPoalimTransactions(ilsPayload)
emit({
  type: 'task-account-txns-uploading',
  sourceId: src.id,
  accountId: String(accountNumber),
  txnType: 'ils',
  count
})
const r = await uploadClient.uploadPoalimIls(ilsPayload)
emit({
  type: 'task-account-txns-done',
  sourceId: src.id,
  accountId: String(accountNumber),
  txnType: 'ils',
  inserted: r.inserted,
  skipped: r.skipped
})
```

---

## Phase 6 — UI State (`src/ui/lib/ws.ts`)

### New step types

```ts
export type MonthStepPhase = 'fetching' | 'fetched' | 'error' | 'uploading' | 'uploaded'

export type MonthStep = {
  month: string
  phase: MonthStepPhase
  transactionCount?: number
  inserted?: number
  skipped?: number
  error?: string
}

export type TxnTypeState = {
  phase: 'fetching' | 'uploading' | 'done'
  count?: number
  inserted?: number
  skipped?: number
}

export type AccountStep = {
  accountId: string
  vaultStatus?: 'accepted' | 'ignored' | 'blocked' | 'unknown'
  ils?: TxnTypeState
  foreign?: TxnTypeState
  swift?: TxnTypeState
}
```

### `TaskState` additions

```ts
steps?: MonthStep[] | AccountStep[];
```

### Message handlers (10 new cases in the switch)

- `task-month-fetching` → find-or-create `MonthStep` by `month`, set `phase: 'fetching'`
- `task-month-fetched` → update step: `phase: 'fetched'`, set `transactionCount`
- `task-month-error` → update step: `phase: 'error'`, set `error`
- `task-month-uploading` → update step: `phase: 'uploading'`, set `transactionCount`
- `task-month-uploaded` → update step: `phase: 'uploaded'`, set `inserted`/`skipped`
- `task-accounts-found` → initialise `AccountStep[]` from `accounts`
- `task-account-vault-checked` → find-or-create `AccountStep` by `accountId`, set `vaultStatus`
- `task-account-txns-fetching` → find/create step, set `step[txnType] = { phase: 'fetching' }`
- `task-account-txns-uploading` → update `step[txnType] = { phase: 'uploading', count }`
- `task-account-txns-done` → update `step[txnType] = { phase: 'done', inserted, skipped }`

---

## Phase 7 — UI Component (`src/ui/components/task-row.tsx`)

Add a `TaskSteps` sub-component (collocated in the same file):

### Month steps (Isracard / Amex / Discount / Cal)

Table with columns: Month | Status | Transactions | Inserted | Skipped | Error

- `fetching` → spinner badge
- `fetched` → neutral badge + txn count
- `error` → red badge + error text in tooltip or inline
- `uploading` → spinner badge + txn count
- `uploaded` → green badge + inserted/skipped counts

### Account steps (Poalim)

Per-account row showing vault status badge + ILS / Foreign / Swift mini-cells, each with phase badge
and inserted/skipped on done.

### Collapse behaviour

```ts
const [collapsed, setCollapsed] = useState(false)

useEffect(() => {
  if (status === 'done' || status === 'error' || status === 'blocked') {
    setCollapsed(true)
  }
}, [status])
```

Manual toggle chevron (`▾` / `▸`) always visible when `steps.length > 0`.

---

## Relevant files

| File                              | Change                                                |
| --------------------------------- | ----------------------------------------------------- |
| `src/shared/ws-protocol.ts`       | +10 schemas, remove 3 dead schemas                    |
| `src/server/scrapers/isracard.ts` | new return type, non-fatal month loop, progress emits |
| `src/server/scrapers/amex.ts`     | same as isracard                                      |
| `src/server/scrapers/discount.ts` | non-fatal month loop, progress emits                  |
| `src/server/scrapers/cal.ts`      | non-fatal month loop, progress emits                  |
| `src/server/scrapers/poalim.ts`   | accounts-found + per-type fetch emits                 |
| `src/server/websocket.ts`         | updated call sites, upload progress emits             |
| `src/ui/lib/ws.ts`                | step types, 10 new message handlers                   |
| `src/ui/components/task-row.tsx`  | `TaskSteps` sub-component                             |

---

## Verification

1. `yarn workspace @accounter-helper/scraper-app test` — 29 pre-existing failures only, 218+ passing
2. `yarn workspace @accounter-helper/scraper-app build` — zero TS errors
3. Manual — Isracard run: sub-rows per month appear, collapse on done
4. Manual — simulated month error: red sub-row, other months continue, task eventually completes
5. Manual — Poalim run: `task-accounts-found` fires, per-account per-txnType rows appear

---

## Decisions

- `task-month-error` is **non-fatal**; `task-error` only fires for login/catastrophic failures
- Isracard/Amex upload split from single-batch to per-month single-element calls (more round-trips,
  but enables granular upload progress)
- `task-account-vault-checked` is **Poalim-only** — other scrapers use the existing `task-blocked`
  mechanism
- Legacy `ScrapeStarted`/`ScrapeProgress`/`ScrapeComplete` schemas removed entirely from protocol
- `accountId` in Poalim events = `String(account.accountNumber)` (matches check-accounts key)
- Sub-rows auto-collapse on terminal task state (`done` / `error` / `blocked`), manually toggleable
