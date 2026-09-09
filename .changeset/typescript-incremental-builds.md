---
---

Turn on TypeScript's `incremental` mode across the monorepo so `tsc` reuses the previous compile's
program state instead of typechecking from scratch on every invocation.

Nothing in the repo set `incremental`, `tsBuildInfoFile` or `references` — the only related option
anywhere was `composite: true` in `packages/client/tsconfig.json`, and even that wrote its build
info to the root `dist/` by accident (the client inherits `outDir: "dist"` from the root config,
where the relative path resolves against the root, not the package).

- **Root `tsconfig.json`** sets `"incremental": true`, inherited by every package that extends it.
- **Each package** sets its own `tsBuildInfoFile` under `node_modules/.cache/tsbuildinfo/`, so the
  whole workspace's build state lives in one already-git-ignored directory and no two projects
  share a file. Setting the path in the root config would have done the opposite: relative paths
  from an `extends` base resolve against the base, so all packages would have written to the same
  file and invalidated each other on every build.
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
- **`.gitignore`** ignores `*.tsbuildinfo` as a safety net for the default locations.

Measured on this repo (warm = build info present, cold = none):

| build                             | cold  | warm  |
| --------------------------------- | ----- | ----- |
| `yarn workspace @accounter/server build` | 25.5s | 4.4s  |
| `packages/client` `tsc`           | 58.2s | 5.4s  |
| `yarn build:main`                 | 63.7s | 12.7s |

The server dev loop is the payoff: `nodemon` reruns `yarn build` on every file save, so each save
went from a ~25s full recompile of ~692 server sources plus four sibling generator packages to a
~5s one.

Correctness was checked, not assumed: a freshly introduced type error is still reported on a warm
build and on the build immediately after it, and disappears once fixed; `tsc-alias` remains
idempotent when `tsc` skips emitting unchanged files, leaving no unresolved `@accounter/*`
specifiers in `dist/`. Stale build info can only cost a full rebuild, never a wrong one —
TypeScript invalidates it itself when a source file or a compiler option changes.

This is step 1 of #4416. Step 2 (real project references via `tsc --build`, which would also
eliminate the double compilation of the four generator packages) is deliberately left out: it
overlaps with #4415 and is a much larger, less reversible change.
