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

## Data Fetching, Caching & Re-renders

The urql client (`src/providers/urql.tsx`) runs with **no cache exchange** — only
`mapExchange`, `authExchange`, `fetchExchange`. Consequences to keep in mind:

- **Mutations do not invalidate or refetch queries.** After a mutation, you must explicitly refresh
  the affected data: re-execute the query via the `reexecuteQuery` function returned by `useQuery`,
  or thread a refetch callback down to the mutating component. Don't assume a mutation result updates
  a list.
- Every query execution hits the network, so `requestPolicy` rarely changes behavior — but pass
  `{ requestPolicy: 'network-only' }` on post-mutation/refresh refetches to make the intent explicit
  and to stay correct if a cache exchange is ever added.

To avoid the "blinking" full-screen re-render on refetch (see the bank-deposits and all-charges
screens):

- **Don't gate the whole view on `fetching`.** `fetching ? <Loader/> : <View/>` unmounts and replaces
  the view on _every_ background refetch, wiping local state (expanded rows, etc.) and flashing.
  Gate on `fetching && !data` so the spinner shows only on the initial load and existing data stays
  visible until the new data arrives.
- **Stabilize derived data with `useStableValue`** (`src/hooks/use-stable-value.ts`). urql returns a
  fresh `data` object on every refetch, so derived arrays change identity even when content is
  identical, forcing re-renders (and resetting child row state). `useStableValue` keeps a
  deeply-equal-stable reference so the view updates only when the data actually changed.
- When a mutation affects multiple mounted subtrees (e.g. reassigning a row between two tables), lift
  a "refresh token" to the common parent and have each subtree re-execute its own query when the
  token changes, rather than relying on remounts to refetch.

## Component Conventions

- Functional components with named exports.
- Return type: `ReactElement`.
- shadcn/ui components imported from `./ui/<component>.js`.
- Prefer core Tailwind utility classes over arbitrary values.
- **`react-hooks/refs` is enforced** (via `@theguild/eslint-config`): never read or write
  `ref.current` during render — CI fails on it. To derive a referentially-stable value from
  props/args, use `useState` with the setState-during-render pattern (see `use-stable-value.ts`), not
  a ref. Note `react-hooks/set-state-in-effect` is turned off for the client.

## Testing

- Primary test directory: `src/__tests__/`
- Colocated tests also exist (e.g. `src/components/__tests__/`)
- Uses jsdom environment.

## Commands

```bash
yarn workspace @accounter/client dev   # Vite dev server
yarn workspace @accounter/client build # Production build
```
