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
  - [x] Add basic `README.md` stub explaining purpose.
  - [x] Add `.gitignore` (`node_modules/`, `dist/`, coverage, etc.).
  - [x] Setup GitHub Actions CI:
    - `.github/workflows/ci.yml` to run lint, type-check, tests on push/PR.
  - [ ] (Optional) Setup Husky or pre-commit hooks for linting/formating.

---

## 🧱 2. Core Types & Interfaces

- [ ] Define shared `ValidationError`, `ParseError`, `GenerateError` types
- [ ] Define `ReportData` structure with sub-interfaces
- [ ] Define all supported record types and their associated interfaces
- [ ] Create common `TaxYearConfig` structure
- [ ] Export everything cleanly from `types.ts`

---

## 📋 3. Constants & Metadata

- [ ] Define `RECORD_TYPES` and descriptions
- [ ] Define `VALIDATION_CODES`
- [ ] Define `FIELD_CODES`, `TAX_YEARS`
- [ ] Define per-record type character lengths
- [ ] Define line endings, max record counts, padding chars
- [ ] Create map of required vs optional record types

---

## 📜 4. Zod Schemas (Per Record Type)

- [ ] Create a base schema factory utility
- [ ] Implement schemas for:

  - [ ] 1000 - Main Form
  - [ ] 1010 - Related Companies
  - [ ] 1020 - Shareholders
  - [ ] 1030 - R\&D Investments
  - [ ] 2000 - Foreign Appendix
  - [ ] 2200 - Foreign Incomes
  - [ ] 3027–3077 - Capital Gains Variants
  - [ ] 9999 - End Record

- [ ] Create `reportDataSchema` for top-level validation
- [ ] Add per-tax-year schema map (2024+)
- [ ] Add tests for all schemas using valid + invalid data

---

## ⚙️ 5. Utilities

- [ ] Add RTL Unicode control injection helper
- [ ] Add field padder/trimmer (right/left aligned)
- [ ] Add string formatting helpers (dates, IDs, etc.)
- [ ] Add normalization function for full report
- [ ] Add function to handle CRLF encoding and trimming

---

## 🧪 6. Validation Engine

- [ ] Implement validation module:

  - [ ] Accept structured object or string
  - [ ] Validate structure + types (Zod)
  - [ ] Enforce business rules (record limits, cross-field rules)
  - [ ] Apply RTL controls
  - [ ] Return consistent `ValidationResult`

- [ ] Add support for tax year-based validation rules
- [ ] Add tests for valid + invalid validation flows
- [ ] Add edge case and max record count tests

---

## 🧵 7. Parser Module

- [ ] Implement strict parser:

  - [ ] Accept UTF-8 OPCN text, CRLF-separated
  - [ ] Parse line-by-line by record type
  - [ ] Map fields by position
  - [ ] Validate line length
  - [ ] Return `ParseResult` with `ReportData`
  - [ ] Handle unknown or malformed records

- [ ] Add tests for:

  - [ ] Valid full reports
  - [ ] Reports with missing/extra records
  - [ ] Invalid lines and format
  - [ ] Real + synthetic fixture coverage

---

## 🛠️ 8. Generator Module

- [ ] Implement `generate` function:

  - [ ] Accept `ReportData`
  - [ ] Validate internally
  - [ ] Normalize and pad fields
  - [ ] Add mandatory and optional records
  - [ ] Auto-append 9999 end record
  - [ ] Return `GenerateResult` with OPCN-formatted string

- [ ] Add RTL injection where needed
- [ ] Add tests for:

  - [ ] Valid generation
  - [ ] Round-trip test (generate → parse → validate)
  - [ ] Field alignment + padding
  - [ ] Max-length edge cases

---

## 🔁 9. Integration & Round-Trip Testing

- [ ] Add end-to-end tests:

  - [ ] Parse → Validate → Generate → Parse
  - [ ] Validate → Generate → Parse → Validate

- [ ] Create fixtures for each supported record type
- [ ] Add snapshot tests for generated OPCN text
- [ ] Add regression tests for known bugs

---

## 📚 10. Documentation

- [ ] Write README with usage examples
- [ ] Add inline JSDoc to all exported functions/types
- [ ] Generate API docs (optional)
- [ ] Document all validation error codes
- [ ] Create example `ReportData` JSON for devs
- [ ] Write schema migration notes per tax year

---

## 🚀 11. Build & Release

- [ ] Confirm Node + browser bundle outputs
- [ ] Test ESM + CJS consumption
- [ ] Verify type declarations
- [ ] Finalize `package.json` (exports, keywords, version, etc.)
- [ ] Add LICENSE
- [ ] Publish to npm
- [ ] Tag v1.0.0

---

## 🧪 12. Optional QA Checklist

- [ ] Memory test with full-length inputs
- [ ] Load test for report with 99 shareholders, 30 incomes, all capital gains
- [ ] Run in browser (ESM bundle) and validate output
- [ ] Verify RTL controls render correctly in Hebrew fields
- [ ] Verify CRLF encoding on generated file

---
