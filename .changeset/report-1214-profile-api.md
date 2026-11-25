---
'@accounter/server': minor
---

Add the form 1214 profile API to the `report-1214` module: the data of the annual company report
that the books cannot supply, stored per owner and tax year. The `report1214Profile(ownerId, year)`
query returns the stored profile, or empty defaults when nothing is saved yet. The
`updateReport1214Profile(ownerId, year, input)` mutation saves it block by block: company
overrides (registered name, phone, fax, email, occupation, addresses, withholding file number),
declarations, preparer, attachments, bank account, other taxable income, capital-gains summary,
qualifying company, related companies, R&D investments and record 1000 amount overrides. An
omitted block is kept, a provided block replaces the stored one, and `null` clears it. Blocks are
stored in the input shape of `@accounter/opcn1214-generator`. Invalid input is rejected with
`BAD_USER_INPUT` naming the field: unknown phone prefixes, phone numbers that are not 7 digits,
non-digit file numbers, lists over a 50-item size limit, and amount codes that are unknown,
repeated or derived by the report. The form's own limits (3 related companies, 5 R&D investments, 5
reportable positions) are not enforced on save; the report validation reports them. An amount
override of 0 is kept, which leaves a code that does not allow zero out of the report. `ownerId` defaults to the caller's active
business, and writes to any other business are refused with `FORBIDDEN`.
