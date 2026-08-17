---
'@accounter/client': minor
---

Replace the charges table with a charge record list, driven by a per-type field spec.

Charges are a union of 11 types with genuinely different attributes, so a shared column set never
fitted them: of 14 display attributes, VAT and business trip each apply to exactly one type, which
left those columns blank on ten rows out of eleven. Rows also measured 166px, because `ListCapsule`
rendered tags and each metadata count as its own bordered box while the select and actions cells
stacked their controls vertically.

Each charge now renders as a record built from six regions at fixed horizontal positions — manage,
identity, meaning, health, money, actions. Region placement is identical on every record, which keeps
the vertical scanning a table gave you; which fields appear inside a region comes from a declarative
matrix in `charge-fields.ts`, so a record's shape is a pure function of its `__typename`. Records
measure ~85px, or 50px with the new density toggle.

The list keeps TanStack Table as its headless engine, so sorting, selection (keyed by charge id) and
expansion are unchanged, and every call site keeps the same props.

Other user-visible changes:

- Missing info is summarised once per record as a badge, counting only fields that charge type
  actually displays, instead of up to six unlabelled red dots scattered across cells.
- Suggested descriptions and tags are offered inline with a one-click accept, replacing a solid
  yellow background that read as an error rather than an offer.
- Sorting moved from column headers to a list toolbar bound to the server's `sortBy`, so it orders
  every matching charge rather than only the loaded page. Select-all, batch actions and CSV export
  moved to the same toolbar, which now announces the selection count.
- A document can be dropped anywhere on a record, not just onto the narrow More Info cell.
- Row density is togglable and remembered.

Bug fixes:

- The Date column never sorted. Its accessor returned the whole date object, so TanStack's automatic
  sort fell back to comparing `"[object Object]"` against itself and returned the same answer for
  every pair, in both directions.
- Lists silently truncated at 100 rows. The rendered row model sits at the end of a pipeline ending
  in pagination, so the charges-ledger-validation screen (which streams without a limit) and the
  unbounded VAT report sections could never show anything past row 100.
- Nothing inside a charge row was clickable when wrapped for drag-and-drop upload, because Mantine's
  dropzone disables pointer events on its content. This went unnoticed while it only wrapped inert
  text.
- The header row rendered one more cell than the body, adding a phantom column.
- CSV export could include charges selected in a different table, since the VAT report shares one
  selection map across three lists.
- Batch "refresh selected" silently did nothing for selected charges that were not currently
  rendered.
- Per-record validation state was conveyed by colour alone with no accessible name; count chips and
  the missing-info badge now carry text, and the expand control, which was a nameless chevron, is
  labelled.
