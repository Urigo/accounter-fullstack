# GraphQL v17 migration — blocked on upstream peer support

**Status: blocked.** Last verified against the npm registry on **2026-10-11**.

`graphql` v17 has been out since June 2026. This repo stays on `graphql@16.14.2` — pinned in the
root `resolutions` and in eight package manifests, of which only four are in scope (`client`,
`server`, `email-ingestion-gateway`, `green-invoice-graphql`; the other four are frozen) — because
three dependencies that are load-bearing in the server's request path still cap their `graphql` peer
range at `^16`, including in their alpha and rc channels.

The blocker is upstream. Our own code needs only a small, well-understood change (see
[Our code](#our-code-two-test-files-need-work)).

## Readiness at a glance

| Area                                | State                                                                       |
| ----------------------------------- | --------------------------------------------------------------------------- |
| Platform (Node, TypeScript)         | **Ready** — Node 26.x, TS 6.x, both well past v17's floors.                 |
| Server runtime stack                | **Blocked** — `graphql-modules`, `@graphql-hive/yoga`.                      |
| HTTP clients                        | **Blocked** — `graphql-request` (`scraper-app`, `email-ingestion-gateway`). |
| Codegen, tools, yoga, envelop, urql | **Ready** — all declare `^17` or have no `graphql` peer.                    |
| Lint                                | **Blocked** — `@graphql-eslint/eslint-plugin`.                              |
| Mesh (`green-invoice-graphql`)      | **Mostly ready** — runtime fine; one stuck codegen plugin.                  |
| Our source                          | **Near-ready** — two test files to convert off `createRequire`.             |

Nothing upstream has moved since the 2026-09-22 check. The repo has moved _toward_ readiness (two
mesh packages frozen out of the build), and one small first-party regression appeared.

## The blockers

### Runtime (hard)

| Package              | Pinned | `graphql` peer range    | Notes                                                                                                             |
| -------------------- | ------ | ----------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `graphql-modules`    | 3.1.2  | `^14 \|\| ^15 \|\| ^16` | The module system the whole server is built on. No v17 **even in alpha**. No publish at all since 2026-07-12.     |
| `@graphql-hive/yoga` | 0.49.7 | `^0.13 … ^16`           | Registered in `packages/server/src/index.ts`. Published most weeks (alpha as recent as 2026-10-09) — still `^16`. |
| `graphql-request`    | 7.4.0  | `14 - 16`               | Used by `scraper-app` and `email-ingestion-gateway`. No publish since 2025-12.                                    |

The **entire Hive line** is capped at `^16` — `@graphql-hive/core`, `@graphql-hive/envelop`,
`@graphql-hive/apollo`, and `@graphql-hive/gateway`. There is no Hive package to switch to.
`@graphql-hive/core` has since shipped its `0.23.0` minor as stable; it did **not** widen the peer
range, and neither did the 2026-10-09 alphas.

### Dev / tooling (softer — blocks lint and the mesh builds, not the server)

- `@graphql-eslint/eslint-plugin` — peer `^16` only (alpha too). Blocks `yarn lint`.
- `@graphql-codegen/typescript-graphql-request` — peer caps at `^16`, and `7.1.0` is the newest
  release.
- `@graphql-codegen/typescript-generic-sdk` — peer caps at `^16`, and `5.0.1` is the newest release,
  so there is nothing to upgrade to. Used by `green-invoice-graphql`.

The mesh surface is smaller than it used to be: `hashavshevet-mesh` and `payper-mesh` are now frozen
and excluded from the workspaces, leaving `green-invoice-graphql` (Mesh **v1**) as the only mesh
package in the build. Its runtime deps are already fine — `@graphql-mesh/fusion-runtime` declares
`^17`, and `transport-rest` / `compose-cli` peer `graphql: "*"`. Only its codegen plugins lag, and
two of the three are simply old majors: `@graphql-codegen/typescript@5.0.10` and
`typescript-operations@5.1.0` both have v17-ready `6.x` releases available. That leaves
`typescript-generic-sdk` as the one genuinely stuck dependency there.

### The sharp edge

`@envelop/graphql-modules` **already declares `graphql: "… || ^17.0.0"`** — the bridge is v17-ready.
But it also peers `graphql-modules: "^1 || ^2 || ^3"`, and `graphql-modules` is the package capped
at `^16`. The adapter is ready and waiting on the library it adapts.

That makes `graphql-modules` the single gating item for the server. Both it
(`Urigo/graphql-modules`) and the Hive line (The Guild) are maintained in-house, so unblocking is
plausibly within our own control rather than a wait on a third party. Worth noting the asymmetry:
Hive ships almost weekly and simply hasn't widened its range, while `graphql-modules` has had no
release of any kind in three months.

## Already v17-ready

Everything else in the GraphQL dependency tree either declares `^17` or has no `graphql` peer at
all: `graphql-yoga`, `@graphql-yoga/plugin-defer-stream`, all `@envelop/*` (including `generic-auth`
and `graphql-modules`), the whole `@graphql-codegen/*` set (`cli`, `client-preset`, `typescript`,
`typescript-resolvers`, `graphql-modules-preset`, `schema-ast`, `core`), `@graphql-tools/*`,
`@graphql-inspector/cli`, `graphql-scalars`, `graphql-ws`, `graphql-tag`, `@0no-co/graphqlsp`, and
`urql` / `@urql/*`.

Platform prerequisites are met: Node 26.x (v17 needs ≥22) and TypeScript 6.x (v17 needs ≥4.4).

## Our code: two test files need work

v17 ships the npm package as **ESM-only**. Two test files load `graphql` through `createRequire`,
which is a CJS require and will break:

- `packages/server/src/__tests__/timeless-dates.integration.test.ts:43` —
  `vi.mock('graphql', () => createRequire(import.meta.url)('graphql'))`
- `packages/server/src/modules/reports/providers/__tests__/dynamic-report-comments.integration.test.ts:169`
  — `const gql = createRequire(import.meta.url)('graphql')`

Both must move to a real ESM import (or a `vi.mock` factory that does) before the bump. These are
test-only, but they will fail loudly rather than silently.

Everything else in `packages/*/src` and `scripts/` is clean (excluding generated output and the
frozen `old-accounter` / `gmail-listener` / `scraper-local-app` packages):

- **Zero** uses of APIs removed in v17 — no `graphql/subscription`, `getOperationRootType`,
  `assertValidName`, `printError`, `formatError`, `KindEnum`, `TokenKindEnum`,
  `DirectiveLocationEnum`, or `getVisitFn`.
- **Zero** positional `new GraphQLError(...)` calls across all 509 call sites — every one already
  passes an options object, so v17 removing the positional constructor costs us nothing.
- **Zero** deep imports into graphql internals — every import is the bare `graphql` entry point.
- **Zero** resolver reads of `info.variableValues` (v17 moves runtime values to `.coerced`). The one
  `variableValues` occurrence is a test helper passing it _into_ `graphql()` as an execution
  argument, which is unchanged in v17.
- **Zero** uses of `astFromValue`, `findBreakingChanges`, or `findDangerousChanges`.

Two custom scalars still use the deprecated-but-working method names —
`packages/server/src/modules/common/resolvers/timeless-date.ts` and `.../country.resolver.ts`
(`serialize` → `coerceOutputValue`, `parseValue` → `coerceInputValue`, `parseLiteral` →
`parseConstLiteral`). These are deprecations, not removals, and can be deferred past the bump.

## The real cost is verification, not editing

Beyond the two test files, the bump is dependency pins plus optional cleanups. The work is
re-testing `@defer` / `@stream`, which this app uses heavily (~25 directive usages across 7 client
components), because **v17 removed incremental delivery from `execute()`**.

Two things to know before anyone attempts it:

1. **The execution path should survive.** `@envelop/graphql-modules` forwards Yoga's `executeFn`
   into `app.createExecution({ execute: executeFn })`, and `graphql-modules`' `executionCreator`
   uses that injected function rather than importing graphql's `execute` directly (it only falls
   back when none is passed). So incremental delivery still routes through Yoga's v17-aware
   executor. This is reasoned from the source, **not** verified against a real v17 install.
2. **One invariant needs an end-to-end test.**
   `packages/server/src/modules/app-providers/tenant-db-client.ts` deliberately defers DB connection
   disposal until the `@defer`/`@stream` tail has been fully sent. v17's incremental-delivery
   changes interact directly with that, and it cannot be checked by inspection.

Also re-test the null-prototype resolver-args change and the now-non-null `@deprecated(reason:)`.

## Why we are not forcing it

Overriding the peer ranges via `resolutions` would install an untested major underneath the server's
execution and usage-reporting paths. Yarn only warns, so it would "work" — which is exactly the
risk. Not worth it for a version bump with no feature we need.

## Re-checking

The peer ranges are the whole story, so a re-check is cheap:

```sh
for p in graphql-modules @graphql-hive/yoga graphql-request \
  @graphql-eslint/eslint-plugin @graphql-codegen/typescript-graphql-request; do
  echo "$p -> $(yarn npm info "$p" --fields peerDependencies --json)"
done
```

Any of these printing `^17.0.0` is the signal that this doc is stale. `graphql-modules` is the one
that matters most — it alone gates the server.
