## 1. High-Level Blueprint

### 1.1. Goals and Scope

- **Primary goal**: A TypeScript library (`opcn1214-generator`) for generating, parsing, and
  validating Israeli tax form 1214 reports in OPCN fixed-width format.
- **Core functions**:

  - `parse(reportText: string, taxYear: number): ParseResult`
  - `generate(data: ReportData, taxYear: number): GenerateResult`
  - `validate(input: ReportData | string, taxYear: number): ValidationResult`

- **Strong typing** via TypeScript interfaces and Zod schemas.
- **Strict validation**: field-level (types, lengths, formats) + business rules (cross-field,
  cross-record).
- **Normalization**: trimming, padding, RTL control injection for Hebrew text.
- **Tax-year versioning**: schemas and rules vary by year.
- **Modular architecture**: parser, generator, validator, utilities, schemas/config.
- **Testing**: unit tests for each piece; integration tests (roundtrip generate→parse→validate).
- **Tooling**: Node.js 24.2.0+ and modern browsers (bundle as ESM/UMD), Vitest for tests,
  ESLint/Prettier, TypeDoc for docs, GitHub Actions CI, semantic versioning.
- **No CLI**: library-only.
- **Deliverables**: library code, versioned schemas, tests, documentation, bundling configs,
  `package.json`, README.

### 1.2. Architectural Components

1. **Spec Definitions Loader**

   - A machine-readable representation (e.g., JSON) of each record type’s field definitions per tax
     year: field codes, positions (start/end or offset+length), types, format rules, allowed values
     if any.
   - This can serve to generate Zod schemas and parser/generator logic programmatically or
     semi-automatically.

2. **TypeScript Interfaces**

   - `ReportData`, sub-interfaces for each record type’s data object.
   - Derived types (unions, optional arrays).

3. **Zod Schemas**

   - For structured input validation: strict schemas per record type and overall `ReportData`.
   - Business rules beyond basic shape: implemented either in Zod refinements or in separate
     validation functions.

4. **Parser Module**

   - Reads OPCN fixed-width lines.
   - Uses spec definitions to slice substrings by positions, trim/pad as needed, parse types
     (numbers, dates).
   - Populates the data object shape matching interfaces.
   - Reports parsing errors with `ParseError` including lineNumber, recordType, field, code,
     message.

5. **Generator Module**

   - Given a valid `ReportData`, uses spec definitions to produce fixed-width lines: formatting,
     padding, RTL injection.
   - Auto-append `9999` end record.
   - Returns `GenerateResult` with `reportText` or structured errors if validation fails.

6. **Validator Module**

   - Two modes:

     - Validate structured `ReportData` object: run through Zod + business rules.
     - Validate raw text: run parser first, then structured validation.

   - Returns `ValidationResult` with `isValid` and array of `ValidationError`s.

7. **Tax Year Versioning**

   - A registry mapping tax years to spec definitions and rules.
   - On unsupported year: immediate error.

8. **Utilities**

   - Padding (left/right), date formatting (via date-fns), numeric formatting.
   - RTL control injection: for Hebrew fields (e.g., wrap with appropriate Unicode bidi marks).
   - Normalization helpers: trim whitespace, unify decimal separators if needed.

9. **Constants**

   - `RECORD_TYPES`, `FIELD_CODES`, `TAX_YEARS`, `VALIDATION_CODES`, etc.
   - Populated from spec definitions or manually maintained.

10. **Error Handling**

- Structured error objects: consistent shape, machine-readable codes, user-friendly messages.

11. **Testing Fixtures**

- Real-world anonymized examples (if available) and synthetic edge-case fixtures.
- Organize under `tests/fixtures/`.

12. **Build and Distribution**

- TS config for ESM and CJS builds.
- Bundler config (Rollup, esbuild, or similar) for browser UMD build.
- Type declarations.
- Source maps.

13. **Documentation**

- Auto-generate API docs via TypeDoc.
- README with overview, installation, usage examples, error code reference.
- Developer guide: how to add a new tax year, extend spec, shape of spec definitions.

14. **CI/CD**

- GitHub Actions: lint, type-check, tests on push/PR.
- Release workflow: semantic-release or manual version bump + npm publish.

15. **Project Setup & Tooling**

- `package.json`, dependencies (`zod`, `date-fns`), devDependencies (`typescript`, `vitest`,
  `eslint`, `prettier`, `ts-node`, `typedoc`).
- Directory structure:

  ```
  src/
    schemas/        # generated or hand-written Zod schemas
    types/          # TS interfaces if separate
    parser/
    generator/
    validator/
    utils/
    config/         # spec definitions per year
    constants.ts
    index.ts        # main exports
  tests/
    unit/
    integration/
    fixtures/
  ```

- Linting/prettier rules.
- Gitignore, commitlint, pre-commit hooks.

### 1.3. Overall Workflow

1. **Gather spec details**: Official Israeli Tax Authority spec for form 1214 OPCN. Obtain field
   definitions per record type for the initial tax year (e.g., 2024).
2. **Define spec JSON model**: Decide on a JSON schema to represent per-record-type metadata: field
   code, name, start position (0-based or 1-based?), length, type (`string`, `number`, `date`),
   required/optional, formatting rules, default values, allowed values/enums, RTL vs LTR flag.
3. **Scaffold project**: Initialize repository, TS config, lint/test tooling.
4. **Implement spec loader**: Read JSON definitions, surface TypeScript types for spec definitions
   (e.g.,
   `interface FieldSpec { code: string; name: string; start: number; length: number; type: 'string'|'number'|'date'; required: boolean; format?: string; rtl?: boolean; ... }`).
   Validate spec JSON at build time (e.g., via Zod or TS validation).
5. **Generate or hand-write Zod schemas**:

   - Option A: Write a generator that, given spec JSON, outputs Zod schema files for each record
     type.
   - Option B: Hand-write Zod schemas based on spec JSON.
   - Probably a hybrid: a script reads spec definitions and generates skeleton Zod schemas that can
     be manually reviewed.

6. **Implement TypeScript interfaces**: Mirror Zod schemas; can be inferred via `z.infer<>`.
7. **Parser for one record**: Start with record 1000 (main form). Write function to parse a single
   line into an object per spec JSON.
8. **Generator for one record**: Given structured object for record 1000, produce fixed-width line.
9. **Validation for one record**: Use Zod + any business logic (e.g., date range, numeric ranges).
10. **Tests for record 1000**: Unit tests: parse valid line → correct object; parse invalid line →
    correct errors; generate from valid object → expected line; generate invalid object → error.
11. **Expand to next record types**: E.g., 1010 (related companies), 1020 (shareholders). For each:
    spec JSON, Zod schema, parser, generator, validation, tests.
12. **Cross-record orchestration**: Write parse function that reads full text: split lines by CRLF,
    for each line detect record type, dispatch to parser, accumulate into `ReportData`. Enforce
    ordering rules (e.g., 1000 first, shareholders present).
13. **Cross-record validation**: After parsing, run business-rule validations: e.g., total
    shareholder percentage sum equals 100 (if relevant); record count limits; conditional
    requirements.
14. **Normalization & RTL**: Utilities to inject Unicode bidi controls around Hebrew text fields.
    Tests verifying correct insertion.
15. **Tax-year versioning**: Abstract spec loader to pick JSON definitions by year. Tests:
    unsupported year yields error. For supported year: parse/generate uses correct spec.
16. **Integration tests**: Roundtrip: structured object → generate → parse → validate yields same
    object (modulo normalization). Use fixture data.
17. **Browser bundling**: Configure bundler to produce minified ESM/UMD builds. Test in a minimal
    HTML page.
18. **Documentation**: Add TypeDoc comments in code; generate doc site or markdown. Write README
    with examples.
19. **CI/CD**: Setup GitHub Actions to lint, build, test, and publish docs.
20. **Release**: Version bump, npm publish, tag, changelog.
21. **Maintaining for new tax years**: Document procedure: update spec JSON for new year, run schema
    generator, add tests, bump version.

---

## 2. Iterative Chunks

Below are logical “chunks”—cohorts of related functionality—that build on each other. Each chunk
should result in a working state that is tested and integrated.

1. **Chunk 1: Project scaffolding & tooling**

   - Initialize repo, package.json, TS, lint, Prettier, Vitest, directory structure, basic README.

