# TODO Checklist for `opcn1214-generator` Project

This `todo.md` provides a comprehensive checklist, combining the high-level blueprint and the
detailed section-plan for ingesting detailed specs for each record (1000, 1010, … 9999). Use it as a
guide and mark tasks as done (`- [x]`) when completed.

---

## 1. Project Scaffolding & Tooling

- [x] **Initialize repository & basic config**
  - [x] `git init`
  - [x] Create `package.json` with:
    - name: `opcn1214-generator`
    - version: `0.1.0`
    - description, keywords, license MIT, repository placeholder.
  - [x] Install dependencies:
    - `zod`, `date-fns`
  - [x] Install devDependencies:
    - `typescript`, `ts-node`, `vitest`, `@types/node`, `eslint`, `eslint-config-prettier`,
      `prettier`, `eslint-plugin-import`, `eslint-plugin-vitest`, `typedoc`, Rollup plugins (later).
  - [x] Create `tsconfig.json`:
    - target ES2022, module ESNext, declaration true, resolveJsonModule true, strict mode, outDir
      `dist`, rootDir `src`.
  - [x] Configure ESLint & Prettier:
    - `.eslintrc.js` integrating TypeScript rules + Prettier.
    - `.prettierrc` default.
  - [x] Setup Vitest:
    - `vitest.config.ts` for Node environment.
  - [ ] Create directory structure:
    - `src/` with subfolders:
      - `config/`
      - `schemas/`
      - `types/`
      - `parser/`
      - `generator/`
      - `validator/`
      - `utils/`
    - `src/constants.ts`
    - `src/index.ts`
    - `tests/` with:
      - `unit/`
      - `integration/`
      - `fixtures/`
  - [ ] Add basic `README.md` stub explaining purpose.
  - [ ] Add `.gitignore` (`node_modules/`, `dist/`, coverage, etc.).
  - [ ] Setup GitHub Actions CI:
    - `.github/workflows/ci.yml` to run lint, type-check, tests on push/PR.
  - [ ] (Optional) Setup Husky or pre-commit hooks for linting/formating.

---

## 2. Spec Ingestion Pipeline

> **Goal**: Systematically convert official spec docs into validated JSON for each record type, per
> tax year.

### 2.1. Spreadsheet / CSV Preparation

- [ ] For each record type (1000, 1010, 1020, …, 9999):
  - [ ] Create a spreadsheet (Excel/Google Sheets) or CSV with columns:
    - `recordType` (e.g., `1000`)
    - `fieldCode` (e.g., `1000_01`)
    - `fieldName` (e.g., `taxpayerId`)
    - `start` (position index; decide 0-based or 1-based, be consistent)
    - `length` (number of characters)
    - `type` (`string` | `number` | `date`)
    - `required` (`yes`/`no` or boolean)
    - `format` (e.g., `"ddMMyyyy"`, `"numeric(8,2)"`; optional)
    - `padding` (`left` | `right`; optional)
    - `rtl` (`yes`/`no`; optional)
    - `enumValues` (comma-separated list if any; optional)
    - `defaultValue` (e.g., `"0"`, `" "`; optional)
    - `description` (textual description from spec)
    - `businessRules` (notes on inter-field or cross-record logic; optional)
  - [ ] Fill in rows from official spec document.
  - [ ] Review with domain experts/accountants; iterate until confident.

### 2.2. CSV-to-JSON Conversion Script

- [ ] Write a script (`scripts/spec-csv-to-json.ts` or similar) that:

  - [ ] Reads CSV(s) for each record type for a given year.
  - [ ] Parses columns into appropriate types:
    - Convert `start`, `length`, `minOccurs`, `maxOccurs` to numbers.
    - Map `yes`/`no` to boolean for `required`, `rtl`, `repeatable`.
    - Parse `enumValues` into string arrays.
  - [ ] Validates that:
    - `start` ≥ 0, `length` > 0.
    - `start + length` ≤ declared `recordLength`.
    - Fields do not overlap inadvertently (detect overlapping ranges).
  - [ ] Outputs JSON files:
    - Individual `recordXXXX.json` for each record type, or directly combine to one `2024.json`.
  - [ ] Place outputs under `src/config/2024/` or `src/config/2024.json`.

- [ ] Commit both CSV/spreadsheet templates and generated JSON to version control.
- [ ] Document usage: how to update spreadsheets and re-run conversion.

### 2.3. Spec JSON Structure & Validation

