---
'@accounter/client': patch
---

Extract the shared mutation-hook boilerplate into a generic `useApiMutation`.

Every GraphQL mutation hook in the client repeated the same body: a `toast.loading` while the
mutation was in flight, `handleCommonErrors` on the response, a `toast.success` on the way out, and
a `console.error` plus a long-lived `toast.error` in the catch — around 60 lines per hook, of which
only the document, the notification texts and the returned field actually differed.

`useApiMutation` owns that flow once. A hook now declares what varies and re-exposes the returned
`execute` under its domain name, so components keep consuming a purpose-named hook:

```ts
const { fetching, execute } = useApiMutation({
  document: AddTagDocument,
  notificationId: variables => `addTag-${variables.tagName}`,
  loadingMessage: 'Adding tag',
  errorMessage: variables => `Error adding new tag [${variables.tagName}]`,
  successToast: (_result, variables) => ({
    description: `"${variables.tagName}" tag was successfully added`,
  }),
});
```

Beyond those, it takes `commonErrorPath` (the `handleCommonErrors` discriminator, which also
excludes `CommonError` from the type handed on), `select` to shape what `execute` resolves to —
throwing from it rejects a response the server reported as unsuccessful — `onSuccess` for side
effects such as refreshing a cache, and `successToast: false` / `errorToast` / `errorDescription`
for the flows that notify differently. Each message is either a constant or derived from the
variables, and the success toast may also be derived from the result. `execute` is referentially
stable, so it can go straight into a dependency array even though the options object and its
callbacks are re-created on every render.

All 95 single-document mutation hooks now use it. `useCronJobs` (three chained mutations in one
flow) and `useGenerateFinancialCharge` (a switch over six documents) keep their own bodies — neither
is the one-document shape the hook abstracts.

Behaviour is preserved per hook, down to the notification texts, toast ids and durations, with three
deliberate exceptions:

- `useFetchDeelDocuments` no longer dismisses its own error toast. The `toast.dismiss` there only
  ran when `handleCommonErrors` had just raised an error toast under the same id, so the error was
  wiped before it could be read.
- `useRevokeApiKey`, `useRevokeInvitation` and `useRemoveBusinessUser` resolve to `undefined` rather
  than `false` when the server reports nothing was revoked or removed. The toast explaining why is
  unchanged.
- The two batch-upload hooks declare the document type they actually resolve to instead of casting
  it to the mutation's raw union.