2. **Chunk 2: Spec JSON model & loader**

   - Define JSON schema for record definitions; implement loader that reads spec JSON files per tax
     year; basic validation of spec JSON.

3. **Chunk 3: Basic types & Zod schema generation for record 1000**

   - Create TypeScript interface & Zod schema (manually or via generator) for main form (record
     1000).
   - Write unit tests for schema validation.

4. **Chunk 4: Parser and generator for record 1000**

   - Implement parse of single 1000 line into object; implement generate single object → fixed-width
     line.
   - Unit tests: valid and invalid cases.

5. **Chunk 5: Validation logic for record 1000**

   - Business rules specific to main form: e.g., required fields, date ranges.
   - Integrate into overall validate function for structured data.

6. **Chunk 6: Expand to record 1010 & 1020 (related companies & shareholders)**

   - Spec definitions, schemas, parser/generator, tests for each.
   - Include record count limits (e.g., max 3 related companies, max 99 shareholders).

7. **Chunk 7: Cross-record orchestration & overall parse/generate/validate entrypoints**

   - Implement `parse(reportText, year)` that splits lines, dispatches.
   - Implement `generate(reportData, year)` orchestration: run validate, then generate all record
     lines in correct order, append 9999.
   - Implement `validate(input, year)` combining structured or text.
   - Tests: small synthetic data combining 1000, 1010, 1020.

8. **Chunk 8: Additional optional record types (1030, 2000, 2200, capital gains appendices)**

   - Iteratively for each section: spec, schema, parser/generator, tests.
   - Enforce per-year limits (e.g., max items).

9. **Chunk 9: Utilities (padding, RTL, normalization)**

   - Implement and test string padding utilities.
   - Implement RTL injection utilities for Hebrew fields.
   - Integrate into generator.
   - Tests verifying correct widths and control characters.

10. **Chunk 10: Tax-year versioning & configuration**

    - Organize spec JSON per year; loader picks correct year.
    - Abstract any year-specific rules in config.
    - Tests: unsupported year error; supported year parse/generate.

11. **Chunk 11: Integration tests & fixtures**

    - Gather real-world or synthetic full-report fixtures.
    - Write tests that generate from JSON fixture, compare to expected text fixture; parse text
      fixture → JSON, compare to expected object (with normalization).
    - Roundtrip tests.

12. **Chunk 12: Browser bundling & distribution setup**

    - Configure bundler (e.g., Rollup) for ESM/UMD.
    - Test in a minimal browser HTML to parse/generate in browser environment.

13. **Chunk 13: Documentation & examples**

    - Add JSDoc/TypeDoc comments.
    - Generate docs site or markdown files.
    - Write README with badges, install instructions, usage examples (parse/generate/validate).
    - Write “how to add new tax year” guide.

14. **Chunk 14: CI/CD & release process**

    - GitHub Actions: lint, type-check, test on push/PR.
    - On tag or merge to main: build, publish to npm, publish docs.
    - Semantic versioning & changelog.

15. **Chunk 15: Maintenance guidelines**

    - Document process for updating spec for new tax years.
    - Provide scripts or guidelines for schema regeneration.
    - Add tests for backward compatibility if needed.

---

## 3. Breaking Chunks into Detailed Steps

Below each chunk is broken into small steps. After listing, we will review sizes.

### Chunk 1: Project scaffolding & tooling

1. **Initialize Git repository**

   - `git init`, create initial commit.

2. **Create `package.json`**

   - `npm init -y`, set fields (name: `opcn1214-generator`, version `0.1.0`, description, keywords,
     repository, license).

3. **Install dependencies & devDependencies**

   - Dependencies: `zod`, `date-fns`.
   - DevDependencies: `typescript`, `ts-node`, `vitest`, `@types/node`, `eslint`,
     `eslint-config-prettier`, `prettier`, `eslint-plugin-import`, `eslint-plugin-jest` or Vitest
     plugin, `typedoc`, `rollup` (later), etc.

4. **Setup TypeScript config**

   - Create `tsconfig.json`: target ES2022, module ESNext, declaration output, strict mode,
     resolveJsonModule (for spec JSON), etc.

5. **Configure ESLint & Prettier**

   - `.eslintrc.js` enabling TypeScript rules; integrate with Prettier.
   - `.prettierrc`.

6. **Setup Vitest**

   - `vitest.config.ts`: specify test environment (node), coverage settings.

7. **Directory structure**

   - Create folders: `src/`, `src/config/`, `src/schemas/`, `src/types/`, `src/parser/`,
     `src/generator/`, `src/validator/`, `src/utils/`, `src/constants.ts`, `src/index.ts`.
   - Create `tests/` with subfolders `unit/`, `integration/`, `fixtures/`.

8. **Add basic README stub**

   - Title, description placeholder.

9. **Add GitHub Actions skeleton**

   - Create `.github/workflows/ci.yml` to run lint, type-check, tests.

10. **Add `.gitignore`**

    - `node_modules/`, `dist/`, coverage, etc.

11. **Set up pre-commit hooks (optional)**

    - Using Husky or simple instructions to run linting.

### Chunk 2: Spec JSON model & loader

1. **Define JSON schema for spec definitions**

   - Decide field properties: `fieldCode`, `fieldName`, `start`, `length`, `type`, `required`,
     `format?`, `rtl?`, `enumValues?`, `default?`, `padding?` (`left`/`right`), `description?`.
   - Save a TS type `SpecField` and `RecordSpec` (array of `SpecField` plus record-level metadata:
     `recordType`, `recordLength`, `repeatable`, `orderIndex`, etc.).

2. **Create skeleton spec JSON file for tax year 2024**

   - Under `src/config/2024.json` (or `spec-2024.json`): start with record 1000 minimal fields to
     test loader.

3. **Implement loader function**

   - In `src/config/loader.ts`: read JSON file for a given year (e.g., dynamic import or
     `fs.readFileSync` if Node; for browser bundling, use import).
   - Validate loaded JSON shape at runtime (e.g., with Zod or manual checks).
   - Expose `getRecordSpecs(year: number): RecordSpec[]` or a map by recordType.

4. **Write unit tests for loader**

   - Test loading a known small spec JSON for year 2024 → correct TS object shape.
   - Test unsupported year → throws or returns error.

5. **Decide bundling strategy for JSON**

   - For Node: read from file; for browser: embed JSON in bundle. May use
     `import spec2024 from './config/2024.json'`.

6. **Document spec JSON format**

   - Add comments or a markdown doc `SPEC_DEFINITION.md` describing JSON format for contributors.

### Chunk 3: Basic types & Zod schema generation for record 1000

1. **Write TypeScript interface skeleton for record 1000 data**

   - `export interface MainFormData { /* fields as per spec */ }`. Initially stub with placeholder
     fields from spec JSON.

2. **Write Zod schema for record 1000**

   - `export const record1000Schema = z.object({ /* using spec JSON definitions */ });`
   - If automating: write a small generator script that reads spec JSON for record 1000 and emits a
     `.ts` file exporting Zod schema.

3. **Integrate schema in code**

   - Place schema in `src/schemas/record1000.ts`.

4. **Derive TypeScript type from Zod**

   - `export type Record1000 = z.infer<typeof record1000Schema>`.

5. **Write unit tests for schema**

   - Valid minimal object passes validation.
   - Missing required fields yields errors with correct codes/messages.
   - Invalid types/formats produce errors.

6. **Decide error code mapping**

   - In schema refinements, attach error codes like `VALIDATION_CODES.INVALID_FORMAT`. Ensure Zod
     errors map to our `ValidationError` shape eventually.

7. **Utility to translate Zod errors to `ValidationError[]`**

   - Implement a function that transforms Zod issues into our structured error objects (including
     field path, message, code).

8. **Test error translation**

   - Given a failing zod parse, confirm translation yields expected `ValidationError` entries.

### Chunk 4: Parser and generator for record 1000

1. **Implement substring extraction utility**

   - Utility: given a line string and a field spec (`start`, `length`), extract substring; trim or
     keep raw.
   - Handle error if line shorter than expected.