- [ ] Define TypeScript interfaces in `src/types/spec.ts`:
  ```ts
  export interface SpecField {
    fieldCode: string;
    fieldName: string;
    start: number;
    length: number;
    type: "string" | "number" | "date";
    required: boolean;
    format?: string;
    rtl?: boolean;
    enumValues?: string[];
    defaultValue?: string | number | null;
    padding?: "left" | "right";
    description?: string;
    businessRules?: string[]; // optional notes
  }
  export interface RecordSpec {
    recordType: string;
    recordLength: number;
    repeatable: boolean;
    minOccurs?: number;
    maxOccurs?: number;
    orderIndex: number;
    description?: string;
    fields: SpecField[];
    placeholderIfEmpty?: boolean; // optional: generate placeholder if no entries
  }
  export interface YearSpec {
    year: number;
    records: RecordSpec[];
  }
  ```

* [ ] In `src/config/loader.ts`, implement:

  - [ ] A Zod schema for `YearSpec`, `RecordSpec`, `SpecField`.
  - [ ] Function `getYearSpec(year: number): YearSpec`:

    - Dynamically import or read JSON (e.g., `import spec2024 from '../config/2024.json'`).
    - Parse through Zod to validate shape; if invalid, throw descriptive error.
    - Return validated `YearSpec`.

  - [ ] Handle unsupported year: throw error with code `TAX_YEAR_NOT_SUPPORTED`.
  - [ ] (For browser bundling) maintain a static map:

    ```ts
    import spec2024 from '../config/2024.json';
    // import spec2025 from '../config/2025.json'; // when available
    const specMap: Record<number, YearSpec> = {
      2024: spec2024 as YearSpec,
      // 2025: spec2025 as YearSpec,
    };
    export function getYearSpec(year: number): YearSpec { ... }
    ```

* [ ] Write unit tests in `tests/unit/config-loader.spec.ts`:

  - [ ] Loading supported year returns correct structure.
  - [ ] Loading unsupported year throws appropriate error.

* [ ] Create documentation `SPEC_DEFINITION.md`:

  - [ ] Explain JSON file structure, each field in `SpecField` and `RecordSpec`.
  - [ ] Instructions for adding/updating spec JSON.
  - [ ] Example snippet.

---

## 3. Schema Generation from Spec JSON

> **Goal**: Generate Zod schemas and TS types for each record automatically, based on spec JSON.

### 3.1. Script to Generate Schemas

- [ ] Create `scripts/generate-schemas.ts`:

  - [ ] Input: year (e.g., CLI arg or config); load `YearSpec` via loader.
  - [ ] For each `RecordSpec` in `yearSpec.records`:

    - [ ] Build Zod schema definitions for each field:

      - If `type === 'string'`:

        - `z.string()`
        - `.max(length)` to enforce max length in structured input.
        - If `required === false`, use `.optional()`.
        - If `enumValues` present: `.refine(val => enumValues.includes(val), { ... })`.
        - Optionally `.transform()` or `.refine()` to normalize/truncate? Better: accept shorter
          strings, but ensure `.length <= spec.length`.

      - If `type === 'number'`:

        - Base: `z.number()`
        - If implicit decimals specified in `format` (e.g., `"numeric(8,2)"`), ensure schema expects
          a JS number; range check in business rules or here:

          - e.g., `refine(n => Number.isInteger(n * 100) && n >= 0 && n <= maxValue, ...)`.

        - If integer-only (`format: "numeric(n,0)"`), enforce integer.
        - If `required === false`, `.optional()`.

      - If `type === 'date'`:

        - Accept either `Date` object or ISO string? E.g.,
          `z.preprocess(val => parse string to Date, z.date())`.
        - Format: from `format` (e.g., `"ddMMyyyy"`); parsing logic in preprocess.
        - If optional, `.optional()`.

      - Additional refinements: disallow invalid characters via `.refine()`.

    - [ ] Generate a TypeScript file `src/schemas/record<recordType>.ts`:

      - Import Zod.
      - Export `record<recordType>Schema`.
      - Export `export type Record<recordType>Data = z.infer<typeof record<recordType>Schema>`.
      - Add comments above each field’s schema entry with `description` from spec.

  - [ ] After generation, optionally lint or format output files.

- [ ] Commit generated schema files.
- [ ] Write unit tests template for each generated schema:

  - For each field, tests for:

    - Accepting a minimal valid value (e.g., empty string if allowed, zero for number).
    - Rejecting too-long string.
    - Rejecting invalid enum value.
    - For date: invalid format string.

  - The script could generate test stubs with placeholders, then developer fills in example values.
    Alternatively, if spec JSON includes sample valid/invalid examples in metadata, generate real
    tests automatically.

### 3.2. Integration in Build

- [ ] Add a script in `package.json`: `"generate-schemas": "ts-node scripts/generate-schemas.ts"`.
- [ ] Document that whenever spec JSON changes, run this script.
- [ ] Add CI check: if spec JSON changed, developer must run schema generation and commit updated
      schema files; CI can detect uncommitted changes by running the script and diff.

---

## 4. Generic Parser/Generator Utilities

