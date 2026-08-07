---
'@accounter/email-ingestion-gateway': patch
'@accounter/modern-poalim-scraper': patch
'@accounter/gmail-listener': patch
'@accounter/scraper-app': patch
'@accounter/mcp-server': patch
'@accounter/client': patch
'@accounter/server': patch
---

Migrate the toolchain to TypeScript 7 (the native Go compiler).

`tsc` is now TypeScript 7.0.2, so all builds and type-checks run on the native compiler.
TypeScript 7 does not ship the JavaScript compiler API, which every tool that consumes
TypeScript programmatically depends on (typescript-eslint, `@pgtyped/cli`,
`bob-the-bundler`, `tsc-alias`, `tsup`, `@0no-co/graphqlsp`). Following the TypeScript
team's side-by-side guidance, the two are now installed under separate names:

- `typescript` → `npm:@typescript/typescript6` — the TypeScript 6 API, resolved by tooling
  that does `import ts from 'typescript'`. Also provides a `tsc6` binary.
- `@typescript/native` → `npm:typescript@7.0.2` — the native compiler, which provides `tsc`.

Type-checking output was compared project-by-project between TypeScript 6 and TypeScript 7
and is unchanged; no source or `tsconfig.json` changes were required.
