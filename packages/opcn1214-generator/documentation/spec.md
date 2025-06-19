# OPCN 1214 Generator - Final Technical Specification

## Overview

A TypeScript library for generating, parsing, and validating Israeli tax form 1214 reports in OPCN
format. The library provides full compliance with Israeli Tax Authority specifications, supporting
strict validation, normalized output, and tax-year versioning.

## Package Information

- **Package Name**: `opcn1214-generator`
- **Description**: Israeli tax form 1214 OPCN report generator, parser, and validator with strict
  and normalized validation
- **Keywords**: `1214`, `opcn`, `accountancy`, `accounter`, `israeli-tax`, `tax-forms`
- **Target Environment**: Node.js 24.2.0+ and modern browsers
- **Dependencies**: TypeScript, Zod, date-fns

## Core Principles

- Designed for developers integrating with accountancy platforms
- Assumes structured data as primary input
- Enforces strict validation and normalization
- Supports UTF-8 output with RTL controls
- One report per file
- Full compliance with SHAAM specs
- Versioned schemas per tax year
- No optional CLI or extensions

## Architecture

The library follows a modular architecture:

- **Core Modules**: `parser`, `generator`, `validator`
- **Schemas**: Tax-year-specific Zod schemas
- **Constants**: Field lengths, record limits, error codes
- **Interfaces**: Typed input/output for strong validation
- **Utilities**: RTL control injection, normalization helpers, padding utilities

## Main Exports

```ts
import {
  parse,
  generate,
  validate,
  // Types
  ReportData,
  ValidationError,
  ParseError,
  GenerateError,
  // Schemas
  reportDataSchema,
  recordType1000Schema,
  ...
  // Constants
  RECORD_TYPES,
  FIELD_CODES,
  TAX_YEARS,
  VALIDATION_CODES,
} from 'opcn1214-generator';
```

## API Function Signatures

```ts
function parse(reportText: string, taxYear: number): ParseResult
function generate(data: ReportData, taxYear: number): GenerateResult
function validate(input: ReportData | string, taxYear: number): ValidationResult
```

## Behavior Summary

| Feature                  | Behavior                                        |
| ------------------------ | ----------------------------------------------- |
| Validation               | Strict, schema + business rules                 |
| Generation               | Normalizes data, fails on invalid input         |
| Normalization            | Trims, formats, pads fields as needed           |
| RTL Handling             | Applies Unicode bidi controls in Hebrew strings |
| Empty Sections           | Includes placeholders with default/zero values  |
| Multi-report Files       | Not supported                                   |
| Derived Fields           | Computed internally where applicable            |
| Record Limit Exceedance  | Fails with clear validation error               |
| Parser Strictness        | Rejects malformed/extra records                 |
| Field Introspection      | Not exposed                                     |
| Schema Versioning        | Per tax year                                    |
| Validation Modes         | No strict/lenient toggle                        |
| Error Language           | English only                                    |
| Browser Support          | Included (minified ESM/UMD bundle)              |
| Memory Usage             | All-at-once processing                          |
| Test Fixtures            | Real-world + synthetic                          |
| CLI Support              | Not included                                    |
| End Record (9999)        | Auto-appended                                   |
| Raw Line Metadata        | Not returned                                    |
| Inter-record Checks      | Only if spec requires                           |
| Unknown Tax Years        | Strictly rejected                               |
| Custom Extensions        | Disallowed                                      |
| Pretty Print / Logging   | Out of scope                                    |
| Zod Schemas & Types      | Exposed                                         |
| Error Codes              | Consistent and machine-readable                 |
| Extra Metadata in Output | Disallowed                                      |

## Data Structures