> **Goal**: Provide reusable functions that parse or format a field given its `SpecField`, so
> per-record code is minimal.

### 4.1. Parsing Utilities

- [ ] In `src/utils/parserUtils.ts`, implement:

  - `function parseField(raw: string, spec: SpecField, year: number): { value: any; error?: ParseError }`

    - Steps:

      - If spec.rtl: call `stripRTL(raw)`.
      - Trim whitespace (e.g., `.trim()` or `.trimEnd()`).
      - If empty and `required === false`: return `{ value: undefined }` or `null`.
      - If `type === 'string'`: return the trimmed string; optionally normalize Unicode (NFC).
      - If `type === 'number'`:

        - If `format` indicates implicit decimals: parse raw as integer, then divide by
          10^decimalPlaces.
        - Else parse raw as integer or float.
        - If NaN: return a ParseError with code `INVALID_FORMAT`.

      - If `type === 'date'`:

        - If trimmed empty and optional: return `{ value: undefined }`.
        - Use date-fns `parse` with `spec.format`; if invalid or out-of-range: return ParseError.

      - If `enumValues` present: check membership; if invalid: return ParseError.
      - Return `{ value }`.

  - `function parseRecord(line: string, recordSpec: RecordSpec, lineNumber: number, year: number): { data?: RecordType; errors: ParseError[] }`

    - For each `SpecField` in `recordSpec.fields`:

      - Extract `raw = line.slice(field.start, field.start + field.length)`.
      - Call `parseField(raw, field, year)`.
      - Collect `value`s into an object keyed by `fieldName`.
      - Collect any parse errors.

    - After raw parsing, if no parse-format errors:

      - Call the corresponding Zod schema `record<recordType>Schema.safeParse(parsedObj)`.
      - Translate Zod issues via `zodErrorToValidationErrors(...)`, adding to errors.

    - Return `data` if no errors, or `errors`.

- [ ] In `src/utils/rtl.ts`, implement:

  - `function injectRTL(value: string): string`:

    - Wrap with RLE/PDF or RLI/PDI as appropriate: e.g., `\u202B${value}\u202C`.

  - `function stripRTL(raw: string): string`:

    - Remove unicode bidi control chars (`\u202A–\u202E`, etc).

- [ ] In `src/utils/formatUtils.ts`, implement:

  - `function formatField(value: any, spec: SpecField, year: number): { text: string; error?: GenerateError }`

    - If value is undefined or null:

      - If `required`, either use `spec.defaultValue` or error if no default.
      - Else use default filler: spaces or zeros depending on `type` or `defaultValue`.

    - If `type === 'string'`: ensure value is string, normalize Unicode, check length ≤ spec.length;
      if spec.rtl, wrap with `injectRTL`.
    - If `type === 'number'`:

      - If format implies decimals: multiply value by 10^decimalPlaces, ensure integer, pad left
        with zeros or spaces per spec.padding.
      - If integer-only: ensure integer, pad.
      - If out-of-range or too-large: return GenerateError.

    - If `type === 'date'`:

      - If value is Date or string: parse/validate then format with date-fns
        `format(value, spec.format)`.
      - If missing and optional: use default filler.

    - After formatting to `str`, measure length:

      - If spec counts characters: `str.length === spec.length`.
      - If spec counts UTF-8 bytes: `Buffer.byteLength(str, 'utf8') === spec.length`. (Decide based
        on spec; implement appropriate check.)

    - Pad to exact length:

      - Use `padLeft` or `padRight` utility.

    - Return `{ text: paddedStr }`.

- [ ] In `src/utils/padding.ts`, implement:

  - `function padLeft(str: string, length: number): string`
  - `function padRight(str: string, length: number): string`
  - If `str` longer than `length`, throw or return error for generator to catch.

- [ ] Write unit tests for all utility functions in `tests/unit/utils/`.

  - [ ] Test parsing of numbers with implicit decimals.
  - [ ] Test formatting of numbers back to fixed-width.
  - [ ] Test date parse/format roundtrip.
  - [ ] Test RTL injection/stripping.
  - [ ] Test padding behavior with ASCII and Hebrew.

---

## 5. Schema Files & TS Types

> **Goal**: For each record type, have a Zod schema and TS type file, generated from spec JSON.

### 5.1. Schema Generation

- [ ] Run `scripts/generate-schemas.ts` for tax year 2024.
- [ ] For each `recordType`:

  - [ ] Generate `src/schemas/record<recordType>.ts`:

    - Import Zod.
    - Build `record<recordType>Schema` using spec JSON:

      - Map each `SpecField` to a Zod entry: string, number, date, optionality, enum checks,
        refinements for numeric precision if possible.

    - Export `export const record<recordType>Schema`.
    - Export `export type Record<recordType>Data = z.infer<typeof record<recordType>Schema>`.

  - [ ] Add comments with `description` for each field.

