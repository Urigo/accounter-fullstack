---
'@accounter/server': minor
'@accounter/client': minor
---

Batch-update selected businesses from the businesses table.

Client: the businesses table's selection-column header gains a bulk-actions menu, mirroring the
charges table's. "Update fields" opens a dialog for locality (country/city/zip), sort code, default
tax category, IRS code, suggestion description and the boolean flags (is active, receipt enough,
docs optional, VAT optional, exempt dealer) — only the fields filled in are applied, flags are
tri-state so "No change" leaves each business's own value alone. Sort code and tax category are now
pickers rather than raw number/UUID inputs. "Change tags" opens an Add/Remove dialog for suggestion
tags. The previous footer "Batch update" button moves into this menu.

Server: new `batchUpdateBusinessesTags(businessIds: [UUID!]!, addTagIds: [UUID!], removeTagIds:
[UUID!])` mutation, the businesses counterpart of `batchUpdateChargesTags`. It adds and/or removes
the given suggestion tags on every listed business while leaving each business's other tags
untouched; an id passed in both lists ends up added.

`batchUpdateBusinesses` no longer updates one business at a time. Every touched table now gets a
single statement for the whole selection (`businesses`, `financial_entities`, and an upsert into
`business_tax_category_match`) plus one read-back, so the query count is fixed regardless of how
many businesses are selected. Business suggestion tags live inside the `suggestion_data` JSON blob
rather than a join table, so `batchUpdateBusinessesTags` performs its set arithmetic in SQL and
costs a single statement as well.

**Breaking:** `BatchUpdateBusinessInput.suggestions: SuggestionsInput` is replaced by
`suggestionDescription: String`. The removed input accepted `phrases`, `emails` and `emailListener`,
which are per-business by nature and meaningless when applied wholesale, and its `tags` replaced a
business's entire tag set — use `batchUpdateBusinessesTags` for additive/subtractive tag changes.
