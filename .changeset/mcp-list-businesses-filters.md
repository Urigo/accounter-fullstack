---
'@accounter/mcp-server': minor
---

`accounter_list_businesses` now sends its filters through the `allBusinesses(filters:)` input
instead of the deprecated `name` / `isClient` arguments, and exposes every `BusinessFilter` field:

- `taxCategoryIds` / `withoutTaxCategory`, to find businesses matched to given tax categories or
  with none mapped
- `sortCodes` / `withoutSortCode`, by numeric sort code key
- `countries`, as ISO 3166-1 alpha-3 codes
- `isAdmin`, for the owner-managed businesses

`activeOnly` is now applied upstream, before paging, as `filters.isActive`. It used to be applied to
the returned page, so pages could come back short and `totalCount` / `pagination` counted inactive
businesses. Both now describe active businesses only when `activeOnly` is set.