- [ ] Review generated schema files for correctness; adjust generation logic if needed.
- [ ] Commit schema files.

### 5.2. Schema Validation Helpers

- [ ] In `src/validator/zodHelpers.ts`, implement:

  - Function
    `zodErrorToValidationErrors(zError: ZodError, recordType: string, recordIndex?: number): ValidationError[]`:

    - Map each issue:

      - Determine `field` path from `issue.path` (join path segments).
      - Map error type: if issue.code is `too_big` or `too_small`, code `INVALID_RANGE`; pattern
        mismatch `INVALID_FORMAT`; missing required `REQUIRED_FIELD`.
      - Include `message`, `code`, `recordType`, optionally `recordIndex`.

- [ ] Unit tests in `tests/unit/validator-zodHelpers.spec.ts`.

---

## 6. Parser & Generator for Each Record Type

> **Goal**: Implement per-record parser/generator that uses generic utilities.

### 6.1. Generic Approach

- [ ] In `src/parser/recordParserFactory.ts` (or similar), implement:

  - `function createRecordParser(recordSpec: RecordSpec): (line: string, lineNumber: number, year: number) => { data?: any; errors: ParseError[] }`

    - Uses `parseField` for each field in `recordSpec.fields`.
    - After building `parsedObj`, call corresponding Zod schema.

- [ ] In `src/generator/recordGeneratorFactory.ts`, implement:

  - `function createRecordGenerator(recordSpec: RecordSpec): (data: any, year: number) => { text?: string; errors: GenerateError[] }`

    - Uses `formatField` for each field.

- [ ] For record-specific modules:

  - [ ] In `src/parser/record1000Parser.ts`: import `YearSpec`, get `recordSpec` for “1000”, then
        export `parseRecord1000 = createRecordParser(recordSpec)`.
  - [ ] Similarly for generator: `generateRecord1000`.

- [ ] Repeat for other record types. These modules simply wire generic factories to record-specific
      specs.

### 6.2. Tests for Each Record

- [ ] For each record type:

  - [ ] Write unit tests in `tests/unit/parser-record<recordType>.spec.ts`:

    - Valid sample line → expected object.
    - Invalid sample line (wrong length, invalid chars) → expected ParseError with correct details.

  - [ ] Write unit tests in `tests/unit/generator-record<recordType>.spec.ts`:

    - Valid object → expected fixed-width line; assert
      `Buffer.byteLength(line,'utf8') === recordLength`.
    - Invalid object → GenerateError.

  - [ ] Roundtrip test: generate → parse → object deep-equals original (taking normalization into
        account).

- [ ] Use fixture samples in `tests/fixtures/<year>/record<recordType>-valid.txt` and corresponding
      JSON in `tests/fixtures/<year>/record<recordType>-valid.json`.

---

## 7. Business-Rule Validation

> **Goal**: Enforce inter-field and cross-record rules after schema validation.

### 7.1. Record-Level Business Rules

- [ ] For each `RecordSpec` with known business rules:

  - [ ] Create module `src/validator/record<recordType>Validation.ts` exporting:

    - `function validateRecord<recordType>Business(data: Record<recordType>Data, year: number): ValidationError[]`

  - [ ] In module header or comments, list the `businessRules` notes from spec JSON.
  - [ ] Implement checks using date-fns, numeric comparisons, conditional presence, enum
        dependencies.
  - [ ] Unit tests in `tests/unit/validator-record<recordType>.spec.ts`: cover each rule violation
        and valid cases.

### 7.2. Cross-Record Business Rules

- [ ] In `src/validator/reportBusinessValidation.ts` or similar:

  - `function validateCrossRecordBusiness(reportData: ReportData, year: number): ValidationError[]`

    - Examples:

      - Sum of shareholder percentages = 100.
      - If R\&D entries exist, mainForm flag must be true.
      - If foreignIncomes present, foreignAppendix must be present.
      - Capital gains appendices totals match mainForm summary.
      - Max/min occurrences enforced (but some from schema layer).

  - [ ] Unit tests in `tests/unit/validator-crossRecord.spec.ts`.

- [ ] In `src/validator/index.ts`, after schema-level validation, call record-level business
      validators, then cross-record validator.

---

## 8. Core API Orchestration: parse(), generate(), validate()

> **Goal**: Implement the main library functions, driven by spec metadata.

### 8.1. Record Ordering & Occurrence

- [ ] In orchestration, load `YearSpec`:

  - `const yearSpec = getYearSpec(year);`
  - Sort `yearSpec.records` by `orderIndex`.

- [ ] Build a map of `recordType` → `RecordSpec`.

### 8.2. parse(reportText: string, year: number): ParseResult

