# `@accounter/opcn1214-generator` — Developer Specification

Status: **ready for implementation** (greenfield). Normative source: SHAAM, _"מבנה קובץ מייצגים
(OPCN ואינטרנט מייצג) לטעינת דוחות 1214 מקוון 2024"_, dated 20/01/2025 —
[`specifications/1214-2024.pdf`](specifications/1214-2024.pdf) (71 pages). Machine-readable
extraction of every record layout: [`layout/2024/`](layout/2024/) (see
[`layout/README.md`](layout/README.md)).

Page references below (`p.N`) are PDF page numbers. Field positions are **1-based**, as in the spec.

## 0. How to use this document

| You want to…                             | Read                                              |
| ---------------------------------------- | ------------------------------------------------- |
| Understand what the package must do      | §1, §2                                            |
| Know the exact bytes to write            | §3 (format), §4 (encoding rules), layout CSVs     |
| Start coding                             | §5 (architecture), §6 (API), §7 (input), §12 (P0) |
| Implement validation                     | §9 (engine), §10 (rule catalogue)                 |
| Implement error handling                 | §11                                               |
| Write tests                              | §13                                               |
| Know what is still uncertain in the spec | §15 (ambiguity register)                          |
| Add the 2025 (or later) layout           | §14                                               |

Terminology: **report** = one company's 1214 return for one tax year (one _tik_ + year). **Record**
= one fixed-width line. **Header** = the fixed fields of a record ("פרטים כלליים / כותרת").
**Code-amount section** = the variable list of `code+amount` pairs ("קוד סכום"). **Appendix** =
foreign appendix (2000) or a capital-gains appendix (30xx).

---

## 1. Goals and scope

### 1.1 Goals

1. **Generate** a SHAAM-compliant 1214 OPCN file from **structured, typed input**.
2. **Validate** input against **every rule stated in the spec**, plus a small, clearly-labelled set
   of derived consistency checks, and report all problems at once with stable rule IDs.
3. **Parse** a 1214 OPCN file back into the same structured input (round-trip), for tests, re-import
   and diagnosis.
4. **Stable output:** byte-identical files for identical input; stable rule IDs and issue paths
   (semver-governed, §6.5).
5. **Per-tax-year layouts**: the year selects the layout; unsupported years are rejected.
6. Parse SHAAM's **response file** (`shumot.shg`, §3.9) so callers can map responses to reports.

### 1.2 Non-goals

- No tax computation. The caller supplies every amount; the package never computes tax, totals or
  rates (it only derives structural values such as counts, flags and serial numbers, §7.4).
- No transmission to SHAAM, no OPCN client, no UI.
- No Accounter server/client integration (follow-up; notes in Appendix B).
- No support for the paper form, PDF rendering or form 1214ב (dividend report).

### 1.3 Consumers and environment

- Primary consumer: `@accounter/server` (GraphQL resolver building the 1214 for the annual-audit
  workflow, step 18 "Generate 1214 Report").
- Runtime: Node ≥ 20 and modern browsers. **No Node-only APIs at runtime** (no `fs`, no
  `import.meta.url` file reads) — layouts are compiled into the bundle.
- Published like the sibling generators (`bob-the-bundler`, ESM + CJS, typings).

---

## 2. Requirements summary

| ID   | Requirement                                                                                                                                                                                  |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R-1  | Accept a typed `Report1214Input` (§7) and produce the file text and windows-1255 bytes (§6.2).                                                                                               |
| R-2  | Every record line has exactly the length in §3.2; the file uses CRLF line endings (§3.1).                                                                                                    |
| R-3  | Records appear in the canonical order of §3.3; 9999 is generated automatically and is always last.                                                                                           |
| R-4  | All fields are encoded per §4; numeric fields zero-padded, alphanumeric fields space-padded.                                                                                                 |
| R-5  | Code-amount sections contain only filled codes, in ascending code order, zero-filled to section length.                                                                                      |
| R-6  | All structural limits are enforced: 1010 ≤ 3; 1020 1–99 (0 only for a kibbutz); 1030 ≤ 5; 2000 ≤ 1; 2200 ≤ 30; capital-gains appendices ≤ 14; 1000 code pairs ≤ 61; ≤ 10 countries per 2200. |
| R-7  | Every rule in §10 marked `spec` is implemented; `derived` rules are implemented with the stated severity.                                                                                    |
| R-8  | `validate1214` never throws on bad data; `generate1214` refuses (throws) when any error-severity issue exists.                                                                               |
| R-9  | Values the spec defines as derived from other data (§7.4) are computed by the package, never taken from the caller.                                                                          |
| R-10 | Output is deterministic: same input (including `meta.saveDate`) ⇒ identical bytes; object key order is irrelevant.                                                                           |
| R-11 | `parse1214(generate1214(x).bytes)` equals `canonicalize(x)` for every valid `x` (§8.4).                                                                                                      |
| R-12 | The layout used is selected by `input.taxYear`; supported years: 2024, 2025 (2025 = 2024 layout until a 2025 spec is added, §14).                                                            |
| R-13 | Hebrew text is written in logical order, windows-1255, with no bidi control characters (§4.3).                                                                                               |
| R-14 | No silent data loss: values are never truncated or rounded unless the caller opted in (§4.4, `rounding`).                                                                                    |

---

## 3. File format (physical)

### 3.1 File

- A file contains **one report** (internet upload: exactly one; OPCN may batch up to **50** reports,
  p.1 — supported by the batch API, §6.1).
- Each record is one line terminated by **CRLF** (`\r\n`), including the last line (§15 A-5).
- Encoding: **windows-1255** single-byte (§15 A-6) ⇒ character count = byte count; all lengths in
  this document are bytes.
- Online structure checker (does not import data): <https://secapp.taxes.gov.il/shopcn> (p.1).

### 3.2 Record types (p.2–4)

Every record starts with the same 136-character prefix, then a header, then (for some records) a
section:

| Positions | Length | Content                                 |
| --------- | ------ | --------------------------------------- |
| 1–4       | 4      | Form type, always `1214`                |
| 5–8       | 4      | Record type (`1000`, `1010`, … `9999`)  |
| 9–136     | 128    | Reserved, all `0`                       |
| 137–…     | varies | Header ("פרטים כלליים")                 |
| after hdr | varies | Section (code-amount or country-amount) |

| Record | Content                                                      | Header | Section             | Total | Occurs    |
| ------ | ------------------------------------------------------------ | ------ | ------------------- | ----- | --------- |
| 1000   | Main form: company, preparer, declarations, all main amounts | 2048   | 2048 code-amount    | 4232  | exactly 1 |
| 1010   | Related companies in Israel/abroad (part C)                  | 1024   | —                   | 1160  | 0–3       |
| 1020   | Shareholders and amounts (part D)                            | 1024   | —                   | 1160  | 1–99 \*   |
| 1030   | Investments in R&D companies                                 | 200    | —                   | 336   | 0–5       |
| 2000   | Foreign appendix                                             | 1024   | 1024 code-amount    | 2184  | 0–1       |
| 2200   | Foreign income by country (one per 2000 code)                | 50     | 1024 country-amount | 1210  | 0–30      |
| 3027   | Capital gains — shares (symbol 27)                           | 1024   | 1024 code-amount    | 2184  | } total   |
| 3050   | Capital gains — betterment-tax transaction (50)              | 1024   | 1024 code-amount    | 2184  | } 0–14    |
| 3051   | Capital gains — forced transaction, virtual currency (51)    | 1024   | 1024 code-amount    | 2184  | }         |
| 3054   | Capital gains — oil-partnership units (54)                   | 1024   | 1024 code-amount    | 2184  | }         |
| 3060   | Capital gains — securities (60)                              | 1024   | 1024 code-amount    | 2184  | }         |
| 3063   | Capital gains — securities under section 6 (63)              | 1024   | 1024 code-amount    | 2184  | }         |
| 3064   | Capital gains — REIT funds (64)                              | 1024   | 1024 code-amount    | 2184  | }         |
| 3065   | Capital gains — no withholding, form 1322 (65)               | 1024   | 1024 code-amount    | 2184  | }         |
| 3066   | Capital gains — no withholding, form 1326 (66)               | 1024   | 1024 code-amount    | 2184  | }         |
| 3077   | Capital gains — all other transactions, incl. goodwill (77)  | 1024   | 1024 code-amount    | 2184  | }         |
| 9999   | Control record                                               | 14     | —                   | 150   | exactly 1 |

\* At least one shareholder is mandatory except for a kibbutz report (p.1, p.21).

Section start positions: 1000 → 2185 (p.13); 2000 and all 30xx → 1161 (p.27 prints "1061", a typo,
§15 A-9); 2200 → 187 (p.31).

The exact header fields of every record (position, length, type, required, Hebrew name, notes, spec
page) are in [`layout/2024/fields.csv`](layout/2024/fields.csv) (270 rows). Every code of every
code-amount section is in [`layout/2024/codes.csv`](layout/2024/codes.csv) (260 rows). Both were
verified for full contiguous coverage of every record (§13.2).

### 3.3 Record order within a report

1. `1000`
2. `1010` × n — input order
3. `1020` × n — input order
4. `1030` × n — input order
5. `2000` (if a foreign appendix exists)
6. `2200` × n — ascending by the 2000 code they break down
7. Capital-gains records — grouped by record type ascending (`3027` … `3077`), input order within a
   type (§15 A-7)
8. `9999`

### 3.4 Header fields

