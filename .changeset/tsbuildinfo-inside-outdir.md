---
'@accounter/server': patch
'@accounter/mcp-server': patch
'@accounter/email-ingestion-gateway': patch
'@accounter/modern-poalim-scraper': patch
---

Fix a green build that emits nothing: move every emitting program's TypeScript build info inside
its own `outDir`.

Staging stopped booting after #4418 with a build that reported success:

```
Error [ERR_MODULE_NOT_FOUND]: Cannot find module
  '/opt/render/project/src/packages/server/dist/bootstrap-telemetry.js'
```

`tsc` trusts its build info without ever checking that the output it describes is still on disk. If
the build info outlives its `dist`, the next build decides everything is up to date, skips the emit
and **exits 0 having produced nothing at all** — not a stale `dist`, an absent one. #4418 put the
build info under `node_modules/.cache/tsbuildinfo/`, which is precisely the arrangement that pulls
the two apart on a deploy: the platform restores a cached `node_modules` (build info intact) over a
fresh checkout that has no git-ignored `dist`.

Reproduced end-to-end against `packages/server` before the fix — a cold build emits 22 files, and
the very next build, with only `dist` removed, exits 0 and leaves `dist` with **0 entries**.

The four programs that emit via `tsc` now keep their build info at `dist/.tsbuildinfo`, so output
and build info are created and discarded together:

- `packages/server/tsconfig.build.json`
- `packages/mcp-server/tsconfig.json`
- `packages/email-ingestion-gateway/tsconfig.json`
- `packages/modern-poalim-scraper/tsconfig.json`

The `--noEmit` type-checking programs (`server` `tsconfig.json`, `client`, and the `typecheck`
scripts of the `tsup`-built packages) stay under `node_modules/.cache/tsbuildinfo/`: they produce no
output that can fall out of sync, and that is where the measured typecheck speedups came from, so
the CI cache keeps covering them.

CI had the same latent defect, and it was worse there than on staging: both `publish` jobs restore
that cache and then run `yarn build`, so a cache hit could have published `@accounter/server` and
`@accounter/modern-poalim-scraper` with no compiled output. The cache comment in
`.github/actions/setup` claimed a stale restore "costs a full rebuild, never a wrong one" — true
only for the `--noEmit` programs still cached there, and now scoped to say so.

`scripts/__tests__/tsbuildinfo-placement.test.ts` guards the rule: it walks each package's `build`
script, resolves which tsconfig every `tsc` invocation actually uses (following `yarn <script>`
chains and `extends` for `noEmit`/`outDir`/`tsBuildInfoFile`), and fails if an emitting program
points its build info outside its `outDir`. It rediscovers exactly the four configs above from the
build scripts rather than a hardcoded list, so a fifth emitting package is covered the day it is
added.
