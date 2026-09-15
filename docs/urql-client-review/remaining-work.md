# urql Client Review — Remaining Work

Companion to [`findings.md`](./findings.md) (the review) and [`blueprint.md`](./blueprint.md) (the
record of the ten steps that shipped).

All figures below were measured against `main` at the time of writing. They are cheap to re-check —
each is a single `git grep -c` — and worth re-checking before acting on any of them.

## Status

The ten-step quick-wins sequence is complete and merged: mutations no longer double-toast, mutations
are never retried on network errors, logout discards the client, `retryExchange` and the dev-only
devtools exchange are wired, the endpoint is configurable, and three categories of dead code are
gone. `main` verifies clean — 378 client tests passing, lint 0 errors, `tsc --noEmit` clean,
production build green.

That phase deliberately excluded the architectural work. This document is what is left.

---

## 1. Still no cache

The gap `findings.md` identified is untouched, by design. Current state:

| Signal                                               | Count | Meaning                                                    |
| ---------------------------------------------------- | ----- | ---------------------------------------------------------- |
| `TODO: add local data update method` in `src/hooks/` | 72    | the codebase asking for this                               |
| `additionalTypenames` usages                         | 0     | urql's invalidation mechanism does nothing without a cache |
| `network-only` request policies                      | 29    | ceremonial — there is no cache to bypass                   |
| zero-arg `onChange` prop declarations                | 64    | the hand-rolled substitute                                 |
| `pause: true` lazy-query emulation                   | 20    | mostly a consequence of the same gap                       |
| `cacheExchange` references                           | 1     | the comment reserving the slot in `providers/urql.tsx`     |

### 1a. Prerequisite: mutation payloads (schema change, not a client one)

**32 mutation hooks select only `{ id }`** in their success payload — `use-batch-update-charges.ts`,
`use-insert-business.ts`, `use-create-contract.ts`, `use-assign-charge-to-deposit.ts` and 28 others.

No cache can patch an entity from an id alone. Until mutations return the fields they changed,
graphcache delivers far less than expected and optimistic updates are impossible. This should land
first, and it is server-side work.

### 1b. `@urql/exchange-graphcache`, sized honestly

From the generated schema:

|                               | Count | Consequence                                   |
| ----------------------------- | ----- | --------------------------------------------- |
| union types                   | 27    | `schema` awareness is mandatory, not optional |
| interface types               | 12    | same                                          |
| object types                  | 200   | —                                             |
| …of those, with no `id` field | 88    | each needs a `keys` entry                     |
| mutations                     | 104   | each list-mutating one needs `updates` config |

The 88 keyless types are less alarming than they look: most are payload wrappers like
`BatchUpdateChargesSuccessfulResult` that want `keys: () => null` rather than a real key function.
The genuine work is `updates`, and it scales with mutations rather than types.

**Recommendation: scope the first landing to the charges surface**, not the whole schema. That is
where the substitute machinery is concentrated and where the payoff is measurable.

### 1c. What a cache retires

- `providers/charge-refresh.tsx` — ~100 lines reimplementing `additionalTypenames`
- most of the 64 `onChange` prop chains
- most of the 29 `network-only` policies
- the referential-stability shims: `hooks/use-stable-value.ts`, plus two `JSON.stringify` calls per
  row in `components/charges/charges-row.tsx`

Those shims exist because urql returns a fresh `data` object on every fetch. A normalized cache
returns stable identities for unchanged entities, which is the specific reason to prefer graphcache
over a document cache here.

---

## 2. Loose edges from the quick-wins pass

Independent of the cache work and of each other. Any of these can be picked up alone.

### `charge.tsx` has a dead query path

The `:chargeId` route always declares `loader: chargeLoader` (`router/config.tsx`), so
`useLoaderData()` always returns data, so `pause: !id || !!loaderData` is permanently `true` — the
`useQuery` in `components/screens/charges/charge.tsx` never executes in production. Its
`chargeId?: string` prop also has no callers; the component is a route element only.

The query, the prop and the `isLoading` branch can all go. Step 5 left this deliberately out of
scope.

### The whole app tree unmounts on a `UserContext` refetch

`providers/user-provider.tsx` has two `if (fetching)` gates that return `<AccounterLoader />` above
the Provider. Every child unmounts, and with no cache every child query refires on remount.
Switching business scope compounds it: the client is rebuilt, `UserContext` re-runs, the tree
unmounts, and everything refetches.