2. **Write parser for record 1000**

   - Function
     `parseRecord1000(line: string, lineNumber: number, year: number): { data?: Record1000; errors?: ParseError[] }`.
   - Use spec definitions: for each field, extract substring, parse into correct type (string:
     trimmed or raw? number: parse int/decimal; date: parse with date-fns).
   - On parse errors (e.g., non-numeric where numeric expected), add `ParseError` with details.

3. **Write generator for record 1000**

   - Function
     `generateRecord1000(data: Record1000, year: number): { line: string; errors?: GenerateError[] }`.
   - For each field in spec definitions: format value (to string), pad (left/right per spec), inject
     RTL controls if needed, append into a fixed-length buffer.
   - Validate lengths: if formatted value exceeds field length → error.

4. **Unit tests for parser**

   - Given a known valid fixed-width line for 1000: parse → matches expected object.
   - Malformed line (too short, non-numeric where numeric) yields appropriate errors.

5. **Unit tests for generator**

   - Given valid `Record1000` object: generate → expected fixed-width line (compare to fixture).
   - Given object with invalid field (e.g., string too long) → error.

6. **Roundtrip test for record 1000**

   - Generate from object → parse the generated line → object equal (modulo normalization).
   - Write test asserting roundtrip equivalence.

7. **Integrate into overall module**

   - Export `parseRecord1000`, `generateRecord1000`.
   - Add to index if desired for testing.

### Chunk 5: Validation logic for record 1000

1. **Identify business rules for main form**

   - E.g., date fields within tax year bounds, numeric ranges, required combinations.
   - Gather from official spec/business rules doc.

2. **Implement business-rule validations**

   - In a function `validateRecord1000(data: Record1000, year: number): ValidationError[]`.
   - Use simple checks beyond Zod schema (e.g., if field A > field B, sum constraints, date
     comparisons).

3. **Integrate into structured validation**

   - In `validate(data: ReportData, year)`, after Zod passes, call `validateRecord1000`.

4. **Unit tests**

   - Valid object passes validation.
   - Violating business rule yields proper `ValidationError` with code `CROSS_FIELD_VALIDATION` or
     specific code.

5. **Test integration of validation in generator**

   - `generate(...)` should call validate first, so invalid data does not generate line but returns
     errors. Write tests for that behavior.

### Chunk 6: Expand to record 1010 & 1020 (related companies & shareholders)

For each record type (e.g., 1010, then 1020):

1. **Update spec JSON**

   - Add definitions for record fields and metadata (repeatable, max count, ordering).

2. **Generate or write Zod schema**

   - Same pattern as record 1000.

3. **TypeScript type**

   - `export type RelatedCompanyData = z.infer<typeof record1010Schema>`, etc.

4. **Parser function**

   - `parseRecord1010(line, lineNumber, year)`, accumulate into array of `RelatedCompanyData`.

5. **Generator function**

   - `generateRecord1010(item: RelatedCompanyData, year)`.

6. **Business rules**

   - E.g., max 3 related companies. Validation: if array length > 3 → error code
     `MAX_RECORDS_EXCEEDED`.

7. **Unit tests**

   - Parse valid/malformed lines; generate valid/invalid objects; roundtrip tests.

8. **Integrate into orchestration later**

   - For now keep parser/generator isolated.

### Chunk 7: Cross-record orchestration & overall parse/generate/validate entrypoints

1. **Implement `parse(reportText: string, year: number)`**

   - Split by CRLF or `\r\n`.
   - For each non-empty line: determine recordType substring (e.g., positions 4–7 contain “1000”,
     “1010”, etc).
   - Dispatch: call appropriate `parseRecordXXXX`.
   - Collect results into a `ReportData` object: set `mainForm`, arrays for repeatable sections.
   - Validate ordering: if a record appears out of sequence → add `ParseError`.
   - After parsing all lines: check required presence (e.g., mainForm exists, at least one
     shareholder).
   - Return `ParseResult` with `success`, `data`, and any `errors`.

2. **Implement `generate(reportData: ReportData, year: number)`**

   - First: call structured validation (`validate(reportData, year)`). If invalid, return errors.
   - Otherwise: build lines in correct order:

     - `generateRecord1000(mainForm)`, then for each related company (if any) generate 1010 lines,
       then each shareholder generate 1020 lines, etc. Follow spec order.
     - For optional sections: if absent but spec requires placeholder lines? (likely include
       zero-value placeholder record with default fields, based on spec). Use spec instructions.
     - Finally append end record 9999 (`generateRecord9999(year)` or constant).

   - Concatenate lines with CRLF endings.
   - Return `GenerateResult`.

3. **Implement `validate(input: ReportData | string, year: number)`**

   - If input is string: call `parse`, then if parse success call structured validation on parsed
     data.
   - If input is object: run Zod schemas + business rules.
   - Return `ValidationResult`.

4. **Unit tests**

   - Feed a small multi-line fixture combining 1000 + 1010 + 1020 lines → parse → validate success.
   - Generate from a minimal valid `ReportData` with only mandatory sections → expected multi-line
     string.
   - Validate rejects missing mandatory sections or mis-ordered lines.

5. **Error handling**

   - Standardize error format across parse/generate/validate.
   - Ensure location info: for parse errors include lineNumber, recordType, field. For validation
     errors on structured data include recordType, recordIndex.

6. **Test invalid sequences**

   - E.g., shareholder record before mainForm → parse error. More than max related companies in data
     → validation error.

### Chunk 8: Additional optional record types (1030, 2000, 2200, capital gains appendices)

For each additional section (possibly group them logically):

1. **Spec JSON update**

   - Add field definitions, section metadata (max count, optionality).

2. **Zod schema & TS type**

   - As before.

3. **Parser & generator functions**

   - Implement parseRecordXXXX, generateRecordXXXX.

4. **Business rules & validation**

   - Field-level rules; section-level rules (e.g., max 5 R\&D investments).
   - Cross-record rules: e.g., if R\&D section present, certain fields mandatory in mainForm.
     Document and implement.

5. **Unit tests**

   - Valid and invalid cases.

6. **Integrate into orchestration**

   - Extend parse/generate order to include these sections.
   - For optional sections: decide if absence means no lines or placeholder zero-lines as per spec.

7. **Roundtrip tests**

   - generate→parse roundtrip for each section.

### Chunk 9: Utilities (padding, RTL, normalization)

1. **Implement padding utilities**

   - `padString(value: string, length: number, direction: 'left'|'right'): string`.
   - Ensure correct behavior with Unicode (Hebrew) characters; measure by code units if spec uses
     bytes? Probably count code points; confirm spec instructions.

2. **Implement numeric formatting utils**

   - E.g., format numbers with leading zeros or right padding spaces; decimal formatting rules.

3. **Implement date formatting/parsing**

   - Use date-fns to parse from `DDMMYYYY` or spec format; format date objects into spec-required
     string.

4. **Implement RTL injection**

   - For Hebrew text fields: wrap with Unicode bidi marks: embed RLE/PDF or RLI/PDI as appropriate.
   - Utility: `injectRTL(value: string): string`.

5. **Normalization helpers**

   - Trim whitespace; normalize Unicode forms (NFC/NFD) if needed.

6. **Unit tests**

   - Test padding with ASCII, Hebrew; test correct lengths.
   - Test date formatting/parsing.
   - Test RTL wrappers produce expected control chars.
   - Edge cases: empty strings, null-safe.

7. **Integrate**

   - In generator: use these utilities when formatting fields.
   - In parser: possibly strip control characters when reading.

### Chunk 10: Tax-year versioning & configuration

1. **Organize spec JSON files per year**

   - E.g., `src/config/2024.json`, `src/config/2025.json` (empty or future).

2. **Enhance loader**

   - Given year, import appropriate JSON or throw error if missing.
   - Optionally, support fallback logic (e.g., if exact year not present).

3. **Per-year overrides**

   - For business rules that differ by year: define in config or code factories keyed by year.

4. **Tests**

   - Attempt parse/generate with unsupported year (e.g., 2023 if not supported) → immediate error.
   - Supported year works as expected.

5. **Document procedure**

   - In README: “To add a new tax year: copy previous year JSON spec, update differences, add tests,
     bump version.”

6. **Version-specific validations**

   - Example: if field format changed in new year, ensure schema uses correct rule via loaded spec.

7. **Integration tests**

   - For at least two years (if spec available): same test suites run against both JSON specs.

