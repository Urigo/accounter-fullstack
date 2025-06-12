# OPCN 1214 Generator - Technical Specification

## Overview

A TypeScript library for generating, parsing, and validating Israeli tax form 1214 reports in OPCN
format. This library provides comprehensive validation according to Israeli Tax Authority
specifications and supports multiple tax years.

## Package Information

- **Package Name**: `opcn1214-generator`
- **Description**: Israeli tax form 1214 OPCN report generator, parser, and validator with
  comprehensive validation
- **Keywords**: `1214`, `opcn`, `accountancy`, `accounter`, `israeli-tax`, `tax-forms`
- **Target Environment**: Node.js 24.2.0+ and modern browsers
- **Dependencies**: TypeScript, Zod, date-fns

## Core Architecture

### Main Exports

```typescript
import {
  FIELD_CODES,
  generate,
  GenerateError,
  parse,
  ParseError,
  // Constants
  RECORD_TYPES,
  recordType1000Schema,
  recordType1010Schema,
  recordType1020Schema,
  recordType1030Schema,
  recordType2000Schema,
  recordType2200Schema,
  recordType3027Schema,
  recordType3050Schema,
  recordType3051Schema,
  recordType3054Schema,
  recordType3060Schema,
  recordType3063Schema,
  recordType3064Schema,
  recordType3065Schema,
  recordType3066Schema,
  recordType3077Schema,
  // Types
  ReportData,
  // Schemas
  reportDataSchema,
  TAX_YEARS,
  validate,
  VALIDATION_LIMITS,
  ValidationError
} from 'opcn1214-generator'
```

### Function Signatures

```typescript
// Parse digital report text into structured data
function parse(reportText: string, taxYear: number): ParseResult

// Generate OPCN report text from structured data
function generate(data: ReportData, taxYear: number): GenerateResult

// Validate structured data or report text
function validate(input: ReportData | string, taxYear: number): ValidationResult
```

## Data Structures

### Input Data Structure (Hierarchical)

```typescript
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

### Record Type Interfaces

#### Main Form Data (Record Type 1000)

```typescript
interface MainFormData {
  // Company details (Part A, B of form)
  companyId: string
  companyName: string
  taxYear: number
  reportingDate: Date
  preparerDetails: PreparerDetails
  // All other form fields with proper typing
  // Total record length: 4232 characters
}

interface PreparerDetails {
  name: string
  id: string
  phone?: string
  email?: string
}
```

#### Related Companies Data (Record Type 1010)

```typescript
interface RelatedCompanyData {
  companyName: string
  companyId: string
  location: 'domestic' | 'foreign'
  relationshipType: string
  // Additional fields as per specification
  // Total record length: 1160 characters
}
```

#### Shareholder Data (Record Type 1020)

```typescript
interface ShareholderData {
  name: string
  id: string
  sharePercentage: number
  shareValue: number
  // Additional fields as per specification
  // Total record length: 1160 characters
}
```

#### R&D Investment Data (Record Type 1030)

```typescript
interface RDInvestmentData {
  companyName: string
  investmentAmount: number
  investmentDate: Date
  // Additional fields as per specification
  // Total record length: 336 characters
}
```

#### Foreign Appendix Data (Record Type 2000)

```typescript
interface ForeignAppendixData {
  // Foreign income details
  // Total record length: 2184 characters
}
```

#### Foreign Income Data (Record Type 2200)

```typescript
interface ForeignIncomeData {
  country: string
  incomeType: string
  amount: number
  // Additional fields as per specification
  // Total record length: 1210 characters
}
```

#### Capital Gains Data Interfaces (Record Types 3027-3077)

```typescript
interface CapitalGainsStocksData {
  // Stock capital gains details
  // Total record length: 2184 characters
}

interface CapitalGainsBettermentData {
  // Betterment tax capital gains details
  // Total record length: 2184 characters
}

// Similar interfaces for other capital gains types...
```

### Error Handling

#### Validation Error Structure

```typescript
interface ValidationError {
  field: string
  message: string
  code: string
  recordType: string
  recordIndex?: number
  value?: any
  expected?: string
}

interface ValidationResult {
  isValid: boolean
  errors: ValidationError[]
}
```

#### Parse Error Structure

```typescript
interface ParseError {
  field: string
  message: string
  code: string
  recordType: string
  recordIndex?: number
  value?: any
  expected?: string
  lineNumber?: number
  position?: number
}

interface ParseResult {
  success: boolean
  data?: ReportData
  errors?: ParseError[]
}
```

#### Generate Error Structure

```typescript
interface GenerateError {
  field: string
  message: string
  code: string
  recordType: string
  recordIndex?: number
  value?: any
  expected?: string
}

interface GenerateResult {
  success: boolean
  reportText?: string
  errors?: GenerateError[]
}
```

## Validation Rules

### Structural Validation

- Required fields validation
- Data type validation (string, number, date)
- Field length validation
- Format validation (dates, IDs, etc.)

### Business Rules Validation

- Maximum record limits:
  - Related companies: 3 records
  - Shareholders: 99 records (minimum 1, except kibbutzim)
  - R&D investments: 5 records
  - Foreign incomes: 30 records
  - Capital gains appendices: 14 total across all types
- Field value ranges and constraints
- Cross-field validation rules
- Tax year specific rules

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

## Text Report Format

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

- Tax year parameter affects validation rules and record structures
- Support for multiple tax years (2024+)
- Year-specific validation rules and field requirements
- Future extensibility for specification changes

### Configuration

```typescript
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
}
```

## Dependencies

### Runtime Dependencies

- `zod`: Schema validation
- `date-fns`: Date formatting and manipulation

### Development Dependencies

- `typescript`: TypeScript support
- `@types/node`: Node.js type definitions
- Standard development tooling (jest, eslint, etc.)

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

## Testing Requirements

### Unit Tests

- All validation rules
- All parsing scenarios
- All generation scenarios
- Error handling
- Edge cases

### Integration Tests

- End-to-end parsing and generation
- Round-trip testing (generate → parse → validate)
- Real-world report samples

### Performance Tests

- Large report handling
- Memory usage validation
- Browser compatibility

## Documentation Requirements

### API Documentation

- Complete TypeScript interfaces
- Usage examples for all functions
- Error code reference
- Migration guides for tax year changes

### Developer Guide

- Integration examples
- Best practices
- Troubleshooting guide
- Contributing guidelines

## Deliverables

1. **Core Library**: TypeScript source code with full implementation
2. **Type Definitions**: Complete TypeScript declarations
3. **Documentation**: API docs and developer guide
4. **Tests**: Comprehensive test suite
5. **Build Configuration**: Multi-target build setup
6. **Package Configuration**: npm package.json and metadata