```ts
interface ReportData {
  mainForm: MainFormData // Record type 1000
  relatedCompanies?: RelatedCompanyData[] // Record type 1010 (max 3)
  shareholders: ShareholderData[] // Record type 1020 (max 99, min 1 except kibbutzim)
  rdInvestments?: RDInvestmentData[] // Record type 1030 (max 5)
  foreignAppendix?: ForeignAppendixData // Record type 2000
  foreignIncomes?: ForeignIncomeData[] // Record type 2200 (max 30)
  capitalGains?: {
    stocks?: CapitalGainsStocksData[] // Record type 3027
    bettermentTax?: CapitalGainsBettermentData[] // Record type 3050
    forcedVirtualCurrency?: CapitalGainsForcedVirtualData[] // Record type 3051
    oilPartnership?: CapitalGainsOilData[] // Record type 3054
    securities?: CapitalGainsSecuritiesData[] // Record type 3060
    section6Securities?: CapitalGainsSection6Data[] // Record type 3063
    reit?: CapitalGainsREITData[] // Record type 3064
    noWithholding1322?: CapitalGainsNoWithholding1322Data[] // Record type 3065
    noWithholding1326?: CapitalGainsNoWithholding1326Data[] // Record type 3066
    other?: CapitalGainsOtherData[] // Record type 3077
  }
}
```

## Error Handling Strategy

All API functions return structured results instead of throwing errors directly. Errors include:

- **Code**: Machine-readable identifier (e.g., `INVALID_FORMAT`)
- **Message**: Human-readable description
- **Location**: `recordType`, `recordIndex`, `field`, `lineNumber`, `position`

```ts
interface ValidationError {
  field: string
  message: string
  code: string
  recordType: string
  recordIndex?: number
  value?: any
  expected?: string
}

interface ParseError extends ValidationError {
  lineNumber?: number
  position?: number
}

interface GenerateError extends ValidationError {}

interface ValidationResult {
  isValid: boolean
  errors: ValidationError[]
}

interface ParseResult {
  success: boolean
  data?: ReportData
  errors?: ParseError[]
}

interface GenerateResult {
  success: boolean
  reportText?: string
  errors?: GenerateError[]
}
```

## Validation Rules

### Structural Validation

- Required fields and record order
- Valid types: string, number, date
- Field length (min/max)
- Fixed format (IDs, dates)

### Business Rules Validation

- Record limits by section
- Field value ranges and constraints
- Cross-field validation rules
- Tax year specific rules
- Cross-record validation (e.g., total shareholder percentages)
- RTL direction enforced via Unicode controls
- Strict record type enforcement and ordering

### Validation Error Codes

```typescript
const VALIDATION_CODES = {
  REQUIRED_FIELD: 'REQUIRED_FIELD',
  INVALID_TYPE: 'INVALID_TYPE',
  INVALID_FORMAT: 'INVALID_FORMAT',
  FIELD_TOO_LONG: 'FIELD_TOO_LONG',
  FIELD_TOO_SHORT: 'FIELD_TOO_SHORT',
  INVALID_RANGE: 'INVALID_RANGE',
  MAX_RECORDS_EXCEEDED: 'MAX_RECORDS_EXCEEDED',
  MIN_RECORDS_NOT_MET: 'MIN_RECORDS_NOT_MET',
  CROSS_FIELD_VALIDATION: 'CROSS_FIELD_VALIDATION',
  TAX_YEAR_NOT_SUPPORTED: 'TAX_YEAR_NOT_SUPPORTED'
} as const
```

## OPCN Report Format

- Fixed-width lines, per official spec
- UTF-8 encoded with CRLF endings
- Required records: 1000, 1020, 9999
- Optional: 1010, 1030, 2000, 2200, 3027–3077
- Field padding/alignment enforced strictly
- Includes zero-value placeholders for unused sections

## Supported Record Types

Record types follow official specification. Each has:

- Exact character length
- Field layout and filler zones
- Repeatability constraints
- Examples: `1000`, `1010`, `1020`, ..., `3077`, `9999`

### Record Structure

Each record follows the specification format:

- Form Type (4 positions): "1214"
- Record Type (4 positions): "1000", "1010", etc.
- Filler (128 positions): Reserved for future use
- Data fields with fixed widths and positions
- Total record length varies by type

### Record Types and Lengths

