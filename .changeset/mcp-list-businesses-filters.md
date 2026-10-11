---
'@accounter/mcp-server': patch
---

`accounter_list_businesses` now sends its filters through the `allBusinesses(filters:)` input
instead of the deprecated `name` / `isClient` arguments.

`activeOnly` is now applied upstream, before paging, as `filters.isActive`. It used to be applied to
the returned page, so pages could come back short and `totalCount` / `pagination` counted inactive
businesses. Both now describe active businesses only when `activeOnly` is set.
