---
'@accounter/client': patch
---

Tax categories screen: bullet the per-category businesses list, open a business in a new tab, and
keep page, page size and sort order in the URL.

The businesses list had no marker between entries, so a business whose name wrapped to a second line
read as two businesses. Entries are now bulleted with outside markers, which indents a wrapped line
under its own first line.

Table state moves from `initialState` to controlled state backed by query params (`page`, `pageSize`,
`sort`), so a shared link reproduces what the sender was looking at. Params arriving from a pasted
link are validated: an unoffered page size or an unknown sort column falls back to the default rather
than rendering a blank pagination select or an unsortable table, and a page past the end lands on the
last real page.
