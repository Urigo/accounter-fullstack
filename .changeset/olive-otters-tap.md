---
'@accounter/client': patch
---

Replace Mantine's `Table`, `Paper`, `Popover`, `Grid`, `List` and `Text` in the business trip
report's tables with `ui/table`, `ui/card`, `Tooltip` and Tailwind. The subtree no longer imports
Mantine at all.

`common/tooltip.tsx` now accepts a `ReactNode` for `content` as its type always claimed — React's
RDFa `content?: string` attribute was narrowing it to strings.
