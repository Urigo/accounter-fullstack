---
'@accounter/client': patch
---

Migrate the tax category sort code selector from Mantine to a reusable shadcn-based
`SortCodeSelect`. Each option now shows both the sort code key and its name (e.g. `100 - Cash`), and
the selector is extracted into a general component (`components/common/inputs/sort-code-select.tsx`)
so it can be reused across forms — it is now also used in the business configurations section.
