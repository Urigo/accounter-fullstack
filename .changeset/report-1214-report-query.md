---
'@accounter/server': minor
---

Add the form 1214 report query. `report1214(ownerId, year)` builds the
`@accounter/opcn1214-generator` input of an owner's tax year from the books (company number,
registered name, VAT and withholding file numbers, address, email and phone of the business) and the
stored 1214 profile and shareholders, with profile overrides winning, and returns its `validation`
(errors and warnings, each with a rule ID, path, code and spec reference) and the `file` to upload
to SHAAM (Windows-1255 bytes as base64, with the generator's warnings and the zero codes left out).
`file` is null with a `REPORT_1214_VALIDATION_FAILED` error while validation has errors. Data the
books and the profile cannot supply is reported as `accounter.*` issues: an unsupported tax year, a
missing company number, address or phone (including a business phone that is not an Israeli number
form 1214 accepts), unanswered required declarations, and amount overrides of codes the report
derives (left out, as a warning). Record 1000 amounts come only from the profile's overrides for
now. `report1214SupportedYears` lists the tax years the report can be generated for.
