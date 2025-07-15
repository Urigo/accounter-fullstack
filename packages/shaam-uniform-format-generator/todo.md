# TODO Checklist for SHAAM Uniform Format Generator & Parser

This checklist follows the phased, iterative blueprint for building the project in a test‑driven,
modular manner. Each item uses a checkbox `[ ]` for easy marking.

---

## Phase 0: Project Kick‑Off ✅ COMPLETED

[x] Initialize repository [x] `git init` [x] `npm init -y`

[x] Install dependencies [x] `npm install typescript zod vite vitest expect-type`

[x] Create configuration files [x] `tsconfig.json` (strict mode) [x] `vitest.config.ts`

[x] Create `README.md` stub

---

## Phase 1: Core API & Orchestrator ✅ COMPLETED

[x] Scaffold `src/index.ts` [x] Implement stub `generateUniformFormatReport(input, options?)` [x]
Export stubbed function

[x] Define initial types [x] `src/types/input-schema.ts` with empty `ReportInput` and `ReportOutput`

[x] Add Vitest test [x] `tests/index.spec.ts` to import stub and assert return shape

[x] Run smoke test: `vitest --run`

---

## Phase 2: Validation Pipeline ✅ COMPLETED

[x] Define Zod schemas [x] `src/types/input-schema.ts`: `BusinessMetadataSchema`,
`ReportInputSchema`

[x] Implement validation logic [x] `src/validation/validateInput.ts` with `fail-fast` and
`collect-all` modes

[x] Integrate validation into orchestrator [x] Call `validateInput` at start of
`generateUniformFormatReport`

[x] Write validation tests [x] Passing case with valid minimal input [x] Failing case: missing
required fields (`fail-fast`) [x] Failing case: multiple errors returned (`collect-all`)

---

## Phase 3: Fixed‑Width Formatting Helpers ✅ COMPLETED

[x] `src/format/padding.ts` [x] `padLeft(value, width, fill)` [x] `padRight(value, width, fill)`

[x] `src/format/newline.ts` [x] Export `CRLF = '\r\n'`

[x] `src/format/encoder.ts` [x] `formatField(value, width, align, padChar)` helper

[x] Unit tests for formatting [x] Test `padLeft` and `padRight` [x] Test `formatField` various
alignments

---

## Phase 4: Record Module Example — A100 ✅ COMPLETED

[x] Scaffold module `src/records/a100.ts`

[x] Define Zod schema (`A100Schema`) and TS type `A100`

[x] Implement `encodeA100(input: A100): string`

[x] Implement `parseA100(line: string): A100`

[x] Write Vitest tests [x] Round-trip JSON → line → JSON [x] Error on invalid line lengths

[x] Confirm module exports [x] `A100Schema`, `encodeA100`, `parseA100`

---

## Phase 5: File Assembly (INI.TXT)

[ ] Implement CRLF join logic in `src/format/encoder.ts`

[ ] In `src/index.ts`, build `iniText` [ ] Call `encodeA100` [ ] Append summary records placeholder

[ ] Write test for `iniText` [ ] Stub input with minimal `business` metadata [ ] Assert `iniText`
contains the `A100` line

---

## Phase 6: Implement Remaining Records

### Documents: C100, D110, D120

[ ] Scaffold `src/records/C100.ts`, `src/records/D110.ts`, `src/records/D120.ts` [ ] Define Zod
schemas + TS types [ ] Implement `encodeXXX` and `parseXXX` [ ] Write round-trip tests

### Journal Entries: B100

[ ] Scaffold `src/records/B100.ts` [ ] Zod schema, TS type, encoder, parser, tests

### Accounts: B110

[ ] Scaffold `src/records/B110.ts` [ ] Zod schema, TS type, encoder, parser, tests

### Inventory: M100

[ ] Scaffold `src/records/M100.ts` [ ] Zod schema, TS type, encoder, parser, tests

### Closing Record: Z900

[x] Scaffold `src/records/Z900.ts` [x] Zod schema, TS type, encoder, parser, tests

---

## Phase 7: Full Integration & Data File

[ ] Wire all `encodeXXX` calls in `src/index.ts` [ ] Assemble `dataText` for `BKMVDATA.TXT` [ ]
Create `File` objects for both outputs

[ ] Write integration test [ ] Use comprehensive `ReportInput` fixture [ ] Assert `dataText` matches
spec example [ ] Parse back and compare semantic objects

---

## Phase 8: DX, Enums, & Packaging

[ ] Define `src/types/enums.ts` with code tables [ ] Document types, currency codes, country codes,
etc.

[ ] Export enums and literal unions

[ ] Implement `src/utils/fileHelpers.ts` [ ] `createFile(text: string, name: string): File`

[ ] Document public API usage in `README.md`

[ ] Configure CI (Vitest + lint) with GitHub Actions

---

## Phase 9: Documentation & Release

[ ] Finalize `README.md` with examples [ ] Bump version to `0.1.0` [ ] Publish to npm [ ] Tag
`v0.1.0` in Git

---

## ✅ Implementation Status

### Completed Infrastructure ✅

- [x] Project scaffolding with TypeScript, Zod, Vitest, and ESLint
- [x] Strict TypeScript configuration
- [x] Basic Zod schemas for input validation
- [x] Core API structure with placeholder implementations
- [x] Fixed-width encoding/decoding utilities
- [x] Basic testing setup and passing smoke test
- [x] File structure for all record types (placeholder exports)
- [x] Build system working correctly

### Completed Validation Pipeline ✅

- [x] Comprehensive Zod schemas for all input types
- [x] Validation logic with both `fail-fast` and `collect-all` modes
- [x] Custom error handling with `ShaamFormatError`
- [x] Integration of validation into main API
- [x] Full test coverage for validation scenarios
- [x] All linting and type-checking issues resolved

### Completed A100 Record Module ✅

- [x] Complete A100 record implementation with Zod schema and TypeScript types
- [x] Fixed-width encoder and parser functions with proper field formatting
- [x] Comprehensive test suite with 20 tests covering validation, encoding, parsing, and round-trip
      scenarios
- [x] Error handling for invalid record lengths and formats
- [x] Field truncation and padding according to SHAAM specification
- [x] Integration with core formatting utilities
- [x] All tests passing and build successful

### Ready for Next Phase

The project is now ready for Phase 5 (File Assembly) implementation. The A100 record module is
complete and serves as a solid foundation for implementing the remaining record types.