- [ ] Split `reportText` by CRLF (`\r\n`), ignore empty trailing lines.
- [ ] Initialize an object to accumulate sections: e.g., `mainForm`, arrays for repeatables.
- [ ] Track current expected order index:

  - [ ] For each line (with lineNumber):

    - Extract recordType substring: use `recordSpec`’s designated positions (from spec JSON: often
      at fixed offsets).
    - If unknown recordType: add ParseError.
    - Retrieve its `orderIndex` from `RecordSpec`.
    - If `orderIndex` < last processed orderIndex and record is not allowed to repeat here: add
      ParseError (out-of-order).
    - Call `parseRecord<recordType>(line, lineNumber, year)`.
    - If errors: collect ParseErrors.
    - Else: append to appropriate property in `ReportData` under `recordType`.
    - Update last processed orderIndex accordingly.

- [ ] After all lines:

  - [ ] Check for required sections: `mainForm` present; repeatable sections meeting `minOccurs`.
  - [ ] If missing: add ParseError(s).

- [ ] Return:

  - If any errors: `{ success: false, errors: ParseError[] }`.
  - Else `{ success: true, data: ReportData }`.

### 8.3. generate(data: ReportData, year: number): GenerateResult

- [ ] Call `validate(data, year)` (structured path). If invalid: return
      `{ success: false, errors }`.
- [ ] Load `YearSpec`, sort records by `orderIndex`.
- [ ] For each `RecordSpec` in order:

  - If recordType = 1000: call `generateRecord1000(data.mainForm, year)`.
  - If repeatable record (e.g., 1010): for each entry in `data.relatedCompanies`:

    - Call `generateRecord1010(item, year)`; collect lines.
    - If array empty:

      - If `placeholderIfEmpty`: generate a default placeholder line using defaultValue from spec
        JSON.
      - Else: skip.

  - For non-repeatable optional record: if data present: generate; else if placeholderIfEmpty:
    generate placeholder; else skip.

- [ ] Append end record 9999: `generateRecord9999({}, year)`.
- [ ] Join lines with `\r\n`.
- [ ] Return `{ success: true, reportText }` or capture any GenerateErrors.

### 8.4. validate(input: ReportData | string, year: number): ValidationResult

- [ ] If `typeof input === 'string'`: call `parse(input, year)`.

  - If parse fails: return `{ isValid: false, errors: parseErrors }`.
  - Else: set `data = parsedData`.

- [ ] If structured object:

  - [ ] For each record section in `data`:

    - For mainForm: `record1000Schema.safeParse(data.mainForm)` → zod errors → translate to
      ValidationError.
    - For each repeatable entry: `recordXXXXSchema.safeParse(...)`.

  - [ ] Collect all schema-based errors.
  - [ ] Call record-level business validators for each section.
  - [ ] Call cross-record business validator.

- [ ] Return `{ isValid: errors.length === 0, errors }`.

### 8.5. Types & Exports

- [ ] Define types in `src/types/errors.ts`:

  ```ts
  export interface ValidationError {
    field: string;
    message: string;
    code: string;
    recordType: string;
    recordIndex?: number;
    value?: any;
    expected?: string;
  }
  export interface ParseError extends ValidationError {
    lineNumber: number;
    position?: number;
  }
  export interface GenerateError extends ValidationError {
    // no extra fields or reuse same shape
  }
  export interface ValidationResult {
    isValid: boolean;
    errors: ValidationError[];
  }
  export interface ParseResult {
    success: boolean;
    data?: ReportData;
    errors?: ParseError[];
  }
  export interface GenerateResult {
    success: boolean;
    reportText?: string;
    errors?: GenerateError[];
  }
  ```

- [ ] In `src/index.ts`, export:

  ```ts
  export { parse } from "./parser";
  export { generate } from "./generator";
  export { validate } from "./validator";
  export type {
    ReportData,
    ValidationError,
    ParseError,
    GenerateError,
    ParseResult,
    GenerateResult,
    ValidationResult,
  } from "./types/errors";
  ```

- [ ] Write unit tests for orchestration in `tests/unit/parser-index.spec.ts`,
      `generator-index.spec.ts`, `validator-index.spec.ts`.

---

## 9. Optional Sections Implementation

> **Goal**: Gradually add optional sections (1030, 2000, 2200, 3027–3077) following same pattern.

For each record type `<XXXX>` in optional sections:

- [ ] Ensure spec JSON for year includes the record spec with correct fields, `repeatable`,
      `minOccurs`, `maxOccurs`, `orderIndex`, `placeholderIfEmpty` if needed.
