# Client Package

React SPA built with Vite, urql (GraphQL), shadcn/ui, and Tailwind CSS.

## Directory Structure

- `src/components/` — UI components (shadcn/ui components in `components/ui/`)
- `src/hooks/` — custom React hooks (including GraphQL mutation hooks)
- `src/providers/` — React context providers
- `src/router/` — routing configuration
- `src/gql/` — generated GraphQL types (git-ignored)
- `src/helpers/` — utility functions
- `src/lib/` — shared library code

## GraphQL

- Types are generated to `src/gql/` — never edit these files.
- Queries: use `useQuery` from urql directly in components.
- Mutations: wrap in a custom hook under `src/hooks/` that handles `useMutation`, error handling via
  `handleCommonErrors`, and toast notifications. Components consume the simplified return value.

## Tables (TanStack Table v9)

- Build tables with `useTable` from `@tanstack/react-table` (v9) — `useReactTable` and the
  `get*RowModel()` options no longer exist.
- Always pass the shared feature set: `features: tableFeaturesConfig` from
  `src/lib/table-features.ts`. Features and row models are registered there; a table API that seems
  to be missing usually means its feature is not registered yet.
- Core types take the feature set first: `ColumnDef<TableFeaturesConfig, TData>`,
  `Row<TableFeaturesConfig, TData>`, `Table<TableFeaturesConfig, TData>`, and
  `createColumnHelper<TableFeaturesConfig, TData>()`.
- Read state via `table.state.<slice>` (components holding the hook's table) or
  `table.store.state.<slice>` (components receiving a core `Table`) — `table.getState()` is gone.
- Column-def sorting option is `sortFn` (was `sortingFn`); column visibility state is
  `ColumnVisibilityState` (was `VisibilityState`).
- Column arrays built with a column helper should be wrapped in `columnHelper.columns([...])` so
  each column keeps its own value type.

## Component Conventions

- Functional components with named exports.
- Return type: `ReactElement`.
- shadcn/ui components imported from `./ui/<component>.js`.
- Prefer core Tailwind utility classes over arbitrary values.

## Testing

- Primary test directory: `src/__tests__/`
- Colocated tests also exist (e.g. `src/components/__tests__/`)
- Uses jsdom environment.

## Commands

```bash
yarn workspace @accounter/client dev   # Vite dev server
yarn workspace @accounter/client build # Production build
```
