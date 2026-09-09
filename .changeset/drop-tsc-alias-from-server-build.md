---
'@accounter/server': patch
---

Resolve the server's remaining tsconfig path aliases natively and drop `tsc-alias`.

`build` is now a single `tsc -p tsconfig.build.json` pass with no post-processing step. The four
`@accounter/*` generator packages resolve through the workspace `node_modules` symlinks and their
own `exports` instead of being co-compiled from source, so the server's tsc program no longer
includes four already-built sibling packages.

The emitted tree is now flat, mirroring `src`: the entry points move from
`dist/server/src/index.js` and `dist/server/src/bootstrap-telemetry.js` to `dist/index.js` and
`dist/bootstrap-telemetry.js`. Anything referencing the old layout (the package `main`, `start`,
deploy or debug configuration) needs updating.

`yarn workspace @accounter/server build` now requires the four generator packages to be built
first. Every pipeline already orders this correctly; a hand-run build in a fresh clone needs
`yarn build:tools` first.
