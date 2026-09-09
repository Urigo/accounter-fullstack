---
---

Turn on TypeScript's `incremental` mode across the monorepo so `tsc` reuses the previous compile's
program state instead of typechecking from scratch on every invocation.

Nothing in the repo set `incremental`, `tsBuildInfoFile` or `references` — the only related option
anywhere was `composite: true` in `packages/client/tsconfig.json`, and even that wrote its build
info to the root `dist/` by accident (the client inherits `outDir: "dist"` from the root config,
where the relative path resolves against the root, not the package).

- **Root `tsconfig.json`** sets `"incremental": true`, inherited by every package that extends it.
- **Each tsconfig** sets its own `tsBuildInfoFile` under `node_modules/.cache/tsbuildinfo/`, so the
  whole workspace's build state lives in one already-git-ignored directory and no two programs
  share a file. Setting the path in the root config would have done the opposite: relative paths
  from an `extends` base resolve against the base, so all packages would have written to the same
  file and invalidated each other on every build.
- **One file per tsconfig, not per package.** Since #4417 the server has two programs —
  `tsconfig.json` typechecks (`noEmit`, `rootDir: ".."`, tests included), `tsconfig.build.json`
  emits (`rootDir: "src"`, tests excluded) — so they get separate files.
- **`etana-scraper`, `etherscan-scraper` and `kraken-scraper`** don't extend the root config, so
  they get `"incremental": true` of their own.
- **Packages built through `bob`** deliberately keep the default build-info location. `bob build`
  runs `tsc` twice with different `--outDir`s and wipes `.bob/` before each build, so a fixed path
  would just make the two runs invalidate each other. Verified that the build info stays inside
  `.bob/` and is never copied into `dist/` — `bob` only copies `**/*.js` and `**/*.d.ts`.
- **CI** gains an opt-in `tsBuildInfo` input on `.github/actions/setup` that caches
  `node_modules/.cache/tsbuildinfo`, enabled for the jobs that actually run `tsc` (the forked-PR
  `compile` job and both `publish` jobs). `client-publish` doesn't use that action and wires the
  same cache up directly. The key hashes `yarn.lock` (which pins the TypeScript version) plus every
  `tsconfig`, with a per-run suffix so cache entries can refresh, and `restore-keys` for the hit.
  The key prefix is computed in a step of its own so every `key`/`restore-keys` line stays a single
  line — `restore-keys` is a literal block where each newline separates two keys, so an expression
  wrapped to fit the line-length limit would put a newline inside a key.
- **`.gitignore`** ignores `*.tsbuildinfo` as a safety net for the default locations.

Measured on this repo (warm = build info present, cold = none):

| build                                       | cold  | warm  |
| ------------------------------------------- | ----- | ----- |
| `yarn workspace @accounter/server build`     | 30.2s | 4.6s  |
| `yarn workspace @accounter/server typecheck` | 25.8s | 4.9s  |
| `packages/client` `tsc`                      | 79.6s | 6.1s  |
| `yarn build:main`                            | 76.9s | 15.3s |

The server dev loop is the payoff: `nodemon` reruns `yarn build` on every file save, so each save
went from a ~30s full recompile of the whole server program to a ~5s one.

Correctness was checked, not assumed: a freshly introduced type error is still reported on a warm
build and on the build immediately after it, and disappears once fixed. Stale build info can only
cost a full rebuild, never a wrong one — TypeScript invalidates it itself when a source file or a
compiler option changes.

The one-file-per-tsconfig rule is measured, not a precaution. Alternating `build` and `typecheck`
on the server with separate files stays warm at 4.1-4.5s each; with both programs pointed at a
single file, every alternation is a full rebuild — 22.1-22.4s for `build`, 27.7-28.0s for
`typecheck`. They differ in `noEmit`, in `rootDir` and in whether the tests are in the program, so
each invalidates the other's state.

This is step 1 of #4416. Step 2 — real project references via `tsc --build` — is deliberately left
out: it is a much larger, less reversible change. Its other stated payoff is already banked, since
#4417 took the four generator `src` trees out of the server's program, so they are no longer
compiled twice.
