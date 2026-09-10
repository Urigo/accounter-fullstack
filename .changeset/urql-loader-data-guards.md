---
'@accounter/client': patch
---

Simplify how the charge, business and contracts screens read their route loader data.

All three wrapped `useLoaderData()` in a `try/catch` with an
`// eslint-disable-next-line react-hooks/rules-of-hooks`, guarding against being rendered outside a
data router. None of them can be: each is only ever a lazy route element of `createBrowserRouter`,
and none has a JSX call site anywhere in the app. The guard is now removed and the disable with it.

`contracts.tsx` goes further. Its route declares no loader at all — only `chargeLoader` and
`businessLoader` exist — so `loaderData` was always `undefined` there and every branch reading it was
unreachable. The variable, its import and the `|| loaderData` / `!!loaderData` branches are deleted
rather than rewritten.

`charge.tsx` also drops a mount effect that re-executed a query already unpaused under the identical
condition. Contrary to what the removal might suggest, this was not costing a second request: urql
dedupes the re-execution against the still-in-flight operation, which a new test pins down by
counting the operations a scripted `fetch` actually receives. The effect was redundant, not
expensive, and the test now guards that the count stays at one.

That test is written against `createMemoryRouter` rather than `MemoryRouter`, because
`useLoaderData` throws outside a data router — which is also why the `try/catch` existed and why it
is safe to remove only for components that are exclusively route elements.
