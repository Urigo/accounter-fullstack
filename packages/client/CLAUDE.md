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
