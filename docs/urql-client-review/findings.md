# urql Client Review — Findings

Review of urql usage across `packages/client`, September 2026. Scope: 127 `useQuery` call sites, 104
`useMutation` call sites, 318 GraphQL documents across 294 files, and the client setup in
`packages/client/src/providers/urql.tsx`.

Companion document: [`blueprint.md`](./blueprint.md) — the phased remediation plan derived from
these findings.

## Summary

The fundamentals are modern and the conventions are unusually well enforced. One architectural gap
sits underneath everything else: **the urql client is constructed with no cache exchange**, and most
of the weak points below are hand-rolled substitutes for the cache that isn't there.

`packages/client` is the only urql consumer in the monorepo. `scraper-app` and
`email-ingestion-gateway` use `graphql-request` instead.

## What the codebase gets right

- **codegen `client-preset` with fragment masking on** (`codegen.ts:180-186`),
  `unmaskFunctionName: 'getFragmentData'`. 104 fragment definitions, 260 `getFragmentData` calls,
  208 `FragmentType` usages — fragments are genuinely colocated with the components that consume
  them rather than hoisted into a shared file.
- **100% mutation-hook discipline.** Zero `useMutation` in `src/components/`; all 97 live in
  `src/hooks/` and route through `handleCommonErrors` (`helpers/error-handling.ts`), whose
  `NonCommonError<T, K>` return type narrows the `CommonError` union away for callers.
- **`@defer` in production** — 22 usages, backed by `useDeferStream()` server-side
  (`packages/server/src/index.ts:148`).
- **A real N+1 fix.** `components/charges/charges-extended-info-loader.tsx` collapses 100 per-row
  `FetchCharge` queries into one `chargesByIDs` call when the table is in expand-all mode, and
  pauses the per-row queries.
- **Multipart uploads with zero extra config.** `File`/`Blob` values go straight into mutation
  variables; `@urql/core` 6's `fetchExchange` implements the multipart spec natively, and the
  codegen scalar mapping `FileScalar: { input: 'File | Blob', output: 'string' }` keeps it
  type-safe. No `graphql-upload`, no `@urql/exchange-multipart-fetch`, no manual `FormData`.
- **`UNSCOPED_OPERATION_CONTEXT`** (`providers/urql.tsx:55-57`) is a frozen module constant with a
  comment explaining why an inline context literal would loop. The one context object passed
  anywhere, and it is done correctly.
- **Solid auth-exchange test coverage** — `src/__tests__/urql-client.test.ts`, 381 lines, 14 cases.

## 1. No cache exchange — the root cause

`providers/urql.tsx:230-315` builds the client with an explicit `exchanges` array:

```
mapExchange (global error toast)  ->  authExchange  ->  fetchExchange
```

urql installs its default `[cacheExchange, fetchExchange]` **only when `exchanges` is omitted
entirely**. Because an explicit array is supplied and `cacheExchange` is absent, the app runs with
no document cache and no normalized cache. Every mount is a network round-trip; only
concurrently-active identical operations are shared by the client's built-in dedup.

`@urql/exchange-graphcache` is not a dependency either.

### What substitutes for it

| Mechanism                                                  | Location                                                                                                                | Size                                                                                                  |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `onChange` callback prop-drilling                          | 64 zero-arg `onChange` prop declarations across 60 files; 262 `onChange={...}` pass-downs                               | the dominant pattern                                                                                  |
| A charge-id → refetch registry                             | `providers/charge-refresh.tsx`                                                                                          | ~100 lines; effectively a reimplementation of `additionalTypenames`                                   |
| Manual `reexecuteQuery({ requestPolicy: 'network-only' })` | 25 sites                                                                                                                | leaks `OperationContext` into three components' public props (`reports/dynamic-report/dialogs/*.tsx`) |
| Deep-equality reference shims                              | `hooks/use-stable-value.ts`; plus a per-row `JSON.stringify` of both old and new row in `charges/charges-row.tsx:62-78` | exists solely because "urql returns a fresh `data` object on every (re)fetch"                         |
| A client-side dataloader + context                         | `charges/charges-extended-info-loader.tsx`                                                                              | 93 lines a normalized cache would provide free                                                        |

`additionalTypenames` — urql's actual invalidation mechanism — is used **0 times**, because without
a cache it does nothing. The 25 `network-only` policies are ceremonial for the same reason.

