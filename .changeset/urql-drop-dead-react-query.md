---
'@accounter/client': patch
---

Remove the unused `@tanstack/react-query` dependency and its provider.

The package was a declared dependency and a `QueryClientProvider` was mounted at the root of the app,
configured with `refetchOnWindowFocus: false` and `retry: 1` — but nothing ever used it. The only
reference anywhere in the repo was the import in `router/layouts/root-layout.tsx` that created and
mounted it; no file imports `useQuery`, `useMutation` or `useSuspenseQuery` from it. All GraphQL data
fetching goes through urql.

The provider, the `QueryClient` construction and the dependency are all removed. `UrqlProvider >
UserProvider` nesting is otherwise unchanged.

`@tanstack/react-table` is a different package and is untouched — it backs every table in the app.
