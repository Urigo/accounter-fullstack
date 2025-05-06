# ✅ SHAAM 6111 Package – Development Checklist

A structured, test-driven checklist for building a Node.js/TypeScript package to generate, parse,
and validate Israeli SHAAM 6111 tax reports.

---

## 📁 Phase 1: Project Setup & Types

- [ ] Initialize TypeScript project with `tsconfig.json` and `package.json`
- [ ] Add and configure Vitest for testing
- [ ] Set up folder structure:
  - `src/`
  - `src/types/`
  - `src/schemas/`
  - `src/generators/`
  - `src/parsers/`
  - `src/utils/`
  - `tests/fixtures/`

### 🧾 Define Types

- [ ] Define `ReportData` structure (with clear field names)
- [ ] Define `HeaderRecord`, `SupplierRecord`, etc.
- [ ] Define `ValidationError` interface
- [ ] Define `ValidationResult` structure
- [ ] Define custom error classes:
  - [ ] `ValidationError`
  - [ ] `ParsingError`

---

## 🔍 Phase 2: Validation (Zod First)

### 🧪 Header Schema

- [ ] Implement `headerSchema` using Zod
  - [ ] Add field-level validation (e.g., length, number format)
- [ ] Write unit tests for `headerSchema`
  - [ ] Valid inputs
  - [ ] Invalid inputs

### 🧪 Other Schemas

- [ ] Implement `SupplierRecord` schema
- [ ] Implement `CustomerRecord` schema
- [ ] Implement all other record schemas
- [ ] Write tests for each schema

### ✅ Data Validator

- [ ] Implement `validateData()` using Zod schemas
- [ ] Aggregate validation errors by field and record
- [ ] Return `ValidationResult` object
- [ ] Write unit and integration tests:
  - [ ] Single record validation
  - [ ] Multi-record validation

---

## 🔤 Phase 3: Encoding Utilities

- [ ] Implement `toWindows1255(input: string): Buffer`
- [ ] Implement `fromWindows1255(buffer: Buffer): string`
- [ ] Use `iconv-lite` for encoding/decoding
- [ ] Write unit tests:
  - [ ] Hebrew → Windows-1255 → Hebrew
  - [ ] English support
  - [ ] Special characters and edge cases

---

## 🏗️ Phase 4: Report Generation

### 🧱 Record Generators

- [ ] Implement `generateHeaderRecord()`

  - [ ] Fixed-width formatting
  - [ ] Padding/truncating logic
  - [ ] Tests for output length and format

- [ ] Implement generators for all other record types
- [ ] Write tests for each record generator

### 🧾 Full Report Generator

- [ ] Implement `generateReport(data: ReportData): string`
  - [ ] Validate before generating
  - [ ] Assemble full file line-by-line
- [ ] Write integration test for `generateReport()`

---

## 🔍 Phase 5: Report Parsing

### 🧩 Record Parsers

- [ ] Implement `parseHeaderRecord(line: string): HeaderRecord`

  - [ ] Fixed-width slicing and conversion
  - [ ] Throw `ParsingError` on malformed input
  - [ ] Unit tests

- [ ] Implement parsers for all other record types
- [ ] Write unit tests for each parser

### 🧾 Full Report Parser

- [ ] Implement `parseReport(content: string): ReportData`
  - [ ] Detect and dispatch per-record type
  - [ ] Validate line counts and formats
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
