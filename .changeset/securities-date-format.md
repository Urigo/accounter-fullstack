---
'@accounter/client': patch
---

Align the securities date formatting with the rest of the app.

`formatSecurityDate` rendered through `toLocaleDateString()` with no locale, which follows the
browser's, so every securities date read as `m/d/yy` for anyone running en-US instead of the
`dd/MM/yyyy` used everywhere else. That one helper feeds the Portfolio activity table's trade and
value dates (both inside a charge and on a security's own business page), the `Last execution` and
`History since` columns of the securities screen, and the "added up since … last one …" line of the
business security section. The reference-data `as of` line in a charge's securities panel had the
same call written out inline, and now goes through the same helper.

Trade, value and settlement dates — like `historyStartDate` and `lastExecutionDate` — are
`TimelessDate`s, a calendar day with no time of day. `new Date('2024-01-15')` would resolve one to
UTC midnight and render it as the previous day anywhere west of Greenwich, so those digits are
reordered as text and only real timestamps (the reference data's `asOfDate`) are parsed into a
`Date`.
