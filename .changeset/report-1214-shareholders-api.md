---
'@accounter/server': minor
---

New `report-1214` module with a shareholders API for the annual company report (form 1214). The
`shareholders(ownerId, year)` query lists an owner's shareholders for a tax year in report order.
`setShareholders` replaces the year's list in one transaction, and `copyShareholdersFromYear`
copies one year's list into a year that has none yet (`SHAREHOLDERS_TARGET_YEAR_NOT_EMPTY`
otherwise). ID numbers are stored zero-padded to 9 digits, and several shareholders may share the
placeholder IDs 999999964 and 999999998. Invalid rows (more than 99 rows, names over 200
characters, percentages outside 0-100 or with more than 4 decimals, repeated IDs) are rejected with
`BAD_USER_INPUT` naming the row. A linked `businessId` must belong to the owner. `ownerId` defaults
to the caller's active business, and writes to any other business are refused with `FORBIDDEN`.
Merging businesses moves shareholder links to the merge target.
An explicit `ownerId` also requires the caller to be a `business_owner` or `accountant` of that
business.