The codebase is aware of this: `TODO: add local data update method after change` appears **72
times** in `src/hooks/`, and `docs/all-charges-performance-boost/findings.md` already names the
missing `cacheExchange`.

### UX cost

No instant back-navigation, no cache-and-network paint, and a full refetch of shared lookup lists on
every remount. `useGetBusinesses` is called from 10 files, three of which are _per-table-cell_
components (`documents-table/cells/debtor.tsx`, `cells/creditor.tsx`,
`transactions-table/cells/counterparty.tsx`) — and a documents table renders debtor and creditor for
every row. Same shape for `useGetTags` (8 sites) and `useGetTaxCategories` (5 sites).

## 2. The whole app tree unmounts on a `UserContext` refetch

`providers/user-provider.tsx:145-147`:

```tsx
if (fetching) {
  return <AccounterLoader />
}
```

Combined with `pause: true` and three chained `useEffect`s (`user` → `fetchUserContext()` → `data` →
`setDefaults` → `setUserContext`, with an `exhaustive-deps` disable at line 123), any refetch of
`UserContext` unmounts every child — which, with no cache, means every child query refires on
remount. Switching business scope compounds it: `setBusinessScope` rebuilds the client, which
re-runs `UserContext`, which unmounts the tree, which refires everything.

## 3. Double error toasts

Two independent layers toast the same failure:

- **Global** — `mapExchange({ onResult: handleUrqlError })` (`providers/urql.tsx:231-235` →
  `providers/urql-error-handler.ts:28`). Toasts `'Operation Error'`, no toast `id`, 5s.
- **Per-mutation** — `handleCommonErrors` (`helpers/error-handling.ts:53-58`). Toasts `'Error'` with
  a stable `id`, 100s, `closeButton`.

Every failing mutation produces both. Only the `CommonError`-union path (a `200 OK` carrying an
error member) is hook-only.

`mapExchange` is correctly placed first in the chain, so it does **not** see the transient
`UNAUTHENTICATED` result that `authExchange` retries — the overlap is real but bounded.

## 4. Toast side effects in the render body — 10 hooks

Ten `use-get-*` hooks do this in the hook body rather than an effect:

```ts
if (error) {
  console.error(`Error fetching businesses: ${error}`)
  toast.error('Error', { description: 'Unable to fetch businesses' })
}
```

It fires on every render while `error` is set, and React 19 StrictMode double-invokes. With no toast
`id`, sonner stacks a new toast each time.

Affected: `use-get-businesses`, `use-get-tags`, `use-get-tax-categories`,
`use-get-financial-entities`, `use-get-financial-accounts`, `use-get-all-contracts`,
`use-get-business-trips`, `use-get-sort-codes`, `use-get-countries`, `use-get-all-clients`.

Two siblings already do it correctly in a `useEffect` (`use-get-admin-businesses:37`,
`use-get-security-businesses:50`), as does `hooks/use-my-memberships.ts:48-52` — which deliberately
logs without toasting and documents why. All ten broken sites are byte-identical apart from one
noun, and both strings derive from it.

## 5. `pause: true` + `useEffect` as a `useLazyQuery` substitute — 19 files

The declarative model is bypassed on the app's most important screen
(`components/screens/charges/all-charges.tsx:51-66`):

```ts
const [{ data, fetching }, fetchCharges] = useQuery({ ..., pause: true });
useEffect(() => {
  if (filter) { fetchCharges({ requestPolicy: 'network-only' }); }
}, [filter, activePage, fetchCharges]);
```

Note `if (filter)`: with no filter the query never fires. That is survivable today only because
`ChargesFilters` receives `initiallyOpened={!filter}` and opens the dialog, but the coupling is
implicit.

Same shape in `charges-ledger-validation.tsx`, `screens/documents/all-documents/index.tsx`,
`common/forms/issue-document/index.tsx`, `salaries/salaries-filters.tsx`, `charges/charges-row.tsx`,
`tags/tag-dialog.tsx`, and 12 more.

`components/screens/charges/charge.tsx:44-48` adds a redundant `useEffect(() => fetchCharge())` on
top of a query that is already unpaused under the identical condition — a duplicate network
round-trip on every mount of that path.

## 6. Missing exchanges