### Chunk 11: Integration tests & fixtures

1. **Collect or create fixtures**

   - Real-world anonymized examples if available, otherwise synthetic but representative examples
     covering: minimal valid, maximal valid, edge cases (record counts at limits, special values).
   - Store raw text (`tests/fixtures/2024/minimal.txt`) and corresponding JSON
     (`tests/fixtures/2024/minimal.json`).

2. **Write integration tests**

   - For each fixture: parse the text and compare to expected JSON object (using deep equality after
     normalization).
   - Generate text from JSON fixture and compare to expected text (possibly ignoring whitespace
     differences at end-of-line).
   - Roundtrip tests: generate→parse yields JSON equal (modulo normalization).

3. **Automate fixture validation**

   - Tests alert if spec changes cause different output; update fixtures deliberately.

4. **Coverage**

   - Ensure tests cover optional sections, error scenarios.

5. **Performance tests (optional)**

   - For large numbers of repeatable records near limits: measure parse/generate time/memory (unit
     test warnings or documentation notes).

### Chunk 12: Browser bundling & distribution setup

1. **Choose bundler**

   - Rollup or similar for ESM/UMD build.

2. **Write bundler config**

   - Input: `src/index.ts`.
   - Outputs:

     - ESM build for Node/browser (`dist/opcn1214-generator.esm.js`).
     - UMD build (`dist/opcn1214-generator.umd.js`) for direct browser inclusion.
     - Types (`dist/index.d.ts`).

   - Externalize dependencies (`zod`, `date-fns`) or bundle? Probably mark `zod` as external,
     expecting user to bundle separately, or bundle everything? Choose based on size/perf. Document.

3. **Test browser usage**

   - Create minimal HTML + script using UMD build: e.g., call `window.opcn1214Generator.parse(...)`.
   - Ensure no Node-specific APIs break bundling (avoid `fs` at runtime; loader must handle browser
     path, so spec JSON import approach).

4. **Configure package.json fields**

   - `main`, `module`, `types`, `browser` fields.
   - Ensure tree-shaking-friendly ESM build.

5. **CI tests for bundling**

   - In GitHub Actions: after build, run a quick Node script importing the built bundle to ensure it
     loads.

6. **Document bundling**

   - In README: how to import in browser (script tag or via bundler).

### Chunk 13: Documentation & examples

1. **Add JSDoc/TypeDoc comments**

   - Document public functions: `parse`, `generate`, `validate`, types like `ReportData`, error
     shapes.
   - Document how to interpret errors.

2. **Generate docs**

   - Configure TypeDoc: output to `docs/` folder or GH Pages.

3. **Write README**

   - Overview, installation: `npm install opcn1214-generator`.
   - Usage examples: parse/generate/validate in Node and browser.
   - Error handling example.
   - How to extend for new tax year overview.
   - Contribution guidelines: spec JSON format, testing new record types.

4. **Write CHANGELOG template**

   - For releases.

5. **Examples directory**

   - Optionally, include `examples/` with small scripts: e.g., `examples/parse-demo.ts`.

6. **Docs for spec JSON format**

   - A separate markdown explaining each field in spec JSON to help contributors.

7. **Publish docs**

   - GitHub Pages or link to npm package README.

### Chunk 14: CI/CD & release process

1. **Enhance GitHub Actions**

   - Lint, type-check, tests on push/PR.
   - On push to main or on tag: build artifacts, run integration tests, create release.

2. **Set up semantic-release or manual versioning**

   - If semantic-release: configure commit message conventions, automate npm publish.
   - Alternatively: manual version bump in `package.json`, then `npm publish`.

3. **Automate docs publishing**

   - After release, deploy docs (e.g., to GitHub Pages).

4. **Badge setup**

   - In README: badges for build status, npm version, coverage.

5. **Monitor coverage**

   - Optionally integrate coverage report and enforce minimal coverage threshold.

6. **Security checks**

   - Dependabot config for dependency updates.

### Chunk 15: Maintenance guidelines

1. **Write CONTRIBUTING.md**

   - How to add new tax year: copy previous spec JSON, update fields, add tests.
   - How to debug parse/generate issues.
   - How to update TypeDoc if public API changes.

2. **Provide scripts**

   - E.g., `scripts/generate-schema.ts` to regenerate schemas from JSON spec.
   - Linting, formatting scripts.

3. **Changelog practice**

   - How to record changes when spec changes for new year.

4. **Issue templates**

   - For bug reports in parsing/generating specific cases.

5. **Release checklist**

   - Ensure tests passing, version bump, docs updated, publish to npm.

---

## 4. Review & Right-sizing Steps

- **Granularity**: Each step above is small enough to write focused code, tests, and review. They
  progress logically: scaffolding → config → single-record implementation → multi-record
  orchestration → optional sections → utilities → versioning → integration → bundling → docs → CI →
  maintenance.
- **Test-driven emphasis**: For each feature, we write tests first or in parallel: schema tests,
  parser/generator unit tests, integration tests.
- **No big jumps**: We start with record 1000 only, then gradually add record types. We don’t
  attempt to implement everything at once.
- **Integration at each stage**: After each chunk, the library has a working subset: after chunk 4,
  can parse/generate/validate record 1000 only. After chunk 7, library can handle main sections.
  This ensures no orphan code.
- **Error handling consistent**: At each stage, define error shapes and translation from Zod or
  parsing errors.
- **Documentation & maintainability**: Early documentation of spec JSON format helps later
  contributors.

If any step seems too large, we can split further. For example, within chunk 3: separate writing TS
interface vs writing schema generation script vs writing manual schema. But current breakdown is
already granular.

---

## 5. Prompts for a Code-Generation LLM

