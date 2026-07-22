---
'@accounter/client': patch
---

- Extracted `missingInfoSuggestions` into a dedicated `ChargesTableSuggestionsFields` fragment.
- Applied `@defer` to the suggestions fragment spread inside `ChargeForChargesTableFields`.
- Updated `convertChargeFragmentToTableRow` to read suggestions via `getFragmentData` and handle the
  deferred (initially-absent) fields safely.