- [ ] Run schema generation script to produce `src/schemas/record<XXXX>.ts`.
- [ ] Ensure generic parser/generator utilities handle the new spec.
- [ ] Create or update modules:

  - `src/parser/record<XXXX>Parser.ts`: wire generic parser to spec.
  - `src/generator/record<XXXX>Generator.ts`: wire generic generator.
  - `src/validator/record<XXXX>Validation.ts`: implement business rules (field-level or
    inter-record).

- [ ] Write unit tests:

  - Schema tests: valid/invalid structured data.
  - Parser tests: sample line(s).
  - Generator tests: sample object → line; byte-length check.
  - Validation tests: business-rule violations.

- [ ] Integrate in orchestration: ensure parse/generate picks up new record in correct order.
- [ ] Write integration fixture for a “full example” including this section.
- [ ] Cross-record rules: if applicable (e.g., R\&D presence implies mainForm flag).
- [ ] Update documentation to mention new optional section.
- [ ] Repeat for each optional section.

---

## 10. Utilities & Byte-Length Considerations

- [ ] Decide how field length is measured:

  - [ ] Character count (`string.length`) or UTF-8 byte count (`Buffer.byteLength(str,'utf8')`)?
        Confirm with spec.

- [ ] In utilities:

  - [ ] If byte-length measurement: implement functions that measure and pad based on byte-length;
        handle multibyte characters (Hebrew) carefully.
  - [ ] Unit tests with Hebrew characters to confirm correct behavior.

- [ ] In parser/generator tests, always assert that generated lines satisfy exact byte-length =
      `recordLength`.
- [ ] Document assumptions clearly in comments and README.

---

## 11. Tax-Year Versioning & Configuration

- [ ] Maintain separate spec JSON files per supported year: `src/config/2024.json`,
      `src/config/2025.json`, …
- [ ] In `src/config/taxYearConfig.ts`, define:

  - Interface `TaxYearConfig`:

    ```ts
    export interface TaxYearConfig {
      year: number;
      maxRecords: {
        relatedCompanies: number;
        shareholders: number;
        rdInvestments: number;
        foreignIncomes: number;
        capitalGainsAppendices: number;
        // any other counts
      };
      // any year-specific flags or overrides
    }
    ```

  - Function `getTaxYearConfig(year: number): TaxYearConfig`

    - Throw if unsupported year.

- [ ] In business-rule validators, reference `getTaxYearConfig(year)` for count limits etc.
- [ ] In orchestration, check unsupported year early, return error code `TAX_YEAR_NOT_SUPPORTED`.
- [ ] Write unit tests in `tests/unit/config-taxYearConfig.spec.ts`.
- [ ] Document procedure to add new year:

  - Copy previous JSON, update fields.
  - Add new entry in static map or loader.
  - Update `taxYearConfig`.
  - Regenerate schemas, update tests/fixtures.

---

## 12. Integration Tests & Fixtures

> **Goal**: End-to-end tests that parse/generate full reports, roundtrip, and cover error cases.

### 12.1. Fixtures Preparation

- [ ] In `tests/fixtures/2024/`:

  - [ ] `minimal.json`: minimal valid `ReportData` object with only required fields (e.g., mainForm
        with required fields, one shareholder).
  - [ ] `minimal.txt`: expected generated text (fixed-width lines, CRLF).
  - [ ] `full.json`: `ReportData` including optional sections with sample values.
  - [ ] `full.txt`: expected full report text.
  - [ ] `invalid.json`: structured data missing required fields or violating business rules.
  - [ ] `invalid.txt`: raw text with out-of-order lines or malformed fields.

- [ ] If possible, include real-world anonymized examples.
- [ ] Optionally write a small script (`scripts/generate-fixtures.ts`) that uses spec JSON to
      auto-generate a minimal placeholder line (e.g., all zeros/spaces except required prefix) for
      each record; then assemble into minimal.txt. Developer can then adjust sample values as
      needed.

### 12.2. Integration Test Code

- [ ] In `tests/integration/integration-2024.spec.ts`:

  - **Generate Test**:

    - Load `minimal.json`.
    - Call `generate(minimalData, 2024)`.
    - Expect `success: true` and `reportText === minimal.txt`.

  - **Parse Test**:

    - Read `minimal.txt`.
    - Call `parse(reportText, 2024)`.
    - Expect `success: true` and `data` deep equals `minimal.json` (account for normalization: e.g.,
      trimmed strings; date objects vs ISO strings may need normalization in test).

  - **Roundtrip Test**:

    - Start with `minimal.json` → generate → parse → compare objects.

  - **Full Example Tests**: same for `full.json`/`full.txt`.
  - **Invalid Tests**:

    - Generate with `invalid.json`: expect `success: false`, specific errors.
    - Parse `invalid.txt`: expect parse errors.

- [ ] Add similar fixtures/tests for other supported years when available.
- [ ] In tests, use Node’s `fs` to read fixture files.
- [ ] Ensure CI fails if fixtures not matching actual output; update fixtures deliberately after
      spec changes.

