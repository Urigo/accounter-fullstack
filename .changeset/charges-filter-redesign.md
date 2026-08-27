---
'@accounter/client': patch
'@accounter/server': patch
---

Redesign the charges filter as a shadcn-native modal, and add per-option include/exclude to the
entity pickers.

`charges-filters.tsx` was the largest remaining pocket of Mantine in the client: seven Mantine
`MultiSelect`s and a `Select` inside a Mantine `SimpleGrid`, wrapped in shadcn `FormField`s, inside a
Mantine `Modal` (`PopUpModal`), opened by a Mantine `Indicator`, with a footer of three raw
`<button>` elements in indigo/orange/rose. Twenty-one controls sat in one flat two-column grid. It is
now a shadcn `Dialog` at `components/charges/charges-filters/`, with free text always visible and the
rest grouped into five accordion sections — Date Range, Entities, Classification, Completeness,
Sorting — each showing a live count of its active filters. The header carries a removable chip per
active filter plus "Clear all"; the footer is Reset / Clear all / Cancel / Apply. The trigger keeps
its place in the footer bar and swaps the Mantine `Indicator` dot for a shadcn count badge. Date
Range gains preset pills (Last 30 days, This quarter, This year, Last year, No range), and Financial
Accounts is grouped by account type — `AllFinancialAccounts` now selects `type`, which was already
resolved server-side and simply unused.

Include/exclude arrives as a new shared input, `common/inputs/negatable-multi-select.tsx`. Clicking
an option cycles unselected → included → excluded → unselected, and a `+`/`−` button on each selected
chip and dropdown row flips it between included and excluded without dropping the selection. The
existing `common/inputs/multi-select.tsx` and its call sites are untouched.

Four fixes fell out of the rewrite. All nine completeness switches are now controlled — eight were
`defaultChecked` with no `checked`, so they would not have moved when the new Reset and Clear-all
buttons call `form.reset()`. The `withOpenDocuments` and `withMissingCounterparty` tooltips no longer
wrap their `Switch` in a `TooltipTrigger` without `asChild`, which nested a `<button>` inside a
`<button>`; they hang off an `Info` icon beside the label instead. The active-filter indicator is
derived from the applied filter rather than held in `useState` and updated only on submit, so it no
longer goes stale on browser back/forward. And sort direction moved into the form: it was local state
merged in at submit time, which meant Reset could not restore it. Validation moved from inline
`rules` to a zod schema, which adds a from-date-after-to-date check and guards against a malformed
`?chargesFilters=` payload.

The Owners field now lists admin businesses (`useGetAdminBusinesses`) instead of every financial
entity. `allFinancialEntities` returns every counterparty in the system — none of which can own a
charge — and the field's own default already came from the admin-business set. A value that is no
longer offered by the picker stays in the filter and remains removable from the header chips, which
fall back to rendering the raw id.

Server-side this is a typeDefs-only change: `ChargeFilter` gains `excludedBusinesses`,
`excludedFinancialAccounts`, `excludedTags` and `excludedFreeText`. **The resolver ignores all four
today** — they are added so the client can send them, with the SQL work deferred to
`docs/charges-filters/backend-followup.md`. They are listed in the MCP server's
`UNSUPPORTED_UPSTREAM_CHARGE_FILTER_FIELDS` so the charge tools do not advertise a filter that
matches everything.
