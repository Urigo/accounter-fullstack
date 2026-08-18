---
'@accounter/server': patch
---

Fix the IDE TypeScript server restart loop and the `yarn lint` out-of-memory crash, both caused by
the root `tsconfig.json` having no `include`.

Without `include`, and with `allowJs: true`, the root config globbed the entire monorepo into a
single program — 9854 files, ~4.3 GB peak heap, 79s to check. VS Code launches `tsserver` with
`--max-old-space-size=3072`, so the root project could never fit: it OOM'd and was respawned
continuously, which is what left the editor stuck on `Initializing 'tsconfig.json'` and
`Loading IntelliSense status`. The same whole-repo program made `yarn lint` die at 4.08 GB.

- **Root `tsconfig.json`** now sets `include` to the root-level scripts and config files it is
  actually responsible for. It remains the `extends` base for every package. The root project drops
  to 2238 files, 0.56 GB, 2.6s.
- **`green-invoice-graphql`, `hashavshevet-mesh`, `israeli-vat-scraper`, `payper-mesh` and
  `pcn874-generator`** gain an explicit `"include": ["src"]`. They had none and would otherwise
  inherit the root's, which is scoped to root paths. No emit change — these packages have no `.ts`
  outside `src/`, and each already pinned `rootDir: ./src`.
- **`@accounter/server`**: the `declare global { namespace GraphQLModules }` augmentation moves out
  of `modules-app.ts` into `src/shared/types/graphql-modules.d.ts`. A global augmentation buried in a
  heavyweight entry file only applies when that file is in the program, so anything importing server
  sources without pulling in the whole module graph lost `GlobalContext` and failed on
  `dbClientsToDispose`. As a `.d.ts` it is cheap for other projects to include. Identical type
  surface; the now-unused `RawAuth` import is dropped.
- **`.vscode/settings.json`** raises the `tsserver` memory ceiling (the client project alone needs
  ~1.9 GB), pins the workspace TypeScript version, and uses fsevents-based watching. Uses the current
  `js/ts.*` setting IDs, since the `typescript.*`-prefixed ones are deprecated.

**Type-aware ESLint was broken independently** and is fixed here too, because scoping the root
project exposed it. `parserOptions.project` listed `'*/tsconfig.json'`, which resolves to
`packages/tsconfig.json` — a file that does not exist. No package tsconfig was ever in the project
list; every file under `packages/` was typed solely via the root glob-everything project. Replaced
with `projectService: true`, which resolves the nearest `tsconfig.json` per file and cannot silently
miss a package. Files that no tsconfig includes (`**/tests/`, `**/.storybook/`, `vite.config.ts`,
`vitest.config.ts`, `packages/*/scripts/`, `packages/*/tools/`) are added to `ignores`, matching the
existing `**/__tests__/` and `**/tsup.config.ts` entries. The root `lint` script raises the Node heap
to 8 GB — the client and server programs coexist in one process and exceed the ~4 GB default.

`yarn lint` now exits 0 (852 pre-existing warnings, 837 of them the intentionally-`warn` `no-console`
rule). Type resolution is verified working, not merely quiet: a floating-promise probe under
`@typescript-eslint/no-floating-promises` errors as it should.