- **1000** (Main Form): 4232 characters
- **1010** (Related Companies): 1160 characters
- **1020** (Shareholders): 1160 characters
- **1030** (R&D Investments): 336 characters
- **2000** (Foreign Appendix): 2184 characters
- **2200** (Foreign Income): 1210 characters
- **3027-3077** (Capital Gains): 2184 characters each
- **9999** (End Record): 150 characters

### Output Format

- Fixed-width text format only
- Proper padding and alignment according to specification
- Hebrew text support (UTF-8 encoding)
- CRLF line endings

## Tax Year Support

### Implementation

- Tax years are explicitly versioned. Tax year parameter affects validation rules and record
  structures
- Support for multiple tax years (2024+)
- Year-specific validation rules and field requirements
- Future extensibility for specification changes
- Unsupported years trigger immediate error.

### Configuration

```ts
interface TaxYearConfig {
  year: number
  maxRecords: {
    relatedCompanies: number
    shareholders: number
    rdInvestments: number
    foreignIncomes: number
    capitalGainsAppendices: number
  }
  requiredFields: Record<string, string[]>
  fieldLengths: Record<string, number>
  derivedFieldRules: Record<string, (...args: any[]) => string | number>
}
```

## Build & Distribution

### Runtime Dependencies

- `zod`: Schema validation
- `date-fns`: Date formatting and manipulation

### Development Dependencies

- `typescript`: TypeScript support
- `@types/node`: Node.js type definitions
- Standard development tooling (vitest, eslint, prettier, etc.)

## Build Configuration

### Targets

- Node.js 24.2.0+ (ESM and CommonJS)
- Modern browsers (ES2022+)
- TypeScript declaration files

### Output

- ESM modules for modern environments
- CommonJS for legacy Node.js compatibility
- Minified browser bundle
- Source maps for debugging

## API Usage Examples

### Parsing a Report

```typescript
import { parse } from 'opcn1214-generator'

const reportText = '1214100012800000...' // OPCN format text
const result = parse(reportText, 2024)

if (result.success) {
  console.log('Parsed data:', result.data)
} else {
  console.error('Parse errors:', result.errors)
}
```

### Generating a Report

```typescript
import { generate } from 'opcn1214-generator'

const reportData: ReportData = {
  mainForm: {
    /* ... */
  },
  shareholders: [
    {
      /* ... */
    }
  ]
  // ... other sections
}

const result = generate(reportData, 2024)

if (result.success) {
  console.log('Generated report:', result.reportText)
} else {
  console.error('Generation errors:', result.errors)
}
```

### Validating Data

```typescript
import { validate } from 'opcn1214-generator'

// Validate structured data
const dataResult = validate(reportData, 2024)

// Validate report text
const textResult = validate(reportText, 2024)

if (!dataResult.isValid) {
  console.error('Validation errors:', dataResult.errors)
}
```

## Testing Plan

**Unit Tests**

- All validation rules, including field validation and limits (types, length, format)
- Schema adherence per tax year
- RTL formatting
- All parsing scenarios
- All generation scenarios
- Error handling
- Edge cases

**Integration Tests**

- End-to-end parsing and generation
- Report generation → parse → validate round-trips
- Tests for all record types (valid and invalid variants)

**Fixtures**

- Real-world anonymized 1214 samples (OPCN text)
- Fully valid JSON `ReportData` inputs
- Synthetic edge cases for every record type

**Performance**

- Large record sets within limits
- Memory profiling under peak load
- Browser compatibility tests

## Documentation Requirements

- Auto-generated API docs from types
- Usage examples for `parse`, `generate`, `validate`
- Error code reference table
- Developer integration guide
- Schema migration notes per year

## Deliverables

1. **Core Library**: Full TypeScript implementation
2. **Schemas**: Versioned per supported tax year
3. **Type Definitions**: Complete TypeScript declarations
4. **Tests**: Complete test coverage as above
5. **Docs**: API reference + integration guides
6. **Build Outputs**: Browser, Node, and type bundles
7. **Package Metadata**: `package.json`, README, LICENSE
