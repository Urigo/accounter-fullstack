---
'@accounter/client': patch
'@accounter/server': patch
---

Tax categories screen: expand a row to see the businesses that use it as their default tax category,
each linking to its business page.

The `business_tax_category_match` table was only ever queried business-first (`taxCategoryByBusinessId`).
`TaxCategory.businesses` adds the reverse direction, batched through a DataLoader so the whole screen
costs one extra query.
