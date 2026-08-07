@README.md @package.json

# Package Manager

- ALWAYS use `yarn`. NEVER use npm, npx, or pnpm.
- Install exact versions.
- Add a package-level dep: `yarn workspace <package-name> add --exact <dep>`
- Add a root dev dep: `yarn add -D --exact <dep> -W`
- Run a workspace script: `yarn workspace <package-name> <script>`

# Monorepo Structure

Yarn Berry (v4) monorepo with 18 packages under `packages/`:

- **Core**: `server` (GraphQL API), `client` (React SPA), `migrations` (Postgres DDL/DML)
- **Scrapers**: `modern-poalim-scraper`, `etana-scraper`, `etherscan-scraper`, `kraken-scraper`,
  `israeli-vat-scraper`
- **Integrations**: `green-invoice-graphql`, `hashavshevet-mesh`, `payper-mesh`, `deel` (via server
  app-providers)
- **Email ingestion**: `email-ingestion-gateway` (v2 multi-tenant Cloudflare→gateway→server email
  pipeline)
- **Generators**: `pcn874-generator`, `opcn1214-generator`, `shaam6111-generator`,
  `shaam-uniform-format-generator` <<<<<<< HEAD
- **Tools**: `scraper-app` (local scrape web app — Fastify server + React UI; replaces
  `scraper-local-app`)
- **Deprecated**: `scraper-local-app` (legacy CLI scrape runner; superseded by `scraper-app` — kept
  only for rollback until `scraper-app` is fully in production use), `gmail-listener` (legacy
  single-inbox email listener; superseded by `email-ingestion-gateway` — kept only for rollback
  during cutover), `old-accounter` (excluded from workspaces)

Package-specific conventions live in `packages/<name>/CLAUDE.md` (loaded on demand when you work in
that package).

# Commands

```bash
yarn install            # Install all dependencies
yarn generate           # Run GraphQL + SQL codegen (concurrent)
yarn generate:watch     # Watch mode for codegen
yarn build              # Full build (generate → tools → main)
yarn lint               # ESLint across the repo
yarn prettier:check     # Prettier check
yarn prettier:fix       # Prettier auto-fix
yarn test               # Unit tests (vitest)
yarn test:integration   # Unit + integration tests
yarn local:setup        # Docker + DB init + codegen
yarn seed:admin-context # Seed admin context for server
```

# Code Generation

- Run `yarn generate` after changing any GraphQL schema (typeDefs files) or SQL schema.
- Codegen is concurrent: GraphQL (graphql-codegen) and SQL run in parallel.
- Generated files are git-ignored: `__generated__/`, `gql/`, `schema.graphql`.
- NEVER manually edit generated files.

# Architecture

- **GraphQL Modules**: the server uses `graphql-modules`. Each module in
  `packages/server/src/modules/<name>/` owns its typeDefs, resolvers, and providers.
- **Dependency Injection**: providers use `@Injectable()` decorator. In resolvers, always access
  providers via `context.injector.get(ProviderClass)` — never instantiate directly.
- **Database**: Postgres is accessed only through provider classes. Resolvers must not query the DB
  directly.
- **Client**: React + urql for GraphQL queries/mutations, shadcn/ui component library, Tailwind CSS.
- **Type safety**: end-to-end via graphql-codegen — schema changes propagate automatically to server
  resolver types and client operation types.

# Coding Conventions

- ES modules (`import`/`export`) only — never CommonJS (`require`).
- All import paths use `.js` extension suffix (ESM convention, required even for `.ts` source
  files).
- TypeScript strict mode throughout.

# TypeScript

The repo builds with **TypeScript 7** (the native Go compiler). TypeScript 7 does not ship the
JavaScript compiler API, so the two versions are installed side by side under different names:

| Dependency           | Resolves to               | Provides                                                                                          |
| -------------------- | ------------------------- | ------------------------------------------------------------------------------------------------- |
| `@typescript/native` | `typescript@7`            | the `tsc` binary — every build and type-check                                                     |
| `typescript`         | `@typescript/typescript6` | the TypeScript 6 JS API for tooling that does `import ts from 'typescript'`, plus a `tsc6` binary |

Three tools import the compiler as a library and would break on TypeScript 7 alone. They resolve
`typescript` and therefore keep working against the TypeScript 6 API:

- **typescript-eslint** — hard-fails with "typescript-eslint does not support TS 7.0", taking
  `yarn lint` down with it.
- **`@pgtyped/cli`** — walks the TypeScript AST to find SQL tagged templates, so `yarn generate:sql`
  depends on it.
- **tsup** — calls `ts.parseJsonConfigFileContent` to read tsconfigs, and rollup-plugin-dts for
  `--dts`.

Other tools in the chain do not need it: `bob-the-bundler` spawns the `tsc` binary, `tsc-alias`
parses tsconfigs itself, and `@0no-co/graphqlsp` is a tsserver plugin that is handed `ts` by the
editor's own TypeScript. Drop the alias once typescript-eslint, pgtyped and tsup support the
TypeScript 7.1 API.

- NEVER change `typescript` back to a plain `typescript@7` dependency — it breaks `yarn lint` and
  the codegen/bundling toolchain.
- `node_modules/typescript` is the API shim and has no `tsserver`, so editors use their own bundled
  TypeScript. Don't set `typescript.tsdk` to `node_modules/typescript/lib`.
- Run `tsc6` when you need to compare behaviour against the old compiler.

# Git & PR Conventions

- Small, focused PRs; squash merge.
- Always run `yarn lint` and `yarn generate` before committing.