---

## 13. Browser Bundling & Distribution

- [ ] Choose bundler: Rollup.
- [ ] Create `rollup.config.js`:

  - Input: `src/index.ts`.
  - Outputs:

    - ESM: `dist/opcn1214-generator.esm.js`, format `es`.
    - UMD: `dist/opcn1214-generator.umd.js`, format `umd`, name `opcn1214Generator`.
    - Optionally CJS build via tsc: `dist/cjs`.

  - Externalize dependencies (`zod`, `date-fns`) or bundle them? Decide and document.
  - Use `@rollup/plugin-typescript`, `@rollup/plugin-json` to include spec JSON for browser.
  - Source maps enabled.

- [ ] Modify loader to use static imports for spec JSON:

  ```ts
  import spec2024 from '../config/2024.json';
  const specMap = { 2024: spec2024 as YearSpec };
  export function getYearSpec(year: number): YearSpec { ... }
  ```

- [ ] Update `package.json`:

  - `"main"` → CJS entry (if provided).
  - `"module"` → ESM build path.
  - `"browser"` → UMD build path or use `"unpkg"` field.
  - `"types"` → `dist/index.d.ts`.
  - Scripts: `"build": "tsc && rollup -c"`.

- [ ] Create example HTML (`examples/browser.html`):

  - Include UMD bundle via `<script>`.
  - Demonstrate usage: `const result = opcn1214Generator.parse(...); console.log(result)`.

- [ ] Create Node script (`scripts/test-bundle.js`) to import built ESM/CJS modules and do a simple
      parse/generate test.
- [ ] CI: after build, run smoke test for bundle in Node environment.
- [ ] Document browser usage in README.

---

## 14. Documentation & Examples

- [ ] Add JSDoc comments in all public API functions (`parse`, `generate`, `validate`) and types
      (`ReportData`, error shapes).
- [ ] Create `typedoc.json`:

  - Entry point: `src/index.ts`.
  - OutDir: `docs`.
  - Exclude private/internal modules.

- [ ] Add script `"docs": "typedoc"` in `package.json`.
- [ ] Write comprehensive `README.md`:

  - Overview: purpose of `opcn1214-generator`.
  - Installation: `npm install opcn1214-generator`.
  - Basic usage:

    ```ts
    import { generate, parse, validate } from "opcn1214-generator";

    const reportText = "...";
    const result = parse(reportText, 2024);
    if (result.success) {
      console.log(result.data);
    } else {
      console.error(result.errors);
    }
    ```

  - Generating from structured data.
  - Validating structured data or raw text.
  - Error handling examples.
  - Browser usage: script tag example.
  - How to add new tax year: link to `SPEC_DEFINITION.md` and maintenance guide.
  - Contribution guidelines summary.
  - License.

- [ ] Write `SPEC_DEFINITION.md` detailing:

  - Structure of spec JSON.
  - Meaning of each property in `SpecField` and `RecordSpec`.
  - Steps to update spec JSON.

- [ ] Examples in `examples/`:

  - `examples/parse.ts`: Node script reading a sample text file, parsing, logging JSON.
  - `examples/generate.ts`: Node script constructing a sample `ReportData` object, generating text,
    writing to file.
  - Document how to run: `node -r ts-node/register examples/parse.ts`.

- [ ] Generate documentation site via TypeDoc and, if desired, publish to GitHub Pages.
- [ ] Add badges to README: build status, coverage, npm version.

---

## 15. CI/CD & Release Process

- [ ] GitHub Actions:

  - **CI Workflow** (`.github/workflows/ci.yml`):

    - On push/PR: `npm ci`, `npm run lint`, `npm run type-check`, `npm run test`,
      `npm run generate-schemas` (verify no diff), `npm run build`.

  - **Release Workflow** (`.github/workflows/release.yml`):

    - On tag (e.g., `v*.*.*`): `npm run build`, `npm run docs`, publish to npm using `NPM_TOKEN`
      secret, deploy docs to GitHub Pages.

- [ ] Semantic versioning:

  - Decide on commit conventions (Conventional Commits).
  - Optionally configure semantic-release.
  - Alternatively, manual version bump process documented.

- [ ] Coverage:

  - Enable Vitest coverage; enforce minimal threshold.
  - Publish coverage reports or display status badge.

- [ ] Dependabot/Security:

  - Configure Dependabot for dependency updates.

- [ ] Add badges (build, coverage, npm) in README.
- [ ] Document release checklist:

  - Ensure all tests passing.
  - Bump version.
  - Update changelog.
  - Publish to npm.
  - Tag in Git.
  - Merge docs changes.

- [ ] Write `CONTRIBUTING.md`:

  - How to open issues/PRs, code style, testing guidelines.
  - How to add new tax year, including updating spec JSON, regenerating schemas, updating
    tests/fixtures.