- **No `retryExchange`.** A single network blip is fatal: toast, no data, no recovery path but the
  user re-navigating.
- **No `devtoolsExchange`.** The urql browser devtools do not attach at all.
- No `ssrExchange` (irrelevant — this is an SPA) and no `subscriptionExchange` (see §8).

## 7. Config and dependency hygiene

- **Hardcoded endpoint URLs.** `providers/urql.tsx:212-226` switches on `import.meta.env.MODE`
  between three literal URLs. No env override, no Vite dev proxy. Blocks preview deploys, branch
  environments and per-developer backends.
- **`@tanstack/react-query` 5.102.8 is installed, a `QueryClientProvider` is mounted, and nothing
  uses it.** The only reference in `src/` is `router/layouts/root-layout.tsx:7,14`. Zero
  `useQuery`/`useMutation`/`useSuspenseQuery` imports from it anywhere.
- **`hooks/use-logout.ts`** has its cache reset commented out behind `// TODO: clear URQL cache`,
  and the commented call is `urqlClient.resetStore?.()` — an **Apollo** API urql does not have. The
  repo's own `resetUrqlClient()` is the correct call. Latent today (Auth0 logout triggers a
  full-page redirect that kills module state); becomes a cross-tenant data-leak path the moment a
  cache exists.
- **`dedupeFragments(XDocument)` called inline in render** at four of five sites
  (`reports/tax-report/index.tsx:153`, `profit-and-loss-report/index.tsx:148`,
  `corporate-tax-ruling-compliance-report/index.tsx:122`,
  `vat-monthly-report/pcn-generator.tsx:30`). Builds a fresh `DocumentNode` every render, forcing
  urql to re-print and re-hash a 126-line document each pass. `vat-monthly-report/index.tsx:44`
  already does it correctly at module scope.
- **`useLoaderData()` wrapped in `try/catch`** with `react-hooks/rules-of-hooks` disabled, in
  `screens/charges/charge.tsx:28-33`, `screens/businesses/business.tsx:25`, and
  `screens/businesses/clients/contracts/contracts.tsx:27`. All three are lazy-loaded route elements
  with no JSX call site anywhere, so the guarded scenario does not occur. `contracts.tsx` has no
  loader wired at all (only `chargeLoader` and `businessLoader` exist), making its branch
  unreachable.
- **Two casts defeat fragment masking** — `hooks/use-upload-multiple-documents.ts:79` and
  `use-upload-documents-from-google-drive.ts:89`.
- **`packages/client/CLAUDE.md`** says tests use `jsdom`; the vitest `client` project uses
  `happy-dom` (`vitest.config.ts:56-70`).

## 8. No persisted documents, no subscriptions

codegen's `client-preset` supports `persistedDocuments: true`, and Hive is already wired server-side
(`useHive`, `packages/server/src/index.ts:145`). Today every request ships the full document text —
including the 126-line tax report — on every execution, and the server accepts arbitrary operations
from any authenticated client.

There are zero subscriptions; all live-ness is manual refetching. Worth adding only if long-running
server operations should push progress.

## 9. Route loaders cannot pay off without a cache

`router/loaders/charge-loader.ts` and `business-loader.ts` call
`getUrqlClient().query(...).toPromise()`, but with no cache the result primes nothing — so the
consuming screens must be told not to re-fetch via `pause: !!loaderData`, and each reads the result
through the `useLoaderData()` try/catch described in §7. Adding a cache is what makes the loaders
actually useful and lets that machinery be deleted.

## Recommended direction

1. **Now:** the mechanical fixes in [`blueprint.md`](./blueprint.md) — §3, §4, §6, §7 above.
2. **Next:** `@urql/exchange-graphcache`. The specific payoff for this codebase is referential
   stability, which is exactly what `hooks/use-stable-value.ts` and the per-row `JSON.stringify` in
   `charges/charges-row.tsx` exist to fake, plus optimistic updates for the tag/description edits
   that dominate the charges workflow. Cost: `schema` awareness for this union-heavy schema, `keys`
   config for keyless types, and `updates` config across 104 mutations.
3. **Prerequisite for (2), and a schema change:** many mutations select only `{ charge { id } }`
   (`hooks/use-update-charge.ts:16-25`). No cache can patch from that. Mutations should return the
   fields they changed.
