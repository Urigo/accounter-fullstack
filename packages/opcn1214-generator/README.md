# @accounter/opcn1214-generator

Generator, validator and parser for SHAAM's **form 1214** (Israeli corporate annual return) OPCN
file: the fixed-width file that representatives upload through OPCN or the identified-representative
internet service.

- **Validate** a typed report and get every error and warning at once, each with a stable rule ID
  and an input path.
- **Generate** the windows-1255 file for one report, or an OPCN batch of up to 50 reports.
- **Parse** a file (single report or batch) back into the typed input, and SHAAM's response file
  `shumot.shg` into one record per report.
- Tax years **2024** and **2025** (2025 uses the 2024 layout until SHAAM publishes its 2025
  specification).

The full developer specification is [`documentation/SPEC.md`](documentation/SPEC.md).

## Installation

```bash
yarn add @accounter/opcn1214-generator
```

## Quick start

Validate, then generate, then save `bytes` (windows-1255) as the file to upload. Do not write
`text`: it is a JS string and would be saved in another encoding.

<!-- test -->

```ts
import { writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { generate1214, validate1214, type Report1214Input } from '@accounter/opcn1214-generator'

const input: Report1214Input = {
  taxYear: 2024,
  company: {
    fileNumber: '514000009',
    registeredName: 'חברה לדוגמה בע"מ',
    mailingAddress: 'רחוב הרצל 1, תל אביב',
    businessAddress: 'רחוב הרצל 1, תל אביב',
    phone: { prefix: '03', number: '1234567' }
  },
  declarations: {
    hasTaxPlanningAction: false,
    hadRelatedPartyTransactions: false,
    controlsBodyOfPersons: false,
    holdsRightsInBodyOfPersons: false,
    appliesAccountingStandards: false,
    directorsReceivedOpinion: false,
    tookReportablePosition: false
  },
  // record 1000 code-amount pairs, keyed by code (the required codes of the layout)
  amounts: { '018': 4, '072': 0, '081': 1000, '094': 0, '263': 1 },
  shareholders: [
    {
      idNumber: '123456782',
      fullName: 'ישראל ישראלי',
      isControllingShareholder: true,
      dividendRightsPercent: 100
    }
  ]
}

const validation = validate1214(input) // never throws; every error and warning at once
if (validation.valid) {
  const { bytes, fileName, warnings, summary } = generate1214(input)
  writeFileSync(join(tmpdir(), fileName), bytes) // e.g. 1214_514000009_2024.txt
  console.log(`${fileName}: ${summary.mainCodePairs} of 61 code pairs, ${warnings.length} warnings`)
} else {
  for (const issue of validation.errors) {
    console.error(`${issue.ruleId} at ${issue.path}: ${issue.message}`)
  }
}
```

Without `meta.saveDate` the save date is today in Asia/Jerusalem; pass
`{ today: () => '2025-03-31' }` as the second argument for reproducible output.

## Error handling

Data problems are values: `validate1214` and `ParseResult.issues` return them and never throw. Every
`Issue` has a stable `ruleId` and `path` (key UIs on those, not on `message`), a `severity`, and,
where it applies, the record, field position and Hebrew field name. The recommended pattern (SPEC
§11.4) validates first, so generation cannot throw a validation error:

<!-- test -->

```ts
import {
  generate1214,
  Opcn1214Error,
  parse1214,
  validate1214,
  type Report1214Input
} from '@accounter/opcn1214-generator'

function prepareUpload(input: unknown) {
  const result = validate1214(input)
  // show every error and warning in the UI at once
  if (!result.valid) return { errors: result.errors, warnings: result.warnings }
  // valid input: generate1214 cannot throw a validation error now
  const { bytes, fileName, warnings } = generate1214(input as Report1214Input)
  return { bytes, fileName, warnings }
}

const outcome = prepareUpload({ taxYear: 2024, company: { fileNumber: '514000009' } })
if ('errors' in outcome) {
  for (const issue of outcome.errors) console.log(issue.ruleId, issue.path, issue.message)
}

// generate1214 / generate1214Batch throw Opcn1214ValidationError, parse1214 / parse1214Batch throw
// Opcn1214ParseError; both extend Opcn1214Error and carry every issue found.
try {
  parse1214('not an OPCN file\r\n')
} catch (error) {
  if (!(error instanceof Opcn1214Error)) throw error // TypeError or Opcn1214InternalError: a bug
  console.log(
    error.name,
    error.issues.map(issue => `${issue.ruleId} (line ${issue.line})`)
  )
}
```

