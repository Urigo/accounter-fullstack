# TODO Checklist for SHAAM Uniform Format Generator & Parser

This checklist follows the phased, iterative blueprint for building the project in a test‑driven,
modular manner. Each item uses a checkbox `[ ]` for easy marking.

---

## Phase 0: Project Kick‑Off

[ ] Initialize repository [ ] `git init` [ ] `npm init -y`

[ ] Install dependencies [ ] `npm install typescript zod vite vitest expect-type`

[ ] Create configuration files [ ] `tsconfig.json` (strict mode) [ ] `vitest.config.ts`

[ ] Create `README.md` stub

---

## Phase 1: Core API & Orchestrator

[ ] Scaffold `src/index.ts` [ ] Implement stub `generateUniformFormatReport(input, options?)` [ ]
Export stubbed function

[ ] Define initial types [ ] `src/types/input-schema.ts` with empty `ReportInput` and `ReportOutput`

[ ] Add Vitest test [ ] `tests/index.spec.ts` to import stub and assert return shape

[ ] Run smoke test: `vitest --run`

---

## Phase 2: Validation Pipeline

[ ] Define Zod schemas [ ] `src/types/input-schema.ts`: `BusinessMetadataSchema`,
`ReportInputSchema`

[ ] Implement validation logic [ ] `src/validation/validateInput.ts` with `fail-fast` and
`collect-all` modes

[ ] Integrate validation into orchestrator [ ] Call `validateInput` at start of
`generateUniformFormatReport`

[ ] Write validation tests [ ] Passing case with valid minimal input [ ] Failing case: missing
required fields (`fail-fast`) [ ] Failing case: multiple errors returned (`collect-all`)

---

## Phase 3: Fixed‑Width Formatting Helpers

[ ] `src/format/padding.ts` [ ] `padLeft(value, width, fill)` [ ] `padRight(value, width, fill)`

[ ] `src/format/newline.ts` [ ] Export `CRLF = '\r\n'`

[ ] `src/format/encoder.ts` [ ] `formatField(value, width, align, padChar)` helper

[ ] Unit tests for formatting [ ] Test `padLeft` and `padRight` [ ] Test `formatField` various
alignments

---

## Phase 4: Record Module Example — A100

[ ] Scaffold module `src/records/A100.ts`

[ ] Define Zod schema (`A100Schema`) and TS type `A100`

[ ] Implement `encodeA100(input: A100): string`

[ ] Implement `parseA100(line: string): A100`

[ ] Write Vitest tests [ ] Round-trip JSON → line → JSON [ ] Error on invalid line lengths

[ ] Confirm module exports [ ] `A100Schema`, `encodeA100`, `parseA100`

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

[ ] Scaffold `src/records/Z900.ts` [ ] Zod schema, TS type, encoder, parser, tests

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

_Mark `[x]` when a task is done. Use this as your actionable roadmap._
