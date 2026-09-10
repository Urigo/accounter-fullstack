---
'@accounter/client': patch
---

Add `useQueryErrorToast`, and stop `useGetBusinesses` from stacking error toasts.

The `use-get-*` lookup hooks reported query failures from the hook body rather than an effect:

```ts
if (error) {
  console.error(`Error fetching businesses: ${error}`);
  toast.error('Error', { description: 'Unable to fetch businesses' });
}
```

That runs on every render for as long as `error` is set, not once. With no toast `id`, sonner has no
way to recognise the repeats, so each render stacked another notification — and React StrictMode
double-invokes on top of that.

`useQueryErrorToast(error, subject)` moves the report into a `useEffect` keyed on the error and adds
a `fetch-<subject>` toast id, so a repeat replaces the existing toast instead of piling onto it. Both
strings and the id derive from the one `subject` argument, so callers cannot drift into describing
the same query two different ways.

Wired into `useGetBusinesses` here; the remaining lookup hooks follow in a separate change so this
one stays reviewable.