`getLayout` throws `Opcn1214UnsupportedYearError` for a year outside `supportedTaxYears()`.
`Opcn1214InternalError` means a bug in this package.

## Parsing and batches

`parse1214` reads a single-report file (bytes are decoded as windows-1255 by default) into the
canonical `Report1214Input` and validates it: business-rule issues come back in `issues`, while
structural problems throw `Opcn1214ParseError`. An OPCN batch holds up to 50 reports:
`generate1214Batch` writes one file (issues carry `reportIndex`) and `parse1214Batch` reads one
`ParseResult` per report.

<!-- test -->

```ts
import {
  generate1214,
  generate1214Batch,
  parse1214,
  parse1214Batch,
  type Report1214Input
} from '@accounter/opcn1214-generator'

const input: Report1214Input = {
  taxYear: 2024,
  company: {
    fileNumber: '514000009',
    registeredName: 'חברה לדוגמה בע"מ',
    mailingAddress: 'רחוב הרצל 1, תל אביב',
    businessAddress: 'רחוב הרצל 1, תל אביב',
    phone: { prefix: '03', number: '1234567' }
  },
  declarations: {
    hasTaxPlanningAction: false,
    hadRelatedPartyTransactions: false,
    controlsBodyOfPersons: false,
    holdsRightsInBodyOfPersons: false,
    appliesAccountingStandards: false,
    directorsReceivedOpinion: false,
    tookReportablePosition: false
  },
  amounts: { '018': 4, '072': 0, '081': 1000, '094': 0, '263': 1 },
  shareholders: [
    {
      idNumber: '123456782',
      fullName: 'ישראל ישראלי',
      isControllingShareholder: true,
      dividendRightsPercent: 100
    }
  ]
}

// Single report: parse(generate(x)) gives x back in canonical form.
const { report, issues, saveDate } = parse1214(generate1214(input).bytes)
console.log(report.company.fileNumber, saveDate, issues.length)

// Batch: one file, up to 50 reports.
const second: Report1214Input = { ...input, company: { ...input.company, fileNumber: '514010016' } }
const batch = generate1214Batch([input, second])
console.log(batch.fileName, batch.summary.reports) // 1214_batch_2.txt 2
for (const parsed of parse1214Batch(batch.bytes)) console.log(parsed.report.company.fileNumber)
```

## Response file

After transmission SHAAM returns `shumot.shg`, one line per report. `parseResponseFile` reads it
(string or windows-1255 bytes) into one `ResponseRecord` per line; only code `00` is `accepted`. A
damaged line or an empty file throws `Opcn1214ParseError`. The PDF does not give the file's encoding
or where the 08/33 field detail goes, so these are unverified defaults (SPEC §15 A-35): decode a
file in another encoding yourself and pass a string.

<!-- test -->

```ts
import { parseResponseFile } from '@accounter/opcn1214-generator'

const responses = parseResponseFile('514000009202400\r\n514010016202405\r\n')
for (const { fileNumber, taxYear, code, meaning, accepted, detail } of responses) {
  console.log(fileNumber, taxYear, accepted ? 'accepted' : `${code}: ${meaning}`, detail ?? '')
}
// 514000009 2024 accepted
// 514010016 2024 05: Report already filed
```

## Rules

Every check has a stable ID. `RULES` exports the catalogue as data; SPEC §10 holds the same list
with the conditions in full. **E** = error (blocks generation), **W** = warning. Source: **spec** =
stated in SHAAM's PDF, **derived** = consistency check added by this package, **checker** = enforced
by SHAAM's structure checker (shopcn) but not stated in the PDF.

<!-- rules:start -->