Each header field has a **type** (`numeric` / `alphanumeric`, the spec's נומרי / אלפאנומרי), a
**length** and a **required** flag (`yes`, `no`, or `conditional` with a Hebrew condition). The CSV
adds a semantic **kind** (§4.2) and the canonical **key** used by the input model. Fillers are
`numeric` (all `0`) or `alphanumeric` (all spaces) per their type.

### 3.5 Code-amount sections (p.12–13, p.26, p.34 and each 30xx section)

- Each entry is `code` (3 digits, zero-padded: capital-gains code `15` is written `015`) followed by
  its value with the **width given for that code** in `codes.csv` (1–12), zero-padded on the left.
- Only codes that have a value are written ("when a code has no value, do not write the code at
  all", p.13). A value of `0` is written **only** for codes marked `zeroAllowed` (§4.5).
- Entries are concatenated with no separators, in **ascending numeric code order** (determinism; the
  spec does not mandate an order).
- The remainder of the section is filled with `0` up to the section length (2048 for 1000; 1024
  otherwise). The 1000 text says the zeros go "on the right", i.e. after the last entry.
- Amounts are non-negative integers with no separators or decimal point ("amounts must be positive
  numbers only, without commas or dots", p.13). Values the spec says are "stored ×100" are scaled by
  the encoder (§4.2).
- 1000 accepts at most **61** entries (p.13).

### 3.6 Country-amount section (record 2200, p.30–32)

- One 2200 record per foreign-appendix code that is flagged "per-country breakdown"
  (`perCountryBreakdown=yes` in `codes.csv`, 23 codes) **and** has a value in the 2000 record.
- Header: `137` the 2000 code (3), `140` total deductions/offsets/exemptions for that code (12),
  `152` filler (35 zeros).
- Section at 187 (1024): up to **10** entries of `affiliation(1) = 1` + `country(3)` + `income(12)`;
  income is before deductions, offsets and exemptions. Remainder `0`-filled.
- `country` is the 3-character country code from
  [`layout/2024/countries.csv`](layout/2024/countries.csv) (255 entries), zero-padded (`40` →
  `040`). The special code **`-88`** ("country unknown", written literally with the minus) is
  allowed **only for 2000 code 439** (p.32).

### 3.7 Capital-gains appendices (p.32–59)

Ten record types share one shape: header 1024 + code-amount 1024. The header begins with the
transaction symbol (`137`, 2 digits, = record type − 3000) and the appendix number (`139`, 3
digits). Five types (3027, 3051, 3065, 3066, 3077) also carry a **"מספר בתל"ם"** sequence number
("give a running number by the order the capital gains were filled", p.35). At most **14**
capital-gains appendices per report (p.1, p.32); more must be reported on field 962 with reasons
964–967.

Guidance quoted from p.38: virtual-currency gains are normally reported with symbol 77 and code 71;
symbol 51 (forced transaction) exists for many monthly realizations without a weighted purchase
date.

### 3.8 Control record 9999 (p.59–61)

| Pos | Len | Value                                               |
| --- | --- | --------------------------------------------------- |
| 137 | 2   | number of 1214 forms — always `01`                  |
| 139 | 2   | number of 1010 records (≤ 3)                        |
| 141 | 2   | number of 1020 records (≤ 99)                       |
| 143 | 2   | `01` if a foreign appendix (2000) exists, else `00` |
| 145 | 2   | number of capital-gains appendices (≤ 14)           |
| 147 | 2   | number of 2200 records                              |
| 149 | 2   | number of 1030 records                              |

Always derived (§7.4). General notes (p.61): "record length is fixed; numeric fields are padded with
zeros on the left; alphanumeric fields are padded with spaces on the left".

### 3.9 Response file `shumot.shg` (p.61–62)

After transmission SHAAM returns one line per report: file number (9), tax year (4), response code
(2), optionally followed by a field description for codes 08/33. Codes:

| Code  | Meaning (translated)                                        |
| ----- | ----------------------------------------------------------- |
| 00    | Valid; saved in a temporary state                           |
| 01    | File type closed, or after the last year allowed for filing |
| 04    | Year blocked                                                |
| 05    | Report already filed                                        |
| 06    | You are not the representative of this file                 |
| 07    | No file exists for the requested tax year                   |
| 08    | Non-numeric value + field detail                            |
| 09    | Report was transmitted                                      |
| 15    | Cannot transmit for the requested tax year                  |
| 16    | Files mismatch                                              |
| 20    | Calculation type mismatch                                   |
| 21    | Report was transmitted via the internet                     |
| 23    | A file exists for the spouse too; contact the account card  |
| 31    | Invalid record type                                         |
| 32    | Invalid form type                                           |
| 33    | Invalid value + field detail                                |
| 97    | Report is being handled by the tax office                   |
| 98    | Representatives-registry connection problem; notify SHAAM   |
| 99    | Input data problem; notify SHAAM                            |
| other | General error; notify SHAAM                                 |

---

## 4. Field encoding rules

### 4.1 General

- Every value is converted to a string, validated, then padded to the field width. **A value that
  does not fit is an error** (`field.length`); the encoder never truncates.
- Numeric fields: only `0`–`9` (exception: `percentLiteral`, §4.2), right-aligned, left-padded with
  `0`. An absent optional numeric value is all zeros.
- Alphanumeric fields: right-aligned, left-padded with spaces, per the literal reading of p.61
  ("משרשרים רווחים משמאל"). An absent optional alphanumeric value is all spaces. The alignment is a
  single constant `ALPHANUMERIC_PAD_SIDE = 'left'` in `src/codec/padding.ts`; it is the first item
  to verify on shopcn (§15 A-1).
- Empty strings and strings that are empty after normalization (§4.3) count as absent.

### 4.2 Kinds

`kind` (column in `fields.csv` / `codes.csv`) determines input type, validation and encoding:

| Kind                       | Input (TS)                                   | Encoding                                                                                                              | Notes                                    |
| -------------------------- | -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| `text`                     | `string`                                     | normalized text, alnum padding                                                                                        | ≤ width                                  |
| `hebrewText`               | `string`                                     | as `text`; first character must be a Hebrew letter א–ת (U+05D0–U+05EA)                                                | spec "חייב אות עברית ראשונה"             |
| `id9`                      | `string` of 1–9 digits                       | numeric, zero-padded to 9                                                                                             | strings keep leading zeros               |
| `shareholderId`            | `string` of 1–9 digits                       | as `id9`; `999999964` (not registered in Israel) and `999999998` (public holding) are valid special values            | p.23                                     |
| `year`                     | `number` (4 digits)                          | numeric                                                                                                               | must equal the layout year               |
| `num`                      | `number` (non-negative integer)              | numeric                                                                                                               | counts, office codes, position numbers   |
| `digits`                   | digit `string` (identifier)                  | numeric, zero-padded; decoded as the full-width string                                                                | phone numbers, withholder branch/account |
| `amount`                   | `number`, integer ≥ 0 (ILS)                  | numeric                                                                                                               | `rounding` option, §4.4                  |
| `amountX`                  | `number`, integer ≥ 0                        | digits, **alnum** padding                                                                                             | 1000@1091 (type alphanumeric in spec)    |
| `amountX100`               | `number` ≥ 0, ≤ 2 decimals (ILS with agorot) | `round(value × 100)`, numeric                                                                                         | "נשמר * 100 מערכו"                       |
| `rateX100`                 | `23 \| 50` (percent)                         | value × 100 → `2300` / `5000`, numeric                                                                                | capital-gains code 018                   |
| `percentX100`              | `number` 1–100, ≤ 2 decimals                 | `round(value × 100)` digits, alnum padding (`10.23` → `1023`)                                                         | 1000@949 (§15 A-2)                       |
| `percentLiteral`           | `number` 1–100, ≤ 2 decimals                 | integer → zero-padded (`100` → `00100`); otherwise `toFixed(2)` then zero-padded (`10.23` → `10.23`, `5.5` → `05.50`) | 1020@199/204/209 (§15 A-3)               |
| `date`                     | ISO `YYYY-MM-DD` string                      | `DD/MM/YYYY` (10, alphanumeric)                                                                                       | must be a real calendar date             |
| `flag`                     | `boolean`                                    | `true` → `1`, `false`/absent → `0`                                                                                    | spec "1 - סומן"                          |
| `yesNo`                    | `boolean`                                    | `true` → `1`, `false` → `2`, absent → `0` (only allowed when not required)                                            | spec "1-כן 2-לא"                         |
| `enum`                     | literal union (see §7)                       | mapped numeric value, numeric                                                                                         | allowed values in `values` column        |
| `phonePrefix`              | one of the allowed prefixes                  | prefix digits; padding per field type (alnum for 493/503, numeric for 822)                                            | §15 A-19                                 |
| `foreignCode`              | 2000 code string                             | numeric(3)                                                                                                            | 2200 header                              |
| `serial`, `count`, `const` | — (derived)                                  | numeric                                                                                                               | §7.4                                     |
| `filler`                   | —                                            | `0`s (numeric) or spaces (alphanumeric)                                                                               |                                          |

Allowed phone prefixes (p.6–7):
`02 03 04 08 09 072 073 074 076 077 050 052 053 054 055 057 058 059`.

The `values` column grammar: `;`-separated items, each `n`, `n..m` (inclusive range) or `n=label`.

### 4.3 Text normalization (before validation and encoding)

Applied to every `text`/`hebrewText` value, in order:

1. Unicode NFC.
2. Remove bidi controls: U+200E, U+200F, U+202A–U+202E, U+2066–U+2069. (The old design's "RTL
   control injection" is explicitly **dropped**: controls occupy bytes and would corrupt widths.)
3. Replace: NBSP U+00A0 → space; TAB → space; “ ” „ → `"`; ‘ ’ → `'`; – — → `-`.
4. Trim, then collapse runs of spaces into one.
5. Any remaining character that is a control character (U+0000–U+001F, U+007F) or is not in the
   windows-1255 code page ⇒ `field.charset` error (the value is not modified further). The encoding
   helper itself only checks code-page membership (CR/LF of the line separators are valid bytes);
   the "no control characters in text" check belongs to the rule.

Hebrew stays in **logical order** (as typed). Geresh/gershayim (U+05F3/U+05F4) and niqqud are
representable in windows-1255 and are kept. Length checks run on the normalized value.

### 4.4 Numbers

- Amounts are JS `number`s and must be finite and `Number.isSafeInteger` after scaling.
- `amount`/`amountX`: must be an integer. Option `rounding: 'reject' | 'halfUp'` (default
  `'reject'`): `'reject'` raises `field.integer`; `'halfUp'` rounds half away from zero and reports
  nothing. There is no silent rounding by default (R-14).
- `amountX100`/`percentX100`/`percentLiteral` (and `rateX100`): at most 2 decimals. Check with
  integer arithmetic: `p = v * 100`, `scaled = Math.round(p)`; error `field.decimals` if
  `Math.abs(p - scaled) > Math.max(1e-6, 4 * Number.EPSILON * Math.abs(p))`. The tolerance grows
  with the magnitude because `v * 100` carries a rounding error of about one ulp, which exceeds a
  fixed `1e-6` for amounts above about 10^8 (e.g. `9481199461.12 * 100` is off by 1.2e-4); a third
  decimal moves `p` by at least 0.1, far above the tolerance at any width of the layout.
- Negative values ⇒ `field.negative` (losses have their own codes; p.13 forbids signs).
- Max value is implied by width (`10^width - 1`); exceeding it ⇒ `field.length`.

### 4.5 Zero values in code-amount sections

- `zeroAllowed=yes` codes (1000: 032, 072, 080, 081, 084, 086, 094, 096, 097, 121, 159; 2000: 442;
  3054: 016) are written when the input value is `0`.
- For every other code, an input value of `0` is treated as "no value": the code is omitted and the
  omission is listed in `GenerateResult.summary.omittedZeroCodes` (no issue is raised).
- Required codes (1000: 018, 072, 081, 094, 263, 273; conditional 080, 084; 3051: 071, 016) must be
  present (`field.required`); for required codes that are not `zeroAllowed`, `0` counts as missing.

---

## 5. Architecture

### 5.1 Pipeline

```
Report1214Input ──(1) shape check (zod, strict)──► (2) normalize + derive ──► NormalizedReport
                                                                               │
                                       (3) rule engine (field / business / structure) ◄┘
                                                                               │ no errors
                                                         (4) encode records ──► lines ──► (5) CRLF join ──► windows-1255 bytes

OPCN bytes/text ──(a) decode windows-1255──► (b) split lines ──► (c) decode records by layout ──► NormalizedReport
                                                    ──► (d) denormalize ──► Report1214Input ──► (e) rule engine (validation)
```

- **`NormalizedReport`** is the single internal model: an ordered list of
  `{ recordType, values: Record<FieldKey, Primitive>, codes: Map<Code, number>, countries?: Entry[] }`
  where keys are the `key` column of `fields.csv`. Generation and parsing both go through it, which
  is what makes the round trip exact.
- The **layout** (per tax year) drives everything generic: field order, widths, kinds, required
  flags, allowed values, code tables. Business rules are hand-written functions over
  `NormalizedReport`.
- Every stage is a pure function. No I/O, no clock access except the default `saveDate` (§7.4),
  which is injectable.

### 5.2 Package layout

```
packages/opcn1214-generator/
├── documentation/
│   ├── SPEC.md                         ← this document
│   ├── layout/README.md                ← CSV column reference + provenance
│   ├── layout/2024/{records,fields,codes,countries}.csv   ← source of truth for the 2024 layout
│   ├── specifications/1214-2024.pdf    ← normative spec
│   └── tools/extract_layout.py         ← PDF → raw layout extractor + CSV diff (yearly updates)
├── scripts/
│   └── generate-layout.ts              ← CSV → src/layout/<year>/layout.generated.ts
├── src/
│   ├── index.ts                        ← public exports only (§6)
│   ├── api/
│   │   ├── generate.ts                 ← generate1214, generate1214Batch
│   │   ├── validate.ts                 ← validate1214
│   │   ├── parse.ts                    ← parse1214, parse1214Batch
│   │   └── response.ts                 ← parseResponseFile
│   ├── layout/
│   │   ├── types.ts                    ← FieldDef, CodeDef, RecordDef, YearLayout, kinds
│   │   ├── registry.ts                 ← getLayout(year), supportedTaxYears()
│   │   ├── 2024/layout.generated.ts    ← generated, committed, `as const`
│   │   └── 2025/index.ts               ← 2024 layout + overrides (none yet)
│   ├── model/
│   │   ├── input.ts                    ← Report1214Input and sub-types (public)
│   │   ├── codes.generated.ts          ← code unions per record (generated)
│   │   ├── normalized.ts               ← NormalizedReport (internal)
│   │   └── schema.ts                   ← zod shape schemas (strict objects)
│   ├── normalize/
│   │   ├── text.ts                     ← §4.3
│   │   ├── report.ts                   ← input → NormalizedReport (+ §7.4 derivations)
│   │   ├── paths.ts                    ← pathFor(recordType, index, key), shared with the parser
│   │   ├── denormalize.ts              ← NormalizedReport → input (parse path)
│   │   └── canonical.ts                ← canonicalize(input, options), §8.4
│   ├── codec/                          ← paired encode/decode (D-1)
│   │   ├── types.ts, padding.ts, registry.ts
│   │   ├── numeric.ts, text.ts, date.ts, boolean.ts, enum.ts, percent.ts, phone.ts
│   │   ├── sections.ts                 ← code-amount and country-amount sections
│   │   ├── record.ts                   ← prefix + header + section ↔ line
│   │   └── windows1255.ts              ← iconv-lite wrapper
│   ├── file/                           ← control.ts (9999), assemble.ts, split.ts, parse.ts
│   ├── pipeline.ts                     ← runPipeline: year → shape → normalize → rules
│   ├── validate/
│   │   ├── issue.ts                    ← Issue, paths, sorting
│   │   ├── rules.ts                    ← RULES catalogue (metadata only)
│   │   ├── field-rules.ts              ← generic, layout-driven (§10.2)
│   │   ├── main-rules.ts, shareholder-rules.ts, foreign-rules.ts,
│   │   ├── capital-gains-rules.ts, structure-rules.ts, parse-rules.ts
│   │   └── engine.ts                   ← runs all rules, sorts issues
│   └── errors.ts                       ← Opcn1214Error hierarchy (§11)
└── tests/                              ← §13
```

### 5.3 Layout code generation

- `documentation/layout/<year>/*.csv` is the **source of truth**. `scripts/generate-layout.ts` (run
  with `yarn workspace @accounter/opcn1214-generator generate:layout`, using `tsx`) parses the CSVs
  (small RFC-4180 parser, no dependency) and writes `src/layout/<year>/layout.generated.ts` and
  `src/model/codes.generated.ts` as `as const` data plus literal-union types:

  ```ts
  export type MainFormCode = '008' | '010' | … | '299';           // 102 codes
  export type MainFormInputCode = Exclude<MainFormCode, DerivedMainCode>; // 95 codes
  export type ForeignAppendixCode = '401' | … | '494';             // 51 codes
  export type CountryBreakdownCode = '416' | '417' | … | '461';    // 23 codes
  export type CapitalGainsCode<S extends Symbol> = …;              // per symbol
  export type CountryCode = '-88' | '004' | … ;                    // 255 codes
  ```

- Generated files are committed; a test regenerates in memory and fails if the committed output
  differs (`layout-sync.test.ts`).
- The Hebrew `notesHe` text is emitted as JSDoc on the code unions, so IDEs show the spec note for
  each code.

### 5.4 Layout types (`src/layout/types.ts`)

```ts
export type RecordType =
  | '1000'
  | '1010'
  | '1020'
  | '1030'
  | '2000'
  | '2200'
  | '3027'
  | '3050'
  | '3051'
  | '3054'
  | '3060'
  | '3063'
  | '3064'
  | '3065'
  | '3066'
  | '3077'
  | '9999'

export type FieldKind =
  | 'text'
  | 'hebrewText'
  | 'id9'
  | 'shareholderId'
  | 'year'
  | 'num'
  | 'digits'
  | 'amount'
  | 'amountX'
  | 'amountX100'
  | 'rateX100'
  | 'percentX100'
  | 'percentLiteral'
  | 'date'
  | 'flag'
  | 'yesNo'
  | 'enum'
  | 'phonePrefix'
  | 'foreignCode'
  | 'serial'
  | 'count'
  | 'const'
  | 'filler'

export interface EnumValue {
  value: number
  label?: string
}

export interface FieldDef {
  readonly record: RecordType
  readonly position: number // 1-based
  readonly length: number
  readonly type: 'numeric' | 'alphanumeric'
  readonly required: 'yes' | 'no' | 'conditional'
  readonly key: string // canonical key without the '(derived) ' prefix of the CSV
  readonly derived: boolean // true for rows whose CSV key starts with '(derived) '
  readonly kind: FieldKind
  readonly values?: readonly EnumValue[]
  readonly nameHe: string
  readonly specPage: number
}

export interface CodeDef {
  readonly record: RecordType
  readonly code: string // 3 digits
  readonly length: number
  readonly required: 'yes' | 'no' | 'conditional'
  readonly kind: 'amount' | 'amountX100' | 'rateX100' | 'enum' | 'num'
  readonly values?: readonly EnumValue[]
  readonly zeroAllowed: boolean
  readonly perCountryBreakdown: boolean
  readonly derived: boolean // 008, 028, 273, 277, 278, 280, 297, 501–505
  readonly notesHe: string
  readonly specPage: number
}

export interface RecordDef {
  readonly type: RecordType
  readonly order: number
  readonly length: number
  readonly headerLength: number
  readonly section?: {
    kind: 'codeAmount' | 'countryAmount'
    start: number
    length: number
    maxEntries: number // 1000: 61; 2200: 10; other records: their number of codes
  }
  readonly minOccurs: number
  readonly maxOccurs: number
  readonly fields: readonly FieldDef[] // sorted by position, contiguous 137..header end
  readonly codes: readonly CodeDef[]
}

export interface YearLayout {
  readonly taxYear: number
  readonly records: Readonly<Record<RecordType, RecordDef>>
  readonly countries: ReadonlyMap<string, string> // code → Hebrew name
  readonly limits: {
    reportsPerFile: 50
    capitalGainsAppendices: 14
    mainCodePairs: 61
    countriesPerRecord: 10
  }
}
```

### 5.5 Dependencies

| Package      | Version | Why                                           |
| ------------ | ------- | --------------------------------------------- |
| `zod`        | 4.6.7   | strict input shape validation (§9.2)          |
| `iconv-lite` | 0.7.3   | windows-1255 encode/decode (same as siblings) |
| dev: `tsx`   | 4.23.15 | run `scripts/generate-layout.ts`              |

No other runtime dependencies (no `date-fns`: dates are ISO strings, handled with plain arithmetic).

---

## 6. Public API

### 6.1 Functions

```ts
/** Validates without generating. Never throws for bad input; returns every issue found. */
export function validate1214(input: unknown, options?: ValidateOptions): ValidationResult

/** Validates, then generates. Throws Opcn1214ValidationError if any error-severity issue exists. */
export function generate1214(input: Report1214Input, options?: GenerateOptions): GenerateResult

/** OPCN batch (p.1: up to 50 reports per file). Each report is generated and validated independently;
 *  issues carry `reportIndex`. Throws if any report has errors or more than 50 reports are given. */
export function generate1214Batch(
  inputs: readonly Report1214Input[],
  options?: GenerateOptions
): GenerateResult

/** Parses a single-report file. Throws Opcn1214ParseError on structural problems.
 *  Business-rule issues of the parsed content are returned as `issues`, not thrown. */
export function parse1214(content: string | Uint8Array, options?: ParseOptions): ParseResult

/** Parses an OPCN batch file (1–50 reports). */
export function parse1214Batch(content: string | Uint8Array, options?: ParseOptions): ParseResult[]

/** Parses SHAAM's response file shumot.shg (§3.9). */
export function parseResponseFile(content: string | Uint8Array): ResponseRecord[]

export function supportedTaxYears(): readonly number[] // [2024, 2025]
export function getLayout(taxYear: number): YearLayout // throws for unsupported years
export const RULES: readonly RuleMeta[] // the §10 catalogue, as data
```

### 6.2 Options and results

```ts
export interface ValidateOptions {
  /** How non-integer amounts are handled. Default 'reject' (error field.integer). */
  rounding?: 'reject' | 'halfUp'
  /** Used when input.meta.saveDate is absent. Default: today in Asia/Jerusalem. */
  today?: () => IsoDate
}
export type GenerateOptions = ValidateOptions
export interface ParseOptions {
  /** Encoding of a Uint8Array input. Default 'windows-1255'. Strings are taken as already decoded. */
  encoding?: 'windows-1255' | 'utf-8'
}

export interface ValidationResult {
  valid: boolean // true ⇔ errors.length === 0
  errors: Issue[] // severity 'error', sorted (§11.3)
  warnings: Issue[] // severity 'warning', sorted
}

export interface GenerateResult {
  text: string // the file as a JS string (CRLF line endings)
  bytes: Uint8Array // windows-1255 — the artifact to upload
  fileName: string // suggestion: `1214_${fileNumber}_${taxYear}.txt` (batch: `1214_batch_${n}.txt`)
  // fileNumber: the 9 digits as written at 1000@137 (zero-padded, e.g. '12' → '000000012')
  warnings: Issue[]
  summary: {
    reports: number
    records: Partial<Record<RecordType, number>>
    mainCodePairs: number // used of 61
    omittedZeroCodes: Array<{ record: RecordType; recordIndex: number; code: string }>
  }
}

export interface ParseResult {
  report: Report1214Input // canonical form (§8.4)
  issues: Issue[] // validation of the parsed content (errors and warnings)
  saveDate: IsoDate // from 1000@165
  softwareName: string // from 1000@150
}

export interface ResponseRecord {
  fileNumber: string // 9 digits
  taxYear: number
  code: string // '00', '05', …
  meaning: string // English text from §3.9
  accepted: boolean // code === '00'
  detail?: string // trailing text for codes 08 / 33
  line: number
}
```

### 6.3 Errors (details in §11)

`Opcn1214Error` (base, has `issues: Issue[]`) → `Opcn1214ValidationError` (generate),
`Opcn1214ParseError` (parse), `Opcn1214UnsupportedYearError` (`getLayout`), `Opcn1214InternalError`
(invariant violated — a bug).

### 6.4 Exports

`index.ts` exports exactly: the functions and `RULES` above; types `Report1214Input` and all its
sub-types (§7), the code unions (§5.3), `Issue`, `RuleMeta`, `Severity`, option/result types,
`YearLayout` and the layout types; the error classes. Nothing else is public.

### 6.5 Stability contract (semver)

| Change                                                         | Version bump |
| -------------------------------------------------------------- | ------------ |
| Output bytes change for an input that was already valid        | **major**    |
| A rule ID or issue `path` format changes or is removed         | **major**    |
| A new **error** rule                                           | **major**    |
| A new **warning** rule (may become an error in the next major) | minor        |
| A new supported tax year / layout                              | minor        |
| Message wording                                                | patch        |

Golden files (§13.5) enforce the first row.

---

## 7. Input model (`src/model/input.ts`)

### 7.1 Conventions

- All money in **ILS**. `amount` fields are whole shekels; `amountX100` fields accept agorot.
- Dates are ISO strings `YYYY-MM-DD` (never `Date` objects — avoids time-zone bugs).
- Identification numbers are **strings** of digits (leading zeros preserved).
- Booleans for flags and yes/no fields; string literal unions for enums.
- Optional properties may be omitted or `undefined`. `null` is rejected (`input.shape`).
- Objects are **strict**: unknown properties are errors (`input.shape`), which also catches typos
  and wrong codes in amount maps.
- Code maps use the 3-digit code string as the key, exactly as in `codes.csv` (`'015'`, not `'15'`).

### 7.2 Types

```ts
export type IsoDate = string // 'YYYY-MM-DD'
export type SupportedTaxYear = 2024 | 2025
export type PhonePrefix =
  | '02'
  | '03'
  | '04'
  | '08'
  | '09'
  | '072'
  | '073'
  | '074'
  | '076'
  | '077'
  | '050'
  | '052'
  | '053'
  | '054'
  | '055'
  | '057'
  | '058'
  | '059'
export interface Phone {
  prefix: PhonePrefix
  number: string /* exactly 7 digits */
}

export interface Report1214Input {
  taxYear: SupportedTaxYear // 1000@146; selects the layout
  meta?: {
    softwareName?: string // 1000@150, ≤ 15, default 'ACCOUNTER'
    saveDate?: IsoDate // 1000@165, default options.today()
  }
  company: CompanyDetails
  preparer?: PreparerDetails // "המסייע/ת במילוי הדו"ח" (1000@563–827)
  declarations: Declarations
  otherTaxableIncome?: {
    // 1000@887/937/949, "הכנסה חייבת אחרת בארץ ובחו"ל"
    source?: string // must start with a Hebrew letter
    amount?: number
    ratePercent?: number // 1–100, ≤ 2 decimals
  }
  attachments?: {
    donationReceiptsCount?: number // 1000@954, receipts for code 070 (section 46)
    withholdingCertificatesCount?: number // 1000@957, certificates for code 010
  }
  capitalGainsSummary?: {
    totalAppendicesCount?: number // 1000@960, all appendices transmitted and not
    untransmittedCount?: number // 1000@962
    reasons?: {
      // 1000@964–968, why appendices were not transmitted
      lossOrNoGain?: boolean
      overFiveImprovementBalances?: boolean
      over14Appendices?: boolean
      other?: boolean
      otherText?: string // required when `other`
    }
  }
  qualifyingCompany?: {
    // 1000@1065–1091, "חברה מזכה" (part A of the form)
    purchased?: boolean
    israeliPurchaseAmount?: number
    foreignPurchaseAmount?: number
    amortizationClaimed?: boolean
    amortizationAmount?: number // may be 0
  }
  bankAccount?: {
    // → codes 277/278/280=1 (only when changing the account on file)
    bank: string // 2 digits
    branch: string // 3 digits
    account: string // 1–9 digits
  }
  amounts: Partial<Record<MainFormInputCode, number>> // 1000 code-amount section
  relatedCompanies?: RelatedCompany[] // ≤ 3
  shareholders: Shareholder[] // 1–99 (0 allowed only for a kibbutz)
  rdInvestments?: RdInvestment[] // ≤ 5
  foreignAppendix?: ForeignAppendix
  capitalGains?: CapitalGainsAppendix[] // ≤ 14 in total
}

export interface CompanyDetails {
  fileNumber: string // 1000@137 "מספר תיק"
  registeredName: string // 1000@175, ≤ 50 (SHAAM replaces it with the registry name if different)
  withholdingFileNumber?: string // 1000@225 "תיק ניכויים"
  vatFileNumber?: string // 1000@234
  occupationDescription?: string // 1000@243
  mailingAddress: string // 1000@293
  businessAddress: string // 1000@343
  booksAddress?: string // 1000@393, where the books are kept
  email?: string // 1000@443
  phone: Phone // 1000@493/496
  fax?: Phone // 1000@503/506
}

export interface PreparerDetails {
  officeName?: string
  contactName?: string
  name?: string
  profession?: string
  licensedDealerNumber?: string // 1000@763 "מספר עוסק מורשה (מסייע)"
  address?: string
  phone?: Phone
}

export interface Declarations {
  // required yes/no (1000@878–882, 1029, 1030)
  hasTaxPlanningAction: boolean // 878
  hadRelatedPartyTransactions: boolean // 879
  controlsBodyOfPersons: boolean // 880
  holdsRightsInBodyOfPersons: boolean // 881
  appliesAccountingStandards: boolean // 882 (→ code 008 = 1)
  directorsReceivedOpinion: boolean // 1029
  tookReportablePosition: boolean // 1030
  reportablePositions?: number[] // 1034–1046: up to 5 position numbers (form 1346), 1–999

  form6111Obligation?: 'obliged' | 'notObliged' | 'notRelevant' // 834 (→ code 297 = 8 / 9)
  financialStatementsAttached?: boolean // 835
  familyCompany?: { representativeFileNumber: string } // 836 + 837 (+ code 080 required)
  isHouseCompany?: boolean // 846 (+ code 084 required)
  form1343Attached?: boolean // 847
  form1344Attached?: boolean // 848
  claimsCapitalInvestmentLawBenefits?: boolean // 849 (required when code 101 or 102 is filled)
  preferredEnterprise?: boolean // 850
  beneficiaryEnterprise?: { noticeDate: IsoDate } // 851 + 852
  dividendDistributed?: boolean // 862
  specialYear?: { balanceSheetDate: IsoDate } // 863 + 864
  foreignInvestors?: boolean // 874
  consolidatedReport?: 'consolidatedUnderSection23' | 'consolidatesWithParent' | 'notRelevant' // 875 → 1/2/3
  partnerInPartnership?: boolean // 876
  isKibbutz?: boolean // 877
  requestsAdvancePayments?: boolean // 883 (yes/no)
  hasBuildingIncome?: boolean // 884 (yes/no; → code 259 required)
  isTrustBeneficiary?: boolean // 886
  nonDeductibleSalaryExpenses?: boolean // 1031
  fewMembersCompany62A?: boolean // 1032
  partOfMultinationalGroup?: boolean // 1033 (yes/no)
  noBankAccount?: boolean // 1064
  /** Forces 833 = yes when capital-gains appendices exist but none are transmitted. */
  hasCapitalGainsAppendix?: boolean // 833 (otherwise derived, §7.4)
}

export interface RelatedCompany {
  // 1010
  companyName: string // ≤ 50
  companyFileNumber?: string
  relationType:
    | 'parent'
    | 'subsidiary'
    | 'partnership'
    | 'kibbutzRelatedCorporation'
    | 'jointlyControlled'
    | 'granddaughter'
    | 'grandmother'
    | 'other' // → 1..8
  assessingOfficeCode?: number // 2 digits
}

export interface Shareholder {
  // 1020
  idNumber: string // 9 digits, or 999999964 / 999999998
  fullName: string // must start with a Hebrew letter
  isControllingShareholder: boolean
  dividendRightsPercent?: number // all shareholders must total 100
  votingRightsPercent?: number
  otherRightsPercent?: number
  isMaterialShareholder?: boolean
  salaryMonths1To9?: number
  salaryMonths10To12?: number
  otherPayments?: number
}

export interface RdInvestment {
  // 1030
  companyName: string
  companyFileNumber?: string
  investmentAmount: number
}

export interface ForeignAppendix {
  // 2000 + 2200
  otherTaxableIncomeDescription?: string // required when otherTaxableIncome > 0
  otherTaxableIncome?: number
  foreignTaxPaidOnOtherIncome?: number
  totalForeignTaxableIncome?: number
  totalForeignLoss?: number
  participationExemptionHoldingCompany?: number
  taxRefundDeclaration: boolean // 247 (required yes/no)
  taxRefundDeclarationAmount?: number
  amounts: Partial<Record<ForeignAppendixCode, number>>
  countryBreakdown?: Partial<
    Record<
      CountryBreakdownCode,
      {
        deductionsOffsetsAndExemptions?: number // 2200@140
        countries: Array<{ country: CountryCode; income: number }> // 1–10
      }
    >
  >
}

export type CapitalGainsAppendix =
  | SharesAppendix
  | BettermentTaxAppendix
  | ForcedVirtualCurrencyAppendix
  | OilPartnershipAppendix
  | SecuritiesAppendix
  | Section6SecuritiesAppendix
  | ReitAppendix
  | NoWithholding1322Appendix
  | NoWithholding1326Appendix
  | OtherTransactionsAppendix

type AssetLocation = 'abroad' | 'israel' // 1 / 2
interface Withholder {
  name?: string /* Hebrew first */
  branch?: string
  account?: string
}

export interface SharesAppendix {
  // 3027
  symbol: 27
  expropriation?: boolean
  assetDetails?: string
  assetLocation?: AssetLocation
  relatedParty?: boolean
  buyerName?: string
  dates?: { code15?: IsoDate; code20?: IsoDate; code53?: IsoDate }
  amounts: Partial<Record<CapitalGainsCode<27>, number>>
}
export interface BettermentTaxAppendix {
  // 3050
  symbol: 50
  expropriation?: boolean
  assetDetails?: string
  purchaseDate: IsoDate
  dates: { code15: IsoDate }
  amounts: Partial<Record<CapitalGainsCode<50>, number>>
}
export interface ForcedVirtualCurrencyAppendix {
  // 3051
  symbol: 51
  assetDetails?: string
  assetLocation?: AssetLocation
  relatedParty?: boolean
  buyerName?: string /* Hebrew first */
  dates: { code15: IsoDate }
  walletAddresses?: [string] | [string, string] // ≤ 150 chars each
  amounts: Partial<Record<CapitalGainsCode<51>, number>> // 071 (=1) and 016 required
}
export interface OilPartnershipAppendix {
  // 3054
  symbol: 54
  assetDetails?: string
  purchaseDate: IsoDate
  dates: { code15: IsoDate }
  amounts: Partial<Record<CapitalGainsCode<54>, number>>
}
export interface SecuritiesAppendix {
  // 3060
  symbol: 60
  foreignAsset?: boolean
  soldToRelatedParty?: boolean
  boughtFromRelatedParty?: boolean
  gainFromInvestmentFund?: boolean
  withholders?: Withholder[] /* ≤ 4 */
  lossesCarriedForward?: number
  amounts: Partial<Record<CapitalGainsCode<60>, number>>
}
export interface Section6SecuritiesAppendix {
  // 3063
  symbol: 63
  foreignAsset?: boolean
  lossesCarriedForward?: number
  amounts: Partial<Record<CapitalGainsCode<63>, number>>
}
export interface ReitAppendix extends Omit<SecuritiesAppendix, 'symbol' | 'amounts'> {
  // 3064
  symbol: 64
  amounts: Partial<Record<CapitalGainsCode<64>, number>>
}
export interface NoWithholding1322Appendix extends Omit<SecuritiesAppendix, 'symbol' | 'amounts'> {
  // 3065
  symbol: 65
  withholdingStatus?: 'notWithheldFirstHalf' | 'notWithheldSecondHalf' // → 2 / 3
  amounts: Partial<Record<CapitalGainsCode<65>, number>>
}
export interface NoWithholding1326Appendix {
  // 3066
  symbol: 66
  foreignAsset?: boolean
  withholdingStatus?: 'notWithheldFirstHalf' | 'notWithheldSecondHalf'
  lossesCarriedForward?: number
  amounts: Partial<Record<CapitalGainsCode<66>, number>>
}
export interface OtherTransactionsAppendix {
  // 3077
  symbol: 77
  expropriation?: boolean
  assetDetails?: string
  assetLocation?: AssetLocation
  relatedParty?: boolean
  buyerName?: string
  dates: { code15: IsoDate; code20: IsoDate }
  improvements?: Array<{
    // ≤ 5 (245 = count)
    expense?: number // ×100 (agorot allowed)
    accumulatedDepreciation?: number // ×100
    date: IsoDate // required per improvement
    code50Amount?: number // → code 501..505, ×100
  }>
  replacementAsset?: { details?: string; purchaseDate?: IsoDate; price?: number } // 417/467/477
  walletAddresses?: [string] | [string, string] // required when code 071 = 1
  amounts: Partial<
    Record<Exclude<CapitalGainsCode<77>, '501' | '502' | '503' | '504' | '505'>, number>
  >
}
```

### 7.3 Field ↔ input mapping

The `key` column of `fields.csv` names every header field. For most fields the key **is** the input
path (`company.fileNumber`, `shareholders[i].fullName` → key `fullName` in record 1020). The
exceptions are listed here; the normalizer (`normalize/report.ts`) implements exactly this table and
a test asserts that every non-filler key in `fields.csv` is produced (§13.3).

| Key (record@pos)                                     | Comes from                                                           |
| ---------------------------------------------------- | -------------------------------------------------------------------- |
| `declarations.familyCompany.isFamilyCompany` (836)   | `declarations.familyCompany !== undefined`                           |
| `declarations.beneficiaryEnterprise.marked` (851)    | `declarations.beneficiaryEnterprise !== undefined`                   |
| `declarations.specialYear.marked` (863)              | `declarations.specialYear !== undefined`                             |
| `declarations.reportablePositions[0..4]` (1034–1046) | `declarations.reportablePositions[i]`, absent → `000`                |
| `declarations.hasCapitalGainsAppendix` (833)         | derived, §7.4                                                        |
| `qualifyingCompany.*` (1065–1091)                    | `qualifyingCompany.*` (`purchased`/`amortizationClaimed` are yes/no) |
| `withholders[0..3].*` (3060/3064/3065)               | `withholders[i].*`                                                   |
| `improvements[0..4].*` (3077)                        | `improvements[i].expense / accumulatedDepreciation / date`           |
| `walletAddresses[0..1]` (3051/3077)                  | `walletAddresses[i]`                                                 |

### 7.4 Derived values (never taken from the caller)

| Output                                                          | Derivation                                                                                                               | Enforces (spec)                            |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------ |
| Prefix (1–136) of every record                                  | `1214` + record type + 128 × `0`                                                                                         | p.4                                        |
| 1000@150 software name                                          | `meta.softwareName ?? 'ACCOUNTER'`                                                                                       | required field                             |
| 1000@165 save date                                              | `meta.saveDate ?? options.today()` (Asia/Jerusalem)                                                                      | required field                             |
| 1000@832 has foreign appendix                                   | `foreignAppendix ? yes : no`                                                                                             | consistency with 2000 record               |
| 1000@833 has capital-gains appendix                             | yes if `capitalGains.length > 0` or `untransmittedCount > 0` or `declarations.hasCapitalGainsAppendix === true`, else no | consistency with 30xx records              |
| code 008                                                        | `1` if `appliesAccountingStandards`, else omitted                                                                        | p.9 (882 → "fill 008 with 1")              |
| code 028                                                        | `capitalGains.length + (untransmittedCount ?? 0)`, omitted if 0                                                          | p.14 "forms attached, transmitted and not" |
| code 273                                                        | 1029/1030: yes/no → 1, no/yes → 2, yes/yes → 3, no/no → 9                                                                | p.19 mapping                               |
| codes 277 / 278 / 280                                           | from `bankAccount`: 277 = account; 278 = bank(2) + branch(3); 280 = 1                                                    | p.19–20                                    |
| code 297                                                        | `form6111Obligation`: obliged → 8, notObliged → 9, otherwise omitted                                                     | p.7 (834 → "fill 297 with 8/9")            |
| 1010@137, 1020@137                                              | 1-based index in input order                                                                                             | serial numbers                             |
| 1030@137                                                        | `1` (company)                                                                                                            | p.25                                       |
| 2200@137 and entry affiliation                                  | the breakdown's 2000 code; affiliation `1`                                                                               | p.31                                       |
| 30xx@137 transaction symbol                                     | `symbol`                                                                                                                 | p.34 ff.                                   |
| 30xx@139 appendix number                                        | 1-based index among appendices **of the same symbol**, in emission order                                                 | §15 A-7                                    |
| "מספר בתל"ם" (3027@255, 3051@234, 3065@325, 3066@154, 3077@487) | 1-based index among **all** capital-gains appendices in emission order                                                   | p.35 "running number"                      |
| 3077@245 improvement count                                      | `improvements.length`                                                                                                    | p.55                                       |
| 3077 codes 501–505                                              | `improvements[i].code50Amount`                                                                                           | p.58                                       |
| 9999@137–150                                                    | counts from the generated records (§3.8)                                                                                 | p.60                                       |

Passing a derived code in an `amounts` map is an error (`input.derivedCode`) whose message names the
input property that controls it.

---

## 8. Data handling

### 8.1 Generation algorithm (`generate1214`)

1. `taxYear` → `getLayout` (unsupported ⇒ issue `struct.taxYear.unsupported`, generation stops).
2. Shape check with the zod schema for that year (§9.2). Shape errors stop the pipeline (later
   stages assume well-typed input); all shape issues are reported together.
3. Normalize: apply §4.3 to text, scale numbers (§4.4), map enums and booleans to their codes, run
   §7.4 derivations, and build `NormalizedReport` in the record order of §3.3.
4. Run the rule engine (§9) on `NormalizedReport` (+ the original input for paths).
5. If any error ⇒ throw `Opcn1214ValidationError` with all errors and warnings.
6. Encode each record: prefix + header fields in position order + section. Assert
   `line.length === RecordDef.length`, otherwise throw `Opcn1214InternalError`.
7. Append 9999. Join with `\r\n` and add a final `\r\n`. Encode to windows-1255 with iconv-lite;
   assert byte length = character length (single-byte) and that no `?` replacement was introduced
   (text was already checked by `field.charset`).
8. Return `GenerateResult` (§6.2).

`generate1214Batch` runs 1–7 per report, concatenates the reports in input order, and requires 1–50
reports (`struct.batch.size`). Issues carry `reportIndex`.

### 8.2 Parsing algorithm (`parse1214`)

1. Decode: `Uint8Array` → string with windows-1255 (or UTF-8 when `options.encoding`). Strip a UTF-8
   BOM if present. Accept `\r\n` or `\n` line endings; ignore one trailing empty line.
2. For each line: check form type (`1214`), record type (known for the year), 128-zero prefix, exact
   length. The tax year is read from the first 1000 record's position 146 and selects the layout; a
   file that does not start with a 1000 record is rejected.
3. Check record order (§3.3) and the **maximum** occurrences (minimums are business rules, e.g.
   `struct.shareholders.min`, so a kibbutz file without 1020 records parses); split reports at each
   9999 (batch). A tax year outside `supportedTaxYears()` is reported as
   `struct.taxYear.unsupported`.
4. Decode header fields by layout (inverse of §4.2); header fillers are ignored (only positions
   9–136 are checked). Numeric fields must be all digits (`percentLiteral` may also hold one `.`
   between digits); alphanumeric values are trimmed of padding spaces. Dates must be valid
   `DD/MM/YYYY` or all spaces. Flag and yes/no fields accept only the digits they are written with
   (flag `0`/`1`, yes/no `0`/`1`/`2`), and phone-prefix fields only an allowed prefix or the absent
   value (spaces, or zeros in 822); any other value is a parse error (codec reason `format`,
   `parse.fieldValue`).
5. Decode sections: read `code(3)` + value(width of that code) repeatedly; stop at the first
   position where the remaining text is all `0` (padding). An unknown code, a truncated entry or a
   non-zero tail is a parse error. Duplicate codes are a parse error.
6. Verify 9999 counts against the records actually present.
7. Build `NormalizedReport`, denormalize to `Report1214Input` (canonical form, §8.4), and run the
   rule engine on it; return its issues in `ParseResult.issues` (they are not thrown). Issue paths
   are those of the reconstructed input, the n-th record of a type standing for the n-th input
   element. A required value that the file leaves empty is absent from `ParseResult.report` too (its
   `field.required` issue reports it); `ParseResult.saveDate` / `softwareName` are then `''`.

Structural problems from steps 1–6 throw `Opcn1214ParseError` with every problem found in the file
(the parser continues to the next line where possible; it does not stop at the first problem). Its
issues are sorted by line, then column, and each has a 1-based `line` and `column`: the first
offending character, the start of the record type for `parse.order`, the field position for
`parse.control.counts`, and column 1 of the line after the last one for `parse.control.missing` (and
of line 1 for `parse.empty`). A line with a structural problem (encoding, form or record type,
prefix, length) is not decoded further, but still counts for the order and 9999 checks.

### 8.3 Determinism

- Output depends only on the input values and `meta.saveDate` (or `options.today()`).
- Object key order, `amounts` key order and `undefined`-valued properties do not affect output.
- Code-amount entries are sorted by code; 2200 records by code; capital gains by record type then
  input order (§3.3).
- No locale-dependent APIs (`toLocaleString`, `Intl` number formatting) are used in encoding.

### 8.4 Canonical form and round trip

`canonicalize(input)` returns the input as the parser would reconstruct it:

- text normalized (§4.3); optional properties that encode to the empty/zero value removed (`false`
  flags, absent yes/no, empty strings); `amounts` entries with value `0` for non `zeroAllowed` codes
  removed; derived values not present in the input;
- `meta.saveDate` and `meta.softwareName` set to the values actually written
  (`canonicalize(input, options)` takes the same options as generation, for `today`);
- digit-string inputs of numeric fields (`id9`, `shareholderId`, `digits`) zero-padded to the field
  width (`'12'` → `'012'` for a 3-digit branch);
- optional numeric header values equal to `0` removed (exception: `amountX` 1000@1091, where 0 is
  meaningful).

Round-trip requirements (tested, §13.6):

1. `parse1214(generate1214(x).bytes).report` deep-equals `canonicalize(x)` for every valid `x`.
2. `generate1214(parse1214(f).report).bytes` equals `f` byte-for-byte for every golden file `f`
   (with the parsed save date and software name passed back in `meta`).

Lossy cases that make (1) use `canonicalize`: `yesNo` absent vs. not-required; `false` flags;
`percentLiteral` 10 vs 10.0 (both → `00010`); text whitespace.

### 8.5 Character set and lengths

All width checks happen on the normalized string, whose length equals its byte length in
windows-1255. JavaScript `string.length` counts UTF-16 code units; after normalization only BMP
characters representable in windows-1255 remain, so `length` is correct.

---

## 9. Validation engine

### 9.1 Issues

```ts
export type Severity = 'error' | 'warning'

export interface Issue {
  ruleId: RuleId // stable, e.g. 'main.familyCompany.code080' (§10)
  severity: Severity
  message: string // English, human-readable, may include values
  path: string // input path, see grammar below; '' for report-level issues
  recordType?: RecordType
  recordIndex?: number // 0-based index among records of that type
  reportIndex?: number // batch only
  field?: { position: number; length: number; nameHe: string } // for field-level issues
  code?: string // for code-amount issues
  value?: unknown // offending value (redacted to 100 chars)
  expected?: string // e.g. 'one of 1, 2, 12'
  specRef?: { page: number; note?: string }
  line?: number // parse issues: 1-based line
  column?: number // parse issues: 1-based column
}

export interface RuleMeta {
  id: RuleId
  severity: Severity
  source: 'spec' | 'derived' // 'spec' = stated in the PDF; 'derived' = our consistency check
  scope: RecordType | 'report' | 'input' | 'parse'
  description: string
  specRef?: { page: number; note?: string }
}
```

**Path grammar:** JavaScript-style access from the root of `Report1214Input`: dot for identifier
properties, `["…"]` for property names that are not identifiers (all code keys), `[n]` for array
indexes, `["code"]` for map keys. Examples: `company.phone.prefix`, `shareholders[3].fullName`,
`amounts["080"]`, `foreignAppendix.countryBreakdown["420"].countries[2].country`,
`capitalGains[1].improvements[0].date`. Issues found while parsing use the path of the reconstructed
input when one exists, plus `line`/`column`.

**Sorting** (deterministic): report index → record order (§3.3) → record index → field position or
code → rule ID.

### 9.2 Stages

| Stage        | Input                   | Rules                                                   | Stops pipeline? |
| ------------ | ----------------------- | ------------------------------------------------------- | --------------- |
| 1. Year      | `input.taxYear`         | `struct.taxYear.unsupported`                            | yes             |
| 2. Shape     | raw input, zod (strict) | `input.shape`, `input.unknownCode`, `input.derivedCode` | yes             |
| 3. Field     | `NormalizedReport`      | `field.*` (layout-driven)                               | no              |
| 4. Business  | `NormalizedReport`      | `main.*`, `shareholders.*`, `foreign.*`, `cg.*`         | no              |
| 5. Structure | `NormalizedReport`      | `struct.*`                                              | no              |

All issues from stages 3–5 are collected (no fail-fast). The zod schema deliberately accepts any
string for phone prefixes and country codes (the TS types are literal unions): those are checked by
`field.phonePrefix` and `foreign.breakdown.country.unknown`, so the rules stay reachable for untyped
callers. Before zod runs, keys of code maps that are unknown or derived are reported as
`input.unknownCode` / `input.derivedCode` and removed, so they are not reported twice. zod's
`unrecognized_keys` issues become one `input.shape` issue per key, with the key appended to the
path. The zod schema is generated per year from the layout (code maps, enum literals) plus the
hand-written object shapes of §7.2; zod issues are mapped to `input.shape` issues with the zod path
converted to the path grammar above.

### 9.3 Generic field rules (stage 3)

Repeated slots: header keys with an index (`withholders[2].name`, `improvements[0].date`,
`walletAddresses[1]`, `declarations.reportablePositions[3]`) form slots. A `required=yes` field
inside a slot is required only when the slot is in use, i.e. another key of the same slot has a
value (D-12).

For every header field and every code with a value, the engine applies the rules implied by its
`FieldDef`/`CodeDef`: `required`, `kind`, `length`, `values`, `zeroAllowed`. Conditional
requirements (`required = conditional`) are **not** evaluated generically; each has a named business
rule in §10.4.

---

## 10. Rule catalogue

Severity: **E** = error (blocks generation), **W** = warning. Source: **spec** = stated in the PDF,
**derived** = consistency check we add (kept few, always justified). Every rule must exist in
`RULES` and have tests (§13.4).

### 10.1 Input and structure

| Rule ID                       | Sev | Source  | Condition (violation)                                                                                                           | Ref           |
| ----------------------------- | --- | ------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| `struct.taxYear.unsupported`  | E   | derived | `taxYear` not in `supportedTaxYears()`                                                                                          | —             |
| `input.shape`                 | E   | derived | wrong JS type, missing required property, unknown property, `null`, array too long (e.g. > 4 withholders, > 2 wallet addresses) | —             |
| `input.unknownCode`           | E   | spec    | an `amounts` / `countryBreakdown` key that is not a code of that record for the year                                            | p.13, 27, 34+ |
| `input.derivedCode`           | E   | derived | caller passed a derived code (008, 028, 273, 277, 278, 280, 297, 501–505)                                                       | §7.4          |
| `struct.relatedCompanies.max` | E   | spec    | more than 3 related companies                                                                                                   | p.2           |
| `struct.shareholders.min`     | E   | spec    | no shareholders and `declarations.isKibbutz` is not true                                                                        | p.1, 21       |
| `struct.shareholders.max`     | E   | spec    | more than 99 shareholders                                                                                                       | p.2, 21       |
| `struct.rdInvestments.max`    | E   | spec    | more than 5 R&D investments                                                                                                     | p.2           |
| `struct.capitalGains.max`     | E   | spec    | more than 14 capital-gains appendices                                                                                           | p.1, 32       |
| `struct.mainCodePairs.max`    | E   | spec    | more than 61 code-amount pairs in record 1000 (after derivations)                                                               | p.13          |
| `struct.batch.size`           | E   | spec    | batch with 0 or more than 50 reports                                                                                            | p.1           |

### 10.2 Generic field rules (apply to every field/code by layout)

| Rule ID                   | Sev | Source  | Condition (violation)                                                                                                                                | Ref            |
| ------------------------- | --- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| `field.required`          | E   | spec    | field/code with `required=yes` absent (for codes not `zeroAllowed`, `0` counts as absent)                                                            | per field      |
| `field.numeric`           | E   | spec    | numeric field (`id9`, `shareholderId`, `num`, phone number, bank/branch/account) contains non-digits                                                 | type column    |
| `field.length`            | E   | spec    | normalized text longer than width, or number with more digits than width                                                                             | length column  |
| `field.integer`           | E   | spec    | `amount`/`amountX`/`num` not an integer (`rounding: 'reject'`)                                                                                       | p.13 "no dots" |
| `field.decimals`          | E   | spec    | `amountX100`/`percentX100`/`percentLiteral`/`rateX100` with more than 2 decimals                                                                     | p.10, 23, 35   |
| `field.negative`          | E   | spec    | negative number                                                                                                                                      | p.13           |
| `field.enum`              | E   | spec    | kinds `enum` and `rateX100` only: value not in `values` (code 014 ∉ {1, 2, 12}; 018 ∉ 2..7; 30xx 018 ∉ {23, 50}; relation type ∉ 1..8)               | values column  |
| `field.date`              | E   | spec    | not a valid ISO date (input) / `DD/MM/YYYY` (parse)                                                                                                  | date fields    |
| `field.percentRange`      | E   | spec    | percentage outside 1–100                                                                                                                             | p.10, 23       |
| `field.hebrewFirstLetter` | E   | spec    | `hebrewText` value whose first character is not א–ת                                                                                                  | p.9, 23, 34 …  |
| `field.charset`           | E   | derived | control character or character not representable in windows-1255 (after §4.3)                                                                        | §4.3           |
| `field.phonePrefix`       | W   | spec    | prefix not in the allowed list: the prefix is dropped (SHAAM deletes it, p.6); for the required 1000@493 the follow-up `field.required` is the error | p.6–7          |
| `field.phoneNumber`       | E   | derived | phone/fax number is not exactly 7 digits (shorter numbers would be silently zero-padded)                                                             | p.6            |

### 10.3 Record 1000 — conditional and cross-field rules

| Rule ID                                     | Sev | Source  | Condition (violation)                                                                                | Ref      |
| ------------------------------------------- | --- | ------- | ---------------------------------------------------------------------------------------------------- | -------- |
| `main.familyCompany.fileNumber`             | E   | spec    | family company (836) without the taxpayer file number (837)                                          | p.7      |
| `main.familyCompany.code080`                | E   | spec    | family company (836) without code 080 (0 allowed)                                                    | p.15     |
| `main.houseCompany.code084`                 | E   | spec    | house company (846) without code 084 (0 allowed)                                                     | p.15     |
| `main.investmentLaw.flag`                   | E   | spec    | code 101 or 102 filled but 849 not marked                                                            | p.8      |
| `main.beneficiaryEnterprise.noticeDate`     | E   | spec    | 851 marked without 852 (guaranteed by the input type; checked for JS callers and parsed files)       | p.8      |
| `main.specialYear.balanceSheetDate`         | E   | spec    | 863 marked without 864 (same as above)                                                               | p.8      |
| `main.kibbutz.code226`                      | E   | spec\*  | `isKibbutz` but code 226 not filled                                                                  | p.9, 18  |
| `main.kibbutz.code226Other`                 | W   | derived | code 226 = 9 ("other cooperative, not kibbutz") while `isKibbutz`                                    | p.18     |
| `main.buildingIncome.code259`               | E   | spec    | `hasBuildingIncome` (884 = 1) without code 259                                                       | p.9      |
| `main.cgReasons.otherText`                  | E   | spec    | reason "other" (967) marked without text (968)                                                       | p.11     |
| `main.reportablePositions.required`         | E   | spec    | `tookReportablePosition` (1030 = 1) and no position numbers                                          | p.11     |
| `main.reportablePositions.max`              | E   | spec    | more than 5 positions                                                                                | p.11     |
| `main.reportablePositions.unexpected`       | W   | derived | positions given while `tookReportablePosition` is false                                              | p.11     |
| `main.rd.records`                           | E   | spec    | code 165 > 0 but no 1030 records                                                                     | p.17     |
| `main.rd.total`                             | W   | derived | sum of 1030 investment amounts ≠ code 165                                                            | p.17     |
| `main.capitalGains.flag`                    | E   | derived | `declarations.hasCapitalGainsAppendix === false` while capital-gains appendices exist                | p.7      |
| `main.cgUntransmitted.reason`               | W   | derived | `untransmittedCount > 0` and none of the reasons 964–967 marked                                      | p.10–11  |
| `main.cgUntransmitted.reasonWithoutCount`   | W   | derived | a reason 964–967 marked while `untransmittedCount` is 0/absent                                       | p.10–11  |
| `main.appendixTotal.min`                    | W   | derived | `totalAppendicesCount` (960) given and < transmitted appendices (2000 + 30xx) + `untransmittedCount` | p.10     |
| `main.bankAccount.withNoBank`               | W   | derived | `noBankAccount` (1064) and `bankAccount` both given                                                  | p.12, 19 |
| `main.bankAccount.format`                   | E   | spec    | bank not 2 digits, branch not 3 digits, or account longer than 9 digits                              | p.19     |
| `main.qualifyingCompany.purchaseAmounts`    | W   | derived | `purchased` but neither purchase amount given                                                        | p.12     |
| `main.qualifyingCompany.amortizationAmount` | W   | derived | `amortizationClaimed` but no amortization amount                                                     | p.12     |
| `main.attachments.code070`                  | W   | derived | donation receipts count > 0 but code 070 absent                                                      | p.10     |
| `main.attachments.code010`                  | W   | derived | withholding certificates count > 0 but code 010 absent                                               | p.10     |

\* The spec text for 877 is "required in the case of a kibbutz and when field 226 is filled" (§15
A-13).

Spec rules that are **enforced by derivation** and therefore need no runtime rule: 834 ⇒ code 297
(8/9); 882 ⇒ code 008 = 1; code 273 ↔ 1029/1030; 832/833 ↔ appendix records; code 028; serial and
sequence numbers; all 9999 counts. Their correctness is covered by encoder tests, and in parse mode
by `parse.derivedMismatch`.

### 10.4 Records 1010 / 1020 / 1030

| Rule ID                             | Sev | Source  | Condition (violation)                                                                                | Ref  |
| ----------------------------------- | --- | ------- | ---------------------------------------------------------------------------------------------------- | ---- |
| `shareholders.dividendRights.total` | E   | spec    | at least one shareholder has `dividendRightsPercent` and the total ≠ 100.00 (computed in hundredths) | p.23 |
| `shareholders.duplicateId`          | W   | derived | the same `idNumber` twice (excluding 999999964 / 999999998)                                          | —    |

(Names, relation type, control flag and amounts are covered by §10.2 through the layout's `required`
and `values` columns.)

### 10.5 Records 2000 / 2200

| Rule ID                                       | Sev | Source  | Condition (violation)                                                                 | Ref         |
| --------------------------------------------- | --- | ------- | ------------------------------------------------------------------------------------- | ----------- |
| `foreign.otherIncome.description`             | E   | spec    | `otherTaxableIncome` > 0 without `otherTaxableIncomeDescription`                      | p.26        |
| `foreign.refund.amount`                       | W   | derived | `taxRefundDeclaration` true without `taxRefundDeclarationAmount`                      | p.26        |
| `foreign.breakdown.required`                  | E   | spec    | a `perCountryBreakdown` code has a value in `amounts` but no `countryBreakdown` entry | p.27        |
| `foreign.breakdown.orphan`                    | E   | spec    | a `countryBreakdown` entry for a code with no value in `amounts`                      | p.30        |
| `foreign.breakdown.countries.min`             | E   | derived | a breakdown with no countries                                                         | p.31        |
| `foreign.breakdown.countries.max`             | E   | spec    | more than 10 countries for one code                                                   | p.30        |
| `foreign.breakdown.country.unknown`           | E   | spec    | country code not in `countries.csv`                                                   | p.32, 63–71 |
| `foreign.breakdown.country.unknownOnlyFor439` | E   | spec    | `-88` used for a code other than 439                                                  | p.32        |
| `foreign.breakdown.country.duplicate`         | W   | derived | the same country twice within one breakdown                                           | —           |

### 10.6 Capital-gains appendices

| Rule ID                        | Sev | Source  | Condition (violation)                                                                        | Ref      |
| ------------------------------ | --- | ------- | -------------------------------------------------------------------------------------------- | -------- |
| `cg.improvements.max`          | E   | spec    | more than 5 improvements in a 3077 appendix (report the excess via 962 / reason 965 instead) | p.10, 55 |
| `cg.improvements.code50Amount` | W   | derived | an improvement without `code50Amount`, or a `code50Amount` with no expense/depreciation      | p.58     |
| `cg.virtualCurrency.wallet`    | E   | spec    | 3077 with code 071 = 1 and no wallet address ("יש להכניס כתובת הארנק", p.57)                 | p.57     |

Improvement dates (271/305/339/373/407) are covered by the slot-aware `field.required` (§9.3); the
rate code 018 by `field.enum`. Required dates (3050 purchase date and code-15 date; 3051 code-15
date; 3054 purchase date and code-15 date; 3077 code-15 and code-20 dates) and required codes (3051:
071 = 1, 016) are `required=yes` in the layout and covered by `field.required`.

### 10.7 Parse-only rules (`Opcn1214ParseError` issues)

| Rule ID                 | Condition                                                                                                    |
| ----------------------- | ------------------------------------------------------------------------------------------------------------ |
| `parse.empty`           | no records                                                                                                   |
| `parse.encoding`        | bytes that do not decode in the selected encoding                                                            |
| `parse.lineLength`      | line length ≠ record length                                                                                  |
| `parse.formType`        | positions 1–4 ≠ `1214`                                                                                       |
| `parse.recordType`      | unknown record type                                                                                          |
| `parse.prefixFiller`    | positions 9–136 not all `0`                                                                                  |
| `parse.order`           | record out of the §3.3 order, or a second 1000 before a 9999                                                 |
| `parse.occurrences`     | maximum record counts of §3.2 exceeded (minimums are business rules)                                         |
| `parse.control.missing` | report not terminated by 9999                                                                                |
| `parse.control.counts`  | 9999 counts differ from the records present                                                                  |
| `parse.multipleReports` | `parse1214` given a batch (use `parse1214Batch`)                                                             |
| `parse.numeric`         | non-digit in a numeric field                                                                                 |
| `parse.date`            | invalid `DD/MM/YYYY`                                                                                         |
| `parse.codeSection`     | unknown code, duplicate code, truncated entry, or non-zero data after the last entry                         |
| `parse.fieldValue`      | header value well-formed for its type but not one it can hold (flag/yes-no digit, phone prefix)              |
| `parse.countrySection`  | malformed country entry (affiliation ≠ 1, bad country, > 10 entries)                                         |
| `parse.derivedMismatch` | a derived value disagrees with its source (e.g. code 273 vs 1029/1030, 832 vs 2000 presence, serial numbers) |

---

## 11. Error handling

### 11.1 Principles

1. **Data problems are values, not exceptions,** in `validate1214` and in `ParseResult.issues`.
2. **Generation refuses invalid data:** `generate1214` throws `Opcn1214ValidationError` carrying
   every error and warning, so callers can show the complete list at once.
3. **Collect all:** no stage short-circuits except year and shape (§9.2), which make later stages
   meaningless.
4. **Programmer and internal errors are exceptions:** wrong argument types to the API (`TypeError`),
   unsupported year in `getLayout` (`Opcn1214UnsupportedYearError`), and invariant violations such
   as a wrong line length (`Opcn1214InternalError`, which signals a bug in the package).
5. **No silent repair.** The only automatic changes are documented normalization (§4.3), dropping an
   invalid phone prefix (as SHAAM does, with a warning) and omitting `0` for non-`zeroAllowed` codes
   (§4.5, listed in `summary.omittedZeroCodes`).

### 11.2 Error classes (`src/errors.ts`)

```ts
export class Opcn1214Error extends Error {
  readonly issues: readonly Issue[]
  constructor(message: string, issues: readonly Issue[])
}
export class Opcn1214ValidationError extends Opcn1214Error {} // generate1214 / generate1214Batch; issues: errors, then warnings (each sorted)
export class Opcn1214ParseError extends Opcn1214Error {} // parse1214 / parse1214Batch
export class Opcn1214UnsupportedYearError extends Opcn1214Error {
  readonly taxYear: number
}
export class Opcn1214InternalError extends Error {} // bug; never expected in production
```

`message` summarizes (`"1214 report has 3 errors: field.required at company.phone.number; …"`, first
five issues). Every class sets `name` and uses `Error.cause` when wrapping.

### 11.3 Messages

English, one sentence, includes the Hebrew field name for UI context, e.g.:
`Required field "מספר טלפון" (1000@496, company.phone.number) is missing.` Messages are not part of
the stability contract (§6.5); UIs should key on `ruleId` and `path`.

### 11.4 Server usage pattern (non-normative)

```ts
const result = validate1214(input)
if (!result.valid) return { errors: result.errors, warnings: result.warnings } // show in the UI
const { bytes, fileName, warnings } = generate1214(input) // cannot throw validation errors now
```

---

## 12. Implementation plan

The step-by-step plan, with one test-driven prompt per step, is
[`IMPLEMENTATION_PLAN.md`](IMPLEMENTATION_PLAN.md). Phase mapping: P0 = Part A (layout), P1 = Parts
B–D (codecs, walking skeleton incl. the parser, record 1000), P2 = Part E (1010, 1030), P3 = Part F
(2000, 2200), P4 = Part G (capital gains), P5 + P6 = Part H (batches, response file, property tests,
release). The parser is built with the first report (Part C) and every later step adds encoding and
decoding together.

---

## 13. Testing plan

Framework: Vitest 5 (globals, node environment, as in the sibling packages). Layout:

```
tests/
├── layout/            integrity.test.ts, codegen-sync.test.ts, registry.test.ts
├── encode/            primitives.test.ts, text-normalization.test.ts, code-amount.test.ts, country-amount.test.ts, records/*.test.ts
├── rules/             cases.ts (one pass + one fail case per rule), rules.test.ts, coverage.test.ts
├── api/               validate.test.ts, generate.test.ts, parse.test.ts, response.test.ts, batch.test.ts
├── roundtrip/         roundtrip.test.ts, determinism.test.ts
└── fixtures/
    ├── builders.ts    typed builders: minimalReport(), withShareholders(n), withCapitalGains(...)…
    └── golden/        <name>.input.json, <name>.opcn (windows-1255 bytes), VERIFICATION.md
```

### 13.1 Principles

- Tests import from `src/`, never from `dist/` (they run in the root `unit` project too).
- Fixtures are built with typed builders, so a model change breaks fixtures at compile time.
- Every assertion on encoded output checks **exact slices** at layout positions
  (`line.slice(pos - 1, pos - 1 + len)`), not only snapshots.

### 13.2 Layout integrity (P0)

For each year and record: fields sorted, first at 137, contiguous, the last ends at
`136 + headerLength`; `136 + headerLength + sectionLength = length`; keys unique per record; every
`kind` known; `values` parse; codes unique, 3 digits, `length` 1–12; derived codes flagged; 23
per-country codes in 2000; countries unique; limits match §3.2.

### 13.3 Normalizer coverage

For a "maximal" input (every optional property set), the normalized 1000…3077 records contain a
value for **every** non-filler key of `fields.csv`. This catches unmapped fields.

### 13.4 Rules

- `tests/rules/cases.ts` exports `RULE_CASES: { [K in RuleId]: RuleCase }` (a missing case is a type
  error). `RuleCase` is one of: `{ kind: 'input'; fail(): unknown; pass(): unknown }`
  (validate1214), `{ kind: 'file'; fail(): string | Uint8Array; pass(): … }` (issues from
  `parse1214(...).issues` or from a thrown `Opcn1214ParseError`), `{ kind: 'batch'; … }`
  (`generate1214Batch`), each with optional `path`.
- `rules.test.ts` iterates `RULES`: the `fail` case yields exactly that rule ID (at `path`, with the
  catalogued severity), the `pass` case does not.
- `spec-sync.test.ts` asserts `RULES` and the §10 catalogue (the first cell of each §10 table row)
  are the same set — the spec and the code cannot drift apart.

### 13.5 Golden files

| Fixture             | Content                                                                                      |
| ------------------- | -------------------------------------------------------------------------------------------- |
| `minimal`           | 1000 with only required fields and codes, one shareholder, 9999                              |
| `main-full`         | every 1000 field set, 61 code pairs, bank account, 99 shareholders                           |
| `kibbutz`           | `isKibbutz`, code 226, no shareholders                                                       |
| `related-and-rd`    | 3 related companies, 5 R&D investments, code 165                                             |
| `foreign`           | 2000 with every per-country code, 23 breakdowns incl. `-88` on 439, 10 countries on one code |
| `cg-<symbol>` × 10  | one appendix per type, all fields filled                                                     |
| `capital-gains-max` | 14 appendices of mixed types, checks numbering and sequence                                  |
| `hebrew-edge`       | Hebrew with geresh/gershayim, niqqud, max-width names, typographic quotes (normalized)       |
| `batch-50`          | 50 minimal reports                                                                           |

Each golden `.opcn` file is committed as PENDING and verified on shopcn at the next checkpoint;
`VERIFICATION.md` records its sha256, which the golden test asserts, so a changed golden cannot pass
unnoticed. `VERIFICATION.md` also logs date, checker result and any change made. A golden file may
only change with a major version bump (§6.5) or before the first release.

### 13.6 Round trip and determinism

- `generate → parse → canonicalize`, deep equality, for every golden input and for randomized inputs
  from the builders (seeded; 200 cases per run).
- `parse → generate` byte equality for every golden `.opcn`.
- Shuffling object keys / `amounts` order / input property order produces identical bytes.
- `meta.saveDate` absent: `options.today` is used; with a fixed `today` the output is stable.

### 13.7 Negative and edge cases (must be covered)

Text one character over the width; a Hebrew name starting with a digit or quote; an emoji; CR/LF
inside text; amount `1e21`; `-0`; `NaN`; `0.1 + 0.2` as an ×100 amount (must pass as `0.3`); percent
`100.001`; date `2024-02-30`; `taxYear: 2023`; 62 code pairs; a zero for a non-`zeroAllowed` code
(omitted and reported); a zero for 080 in a family company (written); an unknown country; `-88` on
code 420; a file with LF endings (parse ok); a file with one byte missing on line 3
(`parse.lineLength` at line 3); 9999 with a wrong count; a 2200 record before its 2000; a 2-digit
phone prefix on the numeric field 822 (padding as specified).

### 13.8 Manual verification on shopcn (gate for P1–P4)

1. Generate the golden file and save the bytes unchanged (`.txt`).
2. Upload to <https://secapp.taxes.gov.il/shopcn>; record the result in `VERIFICATION.md`.
3. If rejected, record the message, fix the encoder default (§15) and repeat. Never edit the golden
   file by hand.

### 13.9 CI

`.github/workflows/opcn1214-generator-test.yml`: Node 22/24/26, `yarn install --immutable`,
`typecheck` (src + tests + scripts via `tsconfig.typecheck.json`), `build` (lint + bob), `test`.
Locally use the package scripts (`yarn workspace @accounter/opcn1214-generator test --run`); the
root `yarn test` also runs these tests but its global setup needs Postgres. Tests that read files
(SPEC.md, CSVs, goldens) resolve paths with `new URL(…, import.meta.url)` because the root runner
uses the repository root as working directory.

---

## 14. Tax-year versioning

- `src/layout/registry.ts` maps `taxYear → YearLayout`. `supportedTaxYears()` returns the keys.
- **2024** is generated from `documentation/layout/2024/`.
- **2025** re-exports the 2024 layout with `taxYear: 2025` until SHAAM's 2025 specification is
  added. Known year-sensitive text: the 3065/3066 withholding-status values describe the halves of
  the tax year (the 2024 text says "January–June 2024"); the turnover threshold printed at 834
  (₪256,410) is informational only (not validated).
- **Adding a year** (e.g. when the 2025 PDF is published):
  1. Save the PDF to `documentation/specifications/1214-<year>.pdf`.
  2. `python3 documentation/tools/extract_layout.py extract <pdf> /tmp/raw.json`
  3. Copy `layout/<prev>/` to `layout/<year>/`, then
     `python3 documentation/tools/extract_layout.py diff /tmp/raw.json documentation/layout/<year>`
     and reconcile every difference in the CSVs (add `key`/`kind`/`values` for new fields/codes; the
     "שינויים ב-<year>" column marks what changed).
  4. `yarn workspace @accounter/opcn1214-generator generate:layout`; register the year.
  5. Add golden files for the year; verify on shopcn; add a changeset (minor).

---

## 15. Ambiguity register

Decisions are the defaults implemented; "verify" items must be confirmed on shopcn (§13.8) in the
phase noted, and this table updated with the outcome.

| ID   | Topic                                                          | Spec says                                                                                                                          | Decision                                                                                                   | Verify    |
| ---- | -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | --------- |
| A-1  | Alphanumeric padding side                                      | p.61: "alphanumeric — when not full, pad spaces **on the left**"                                                                   | Spaces on the left (right-aligned text). One constant controls it.                                         | P1        |
| A-2  | 1000@949 percentage                                            | Type alphanumeric, length 5; "stored ×100, 10.23% → 1023"                                                                          | `1023`, alphanumeric padding (→ ` 1023` under A-1)                                                         | P1        |
| A-3  | 1020@199/204/209 percentages                                   | Type numeric, length 5; "10.23% → 10.23; 100% → 00100"                                                                             | Integers zero-padded; decimals `toFixed(2)` zero-padded (`05.50`); `.` allowed in these fields only        | P1        |
| A-4  | 2000 code value width                                          | p.26 text "amount of 13 positions"; the code table gives 12 for every code                                                         | 12 (table)                                                                                                 | P3        |
| A-5  | Line separator                                                 | Not stated                                                                                                                         | CRLF after every record, including the last                                                                | P1        |
| A-6  | Character encoding                                             | Not stated                                                                                                                         | windows-1255 (siblings' convention for SHAAM files)                                                        | P1        |
| A-7  | Appendix number vs "מספר בתל"ם"; record order of capital gains | Appendix number "running number of the appendix (1,2,3…)"; תל"ם number "running number by the order the capital gains were filled" | Appendix number per symbol; תל"ם number global; records grouped by type ascending                          | P4        |
| A-8  | 3060/3065 field 145 values                                     | Lists only "2 - no" (3064 lists "1 - yes")                                                                                         | Yes/no {1, 2} for all three                                                                                | P4        |
| A-9  | 2000 section start                                             | p.27 "starts at position 1061"                                                                                                     | 1161 (137 + 1024; matches every 30xx record)                                                               | P3        |
| A-10 | Section zero-fill side for 2000/30xx                           | 1000: zeros "on the right"; others unspecified                                                                                     | Zeros after the last entry for all sections                                                                | P3        |
| A-11 | 3077 code 092 (length 1)                                       | No allowed values given                                                                                                            | Single digit 0–9 (`num`)                                                                                   | P4        |
| A-12 | 1000@960 "total number of appendices"                          | "all appendices transmitted and not transmitted" — which appendix kinds is unclear                                                 | Caller-supplied; warning only (`main.appendixTotal.min`)                                                   | —         |
| A-13 | 1000@877 kibbutz                                               | "required in the case of a kibbutz and when field 226 is filled"                                                                   | `isKibbutz` requires code 226; 226 = 9 with `isKibbutz` is a warning                                       | —         |
| A-14 | 9999@143 foreign appendix                                      | Length 2, "1 – if a foreign appendix exists"                                                                                       | `01` / `00`                                                                                                | P3        |
| A-15 | Dividend rights total                                          | "dividend rights of all shareholders should add up to 100%"                                                                        | Enforced (E) only when at least one shareholder states dividend rights                                     | —         |
| A-16 | Country table completeness                                     | Appendix is "an initial table; follow official publications for updates"                                                           | Unknown codes rejected; update `countries.csv` when SHAAM publishes changes                                | P3        |
| A-17 | 834 turnover threshold                                         | Label includes "above ₪256,410"                                                                                                    | Not validated (the package has no turnover input)                                                          | —         |
| A-18 | 3065/3066 withholding status for 2025                          | Values describe January–June / July–December **2024**                                                                              | Interpreted as the halves of the report's tax year                                                         | 2025 spec |
| A-19 | Phone-prefix field types                                       | 493/503 alphanumeric; 822 numeric — same value list                                                                                | Follow each field's type for padding (` 02` vs `002` for a 2-digit prefix)                                 | P1        |
| A-20 | Absent optional yes/no                                         | Not stated                                                                                                                         | `0`                                                                                                        | P1        |
| A-21 | 1091 amortization amount                                       | Type alphanumeric; "0 may be entered"                                                                                              | Digits with alphanumeric padding (`amountX`); 0 is written as `0`                                          | P1        |
| A-22 | Code order in sections                                         | Not stated                                                                                                                         | Ascending code order                                                                                       | P1        |
| A-23 | Data provenance, 3051 header                                   | The PDF table on p.39 lost the position column during extraction                                                                   | Positions 137/139/142/192/193/194/224 taken from the PDF text layer and verified to chain with the lengths | —         |

---

## Appendix A — Layout data files

See [`layout/README.md`](layout/README.md). Summary: `records.csv` (17 rows), `fields.csv` (270
header fields incl. fillers), `codes.csv` (260 codes: 1000 = 102, 2000 = 51, capital gains 107),
`countries.csv` (255). Extracted from the PDF with `tools/extract_layout.py` and cross-checked
against the earlier hand-typed JSON: they agree on all positions and lengths except known defects in
that JSON (off-by-one positions at 1000@613, 2200@140 and the whole 9999 record; 3065 filler 837 vs
834; two 3050 dates wrongly optional).

## Appendix B — Accounter integration notes (follow-up, non-normative)

Findings from `main` that the follow-up server work will need:

- Annual-audit workflow: `packages/client/src/components/screens/operations/annual-audit/index.tsx`
  — step 6 "Add Shareholders Data (1214)" links to routes that do not exist; step 18 "Generate 1214
  Report" links to `/reports/1214` (missing); step 19 compares 1214 tax expenses with the ledger.
- The closest pattern is the 6111 report:
  `packages/server/src/modules/reports/helpers/shaam6111.helper.ts`
  - `resolvers/shaam6111.resolver.ts`, which returns the file content over GraphQL.
- Available data: `calculateTaxAmounts` in
  `packages/server/src/modules/reports/helpers/tax.helper.ts` (taxable income, tax expense),
  corporate tax rates (`corporate-taxes` module), business identity and addresses (`businesses` /
  `AdminBusiness`: government ID, withholding and advances file IDs), foreign revenue by country
  (`annualRevenueReport`), securities gains (`foreign-securities`, `securities-semi-annual-report`).
- Missing data: shareholders with ownership percentages (no table), related companies, R&D
  investments, the declaration flags of record 1000, advance-payment and withholding totals. These
  need a per-year "1214 profile" store and UI before step 18 can be automated.

## Appendix C — Glossary

| Hebrew                   | English used here                           |
| ------------------------ | ------------------------------------------- |
| מספר תיק                 | file number (tax file)                      |
| תיק ניכויים              | withholding file                            |
| המסייע/ת במילוי הדו"ח    | preparer                                    |
| חברה משפחתית / חברת בית  | family company / house company              |
| מפעל מוטב / מועדף        | beneficiary / preferred enterprise          |
| עמדה חייבת בדיווח        | reportable position (form 1346)             |
| נספח חו"ל                | foreign appendix                            |
| נספח רווח הון / סמל עסקה | capital-gains appendix / transaction symbol |
| מספר בתל"ם               | sequence number                             |
| יתרות הוצאות השבחה       | improvement-expense balances                |
| מנכה                     | withholding agent                           |
| הפסדים להעברה            | losses carried forward                      |
| פרטים כלליים (כותרת)     | header                                      |
| קוד סכום                 | code-amount section                         |
| רשומת בקרה               | control record                              |
