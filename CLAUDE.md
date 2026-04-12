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
- **Generators**: `pcn874-generator`, `opcn1214-generator`, `shaam6111-generator`,
  `shaam-uniform-format-generator`
- **Tools**: `gmail-listener`, `scraper-local-app`
- **Deprecated**: `old-accounter` (excluded from workspaces)

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

# Git & PR Conventions

- Small, focused PRs; squash merge.
- Always run `yarn lint` and `yarn generate` before committing.