---

## 16. Maintenance & Adding New Tax Year

- [ ] Create `MAINTENANCE.md` or extend `CONTRIBUTING.md` with:

  - **Steps to add a new tax year**:

    1. Copy previous year’s spreadsheet CSV(s) to new year folder; update fields per official spec
       changes.
    2. Run CSV-to-JSON conversion script ⇒ generate `src/config/<newYear>.json`.
    3. Update static specMap or loader to include new year.
    4. Update `src/config/taxYearConfig.ts` with new year’s settings (maxRecords, flags).
    5. Run `npm run generate-schemas` to produce new `src/schemas/recordXXXX.ts` files for new year.
    6. Review generated schemas; adjust if needed.
    7. Update or add unit tests for any changed fields or new record types.
    8. Create integration fixtures in `tests/fixtures/<newYear>/`: minimal.json/txt, full.json/txt.
    9. Run all tests (`npm run test`) targeting new year; fix issues.
    10. Bump version in `package.json`; update README examples to reference new year where relevant.
    11. Commit changes, open PR, get review.
    12. Merge, publish release.

  - **Handling deprecations or field removals**:

    - How to mark fields removed in new year; update queries in code if conditional logic needed.

  - **Backward compatibility**:

    - If supporting multiple years concurrently, ensure loader and orchestration handle differences
      solely via spec JSON.

  - **Script to scaffold new year**:

    - Create `scripts/add-new-year.ts`:

      - Prompt for year.
      - Copy previous year spec JSON to new file, updating `"year"` field.
      - Add placeholder entry in specMap.
      - Add stub in `taxYearConfig`.
      - Remind developer to adjust fields and tests.

- [ ] Document commit message guidelines: “feat: add support for tax year YYYY”.
- [ ] Maintain a changelog template.

---

## 17. Testing & Quality Assurance

- [ ] Ensure thorough unit test coverage for:

  - Utility functions (padding, RTL, parse/format).
  - Schema validation for each record type.
  - Parser/generator for each record type.
  - Business-rule validators (record-level & cross-record).
  - Orchestration: parse/generate/validate API.

- [ ] Integration tests for full-report fixtures.
- [ ] Byte-length checks in generator tests.
- [ ] CI enforces that spec JSON changes trigger schema regeneration.
- [ ] Peer code reviews for:

  - Spreadsheet-to-JSON conversion logic.
  - Schema generation script.
  - Business-rule implementations.

- [ ] Automated linters and formatters enforced in CI.

---

## 18. Documentation of Assumptions & Open Questions

- [ ] Document assumptions about field length measurement:

  - Character count vs UTF-8 byte count.

- [ ] Document any unresolved ambiguities in spec:

  - E.g., how to handle negative values if spec unclear.
  - How to detect Hebrew vs Latin in strings (if needed).

- [ ] Track open questions in project issues or a `SPEC_NOTES.md`:

  - Clarify with domain experts/accountants.
  - Once clarified, update spreadsheet and regenerate JSON.

---

## 19. Continuous Spec Updates & Version Control

- [ ] Maintain versioned spreadsheets/CSVs under version control to track changes year-over-year.
- [ ] On official spec updates:

  - [ ] Update spreadsheet.
  - [ ] Run conversion script → update JSON.
  - [ ] CI validates JSON against Zod schema.
  - [ ] Regenerate schemas → update code/tests as needed.
  - [ ] Run full test suite; fix issues.
  - [ ] Update fixtures if necessary.
  - [ ] Release new version.

---

## 20. Checklist Summary

- **Project Setup**: scaffolding, linting, testing framework.
- **Spec Ingestion**: spreadsheet, CSV-to-JSON script, JSON validation.
- **Schema Generation**: automated Zod schema & TS type files.
- **Utilities**: generic parse/format, padding, RTL, date/number formatting (with byte-length
  handling).
- **Per-Record Modules**: parser/generator wiring using generic utilities.
- **Business Rules**: record-level & cross-record validations.
- **API Orchestration**: `parse`, `generate`, `validate`.
- **Optional Sections**: incrementally add each record type using same pattern.
- **Versioning**: spec per year, taxYearConfig, loader mapping.
- **Integration Tests & Fixtures**: minimal/full/invalid for each year.
- **Bundling & Distribution**: Rollup config, browser examples, package.json fields.
- **Documentation**: JSDoc, TypeDoc, README, SPEC_DEFINITION.md, examples.
- **CI/CD & Release**: GitHub Actions, semantic versioning, coverage enforcement.
- **Maintenance Guide**: procedures and scripts for new tax year support.
- **Assumptions & Questions**: document and resolve ambiguities.
- **Continuous Updates**: track spec changes, regenerate, test, release.
