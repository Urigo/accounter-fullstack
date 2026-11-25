# 1214 layout data

Machine-readable record layouts of the SHAAM 1214 OPCN file, one directory per tax year. These CSV
files are the **source of truth** for the package's layout code (`scripts/generate-layout.ts`
generates `src/layout/<year>/layout.generated.ts` from them, see `../SPEC.md` §5.3).

## Provenance (2024)

- Extracted from `../specifications/1214-2024.pdf` with `../tools/extract_layout.py` (pdfplumber
  table extraction, Hebrew restored to logical order).
- Verified: every record's header fields are contiguous from position 137 and end exactly at the
  header length; header + section lengths add up to the record length for all 17 record types.
- Cross-checked against the earlier hand-typed `src/config/2024.json` (branch `1214-generator`): all
  positions, lengths and the 102 main-form codes agree, except defects in that JSON (1000@613 and
  2200@140 off by one, the whole 9999 record shifted by one, 3065 filler 837 instead of 834, two
  3050 dates marked optional).
- Known extraction fixup: record 3051, page 39 — the PDF table lost its position column; positions
  137/139/142/192/193/194/224 were taken from the PDF text layer and verified to chain with the
  field lengths (`extractionNote` column). `extract_layout.py diff` reports exactly these 7 rows.
- Curated by hand: the `key`, `kind` and `values` columns, and the English record descriptions.

## Files

### `records.csv` — one row per record type

| Column          | Meaning                                                     |
| --------------- | ----------------------------------------------------------- |
| `record`        | Record type (`1000` … `9999`)                               |
| `order`         | Canonical order within a report                             |
| `description`   | English description                                         |
| `length`        | Total record length                                         |
| `prefixLength`  | Always 136 (form type 4 + record type 4 + 128 zeros)        |
| `headerStart`   | Always 137                                                  |
| `headerLength`  | Header length                                               |
| `sectionStart`  | Start of the code-amount / country-amount section, if any   |
| `sectionLength` | Section length, if any                                      |
| `sectionKind`   | `codeAmount` or `countryAmount`                             |
| `minOccurs`     | Minimum occurrences per report (1020: 1, except kibbutz)    |
| `maxOccurs`     | Maximum occurrences per report (capital gains: 14 in total) |

### `fields.csv` — one row per header field (fillers included)

| Column           | Meaning                                                                 |
| ---------------- | ----------------------------------------------------------------------- |
| `record`         | Record type                                                             |
| `position`       | 1-based start position, as printed in the spec                          |
| `length`         | Width in characters (= bytes in windows-1255)                           |
| `end`            | Last position (inclusive)                                               |
| `type`           | `numeric` / `alphanumeric` (spec: נומרי / אלפאנומרי)                    |
| `required`       | `yes`, `no` or `conditional` (spec: שדה חובה)                           |
| `requiredNote`   | Hebrew condition text when `conditional`                                |
| `key`            | Canonical key (`SPEC.md` §7.3); `(derived) …` = computed by the package |
| `kind`           | Semantic kind controlling validation and encoding (`SPEC.md` §4.2)      |
| `values`         | Allowed values: `;`-separated `n`, `n..m` or `n=label`                  |
| `nameHe`         | Field name (Hebrew, from the spec)                                      |
| `notesHe`        | Notes column (Hebrew, from the spec)                                    |
| `changes2024`    | "שינויים ב-2024" column (what changed this year)                        |
| `specPage`       | PDF page                                                                |
| `extractionNote` | Manual fixups made during extraction                                    |

### `codes.csv` — one row per code of a code-amount section

| Column                | Meaning                                                                         |
| --------------------- | ------------------------------------------------------------------------------- |
| `record`              | Record type (1000, 2000, 30xx)                                                  |
| `code`                | 3-digit code as written in the file (capital-gains code `15` → `015`)           |
| `length`              | Width of the value                                                              |
| `required`            | `yes`, `no` or `conditional`                                                    |
| `requiredNote`        | Hebrew condition text when `conditional`                                        |
| `kind`                | `amount`, `amountX100`, `rateX100`, `enum` or `num`                             |
| `values`              | Allowed values (same grammar as `fields.csv`)                                   |
| `zeroAllowed`         | `yes` when the spec says the value may be 0 (otherwise 0 means "omit the code") |
| `perCountryBreakdown` | 2000 only: `yes` when a 2200 record is required for a filled code               |
| `notesHe`             | Notes column (Hebrew)                                                           |
| `changes2024`         | "שינויים ב-2024" column                                                         |
| `specPage`            | PDF page                                                                        |

Code 3077 `501`–`505` are the five "code 50 – improvement N" entries ("שומרים קוד 50N").

### `countries.csv` — country codes for record 2200

`code` (spec code without zero padding; `-88` = country unknown, allowed only for 2000 code 439) and
`nameHe`. The spec calls this table "initial"; update it from official SHAAM publications.

## Updating for a new tax year

See `../SPEC.md` §14.