| Rule ID                                       | Sev | Source  | Scope  | Description                                                                                                                                                                                                                                                                                                                                                                 |
| --------------------------------------------- | --- | ------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `struct.taxYear.unsupported`                  | E   | derived | input  | taxYear is not one of supportedTaxYears().                                                                                                                                                                                                                                                                                                                                  |
| `struct.taxYear.provisionalLayout`            | W   | derived | input  | taxYear has no SHAAM layout of its own yet and reuses an earlier year's layout (2025 → 2024, SPEC §14): the report is provisional.                                                                                                                                                                                                                                          |
| `input.shape`                                 | E   | derived | input  | Wrong JavaScript type, missing required property, unknown property, null, array too long, or a date not in YYYY-MM-DD form.                                                                                                                                                                                                                                                 |
| `input.unknownCode`                           | E   | spec    | input  | A code-map key (amounts, foreignAppendix.amounts, capitalGains[i].amounts) that is not a code of that record for the tax year, or a foreignAppendix.countryBreakdown key that is not a per-country code of record 2000.                                                                                                                                                     |
| `input.derivedCode`                           | E   | derived | input  | A derived code (008, 028, 273, 277, 278, 280, 297; 3077: 501–505) passed in a code map; the message names the input property that controls it.                                                                                                                                                                                                                              |
| `struct.relatedCompanies.max`                 | E   | spec    | 1010   | More than 3 related companies.                                                                                                                                                                                                                                                                                                                                              |
| `struct.shareholders.min`                     | E   | spec    | 1020   | No shareholders while declarations.isKibbutz is not true.                                                                                                                                                                                                                                                                                                                   |
| `struct.shareholders.max`                     | E   | spec    | 1020   | More than 99 shareholders.                                                                                                                                                                                                                                                                                                                                                  |
| `struct.rdInvestments.max`                    | E   | spec    | 1030   | More than 5 R&D investments.                                                                                                                                                                                                                                                                                                                                                |
| `struct.capitalGains.max`                     | E   | spec    | report | More than 14 capital-gains appendices (records 30xx); report the excess on 1000@962 with reasons 964–967 instead.                                                                                                                                                                                                                                                           |
| `struct.mainCodePairs.max`                    | E   | spec    | 1000   | More than 61 code-amount pairs in record 1000 (after derivations).                                                                                                                                                                                                                                                                                                          |
| `struct.batch.size`                           | E   | spec    | input  | A batch (generate1214Batch) with no reports or more than 50 reports.                                                                                                                                                                                                                                                                                                        |
| `field.required`                              | E   | spec    | report | A field or code with required=yes is absent (for codes that are not zeroAllowed, 0 counts as absent); inside a repeated slot only when the slot is in use.                                                                                                                                                                                                                  |
| `field.numeric`                               | E   | spec    | report | A digit-string field (id9, shareholderId, digits) contains non-digits.                                                                                                                                                                                                                                                                                                      |
| `field.length`                                | E   | spec    | report | Normalized text longer than the field width, or a number with more digits than the width.                                                                                                                                                                                                                                                                                   |
| `field.checkDigit`                            | E   | checker | report | An identifier (id9, shareholderId) of 1–9 digits fails the Israeli check digit (left-padded to 9 digits, weights 1, 2, 1, 2, …); SHAAM rejects the file.                                                                                                                                                                                                                    |
| `field.integer`                               | E   | spec    | report | An amount, amountX or num value is not an integer (with rounding 'halfUp', amounts are rounded instead).                                                                                                                                                                                                                                                                    |
| `field.decimals`                              | E   | spec    | report | An amountX100, percentX100, percentLiteral or rateX100 value has more than 2 decimals.                                                                                                                                                                                                                                                                                      |
| `field.negative`                              | E   | spec    | report | A number is negative (losses have their own codes).                                                                                                                                                                                                                                                                                                                         |
| `field.enum`                                  | E   | spec    | report | An enum or rateX100 value is not one of the values of its field or code (the values of other kinds are documentation).                                                                                                                                                                                                                                                      |
| `field.date`                                  | E   | spec    | report | A YYYY-MM-DD date is not a real calendar date (other forms are input.shape).                                                                                                                                                                                                                                                                                                |
| `field.percentRange`                          | E   | spec    | report | A percentage (percentX100, percentLiteral) is outside 1–100, compared as written (rounded to hundredths).                                                                                                                                                                                                                                                                   |
| `field.hebrewFirstLetter`                     | E   | spec    | report | A hebrewText value does not start with a Hebrew letter (U+05D0–U+05EA).                                                                                                                                                                                                                                                                                                     |
| `field.charset`                               | E   | derived | report | A text value (after SPEC §4.3 normalization) contains a control character or a character not representable in windows-1255.                                                                                                                                                                                                                                                 |
| `field.phonePrefix`                           | W   | spec    | report | A phone or fax prefix is not in the allowed list: it is dropped (SHAAM deletes it); for the required 1000@493 the follow-up field.required is the error.                                                                                                                                                                                                                    |
| `field.phoneNumber`                           | E   | derived | report | A phone or fax number is not exactly 7 digits (shorter numbers would be silently zero-padded).                                                                                                                                                                                                                                                                              |
| `main.familyCompany.fileNumber`               | E   | spec    | 1000   | A family company (836 marked) without the taxpayer file number (837).                                                                                                                                                                                                                                                                                                       |
| `main.familyCompany.code080`                  | E   | spec    | 1000   | A family company (836 marked) without code 080 (0 allowed).                                                                                                                                                                                                                                                                                                                 |
| `main.houseCompany.code084`                   | E   | spec    | 1000   | A house company (846 marked) without code 084 (0 allowed).                                                                                                                                                                                                                                                                                                                  |
| `main.investmentLaw.flag`                     | E   | spec    | 1000   | Code 101 or 102 filled but 849 (capital investment law benefits) not marked.                                                                                                                                                                                                                                                                                                |
| `main.beneficiaryEnterprise.noticeDate`       | E   | spec    | 1000   | 851 (beneficiary enterprise) marked without the notice date (852); guaranteed by the input type, checked for JS callers and parsed files.                                                                                                                                                                                                                                   |
| `main.specialYear.balanceSheetDate`           | E   | spec    | 1000   | 863 (special year) marked without the balance sheet date (864); guaranteed by the input type, checked for JS callers and parsed files.                                                                                                                                                                                                                                      |
| `main.kibbutz.code226`                        | E   | spec    | 1000   | isKibbutz (877 marked) but code 226 not filled (SPEC §15 A-13).                                                                                                                                                                                                                                                                                                             |
| `main.kibbutz.code226Other`                   | W   | derived | 1000   | Code 226 = 9 ("other cooperative, not kibbutz") while isKibbutz (877 marked).                                                                                                                                                                                                                                                                                               |
| `main.buildingIncome.code259`                 | E   | spec    | 1000   | hasBuildingIncome (884 = yes) without code 259.                                                                                                                                                                                                                                                                                                                             |
| `main.cgReasons.otherText`                    | E   | spec    | 1000   | Capital-gains reason "other" (967) marked without its text (968).                                                                                                                                                                                                                                                                                                           |
| `main.reportablePositions.required`           | E   | spec    | 1000   | tookReportablePosition (1030 = yes) and no reportable position numbers (1034–1046).                                                                                                                                                                                                                                                                                         |
| `main.reportablePositions.max`                | E   | spec    | 1000   | More than 5 reportable positions (only five fields exist, 1034–1046).                                                                                                                                                                                                                                                                                                       |
| `main.reportablePositions.unexpected`         | W   | derived | 1000   | Non-zero reportable positions (1034–1046) given while tookReportablePosition (1030) is no.                                                                                                                                                                                                                                                                                  |
| `main.rd.records`                             | E   | spec    | 1000   | Code 165 > 0 but no R&D investment (1030) records.                                                                                                                                                                                                                                                                                                                          |
| `main.rd.total`                               | W   | derived | 1000   | The R&D investment amounts (1030) do not add up to code 165 (absent is 0), compared in whole shekels.                                                                                                                                                                                                                                                                       |
| `main.capitalGains.flag`                      | E   | derived | 1000   | declarations.hasCapitalGainsAppendix is false while capital-gains appendices exist, transmitted or not (833 is derived from them as yes).                                                                                                                                                                                                                                   |
| `main.cgUntransmitted.reason`                 | W   | derived | 1000   | capitalGainsSummary.untransmittedCount (962) > 0 and none of the reasons 964–967 marked.                                                                                                                                                                                                                                                                                    |
| `main.cgUntransmitted.reasonWithoutCount`     | W   | derived | 1000   | A reason 964–967 marked while capitalGainsSummary.untransmittedCount (962) is 0 or absent.                                                                                                                                                                                                                                                                                  |
| `main.appendixTotal.min`                      | W   | derived | 1000   | capitalGainsSummary.totalAppendicesCount (960) is given (> 0) and lower than the transmitted appendices (2000 and 30xx records) plus capitalGainsSummary.untransmittedCount (962).                                                                                                                                                                                          |
| `main.bankAccount.withNoBank`                 | W   | derived | 1000   | noBankAccount (1064) marked while a bank account (codes 277/278/280) is given.                                                                                                                                                                                                                                                                                              |
| `main.bankAccount.format`                     | E   | spec    | 1000   | bankAccount.bank is not exactly 2 digits, branch not exactly 3 digits, or account not 1–9 digits.                                                                                                                                                                                                                                                                           |
| `main.qualifyingCompany.purchaseAmounts`      | W   | derived | 1000   | qualifyingCompany.purchased (1065 = yes) but neither purchase amount (1066, 1078) given.                                                                                                                                                                                                                                                                                    |
| `main.qualifyingCompany.amortizationAmount`   | W   | derived | 1000   | qualifyingCompany.amortizationClaimed (1090 = yes) but no amortization amount (1091; 0 counts as given).                                                                                                                                                                                                                                                                    |
| `main.attachments.code070`                    | W   | derived | 1000   | attachments.donationReceiptsCount (954) > 0 but code 070 absent.                                                                                                                                                                                                                                                                                                            |
| `main.attachments.code010`                    | W   | derived | 1000   | attachments.withholdingCertificatesCount (957) > 0 but code 010 absent.                                                                                                                                                                                                                                                                                                     |
| `shareholders.dividendRights.total`           | E   | spec    | 1020   | At least one shareholder states dividendRightsPercent and the total is not 100.00 (computed in hundredths; SPEC §15 A-15).                                                                                                                                                                                                                                                  |
| `shareholders.duplicateId`                    | W   | derived | 1020   | The same shareholder idNumber twice, compared zero-padded to 9 digits (999999964 and 999999998 excluded).                                                                                                                                                                                                                                                                   |
| `foreign.otherIncome.description`             | E   | spec    | 2000   | otherTaxableIncome (2000@187) > 0 without otherTaxableIncomeDescription (2000@137).                                                                                                                                                                                                                                                                                         |
| `foreign.refund.amount`                       | W   | derived | 2000   | taxRefundDeclaration (2000@247) is yes without a taxRefundDeclarationAmount (2000@248) > 0; 0 is written as absent.                                                                                                                                                                                                                                                         |
| `foreign.breakdown.required`                  | E   | spec    | 2000   | A per-country code written in the 2000 section (442 = 0 included) without a countryBreakdown entry (record 2200).                                                                                                                                                                                                                                                           |
| `foreign.breakdown.orphan`                    | E   | spec    | 2200   | A countryBreakdown entry for a code not written in the 2000 section.                                                                                                                                                                                                                                                                                                        |
| `foreign.breakdown.countries.min`             | E   | derived | 2200   | A country breakdown with no countries.                                                                                                                                                                                                                                                                                                                                      |
| `foreign.breakdown.countries.max`             | E   | spec    | 2200   | More than 10 countries in one country breakdown.                                                                                                                                                                                                                                                                                                                            |
| `foreign.breakdown.country.unknown`           | E   | spec    | 2200   | A country code that is not in the country table of the tax year (countries.csv).                                                                                                                                                                                                                                                                                            |
| `foreign.breakdown.country.unknownOnlyFor439` | E   | spec    | 2200   | The country code -88 (country unknown) in the breakdown of a code other than 439.                                                                                                                                                                                                                                                                                           |
| `foreign.breakdown.country.duplicate`         | E   | spec    | 2200   | The same country twice within one country breakdown.                                                                                                                                                                                                                                                                                                                        |
| `cg.investmentFund.value`                     | E   | spec    | report | A capital-gains appendix whose gain-from-investment-fund mark (30xx@145) is not the one value the PDF lists for its record type: 3060 and 3065 only no (2), 3064 only yes (1). Absent is allowed (SPEC §15 A-8).                                                                                                                                                            |
| `cg.improvements.max`                         | E   | spec    | 3077   | More than 5 improvements in a 3077 appendix (only five slots exist, 247–416); report the excess via 962 with reason 965 instead.                                                                                                                                                                                                                                            |
| `cg.improvements.code50Amount`                | W   | derived | 3077   | An improvement without code50Amount (code 501–505), or a code50Amount with neither expense nor accumulated depreciation.                                                                                                                                                                                                                                                    |
| `cg.virtualCurrency.wallet`                   | E   | spec    | 3077   | A 3077 appendix with code 071 = 1 (virtual currency) and no wallet address in 489 (the first slot).                                                                                                                                                                                                                                                                         |
| `parse.empty`                                 | E   | derived | parse  | The file has no records.                                                                                                                                                                                                                                                                                                                                                    |
| `parse.encoding`                              | E   | derived | parse  | Bytes that do not decode in the selected encoding (windows-1255, or UTF-8 when options.encoding says so).                                                                                                                                                                                                                                                                   |
| `parse.lineLength`                            | E   | spec    | parse  | A line whose length is not the record length of its record type.                                                                                                                                                                                                                                                                                                            |
| `parse.formType`                              | E   | spec    | parse  | Positions 1–4 of a line are not 1214.                                                                                                                                                                                                                                                                                                                                       |
| `parse.recordType`                            | E   | spec    | parse  | Positions 5–8 of a line are not a record type of the layout.                                                                                                                                                                                                                                                                                                                |
| `parse.prefixFiller`                          | E   | spec    | parse  | Positions 9–136 of a line are not all 0.                                                                                                                                                                                                                                                                                                                                    |
| `parse.order`                                 | E   | spec    | parse  | A record out of the SPEC §3.3 order (the file must start with 1000; a 2200 record must follow a 2000 record), a second 1000 before a 9999, or a record after the 9999 that does not start the next report (a second 9999 too; a 1000 there is parse.multipleReports in parse1214).                                                                                          |
| `parse.occurrences`                           | E   | spec    | parse  | More records of a type than SPEC §3.2 allows (1010 > 3, 1020 > 99, 1030 > 5, 2000 > 1, 2200 > 30, capital-gains records 30xx > 14 together), or more than 50 reports in a batch file; minimums are business rules.                                                                                                                                                          |
| `parse.control.missing`                       | E   | spec    | parse  | The report is not terminated by a 9999 control record.                                                                                                                                                                                                                                                                                                                      |
| `parse.control.counts`                        | E   | spec    | parse  | A count of the 9999 control record differs from the records present.                                                                                                                                                                                                                                                                                                        |
| `parse.multipleReports`                       | E   | derived | parse  | parse1214 was given a file with more than one report (a 1000 record after a 9999 record); use parse1214Batch.                                                                                                                                                                                                                                                               |
| `parse.numeric`                               | E   | spec    | parse  | A non-digit in a numeric field or code value.                                                                                                                                                                                                                                                                                                                               |
| `parse.date`                                  | E   | spec    | parse  | A date field that is not a valid DD/MM/YYYY date or all spaces.                                                                                                                                                                                                                                                                                                             |
| `parse.codeSection`                           | E   | spec    | parse  | A code-amount section with an unknown code, a duplicate code, a truncated entry, or non-zero data after the last entry.                                                                                                                                                                                                                                                     |
| `parse.fieldValue`                            | E   | spec    | parse  | A header field that is well-formed for its type but not a value the field can hold: flag or yes/no digits other than the ones written, a phone prefix outside the allowed list, a 2200 code (2200@137) that is not a per-country code of record 2000 or that an earlier 2200 record already has.                                                                            |
| `parse.countrySection`                        | E   | spec    | parse  | A country-amount section (record 2200) with an affiliation other than 1, a malformed country code, a truncated entry, more than 10 entries, or non-zero data after the last entry.                                                                                                                                                                                          |
| `parse.derivedMismatch`                       | E   | derived | parse  | A derived value (SPEC §7.4) that disagrees with the value derived again from its source in the file: 832 vs a 2000 record, 833 = no with capital-gains records or untransmitted appendices, codes 008/028/273/277/278/280/297, 1010/1020 serial numbers, 1030 affiliation, 30xx transaction symbol, appendix and "מספר בתל"ם" sequence numbers, 3077@245 improvement count. |

