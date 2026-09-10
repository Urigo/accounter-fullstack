# urql Quick Wins — Implementation Blueprint

Companion document: [`findings.md`](./findings.md) — the review these steps derive from.

## Status

Each step lands as its own PR, stacked on the previous one while that one is unmerged. A row is
marked done only once its PR is **merged**.

| Step | Scope                                           | PR          | Status      |
| ---- | ----------------------------------------------- | ----------- | ----------- |
| 0    | Baseline + `CLAUDE.md` happy-dom fix            | [#4438][s0] | **merged**  |
| 1    | `handleUrqlError` skips mutations               | [#4440][s1] | in review   |
| 2    | Extract `useQueryErrorToast`, wire one caller   | —           | not started |
| 3    | Roll the hook out to the remaining eleven       | —           | not started |
| 4    | `use-logout.ts` client reset                    | —           | not started |
| 5    | Drop dead loader-data guards + redundant effect | —           | not started |
| 6    | Hoist in-render `dedupeFragments()` calls       | —           | not started |
| 7    | Delete dead `@tanstack/react-query`             | —           | not started |
| 8a   | Configurable `VITE_GRAPHQL_URL`                 | —           | not started |
| 8b   | `retryExchange` + dev `devtoolsExchange`        | —           | not started |

[s0]: https://github.com/Urigo/accounter-fullstack/pull/4438
[s1]: https://github.com/Urigo/accounter-fullstack/pull/4440

## Context

A review of urql usage across `packages/client` (127 `useQuery` sites, 104 `useMutation` sites, 318
GraphQL documents in 294 files) found the fundamentals modern and well-disciplined — codegen
`client-preset` with fragment masking on, 100% mutation-hook discipline, `@defer` in production,
multipart uploads with zero extra config — sitting on one architectural gap: the client is built
with an explicit `exchanges` array that **omits `cacheExchange`** (`providers/urql.tsx:230-315`).
urql only installs its default `[cacheExchange, fetchExchange]` when `exchanges` is omitted
entirely, so the app runs with no cache. `TODO: add local data update method after change` appears
**72 times** in `src/hooks/`.

**Decisions taken:** this phase ships safe, mechanical fixes only — no cache change. The agreed
direction for the follow-up is **`@urql/exchange-graphcache`** (normalized), not a document cache.
Step 4 below is a prerequisite for that and is sequenced accordingly.

Branch: `claude/gifted-wozniak-ez6y23`. One commit per step.

### Corrections found while blueprinting

Four things I asserted in the review turned out to be wrong or incomplete. The steps below reflect
the verified state, not the original claims:

1. **Only 10 hooks have render-body toasts, not 12.** `use-get-admin-businesses.ts:37` and
   `use-get-security-businesses.ts:50` already use `useEffect`.
2. **The "7 component-level occurrences" do not exist.** All six component sites
   (`tax-categories/index.tsx:113`, `screens/sort-codes/index.tsx:135`,
   `business-trip-report/parts/core-expense-row.tsx:86`, and three more) are already inside
   `useEffect`. Nothing to fix there.
3. **No route declares an `id`,** so `useRouteLoaderData(routeId)` is not available without first
   adding ids. It also isn't needed — see step 5.
4. **`contracts.tsx` has no loader wired at all.** Only `chargeLoader` and `businessLoader` exist
   (`router/config.tsx:335,365`). Its `useLoaderData()` branch is unreachable code.

### Environment note

`node_modules` was absent at review time, and the only Node on PATH is **v22.22.2** while the repo
pins **26.8.1** (`.node-version`, `package.json` `engines`). `yarn install` was nonetheless verified
to complete successfully on Node 22 (exit 0, warnings only), so the suite is runnable. Step 0
records the test baseline before any code changes.

---

## Blueprint: why this order

Three constraints drive the sequencing:

- **Existing test anchors first.** Steps 3 and 4 have test files already in place — step 4 even has
  an `it.skip` waiting to be un-skipped. Those give the cheapest red-green cycles, so they come
  early and build confidence in the harness.
- **New dependencies last.** Step 8 is the only step needing `yarn add`, and it is also the only one
  that must extend the wholesale `vi.mock('urql', ...)` in `urql-client.test.ts`. If the install is
  blocked by the Node mismatch, everything before it still lands.
- **Novel before repetitive.** Step 2 builds and tests one new shared hook against a single call
  site; step 3 is the bulk rollout of that proven unit. The risk is isolated in the small step.

Steps 1–7 change no dependencies and need no `yarn generate` — no GraphQL document or schema changes
anywhere in this phase.

### Right-sizing pass

First cut had 10 steps mirroring the 10 review items. Three revisions:

- **Merged** the `CLAUDE.md` `jsdom`→`happy-dom` fix into step 0 — it documents exactly what step 0
  verifies, and does not deserve its own commit.
- **Split** the render-body toast fix into two steps (2 and 3). Creating a shared hook _and_
  rewriting 12 call sites in one commit hides a new abstraction inside a bulk diff. Step 2 proves
  the hook against one caller; step 3 is then purely mechanical.
- **Merged** the three loader-data screens into one step (5) — same pattern, and `contracts.tsx`
  only makes sense alongside the two that do have loaders.

Result: 8 steps. Each is independently revertable, each ends with the code wired into a caller, and
no step leaves an untested unit behind.

---

## Step 0 — Establish a green baseline

**No source changes.** Purely: can this environment run the suite?

```bash
yarn install
yarn test:client # vitest run --project client
```

If `yarn install` fails the `engines` check on Node 22, try in order: (a) a Node 26 runtime if one
can be provisioned, (b) `YARN_IGNORE_NODE=1 yarn install`. If neither works, **stop and report** —
do not proceed to write code that cannot be tested. A plan whose verification step is unrunnable is
not a plan.

Record the pass/fail baseline. Any test already failing before step 1 is pre-existing and must not
be attributed to this work.

Then fix `packages/client/CLAUDE.md`: the Testing section says `Uses jsdom environment`; the vitest
`client` project uses `happy-dom` (`vitest.config.ts:56-70`).

**Done when:** the baseline is recorded and `CLAUDE.md` matches reality.

---

## Step 1 — `handleUrqlError` skips mutations

The smallest real behavior change, with a test file already in place.

**Problem.** Two layers toast every failing mutation: the global `mapExchange` handler
(`providers/urql-error-handler.ts:28`, `'Operation Error'`, no toast `id`, 5s) and
`handleCommonErrors` (`helpers/error-handling.ts:53-58`, `'Error'`, stable `id`, 100s,
`closeButton`). The hook's version is strictly better — entity-scoped message, dismissible, replaces
in place — so the global one should stand down for mutations.

**Red.** Add to `src/__tests__/urql-error-handler.test.ts`:

- a result with `operation.kind === 'mutation'` → `toast.error` not called;
- a result with `operation.kind === 'query'` → called once.

**Critical detail:** the existing `resultWithCode()` helper builds `{ error }` with **no `operation`
key at all**, and both existing tests depend on it toasting. The implementation must therefore use
optional chaining (`result.operation?.kind === 'mutation'`) so an absent operation still toasts.
Extend the helper to take an optional kind rather than replacing it.

**Green.** One guard clause in `handleUrqlError`, above the `graphQLErrors` branch. Leave the
`networkError` branch alone — a mutation that never reached the server should still raise the
network toast, since `handleCommonErrors` produces only a generic `'Error occurred'` for that case.

---

## Step 2 — Extract `useQueryErrorToast`, prove it on one caller

**Problem.** 10 hooks do this in the hook body, so it fires on **every render** while `error` is
set, and React 19 StrictMode double-invokes. No toast `id`, so sonner stacks a new toast each time:

```ts
if (error) {
  console.error(`Error fetching businesses: ${error}`)
  toast.error('Error', { description: 'Unable to fetch businesses' })
}
```

All 10 are byte-identical apart from one noun, and both strings derive from it
(`Error fetching ${subject}: ` / `Unable to fetch ${subject}`). That uniformity is what makes a
shared hook the right call rather than 10 copied effects.

**Red.** New `src/hooks/__tests__/use-query-error-toast.test.ts`, using the repo's hand-rolled
`createRoot` + `act` harness (see `hooks/__tests__/use-logout.test.ts` for the shape — there is no
`@testing-library` in this package). Cases:

- no error → no toast;
- an error → exactly one toast, and a `console.error` carrying the subject;
- **re-render with the same error → still exactly one toast** (this is the regression that names the
  bug — it fails against the current inline code);
- a new error → a second toast;
- the toast carries a stable `id` derived from the subject.

**Green.** New `src/hooks/use-query-error-toast.ts`:

```ts
export function useQueryErrorToast(error: CombinedError | undefined, subject: string): void
```

`useEffect` keyed on `[error, subject]`, `console.error` +
`toast.error('Error', { id: \`fetch-${subject}\`, description: \`Unable to fetch ${subject}\` })`.

**Wire it.** Adopt in `hooks/use-get-businesses.ts` only — one caller, proving the abstraction end
to end. The remaining nine stay untouched until step 3, so this commit is small and the new unit is
not orphaned.

Reference for the target shape: `hooks/use-my-memberships.ts:48-52`, which already does the effect
correctly (and deliberately does not toast, with a documented rationale — leave it alone).

---

## Step 3 — Roll `useQueryErrorToast` out to the remaining 11 hooks

Purely mechanical, on a unit the previous step already tested.

Nine still holding the render-body bug: `use-get-tags`, `use-get-tax-categories`,
`use-get-financial-entities`, `use-get-financial-accounts`, `use-get-all-contracts`,
`use-get-business-trips`, `use-get-sort-codes`, `use-get-countries`, `use-get-all-clients`.

Two already using an effect, folded in for one pattern: `use-get-admin-businesses`,
`use-get-security-businesses`. Behavior change for these two is only the added toast `id`.

Verify each hook's subject noun still produces its original two strings verbatim — the point is to
change _when_ the toast fires, not _what_ it says. `yarn test:client` plus
`src/__tests__/stories.test.tsx` (which mounts every story against a real urql client) is the net.

---

## Step 4 — Fix `use-logout.ts` (graphcache prerequisite)

**Problem.** `hooks/use-logout.ts` has its cache reset commented out behind
`// TODO: clear URQL cache`, and the commented call is `urqlClient.resetStore?.()` — an **Apollo**
API urql does not have. `hooks/__tests__/use-logout.test.ts:71` already carries
`it.skip('calls urqlClient.resetStore()')`.

Latent today, because Auth0 logout triggers a full-page redirect that kills module state. It becomes
a **cross-tenant leak the moment graphcache lands**: a normalized cache surviving a logout/login
inside one page lifetime would serve the previous user's entities. This is why it lands before the
cache, not after.

**Red.** Rewrite the skipped test against the real API and un-skip it. The mock changes from
`vi.mock('urql', () => ({ useClient }))` to a mock of `../providers/urql.js` exposing
`resetUrqlClient`. Assert it is called once, and that it is called **before** `logout()` — order
matters, since `logout()` navigates away.

**Green.** Call the repo's own `resetUrqlClient()` (`providers/urql.tsx:324`). Note it nulls the
singleton but does **not** push a new client into the Provider; `setBusinessScope`
(`providers/urql.tsx:84-97`) is the in-repo precedent for doing both. Follow it — export a small
`resetUrqlClientAndNotify()` from `providers/urql.tsx` wrapping the existing `resetUrqlClient()` +
`onClientReset?.(getUrqlClient())` pair, and have `setBusinessScope` call it too so the two paths
cannot drift.

---

## Step 5 — Loader data: drop the try/catch and the redundant effect

Three screens wrap `useLoaderData()` in `try/catch` with an
`// eslint-disable-next-line react-hooks/rules-of-hooks` above it, guarding against being rendered
outside a data route. **That scenario does not exist** — all three are lazy-loaded route elements
only (`router/config.tsx:335,365`, and the contracts route), never used as embedded children.
Verified by grep: no JSX call site for any of them.

- **`screens/charges/charge.tsx`** — remove the try/catch + disable, and remove the redundant mount
  effect at lines 44-48. That effect re-executes a query urql already runs on mount under the exact
  same condition (`pause: !id || !!loaderData`), costing a duplicate round-trip with no cache to
  absorb it. Leave the now-unused `chargeId?: string` prop in place; removing it is a public-shape
  change and out of scope — note it for the follow-up.
- **`screens/businesses/business.tsx:25`** — remove the try/catch + disable.
- **`screens/businesses/clients/contracts/contracts.tsx:24-30`** — this route has **no loader**, so
  delete the `loaderData` variable, the `useLoaderData` import, and the `|| loaderData` /
  `!!loaderData` branches outright. Unreachable code, not a conversion.

**Test.** No existing test covers these screens. Add a focused render test for `charge.tsx`
asserting the query executes exactly once on mount when there is no loader data — that is the
regression the removed effect caused. Use the scripted-`fetch` real-`Client` harness from
`components/charges/__tests__/charges-table-refetch.test.tsx`, which already counts operations by
name; it is the highest-fidelity pattern in the repo and exactly fits "assert one network call".

`useRouteLoaderData` is explicitly **not** used: no route declares an `id`, and it would need one.

---

## Step 6 — Hoist the 4 in-render `dedupeFragments()` calls

Pure refactor, no behavior change.

`reports/tax-report/index.tsx:153`, `reports/profit-and-loss-report/index.tsx:148`,
`reports/corporate-tax-ruling-compliance-report/index.tsx:122`,
`reports/vat-monthly-report/pcn-generator.tsx:30` each call `dedupeFragments(XDocument)` inline in
render, building a fresh `DocumentNode` every pass and forcing urql to re-print and re-hash the
document (the tax report's is 126 lines). Hoist each to a module-scope `const`, matching
`reports/vat-monthly-report/index.tsx:44`, which already does it right.

Verified by `yarn lint` + build + `stories.test.tsx`. No new test — there is no behavior to assert,
and a test that only restates the refactor is noise.

---

## Step 7 — Remove the dead `@tanstack/react-query`

`@tanstack/react-query@5.102.8` is a dependency with a `QueryClientProvider` mounted and **zero**
usage: the only reference in `src/` is `router/layouts/root-layout.tsx:7,14`, and no file anywhere
imports `useQuery`/`useMutation`/`useSuspenseQuery` from it.

Remove the `QueryClient` construction and the `QueryClientProvider` wrapper from `root-layout.tsx`
(keeping the `UrqlProvider > UserProvider` nesting intact), drop the dep from
`packages/client/package.json`, and re-run `yarn install` to update the lockfile.

**Keep `@tanstack/react-table`** — that one is load-bearing across every table in the app.

Sequenced here rather than earlier because it is the first step to touch `package.json`, and a
lockfile change is the noisiest thing to bisect through if an earlier step regressed.

---

## Step 8 — `VITE_GRAPHQL_URL`, then retry + devtools exchanges

Both parts touch `providers/urql.tsx` and both must extend `src/__tests__/urql-client.test.ts`, so
they share a step — but land them as **two commits**.

### 8a — Configurable endpoint

`providers/urql.tsx:212-226` switches on `import.meta.env.MODE` between three hardcoded URLs. This
blocks preview deploys, branch environments and per-developer backends.

**Follow the existing convention, which is not the obvious one:** `vite.config.ts:44-52` maps
_unprefixed_ env vars into `import.meta.env.VITE_*` via `define` (`AUTH0_DOMAIN` →
`VITE_AUTH0_DOMAIN`, `ALLOW_DEV_AUTH` → `VITE_DEV_AUTH`). `.env.template` contains **no** `VITE_`
lines. So: add `GRAPHQL_URL` to `.env.template` near the Auth0 block (line ~91), and
`'import.meta.env.VITE_GRAPHQL_URL': JSON.stringify(process.env.GRAPHQL_URL ?? '')` to `define`. Use
`?? ''` rather than bare `JSON.stringify` so an unset var yields an empty string instead of the
literal `undefined`.

In `getUrqlClient()`, prefer a non-empty `import.meta.env.VITE_GRAPHQL_URL`, else fall back to the
existing per-`MODE` literals unchanged.

**Test.** Extend `urql-client.test.ts`:
`vi.stubEnv('VITE_GRAPHQL_URL', 'https://example.test/graphql')` → `createClientMock` receives that
url; unset/empty → the existing `MODE` default. The file already uses `vi.stubEnv` +
`vi.unstubAllEnvs` and already captures the `createClient` call, so this needs no new harness.

### 8b — `retryExchange` + dev-only `devtoolsExchange`

```bash
yarn workspace @accounter/client add --exact @urql/exchange-retry
yarn workspace @accounter/client add --exact --dev @urql/devtools
```

Today a single network blip is fatal — a toast, no data, no recovery but re-navigating. And the urql
browser devtools do not attach at all.

**Order — corrected from the original plan.** Put `retryExchange` **after** `authExchange`, closest
to the network:

```
[devtoolsExchange (dev only), mapExchange, <cacheExchange slot>, authExchange, retryExchange, fetchExchange]
```

Rationale: `authExchange` then sees one final result rather than each retry attempt, so retries
cannot interact with `didAuthError`/`refreshAuth`. The reverse order would re-run the auth logic per
attempt for no benefit — a network failure carries no `graphQLErrors`, so `didAuthError` never
matches either way. The `cacheExchange` slot stays open for graphcache.

Config: `retryIf: err => !!err.networkError` — never retry GraphQL errors. `retryExchange` skips
mutations by default; **keep that**, these mutations are not idempotent.

**Three test-harness landmines, all in `urql-client.test.ts`:**

1. It mocks the `urql` module wholesale (lines 45-50) with only four exports. Adding a
   `retryExchange`/`devtoolsExchange` import means adding `vi.mock('@urql/exchange-retry', ...)` and
   `vi.mock('@urql/devtools', ...)`, or the real modules load into the mocked graph.
2. **`import.meta.env.DEV` is `true` under vitest**, so a naive `DEV` gate puts `devtoolsExchange`
   in the array during tests. Either stub it per-test or assert with `expect.arrayContaining` rather
   than exact array equality.
3. Nothing currently asserts the exchange array's _contents_. Add that assertion as part of this
   step — it is what makes the graphcache insertion in the next phase safe.

Also confirm `renovate.json:36-38` already groups these (it matches `@urql{/,}**`, so it should).

---

## Verification

Per step:

```bash
yarn lint
yarn test:client
yarn workspace @accounter/client build # tsc && vite build — only needed on steps 5-8
```

`yarn generate` is never needed in this phase.

The three regression nets, in increasing breadth:

- **`src/__tests__/urql-client.test.ts`** (381 lines, 14 auth cases) — guards steps 4 and 8. It
  asserts on the `createClient` call, so step 8 necessarily updates it.
- **`src/__tests__/urql-error-handler.test.ts`** — guards step 1.
- **`src/__tests__/stories.test.tsx`** — mounts every `*.stories.tsx` through `composeStories`
  against a real urql client. The broadest smoke test in the repo and the one most likely to catch
  an exchange-order mistake from step 8.

Manual pass at the end, against `yarn mock:client` from the repo root (graphql-yoga +
`@graphql-tools/mock` on :4000, Vite on :3001):

1. Force a failing mutation → exactly one toast, dismissible (step 1).
2. Force a failing lookup query, re-render the screen → the toast does not stack (steps 2-3).
3. Kill the mock server mid-query → the retry fires before the network toast (step 8b).
4. urql devtools attach in dev; confirm absent from a production build (step 8b).
5. Point `GRAPHQL_URL` at a bogus host → it is actually used (step 8a).
6. Log out → `resetUrqlClient` runs before the Auth0 redirect (step 4).

---

## Implementation prompts

Each prompt is self-contained, assumes only the prior prompts have landed, and ends with the code
wired into a caller. Run `yarn lint && yarn test:client` before every commit; commit at the end of
each prompt.

---

### Prompt 0 — Baseline

```
Establish a verified baseline before any code changes.

1. Run `yarn install` at the repo root. It may fail the `engines` check: the repo pins Node
   26.8.1 (`.node-version`, root `package.json`) and only Node 22 is on PATH. If it fails, try
   `YARN_IGNORE_NODE=1 yarn install`. If that also fails, STOP and report the blocker — do not
   write code that cannot be tested.
2. Run `yarn test:client` and record which tests pass and which already fail. Anything red here
   is pre-existing; note it so later steps are not blamed for it.
3. Fix `packages/client/CLAUDE.md`: its Testing section says "Uses jsdom environment", but the
   vitest `client` project uses happy-dom (`vitest.config.ts:56-70`).

Commit only the CLAUDE.md fix. Report the baseline in your summary.
```

---

### Prompt 1 — Stop double-toasting mutation errors

```
Two layers toast every failing mutation: the global handler in
`packages/client/src/providers/urql-error-handler.ts` (wired as `mapExchange({ onResult })` at
`providers/urql.tsx:231`) and `handleCommonErrors` in `helpers/error-handling.ts:53-58`. The
hook-level one is better — entity-scoped message, stable toast id, dismissible, replaces in
place — so the global handler should stand down for mutations only.

TEST FIRST, in `packages/client/src/__tests__/urql-error-handler.test.ts`:
- Extend the existing `resultWithCode()` helper to accept an optional operation kind. Do NOT
  change its default: both existing tests build a result with NO `operation` key and depend on
  it still toasting.
- Add: a result with `operation.kind === 'mutation'` does not call `toast.error`.
- Add: a result with `operation.kind === 'query'` calls `toast.error` exactly once.
Run the tests and confirm the mutation case fails.

THEN implement in `handleUrqlError`: a guard using optional chaining
(`result.operation?.kind === 'mutation'`) placed above the `graphQLErrors` branch. An absent
`operation` must still toast.

Leave the `networkError` branch untouched and above the guard — a mutation that never reached the
server should still raise the network toast, because `handleCommonErrors` only produces a generic
"Error occurred" for that case.

Confirm all four tests pass.
```

---

### Prompt 2 — Extract `useQueryErrorToast` and prove it on one caller

```
Ten hooks in `packages/client/src/hooks/` call `toast.error` from the HOOK BODY, so it fires on
every render while `error` is set, and React 19 StrictMode double-invokes. There is no toast id,
so sonner stacks a new toast each time. All ten are byte-identical apart from one noun:

  if (error) {
    console.error(`Error fetching businesses: ${error}`);
    toast.error('Error', { description: 'Unable to fetch businesses' });
  }

TEST FIRST: create `packages/client/src/hooks/__tests__/use-query-error-toast.test.ts`. There is
no @testing-library in this package — use the repo's hand-rolled `createRoot` + `act` harness;
copy the shape from `hooks/__tests__/use-logout.test.ts` (note its `// @vitest-environment
happy-dom` pragma and `IS_REACT_ACT_ENVIRONMENT` setup). Mock sonner as that file mocks its deps.
Cases:
- no error -> no toast
- an error -> exactly one toast, plus a console.error containing the subject
- RE-RENDER with the same error -> STILL exactly one toast   <- this is the regression under test
- a different error -> a second toast
- the toast carries a stable id derived from the subject

THEN implement `packages/client/src/hooks/use-query-error-toast.ts`:

  export function useQueryErrorToast(error: CombinedError | undefined, subject: string): void

A `useEffect` keyed on `[error, subject]` that calls `console.error(`Error fetching ${subject}: ${error}`)`
and `toast.error('Error', { id: `fetch-${subject}`, description: `Unable to fetch ${subject}` })`.

THEN WIRE IT into `hooks/use-get-businesses.ts` ONLY — replacing its render-body block with
`useQueryErrorToast(error, 'businesses')`. Leave the other nine alone; they are the next prompt.
Verify the emitted strings are byte-identical to what that hook produced before.

Reference for the target shape: `hooks/use-my-memberships.ts:48-52` already does the effect
correctly. Do not modify it — it deliberately logs without toasting and documents why.
```

---

### Prompt 3 — Roll the hook out to the remaining eleven

```
`useQueryErrorToast` from the previous prompt is tested and in use by `use-get-businesses.ts`.
Adopt it everywhere else in `packages/client/src/hooks/`.

Nine still carrying the render-body bug — convert each:
  use-get-tags, use-get-tax-categories, use-get-financial-entities, use-get-financial-accounts,
  use-get-all-contracts, use-get-business-trips, use-get-sort-codes, use-get-countries,
  use-get-all-clients

Two already using a useEffect — fold them in so there is one pattern; their only behavior change
is gaining a toast id:
  use-get-admin-businesses, use-get-security-businesses

For each, pass the subject noun that reproduces its ORIGINAL two strings verbatim
(`Error fetching <subject>: ` and `Unable to fetch <subject>`). This step changes WHEN the toast
fires, never WHAT it says — diff each one to confirm. Remove the now-unused `toast` imports.

Verify with `yarn test:client`, which includes `src/__tests__/stories.test.tsx` (it mounts every
story against a real urql client and will catch a broken hook import).
```

---

### Prompt 4 — Make logout actually reset the client

```
`packages/client/src/hooks/use-logout.ts` has its cache reset commented out behind
`// TODO: clear URQL cache`, and the commented call is `urqlClient.resetStore?.()` — an Apollo
API that urql does not have. `hooks/__tests__/use-logout.test.ts:71` already has a matching
`it.skip('calls urqlClient.resetStore()')`.

This is latent today (Auth0 logout does a full-page redirect that kills module state) but becomes
a cross-tenant data leak once graphcache lands, so it must be fixed before the cache.

FIRST, in `providers/urql.tsx`: note that `resetUrqlClient()` (line 324) nulls the singleton but
does NOT push a new client into the Provider. `setBusinessScope` (lines 84-97) is the in-repo
precedent that does both. Extract that pair into an exported
`resetUrqlClientAndNotify()` (calling `resetUrqlClient()` then `onClientReset?.(getUrqlClient())`)
and have `setBusinessScope` call it, so the two paths cannot drift.

TEST: rewrite the skipped test in `hooks/__tests__/use-logout.test.ts` against the real API and
un-skip it. Replace `vi.mock('urql', () => ({ useClient }))` with a mock of `../providers/urql.js`
exposing `resetUrqlClientAndNotify`. Assert it is called exactly once, and that it is called
BEFORE `logout()` — ordering matters because `logout()` navigates away. Confirm it fails first.

THEN implement: `useLogout` calls `resetUrqlClientAndNotify()` before `await logout(...)`. Remove
the commented-out `useClient` import and the TODO. Keep the existing `sessionStorage.clear()`.

Confirm both tests in the file pass and `src/__tests__/urql-client.test.ts` (which exercises
`setBusinessScope`) is still green.
```

---

### Prompt 5 — Remove the dead loader-data guards

```
Three screens wrap `useLoaderData()` in a try/catch with an
`// eslint-disable-next-line react-hooks/rules-of-hooks`, guarding against being rendered outside
a data route. That scenario does not exist: all three are lazy-loaded route elements only
(`router/config.tsx:335,365` and the contracts route) and have no JSX call site anywhere. Verify
that with a grep before you start, then:

1. `components/screens/charges/charge.tsx`
   - remove the try/catch and the eslint disable; call `useLoaderData()` directly
   - remove the redundant mount effect at lines 44-48. It re-executes a query urql already runs
     on mount under the identical condition (`pause: !id || !!loaderData`), costing a duplicate
     network round-trip with no cache to absorb it.
   - LEAVE the now-unused `chargeId?: string` prop alone — removing it is a public-shape change
     and out of scope.
2. `components/screens/businesses/business.tsx:25` — remove the try/catch and the eslint disable.
3. `components/screens/businesses/clients/contracts/contracts.tsx:24-30` — this route has NO
   loader wired (only `chargeLoader` and `businessLoader` exist), so the branch is unreachable.
   Delete the `loaderData` variable, the `useLoaderData` import, and the `|| loaderData` /
   `!!loaderData` branches outright. This is a deletion, not a conversion.

Do NOT reach for `useRouteLoaderData` — no route in `router/config.tsx` declares an `id`, and it
would need one.

TEST: no existing test covers these screens. Add one for `charge.tsx` asserting the query executes
EXACTLY ONCE on mount when there is no loader data — that is the duplicate-fetch regression the
removed effect caused. Use the scripted-`fetch` real-`Client` harness from
`components/charges/__tests__/charges-table-refetch.test.tsx`, which already counts operations by
name and is the right fidelity for "assert one network call". Write it against the current code
first and confirm it fails with two calls.
```

---

### Prompt 6 — Hoist the in-render `dedupeFragments()` calls

```
Four report components call `dedupeFragments(XDocument)` inline in render, building a fresh
DocumentNode every pass and forcing urql to re-print and re-hash the document (the tax report's
is 126 lines):

  components/reports/tax-report/index.tsx:153
  components/reports/profit-and-loss-report/index.tsx:148
  components/reports/corporate-tax-ruling-compliance-report/index.tsx:122
  components/reports/vat-monthly-report/pcn-generator.tsx:30

Hoist each to a module-scope const, matching `components/reports/vat-monthly-report/index.tsx:44`,
which already does it correctly.

Pure refactor with no behavior to assert — do not add a test that merely restates the change.
Verify with `yarn lint`, `yarn workspace @accounter/client build`, and `yarn test:client`
(`stories.test.tsx` mounts these components).
```

---

### Prompt 7 — Delete the dead `@tanstack/react-query`

```
`@tanstack/react-query@5.102.8` is a dependency with a `QueryClientProvider` mounted and zero
usage. Confirm first: the only reference in `packages/client/src/` is
`router/layouts/root-layout.tsx:7,14`, and nothing anywhere imports `useQuery`, `useMutation` or
`useSuspenseQuery` from it.

- Remove the `QueryClient` construction and the `QueryClientProvider` wrapper from
  `root-layout.tsx`, keeping the surrounding `UrqlProvider > UserProvider` nesting intact.
- Drop the dependency from `packages/client/package.json`.
- Re-run `yarn install` to update the lockfile.

KEEP `@tanstack/react-table` — it is load-bearing across every table in the app. Do not touch it.

Verify with `yarn test:client` and `yarn workspace @accounter/client build`.
```

---

### Prompt 8a — Make the GraphQL endpoint configurable

```
`providers/urql.tsx:212-226` switches on `import.meta.env.MODE` between three hardcoded URLs,
which blocks preview deploys, branch environments and per-developer backends.

Follow the repo's existing convention, which is NOT the obvious one: `vite.config.ts:44-52` maps
UNPREFIXED env vars into `import.meta.env.VITE_*` via `define` (AUTH0_DOMAIN -> VITE_AUTH0_DOMAIN,
ALLOW_DEV_AUTH -> VITE_DEV_AUTH). `.env.template` contains no VITE_ lines at all.

TEST FIRST, in `src/__tests__/urql-client.test.ts` — it already uses `vi.stubEnv` /
`vi.unstubAllEnvs` and already captures the `createClient` call via `createClientMock`, so no new
harness is needed:
- `vi.stubEnv('VITE_GRAPHQL_URL', 'https://example.test/graphql')` -> createClient receives it
- unset or empty -> the existing per-MODE default is used

THEN implement:
- `getUrqlClient()` prefers a non-empty `import.meta.env.VITE_GRAPHQL_URL`, else falls back to the
  existing MODE literals unchanged.
- `vite.config.ts` `define`: add
  `'import.meta.env.VITE_GRAPHQL_URL': JSON.stringify(process.env.GRAPHQL_URL ?? '')`.
  Use `?? ''` so an unset var yields an empty string, not the literal `undefined`.
- `.env.template`: add a commented `GRAPHQL_URL=` near the Auth0 block (~line 91).
```

---

### Prompt 8b — Add retry and devtools exchanges

```
Today a single network blip is fatal — a toast, no data, no recovery but re-navigating — and the
urql browser devtools do not attach at all.

  yarn workspace @accounter/client add --exact @urql/exchange-retry
  yarn workspace @accounter/client add --exact --dev @urql/devtools

Target exchange order in `providers/urql.tsx`:

  [devtoolsExchange (dev only), mapExchange, <cacheExchange slot>, authExchange, retryExchange, fetchExchange]

retryExchange goes AFTER authExchange, closest to the network, so authExchange sees one final
result rather than each retry attempt and retries cannot interact with didAuthError/refreshAuth.
Leave the cacheExchange slot open and comment it — graphcache lands there next phase.

Config: `retryIf: err => !!err.networkError` — never retry GraphQL errors. retryExchange skips
mutations by default; KEEP that, these mutations are not idempotent. Gate devtoolsExchange on
`import.meta.env.DEV` so it is tree-shaken from production builds.

THREE HARNESS LANDMINES in `src/__tests__/urql-client.test.ts`:
1. It mocks the `urql` module wholesale (lines 45-50) with only four exports. You must add
   `vi.mock('@urql/exchange-retry', ...)` and `vi.mock('@urql/devtools', ...)` or the real
   modules load into the mocked graph.
2. `import.meta.env.DEV` is TRUE under vitest, so a naive DEV gate puts devtoolsExchange into the
   array during tests. Either stub it per-test or assert with `expect.arrayContaining` rather
   than exact array equality.
3. Nothing currently asserts the exchange array's CONTENTS. Add that assertion now — it is what
   makes inserting graphcache safe next phase.

Confirm all 14 pre-existing auth tests still pass. Verify `renovate.json:36-38` already groups the
new packages (it matches `@urql{/,}**`).

Finally, run the full manual pass from the Verification section against `yarn mock:client`.
```

---

## Out of scope, recorded for the follow-up

- Any cache exchange. Next phase is `@urql/exchange-graphcache`, needing `schema` awareness for this
  union-heavy schema (`CommonError` unions, `... on BusinessTripCharge`), `keys` for keyless types,
  and `updates` across the 104 mutations. Its payoff here is referential stability — exactly what
  `hooks/use-stable-value.ts` and the per-row `JSON.stringify` in `charges/charges-row.tsx:62-78`
  exist to fake — plus optimistic updates for the tag/description edits that dominate charges.
- Retiring the hand-rolled invalidation: `providers/charge-refresh.tsx` (~100 lines), 64 zero-arg
  `onChange` declarations across 60 files, 25 `network-only` policies, the `pause: true` + effect
  pattern in 19 files.
- `providers/user-provider.tsx:145-147` — `if (fetching) return <AccounterLoader />` unmounts the
  whole app tree on any `UserContext` refetch, refiring every child query.
- The dead `chargeId?: string` prop on `Charge` (step 5).
- Mutation payload design — many mutations select only `{ charge { id } }`
  (`hooks/use-update-charge.ts:16-25`), which no cache can patch from. Prerequisite for optimistic
  UI.
- Persisted documents (`presetConfig.persistedDocuments` + `usePersistedOperations`; Hive already
  wired at `packages/server/src/index.ts:145`).