Below are sequential prompts. Each prompt is in its own section, tagged as text with triple
backticks (\`\`\`text). They build on previous steps: the context includes what has been done so
far, and the next objective. You can feed each prompt to an LLM configured to generate code, tests,
and possibly documentation.

> **Note**: When using these prompts, ensure that the code-generation LLM has access to the existing
> codebase context (e.g., files generated in previous steps) so that it can integrate new code
> appropriately.

---

### Prompt 1: Project Scaffolding & Tooling

```text
You are an expert TypeScript library engineer. We are creating a new NPM package named `opcn1214-generator`, a library to parse/generate/validate Israeli tax form 1214 in OPCN fixed-width format.

Perform the following:
1. Create a new Node.js project scaffolding:
   - `package.json` with name `opcn1214-generator`, version `0.1.0`, description, keywords: ["1214", "opcn", "accountancy", "israeli-tax", "tax-forms"], license MIT, repository placeholder.
   - Install dependencies: `zod`, `date-fns`.
   - Install devDependencies: `typescript`, `ts-node`, `vitest`, `@types/node`, `eslint`, `eslint-config-prettier`, `prettier`, `eslint-plugin-import`, `eslint-plugin-vitest`, `typedoc`.
2. Create a `tsconfig.json` with strict mode, target ES2022, module ESNext, declaration true, resolveJsonModule true, outDir `dist`, rootDir `src`.
3. Set up ESLint and Prettier:
   - `.eslintrc.js` enabling TypeScript linting, integrate with Prettier.
   - `.prettierrc` with default settings.
4. Set up Vitest:
   - `vitest.config.ts` targeting Node environment.
5. Create directory structure:
   - `src/` with subfolders: `config/`, `schemas/`, `types/`, `parser/`, `generator/`, `validator/`, `utils/`; `src/constants.ts`; `src/index.ts`.
   - `tests/` with `unit/`, `integration/`, `fixtures/`.
6. Add basic `README.md` stub explaining the purpose.
7. Add `.gitignore` ignoring `node_modules`, `dist`, coverage, etc.
8. Add a GitHub Actions workflow file at `.github/workflows/ci.yml` that runs lint, type-check, and Vitest on push and pull requests.

Provide the content of each configuration file (package.json, tsconfig.json, ESLint/Prettier config, Vitest config, basic README stub, GitHub Actions workflow). Ensure best practices (strict TS, linting rules). Do not implement library code yet. After generating these files, briefly explain where to commit them and how to verify initial setup (e.g., `npm run lint`, `npm run test` which currently has no tests).
```

---

### Prompt 2: Spec JSON Model & Loader

````text
Context:
- We have a newly scaffolded TypeScript project (`opcn1214-generator`) with src/ directory.
- Our goal: represent record definitions (field positions, lengths, types, required, formatting rules, RTL flag, etc) in JSON per tax year, and load them at runtime/build time.

Task:
1. Define a TypeScript interface (in `src/types/spec.ts`) for a field specification (`SpecField`) with properties:
   - `fieldCode: string`
   - `fieldName: string`
   - `start: number` (0-based index in fixed-width line)
   - `length: number`
   - `type: 'string' | 'number' | 'date'`
   - `required: boolean`
   - Optional `format?: string` (e.g., date format pattern)
   - Optional `rtl?: boolean` (true for Hebrew text fields)
   - Optional `enumValues?: string[]`
   - Optional `defaultValue?: string | number | null`
   - Optional `padding?: 'left' | 'right'`
   - Optional `description?: string`
2. Define an interface for a record specification (`RecordSpec`) with:
   - `recordType: string` (e.g., "1000")
   - `recordLength: number`
   - `repeatable: boolean`
   - `minOccurs?: number`
   - `maxOccurs?: number`
   - `orderIndex: number`
   - `fields: SpecField[]`
   - Optional `description?: string`
3. Create a minimal example JSON file for tax year 2024, `src/config/2024.json`, containing just one record spec for record type "1000" with at least two example fields (stubbed) to test loading. For instance:
   ```json
   {
     "year": 2024,
     "records": [
       {
         "recordType": "1000",
         "recordLength": 50,
         "repeatable": false,
         "orderIndex": 1,
         "fields": [
           {
             "fieldCode": "1000_01",
             "fieldName": "exampleStringField",
             "start": 0,
             "length": 10,
             "type": "string",
             "required": true,
             "padding": "right",
             "rtl": false
           },
           {
             "fieldCode": "1000_02",
             "fieldName": "exampleNumberField",
             "start": 10,
             "length": 5,
             "type": "number",
             "required": true,
             "padding": "left"
           }
         ]
       }
     ]
   }
````

4. Implement a loader in `src/config/loader.ts`:

   - A function `getSpecForYear(year: number): RecordSpec[]` that imports or reads
     `src/config/${year}.json`.
   - Validate that the JSON matches the TypeScript interfaces (e.g., at runtime using Zod or manual
     checks). If invalid or year unsupported, throw an error.
   - Export necessary types and loader function.

5. Write unit tests in `tests/unit/config-loader.spec.ts`:

   - Test that loading year 2024 returns the array with our stub record spec.
   - Test that loading unsupported year (e.g., 2023) throws or returns a clear error.

6. In documentation (`SPEC_DEFINITION.md`), describe the structure of the JSON spec file and
   instructions for contributors to add new record definitions.

Provide the TypeScript code for interfaces, the loader module, the example JSON, and unit tests.
Also show the content of `SPEC_DEFINITION.md`. Ensure code integrates into existing project
structure.

````

---

### Prompt 3: Zod Schema Generation for Record 1000

```text
Context:
- Project scaffolding exists.
- We have spec JSON loader working and a stub spec for record 1000 in `src/config/2024.json`.
- Aim: create Zod schema and TS type for record 1000 based on spec JSON, and test it.

Task:
1. In `src/schemas/record1000.ts`, implement a script or code that:
   - Imports the spec for record "1000" from the loaded JSON (use `getSpecForYear(2024)` and find recordType "1000").
   - Dynamically constructs a Zod object schema that:
     - For each `SpecField`:
       - If `type === "string"`, use `z.string()`, optionally `.min()` or `.max()` if spec requires length constraints; possibly `.refine()` for patterns.
       - If `type === "number"`, use `z.number()`. If integer-only, ensure integer check; if decimal, define appropriate precision if known.
       - If `type === "date"`, use `z.string()` with a `.refine()` checking valid date format per `format` (use date-fns `parse` inside refinement).
       - Enforce `required`: if required false, use `.optional()`.
       - Attach `.describe()` or metadata with `fieldCode`, `description`.
     - After constructing the Zod schema, export it: `export const record1000Schema = z.object({...})`.
     - Export TS type: `export type Record1000 = z.infer<typeof record1000Schema>`.
   - Implement helper functions if needed to map spec field properties to Zod rules.
2. Implement translation from Zod errors to our `ValidationError` shape:
   - In `src/validator/zodHelpers.ts`, write a function `zodErrorToValidationErrors(zError: ZodError, recordType: string, recordIndex?: number): ValidationError[]`.
   - Map each issue to `{ field, message, code, recordType, recordIndex }`. Choose code based on nature (e.g., invalid format, too long).
3. Write unit tests in `tests/unit/schemas/record1000.spec.ts`:
   - Provide a minimal valid object matching stub fields: e.g., `{ exampleStringField: "ABC", exampleNumberField: 123 }` → passes.
   - Omit required field → yields appropriate ValidationError via zodErrorToValidationErrors.
   - Provide invalid types → yields correct errors.
4. If desired, implement a script (in `scripts/`) that, given a spec JSON year and recordType, can generate a skeleton Zod schema file. But for now focus on record1000 manually based on spec stub.

Provide the TypeScript code for:
- `src/schemas/record1000.ts`
- `src/validator/zodHelpers.ts`
- Unit tests for record1000 schema.
- Any helper utilities used.
````

---

### Prompt 4: Parser and Generator for Record 1000

```text
Context:
- We have Zod schema and TS type for `Record1000`, plus spec JSON loader.
- Next: implement parsing and generation of a single fixed-width line for record 1000 and tests.

Task:
1. In `src/parser/record1000Parser.ts`, implement:
   - `export function parseRecord1000(line: string, lineNumber: number, year: number): { data?: Record1000; errors?: ParseError[] }`.
   - Use `getSpecForYear(year)` to retrieve spec for recordType "1000". For each field spec:
     - Extract substring: `line.slice(start, start + length)`.
     - For `type==="string"`, trim or keep whitespace? Trim trailing spaces; remove RTL controls.
     - For `type==="number"`, trim and parse to number; if empty but required → error; if non-numeric → error.
     - For `type==="date"`, parse string via date-fns per spec format; invalid date → error.
   - Collect parsed values into an object matching `Record1000`. After raw parse, run `record1000Schema.safeParse(parsedObj)`, translate zod errors via `zodErrorToValidationErrors`. Combine parse-format errors and schema-level errors.
   - Return either `{ data }` if no errors, or `{ errors }`.
2. In `src/generator/record1000Generator.ts`, implement:
   - `export function generateRecord1000(data: Record1000, year: number): { line?: string; errors?: GenerateError[] }`.
   - Validate `data` via `record1000Schema` + business-rule validation (if some rules known; else skip for now).
   - For each field spec:
     - Get value from `data[fieldName]`, format to string:
       - For numbers: convert to string, no thousands separators; for decimals, fix decimal places if needed.
       - For dates: format date string using date-fns to spec format.
       - For strings: ensure no disallowed chars; for Hebrew, apply `injectRTL` utility if `rtl=true`.
     - Pad string to `length` using padding direction from spec: if shorter, pad spaces; if longer, error.
   - Concatenate field strings in order, ensure total length matches `recordLength`. If mismatch or overflow, return errors.
   - Return `{ line }`.
3. Write utilities in `src/utils/padding.ts`:
   - `padRight`, `padLeft`.
   - In `src/utils/rtl.ts`, stub `injectRTL(value: string): string`. (Later refine).
4. Define `ParseError` and `GenerateError` types in `src/types/errors.ts` matching spec: `{ field: string; message: string; code: string; recordType: string; recordIndex?: number; lineNumber?: number; position?: number; value?: any; expected?: string; }`.
5. Write unit tests in `tests/unit/parser-record1000.spec.ts` and `tests/unit/generator-record1000.spec.ts`:
   - For parser: given a test line built manually matching stub spec, expect correct `data`. For invalid line (wrong length, non-numeric), expect `errors` with correct info.
   - For generator: given valid `Record1000` object, expect correct padded line. Given object with too-long field, expect error. Roundtrip: generate then parse yields same object.
6. Ensure functions integrate: import in `src/parser/index.ts` and `src/generator/index.ts`.

Provide TypeScript code for parser/generator modules, utilities (padding, rtl stub), error types, and tests.
```

---

### Prompt 5: Business-Rule Validation for Record 1000

```text
Context:
- Parser/generator for record1000 exist.
- Zod schema validates basic types/lengths; now add business rules for main form.

Task:
1. Identify example business rules for record 1000 (for demonstration, assume some plausible rules; later replace with actual spec rules). For example:
   - A date field “reportDate” must be within the year parameter (i.e., between Jan 1 and Dec 31 of given taxYear).
   - A numeric field “totalIncome” must be >= 0.
   - If fieldA is present, fieldB must also be present or >0.
2. In `src/validator/record1000Validation.ts`, implement:
   - `export function validateRecord1000Business(data: Record1000, year: number): ValidationError[]`.
   - Use date-fns to check date fields.
   - Return array of `ValidationError` with appropriate `code` (e.g., `INVALID_RANGE` or `CROSS_FIELD_VALIDATION`) and descriptive messages.
3. In `src/validator/index.ts`, integrate:
   - For structured validation of `ReportData`, after Zod-based validation of record1000, call `validateRecord1000Business`.
4. Write unit tests in `tests/unit/validator-record1000.spec.ts`:
   - Create `Record1000` objects violating each rule → expect corresponding ValidationError entries.
   - Valid object passes with empty array.
5. Update generator: before generating the line, run business validation; if errors, return errors instead of line.
6. Write a test in generator test: passing a `Record1000` that fails business rule yields errors.

Provide TypeScript code for the validation module and updated integration, plus unit tests. Use realistic placeholder field names if spec stub doesn’t include real names; structure code so that when actual spec fields replace stubs, rules can be updated.
```

---

### Prompt 6: Records 1010 & 1020 (Related Companies & Shareholders)

```text
Context:
- Single-record (1000) pipeline implemented: spec JSON stub, schema, parser, generator, validation.
- Now expand to record types 1010 (related companies) and 1020 (shareholders). Assume stub spec JSON for these is added in `src/config/2024.json`. Each record spec has its own fields, repeatable with maxOccurs defined in JSON.

Task (for each record type, e.g., first 1010 then 1020):
1. Retrieve spec definitions:
   - Use `getSpecForYear(2024)` to get record spec for “1010”.
2. Create Zod schema module:
   - `src/schemas/record1010.ts`: build Zod schema based on spec JSON fields, export `record1010Schema` and `RelatedCompanyData = z.infer<...>`.
3. Create parser:
   - `src/parser/record1010Parser.ts`: `parseRecord1010(line: string, lineNumber: number, year: number): { data?: RelatedCompanyData; errors?: ParseError[] }`.
4. Create generator:
   - `src/generator/record1010Generator.ts`: `generateRecord1010(data: RelatedCompanyData, year: number): { line?: string; errors?: GenerateError[] }`.
5. Create business-rule validation:
   - E.g., maximum 3 related companies: In overall orchestration, if array length > 3, return a `ValidationError` with code `MAX_RECORDS_EXCEEDED`.
   - If within record-level validation, check field interdependencies.
   - Implement `validateRelatedCompanies(dataArray: RelatedCompanyData[], year: number): ValidationError[]` in `src/validator/relatedCompaniesValidation.ts`.
6. Write unit tests:
   - `tests/unit/schemas/record1010.spec.ts`: schema tests.
   - `tests/unit/parser-record1010.spec.ts` and generator tests similarly.
   - `tests/unit/validator-relatedCompanies.spec.ts`: test maxOccurs and any field-specific rules.
7. Repeat for record 1020:
   - Similar modules: `src/schemas/record1020.ts`, `parser/record1020Parser.ts`, `generator/record1020Generator.ts`, `validator/shareholdersValidation.ts`.
   - Business rule: at least one shareholder (minOccurs=1), max 99; sum of shareholder percentage fields equals 100 (if applicable). Implement sum check in `validateShareholders`.
8. Integrate into orchestration later:
   - Ensure functions exported so orchestration module can import and use them.
9. Provide code and tests for both record types. Use placeholder logic for business rules (e.g., sum percentages) but structure code so real rules can be plugged in easily.

Provide the TypeScript code for schemas, parsers, generators, validation modules, and unit tests for both record 1010 and 1020.
```

---

### Prompt 7: Cross-Record Orchestration: parse(), generate(), validate()

````text
Context:
- Individual record modules (1000, 1010, 1020) exist with parser, generator, schema, business validation.
- Need to implement the core API methods: `parse`, `generate`, `validate`.

Task:
1. In `src/parser/index.ts`, implement `export function parse(reportText: string, year: number): ParseResult`:
   - Split `reportText` by CRLF (`\r\n`), ignoring empty trailing lines.
   - For each line, extract recordType substring (e.g., positions 4–7 depending on spec; retrieve from spec JSON: field `formType` and `recordType` positions).
   - Based on recordType, call specific `parseRecordXXXX`. Keep track of lineNumber (1-based).
   - Enforce ordering: load spec for year, get array of recordSpecs sorted by `orderIndex`. Ensure records appear in correct order: e.g., only after record1000, then any number of 1010 up to maxOccurs, then 1020, etc. If out-of-order, record `ParseError`.
   - Accumulate parsed data into a `ReportData` object shape:
     ```ts
     interface ReportData {
       mainForm: Record1000;
       relatedCompanies?: RelatedCompanyData[];
       shareholders: ShareholderData[];
       // other sections optional
     }
     ```
   - After processing all lines, check required presence: mainForm must exist; shareholders array must have at least one. If missing, add ParseError.
   - Return `{ success: boolean; data?: ReportData; errors?: ParseError[] }`.
2. In `src/generator/index.ts`, implement `export function generate(data: ReportData, year: number): GenerateResult`:
   - First: call structured validation (`validate(data, year)`); if not valid, return errors.
   - Else: retrieve spec for year, get recordSpecs sorted by `orderIndex`.
   - For each spec in order:
     - If recordType = “1000”: call `generateRecord1000(data.mainForm, year)`.
     - If recordType = “1010”: for each item in `data.relatedCompanies` (or if absent and spec requires placeholder lines, generate default zero-lines).
     - If recordType = “1020”: for each item in shareholders array.
     - Handle optional sections similarly.
   - Append end record “9999” line via `generateRecord9999(year)`.
   - Join lines with `\r\n` to form `reportText`.
   - Return `{ success: true, reportText }`.
3. In `src/validator/index.ts`, implement `export function validate(input: ReportData | string, year: number): ValidationResult`:
   - If `typeof input === 'string'`: call `parse`; if parse fails, return `{ isValid: false, errors: parseErrors }`; else take parsed data for next step.
   - If `input` object: use it directly.
   - Run schema-based validation for each record: e.g., call `record1000Schema.safeParse`, `record1010Schema` for each related company, etc., collecting `ValidationError`s via zodErrorToValidationErrors.
   - Run business-rule validations: `validateRecord1000Business`, `validateRelatedCompanies`, `validateShareholders`, etc.
   - Return `{ isValid: errors.length === 0, errors }`.
4. Define `ParseError`, `ValidationError`, `GenerateError` shapes in `src/types/errors.ts`, and import where needed.
5. Write unit tests:
   - `tests/unit/parser-index.spec.ts`: small multi-line sample combining 1000 + 1010 + 1020 lines → parse success yields expected `ReportData`.
   - Test out-of-order lines → error.
   - `tests/unit/generator-index.spec.ts`: generate from `ReportData` with only mandatory sections; test output structure; invalid data → errors.
   - `tests/unit/validator-index.spec.ts`: feed structured object missing mandatory fields → errors; pass valid object → `isValid: true`.
6. Ensure all modules import and export correctly in `src/index.ts`:
   ```ts
   export { parse } from './parser';
   export { generate } from './generator';
   export { validate } from './validator';
   export type { ReportData, ValidationError, ParseError, GenerateError, ParseResult, GenerateResult, ValidationResult } from './types';
````

7. Provide the TypeScript code for orchestration modules and unit tests.

Ensure that code references spec JSON loader to enforce record ordering and presence. Use common
utilities for error creation.

````

---

### Prompt 8: Optional Sections (1030, 2000, 2200, Capital Gains)

```text
Context:
- Core orchestration for 1000, 1010, 1020 is working.
- Now implement additional optional sections: record types 1030 (R&D Investments), 2000 (Foreign Appendix), 2200 (Foreign Incomes), and various capital gains appendices (3027–3077). Each has its own spec, repeatability, and business rules.

Task:
For each section (grouped logically):
1. Ensure spec JSON (`src/config/2024.json`) includes definitions for the record type. If not present, add stubs or actual definitions.
2. Create Zod schema module, parser, generator, validation module, and unit tests, following same pattern as 1000/1010/1020:
   - Schema: `src/schemas/recordXXXX.ts`, export `RecordXXXXData`.
   - Parser: `src/parser/recordXXXXParser.ts`.
   - Generator: `src/generator/recordXXXXGenerator.ts`.
   - Validation: in `src/validator/recordXXXXValidation.ts`, including count limits (e.g., R&D max 5 items), and field-specific business rules (placeholder logic for now).
   - Unit tests: `tests/unit/schemas/recordXXXX.spec.ts`, parser/generator/validation tests.
3. Integrate each into orchestration: update parsing order in `src/parser/index.ts`, generation order in `src/generator/index.ts`, validation flow in `src/validator/index.ts`.
4. For sections that depend on other data (cross-record rules), implement those validations, e.g.:
   - If R&D investments present, ensure certain flags in mainForm are set.
   - If foreign incomes exist, ensure foreignAppendix present, or vice versa.
   - For capital gains: if a specific appendix present, check totals in mainForm or related summary fields.
5. Write integration tests in `tests/integration/` combining multiple optional sections:
   - E.g., a full example with R&D + foreign incomes + one capital gains appendix. Use synthetic JSON fixture and expected text fixture. Test parse→validate→generate roundtrip.
6. Document within code comments how to plug in real business rules when known.
7. Provide TypeScript code for at least one optional section as an example (e.g., record1030), demonstrating the full pattern, and instructions to replicate for others.

Note: Since full field definitions may be large, you can show pattern code using spec JSON; actual field arrays can be stubbed but code must handle dynamic spec. Provide code templates and tests based on stub fields.
````

---

### Prompt 9: Utilities: Padding, RTL, Date & Number Formatting

```text
Context:
- Parser/generator modules reference utilities for padding, RTL injection, date parsing/formatting, number formatting.
- Need full implementation and unit tests to ensure correct handling of fixed-width details.

Task:
1. In `src/utils/padding.ts`, implement:
   - `export function padRight(value: string, length: number): string`
   - `export function padLeft(value: string, length: number): string`
   - For values longer than length: throw or return error object (but generator modules handle that).
   - Ensure Unicode strings (Hebrew) are counted correctly by code units if spec measures bytes or code units. Document assumption.
2. In `src/utils/rtl.ts`, implement:
   - `export function injectRTL(value: string): string` that wraps `value` with Unicode bidi control chars (e.g., RLE `\u202B` and PDF `\u202C`) so that Hebrew displays RTL in LTR context. Document rationale.
   - `export function stripRTL(value: string): string` to remove those control chars when parsing.
3. In `src/utils/format.ts`, implement:
   - Date formatting: `formatDate(date: Date, format: string): string` (using date-fns) according to spec format (e.g., 'ddMMyyyy').
   - Date parsing: `parseDate(dateStr: string, format: string): Date | null`.
   - Number formatting: `formatNumber(value: number, integerLength: number, decimalLength?: number): string` returning a string without separators, padded as needed.
4. Write unit tests in `tests/unit/utils-padding.spec.ts`, `utils-rtl.spec.ts`, `utils-format.spec.ts`:
   - Test padding with ASCII and Hebrew strings.
   - Test RTL injection yields correct wrapper chars.
   - Test date parse/format roundtrip for known format.
   - Test number formatting for various numeric inputs (integers, decimals, negative if allowed).
5. Integrate in parser/generator:
   - Parser: use `stripRTL` before interpreting string fields.
   - Generator: after formatting string fields (especially Hebrew), call `injectRTL`.
   - Use `formatDate` and `formatNumber` in generator, and date parsing in parser.
6. Document in code comments any assumptions (e.g., counting code units vs bytes) and how to adjust for spec specifics.

Provide the complete TypeScript code for these utilities and their tests.
```

---

### Prompt 10: Tax-Year Versioning & Configuration

````text
Context:
- Spec JSON loader handles a given year’s JSON. Now formalize versioning so adding new years is straightforward, and business rules can vary by year.

Task:
1. In `src/config/loader.ts`, ensure `getSpecForYear(year: number)`:
   - Imports `src/config/${year}.json`. If file not found, throw `ValidationError` or custom error with code `TAX_YEAR_NOT_SUPPORTED`.
   - Returns an object containing:
     - `year: number`
     - `recordSpecs: RecordSpec[]`
   - Optionally, cache loaded specs for performance.
2. Create a `src/config/taxYearConfig.ts`:
   - Define interface `TaxYearConfig`:
     ```ts
     interface TaxYearConfig {
       year: number;
       maxRecords: {
         relatedCompanies: number;
         shareholders: number;
         rdInvestments: number;
         foreignIncomes: number;
         capitalGainsAppendices: number;
       };
       // other year-specific settings
     }
     ```
   - Provide default config for 2024 (values from spec or stub).
   - Export a function `getTaxYearConfig(year: number): TaxYearConfig`.
3. In validation modules, where count limits or special rules depend on year, use `getTaxYearConfig(year)`.
4. Write unit tests in `tests/unit/config-taxYearConfig.spec.ts`:
   - For supported year returns expected config.
   - For unsupported year, throw or error.
5. Document steps to add a new year: copy/update JSON spec, update `taxYearConfig`, add tests.
6. In orchestration (`parse`/`generate`), if calling with unsupported year, immediately return error before anything else.
7. Provide TypeScript code for loader enhancements, taxYearConfig, and tests.

Make sure dynamic imports or bundling approach works for browser: if bundler cannot import dynamic JSON filenames, use a static map in code linking year to JSON import. Provide code template for this pattern.
````

---

### Prompt 11: Integration Tests & Fixtures

```text
Context:
- Core functionality (records 1000, 1010, 1020, optional stubs) implemented; utilities and versioning in place.
- Need integration tests with real or synthetic fixtures for full-report roundtrip.

Task:
1. In `tests/fixtures/2024/`, create:
   - `minimal.json`: a minimal valid `ReportData` object with only required fields (mainForm with minimal fields, single shareholder).
   - `minimal.txt`: the expected OPCN text output for `minimal.json` (fixed-width lines, CRLF).
   - `full.json`: a more complete `ReportData` example including optional sections with stub values.
   - `full.txt`: expected text output for full example.
2. In `tests/integration/integration-2024.spec.ts`, write tests:
   - **Generate Test**: import `minimal.json`, call `generate(minimalData, 2024)`, expect `success: true` and `reportText === minimal.txt`.
   - **Parse Test**: read `minimal.txt`, call `parse(reportText, 2024)`, expect `success: true` and `data` deep-equals `minimal.json` (accounting for normalization: e.g., trimmed strings).
   - **Roundtrip Test**: starting from `minimal.json`, do generate → parse → compare object deep equality.
   - Repeat for `full.json`/`full.txt`.
   - Test invalid fixture: e.g., create `invalid.json` missing required field; `generate` yields errors; create `invalid.txt` malformed line; `parse` yields errors.
3. Use Node file reads within tests to load fixtures.
4. Ensure tests fail if output differences occur; document how to update fixtures if spec changes intentionally.
5. Provide example fixture JSON structures with stub field names matching earlier spec stubs. Provide example text lines with correct padding based on stub lengths.
6. Include integration test code in TypeScript.

Provide the fixture files content and integration test code. If full real-world spec is unavailable, show synthetic stubs consistent with earlier record definitions.
```

---

### Prompt 12: Browser Bundling & Distribution Setup

````text
Context:
- Library works in Node; need to bundle for browser usage.

Task:
1. Choose bundler: use Rollup. Create `rollup.config.js` at project root:
   - Input: `src/index.ts`.
   - Outputs:
     - ESM build: `dist/opcn1214-generator.esm.js`, format `es`.
     - UMD build: `dist/opcn1214-generator.umd.js`, format `umd`, name `opcn1214Generator`.
   - Externalize dependencies (e.g., `zod`, `date-fns`) or bundle them? For simplicity, mark them external and document that user must bundle or include separately.
   - Include TypeScript plugin (`@rollup/plugin-typescript`) to handle TS.
   - Include JSON plugin (`@rollup/plugin-json`) to bundle spec JSON if needed.
   - Generate source maps.
2. Update `package.json`:
   - `"main"` pointing to UMD build or CommonJS? If we want CJS as well, add separate build step (e.g., via tsc). Include `"module"` for ESM build.
   - `"types"` pointing to `dist/index.d.ts`.
   - Scripts: `"build": "tsc && rollup -c"`.
3. Ensure spec JSON can be imported in browser:
   - If dynamic imports not possible, modify loader to use a static map:
     ```ts
     import spec2024 from './config/2024.json';
     const specMap: Record<number, any> = { 2024: spec2024 };
     export function getSpecForYear(year: number) { ... specMap[year] ... }
     ```
4. Build and test:
   - Run `npm run build`, then create a minimal HTML file in `examples/browser.html`:
     ```html
     <script src="dist/opcn1214-generator.umd.js"></script>
     <script>
       const result = opcn1214Generator.parse("...", 2024);
       console.log(result);
     </script>
     ```
   - Document that in README.
5. Write a Node script test (`scripts/test-bundle.js`) that imports built ESM or CJS bundle and runs a simple parse/generate.
6. Adjust GitHub Actions to include bundling step and basic smoke test loading the bundle.
7. Provide `rollup.config.js`, updated `package.json` sections, loader modifications, and example HTML.

Return the TypeScript/JS configuration code and instructions.
````

---

### Prompt 13: Documentation & Examples

```text
Context:
- Library code and bundling in place.
- Need to generate documentation and add examples.

Task:
1. Add JSDoc comments in code:
   - For public API functions (`parse`, `generate`, `validate`), include descriptions, parameter docs, return types, thrown errors.
   - For types like `ReportData`, describe structure and when fields are required.
   - For error shapes, explain properties.
2. Configure TypeDoc:
   - Add `typedoc.json` with entry point `src/index.ts`, outDir `docs`, options to include private false, exclude tests and config files.
   - Add script `"docs": "typedoc"`.
3. Write `README.md`:
   - Overview: what is `opcn1214-generator`.
   - Installation: `npm install opcn1214-generator`.
   - Basic usage example in Node: parse/generate/validate snippet with placeholder data.
   - Browser usage: explain script tag from UMD build.
   - Error handling: example catching errors from validation/generation.
   - How to add new tax year: link to `SPEC_DEFINITION.md`.
   - Contribution guidelines summary.
   - License, disclaimers.
4. Create `SPEC_DEFINITION.md` (if not fully done earlier):
   - Describe JSON spec file structure: top-level `year`, `records` array, each with recordType, recordLength, fields array with each SpecField property explained.
   - Example snippet.
   - Steps for adding/updating fields for a new year.
5. Add examples in `examples/` directory:
   - `examples/parse.ts`: script that loads library, reads sample text, parses, logs JSON.
   - `examples/generate.ts`: builds a sample `ReportData` object, calls generate, writes output to file.
   - Document how to run: `node -r ts-node/register examples/parse.ts`.
6. Generate documentation:
   - Run `npm run docs`, verify HTML or markdown output in `docs/`.
   - Optionally configure GitHub Pages to serve `docs/`.
7. Write integration in README to point to docs URL.

Provide JSDoc-annotated sample code blocks for `parse`, `generate`, `validate`, a sample README.md content, typedoc.json, and SPEC_DEFINITION.md content.
```

---

### Prompt 14: CI/CD & Release Process

```text
Context:
- Code, tests, bundling, and docs are ready.
- Need automated CI and release.

Task:
1. GitHub Actions workflows:
   - `ci.yml` (already exists) updated to:
     - On push to main and PR: run `npm ci`, `npm run lint`, `npm run type-check`, `npm run test`, `npm run build`.
     - On tag push (e.g., v*.*.*): run `npm run build`, `npm run docs`, and publish to npm.
   - Use secrets for NPM_TOKEN.
   - Example workflow steps for npm publish.
2. Semantic versioning:
   - Decide on commit conventions (e.g., Conventional Commits).
   - Configure semantic-release or manual instructions in CONTRIBUTING.md.
3. Coverage:
   - Use Vitest coverage: add step in CI, optionally fail if coverage < threshold.
4. Documentation deployment:
   - After docs generation, commit or deploy to GitHub Pages (e.g., via `peaceiris/actions-gh-pages`).
5. Badges:
   - Add badges for build, coverage, npm version in README.
6. Provide `.github/workflows/release.yml` snippet for publishing on tag.
7. Write `CONTRIBUTING.md`:
   - Describe process: open PR for new features/tests, commit conventions, how releases are cut.
8. Provide the YAML configurations and any scripts (e.g., `release.sh`) necessary.

Return the CI/CD config files and brief instructions for maintainers.
```

---

### Prompt 15: Maintenance Guidelines & Adding New Tax Year

```text
Context:
- Library is published and in use for tax year 2024.
- Need clear instructions, scripts, and templates for future maintainers to add new tax year (e.g., 2025 spec).

Task:
1. In `CONTRIBUTING.md` or separate `MAINTENANCE.md`, describe:
   - Steps to add new tax year:
     1. Copy `src/config/2024.json` to `src/config/2025.json`.
     2. Update field definitions per official spec changes.
     3. Update `src/config/taxYearConfig.ts` for 2025 config (maxRecords, any new rules).
     4. Run or update any schema-generator script to regenerate Zod schemas for changed records.
     5. Update unit tests: for each record type changed or new, add/modify tests in `tests/unit/schemas/`, `parser`, `generator`, `validator`.
     6. Add integration fixtures in `tests/fixtures/2025/`.
     7. Run full test suite for year 2025: `npm run test`. Ensure parse/generate/validate works.
     8. Bump version in `package.json` (e.g., minor version bump).
     9. Update docs (`SPEC_DEFINITION.md`, README examples) to mention new year support.
   - Highlight how to handle deprecated fields or removed record types.
   - How to handle version-specific differences in code (e.g., use conditional logic if field moved position).
   - How to test backward compatibility if needed.
   - How to deploy new version to npm.
2. Provide a template script (e.g., `scripts/add-new-year.ts`) that:
   - Prompts for new year number.
   - Copies previous year JSON to new file.
   - Updates `taxYearConfig` stub for new year.
   - Reminds developer to fill changes.
3. Provide sample code for schema generator: if using a script that reads spec JSON and outputs Zod schema files, show how to run it for new year.
4. Provide example commit message guidelines when adding new year: “feat: add support for tax year 2025”.
5. Provide the content of `MAINTENANCE.md` or updated `CONTRIBUTING.md`.

Return the maintenance guide and helper script code.

```

---

With the above prompts, each step is integrated: after running Prompt 1, the project scaffold
exists; Prompt 2 adds spec loader; Prompt 3 builds schema for record1000; Prompt 4 adds
parser/generator for 1000; Prompt 5 business rules; Prompt 6 adds 1010/1020; Prompt 7 orchestration;
Prompt 8 optional sections; Prompt 9 utilities; Prompt 10 versioning; Prompt 11 integration tests;
Prompt 12 bundling; Prompt 13 docs; Prompt 14 CI/CD; Prompt 15 maintenance.

Feed these prompts sequentially to your code-generation LLM, verifying at each stage that generated
code passes tests before proceeding to next prompt. Adjust spec stubs to real fields when actual
spec details are available.

---

### Final Note

- At each prompt, ensure the LLM references existing files: e.g., `src/config/loader.ts`,
  `src/schemas/record1000.ts`, so the code integrates.
- After each generated code, run tests (`npm run test`) to catch errors early.
- When real field definitions from Israeli Tax Authority spec become available, replace stubbed
  fields in `src/config/<year>.json`, regenerate schemas or manually adjust Zod schemas, update
  tests/fixtures accordingly.
- Keep steps small: for complex schemas (dozens of fields), break down further: e.g., handle group
  of related fields in separate test or partial schema generation.
- Always write tests first (TDD): for each new record type or utility, write tests reflecting
  expected behavior before generating implementation.
- Use consistent error codes from `VALIDATION_CODES` to ensure uniform error handling.
