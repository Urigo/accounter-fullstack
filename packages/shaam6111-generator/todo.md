# ✅ SHAAM 6111 Package – Development Checklist

A structured, test-driven checklist for building a Node.js/TypeScript package to generate, parse,
and validate Israeli SHAAM 6111 tax reports.

---

## 📁 Phase 1: Project Setup & Types

- [x] Initialize TypeScript project with `tsconfig.json` and `package.json`
- [x] Add and configure Vitest for testing
- [x] Set up folder structure:
  - `src/`
  - `src/types/`
  - `src/schemas/`
  - `src/generators/`
  - `src/parsers/`
  - `src/utils/`
  - `tests/fixtures/`

### 🧾 Define Types

- [x] Define `ReportData` structure (with clear field names)
- [x] Define `HeaderRecord`, `SupplierRecord`, etc.
- [x] Define `ValidationError` interface
- [x] Define `ValidationResult` structure
- [x] Define custom error classes:
  - [x] `ValidationError`
  - [x] `ParsingError`

---

## 🔍 Phase 2: Validation (Zod First)

### 🧪 Header Schema

- [x] Implement `headerSchema` using Zod
  - [x] Add field-level validation (e.g., length, number format)
- [x] Write unit tests for `headerSchema`
  - [x] Valid inputs
  - [x] Invalid inputs

### ✅ Data Validator

- [x] Implement `validateData()` using Zod schemas
- [x] Aggregate validation errors by field and record
- [x] Return `ValidationResult` object
- [x] Write unit and integration tests:
  - [x] Single record validation
  - [x] Multi-record validation

---

## 🔤 Phase 3: Encoding Utilities

- [x] Implement `toWindows1255(input: string): Buffer`
- [x] Implement `fromWindows1255(buffer: Buffer): string`
- [x] Use `iconv-lite` for encoding/decoding
- [x] Write unit tests:
  - [x] Hebrew → Windows-1255 → Hebrew
  - [x] English support
  - [x] Special characters and edge cases

---

## 🏗️ Phase 4: Report Generation

### 🧱 Record Generators

- [x] Implement `generateHeaderRecord()`

  - [x] Fixed-width formatting
  - [x] Padding/truncating logic
  - [x] Tests for output length and format

- [x] Implement generators for all other record types
- [x] Write tests for each record generator

### 🧾 Full Report Generator

- [x] Implement `generateReport(data: ReportData): string`
  - [x] Validate before generating
  - [x] Assemble full file section-by-section
- [x] Write integration test for `generateReport()`

---

## 🔍 Phase 5: Report Parsing

### 🧩 Record Parsers

- [x] Implement `parseHeaderRecord(line: string): HeaderRecord`

  - [x] Fixed-width slicing and conversion
  - [ ] Throw `ParsingError` on malformed input
  - [x] Unit tests

- [x] Implement parsers for all other record types
- [x] Write unit tests for each parser

### 🧾 Full Report Parser

- [x] Implement `parseReport(content: string): ReportData`
  - [x] Detect and dispatch per-record type
  - [x] Validate line counts and formats
- [ ] Write integration tests:
  - [ ] Full string → object
  - [ ] Multi-line validation

---

## 🧪 Phase 6: Report Validation

- [ ] Implement `validateReport(content: string): ValidationResult`
  - [ ] Parse report
  - [ ] Validate parsed data
  - [ ] Aggregate and return results
- [ ] Write tests for:
  - [ ] Valid file
  - [ ] Malformed file
  - [ ] Missing/extra fields

---

## 🧷 Phase 7: Fixtures and Roundtrip Testing

### 📁 Fixtures

- [ ] Create fixture: `tests/fixtures/validReports/sample1.txt`
- [ ] Create fixture: `tests/fixtures/invalidReports/sample1.txt`

### 🔁 Roundtrip Tests

- [ ] Write test:
  - [ ] Input → generate → parse → expect deep equality
- [ ] Add encoding edge cases
- [ ] Add tests for:
  - [ ] Extra/missing lines
  - [ ] Field length overflows
  - [ ] Invalid encodings

---

## 📦 Finalization

- [ ] Add README with usage examples
- [ ] Add CLI or Node API interface (optional)
- [ ] Lint and format code
- [ ] Ensure 100% test coverage
- [ ] Add GitHub Actions or CI pipeline

---

## 🧹 Polish and Publish

- [ ] Run type checks and linter
- [ ] Tag initial release
- [ ] Publish to NPM
