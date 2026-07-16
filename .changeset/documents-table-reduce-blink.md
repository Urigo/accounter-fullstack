---
"@accounter/client": patch
---

Stop the documents table (reused under the charge extended-info panel) from "blinking" when a
document is updated. The document row fields are fetched under a `@defer` fragment, so on a refetch
each document streams back id-first and its other fields (amount, vat, …) arrive in later patches —
which briefly rendered the rows with empty cells before the data refilled. The table now merges each
incoming document's present fields over the version currently shown (matched by id), so every cell
keeps its current value until the real data replaces it, and bails out of re-rendering when nothing
changed.