<!-- rules:end -->

## Versioning

The package follows semver with this contract (SPEC §6.5):

| Change                                                         | Version bump |
| -------------------------------------------------------------- | ------------ |
| Output bytes change for an input that was already valid        | **major**    |
| A rule ID or issue `path` format changes or is removed         | **major**    |
| A new **error** rule                                           | **major**    |
| A new **warning** rule (may become an error in the next major) | minor        |
| A new supported tax year / layout                              | minor        |
| Message wording                                                | patch        |

Golden files (byte-level fixtures) enforce the first row.

## Verification status

Golden files are checked with SHAAM's structure checker (shopcn) before release; the status of each
one is recorded in [`tests/fixtures/golden/VERIFICATION.md`](tests/fixtures/golden/VERIFICATION.md).

## Contents

| Path                                                                                       | What it is                                                              |
| ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------- |
| [`documentation/SPEC.md`](documentation/SPEC.md)                                           | Developer specification: format, API, input model, rules, tests         |
| [`documentation/layout/2024/`](documentation/layout/2024/)                                 | Every record field and code of the 2024 layout as CSV (source of truth) |
| [`documentation/layout/README.md`](documentation/layout/README.md)                         | CSV column reference and provenance                                     |
| [`documentation/specifications/1214-2024.pdf`](documentation/specifications/1214-2024.pdf) | SHAAM's normative specification (Hebrew, 71 pages)                      |
| [`documentation/tools/extract_layout.py`](documentation/tools/extract_layout.py)           | PDF → layout extractor and CSV diff, for yearly spec updates            |

## License

MIT
