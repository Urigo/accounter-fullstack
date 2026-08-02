---
'@accounter/mcp-server': patch
---

- Added a shared `dates.ts` module exporting `TIMELESS_DATE`, `parseCalendarDate`, and `DAY_MS`.
- Updated `tools/charges.ts` and `tools/reports.ts` to import those primitives from `./dates.js` and
  removed their local copies.
- Avoided per-call redefinition of `parseCalendarDate` in `reports.ts` by using the shared
  implementation.