Fix is to gate on first load only (`fetching && !userContext`) and collapse the three chained
effects into derived state. It changes app-wide loading behaviour, which is why it was not folded
into a mechanical batch.

### 12 casts defeat fragment masking

`as FragmentType<typeof …>` appears 12 times across `packages/client/src`. Each one asserts a shape
the mask exists to prove. Originally two sites in the upload hooks; it has spread.

### 20 `pause: true` + `useEffect` lazy-query sites

Including `all-charges.tsx`, the most-used screen in the app. Most are cache consequences, but some
can be made declarative today.

### `GRAPHQL_URL` is documented twice

Present in both the root `.env.template` and `packages/client/.env.template`. Deliberate — it
matches how `AUTH0_DOMAIN`, `AUTH0_FRONTEND_CLIENT_ID` and `AUTH0_AUDIENCE` are already duplicated,
and `vite.config.ts` loads dotenv from `['.env', '../../.env']` so both genuinely work. Worth an
explicit decision on which is canonical rather than leaving it to drift.

---

## 3. From the original review, never started

**Persisted documents.** `persistedDocuments` appears 0 times in `codegen.ts`. Hive is already wired
server-side, so the manifest has a home. Shrinks every request — the tax report document alone is
126 lines — and turns the operation set into a server-side allowlist.

**Subscriptions.** `useSubscription` appears 0 times; all live-ness is manual refetching. Worth it
only if long-running server work (scrape jobs, ledger regeneration) should push progress. Otherwise
this should be explicitly dropped rather than left as a perpetual maybe.

**`willAuthError` is hardcoded `false`**, so every token expiry costs one failed round-trip before
the refresh fires. Deliberate and documented in-code ("avoid eager refresh loops"). Recorded here so
it stays a choice rather than becoming an oversight.

---

## 4. Process notes from the sequence

Worth knowing before the next multi-PR stack in this repo.

**Three merged PRs have no commit of their own on `main`.** #4443, #4448 and #4450 were each merged
into their parent's branch before the parent merged, so they arrived inside #4442's, #4447's and
#4449's squashes. Searching `main` for those numbers finds nothing; their content is present and was
verified directly. Expect this whenever a stack is merged bottom-up.

**A green `yarn test:client` does not imply a green build.** The client build is
`tsc && vite build`. During step 8b the suite passed while `tsc --noEmit` had three errors — untyped
`vi.fn()` factories make `.mock.calls[0][0]` an empty tuple, which vitest ignores and `tsc` rejects.
The failing `tsc` silently skipped the `vite build`, leaving a bundle check reading a stale `dist`.

**A green test run does not prove a test still exists.** A `rebase --onto <base> $TIP~1` on a branch
that had grown to two commits dropped an entire feature commit. The suite stayed green because the
commit's tests were dropped with it — 19 tests became 17 and still reported success. After any
restack, check commit counts and file contents, not just the suite.

**`yarn generate` must run before `yarn test:client` on a fresh checkout.** `src/gql/` is
git-ignored; without it, 16 of the test files fail to resolve their generated documents and it reads
like real breakage.

**`main` carries a commit titled `.`** (`0d44509f`, which added `packages/client/.env.template`).

---

## 5. Suggested order

| #   | Item                                                           | Depends on | Rough size                |
| --- | -------------------------------------------------------------- | ---------- | ------------------------- |
| 1   | Mutation payloads return changed fields                        | —          | large, server-side        |
| 2   | graphcache, charges surface only                               | 1          | large                     |
| 3   | Retire `charge-refresh.tsx`, `onChange` chains, `network-only` | 2          | medium, incremental       |
| 4   | Retire `use-stable-value` + per-row `JSON.stringify`           | 2          | small                     |
| 5   | Persisted documents                                            | —          | medium                    |
| 6   | `charge.tsx` dead query path                                   | —          | small                     |
| 7   | `user-provider` unmount gate                                   | —          | small, app-wide behaviour |
| 8   | 12 fragment-mask casts                                         | —          | small                     |

Items 6–8 depend on nothing and can be picked up at any time. Item 1 is the one that unlocks the
rest, and it is the easiest to defer by accident.
