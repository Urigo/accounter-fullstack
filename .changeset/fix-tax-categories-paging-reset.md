---
'@accounter/client': patch
---

Fix the tax categories table snapping back to page 1 immediately after clicking next page.

TanStack resets the page index to `0` whenever a row model recomputes
(`table_autoResetPageIndex`). With pagination controlled by the URL, that reset arrived as a second
`onPaginationChange` right after the user's own, so the page flashed and reverted — and took the
`page` query param with it. A fresh `data` identity from urql is enough to trigger it, so it fired on
essentially every paging click. `autoResetPageIndex` is now off: the page index belongs to the URL,
and the one reset worth having (on sort change) is explicit.
