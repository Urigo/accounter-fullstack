# SHAAM 6111 Report Tool - Developer Implementation Specification

## 1. Project Overview

This project is a Node.js package for generating and parsing SHAAM 6111 reports used for Israeli tax
reporting. The tool provides a strongly-typed API allowing developers to convert between intuitive
object structures and the SHAAM 6111 format defined in the
[official specification](https://www.gov.il/BlobFolder/generalpage/annual-files-form/he/IncomeTax_software-houses-6111-2023.pdf).

### Purpose

- Provide developers with an easy-to-use tool to generate valid SHAAM 6111 reports from structured
  data
- Enable parsing of existing SHAAM 6111 reports into developer-friendly object structures
- Offer validation capabilities for both report generation and existing reports

### Target Users

- Primarily software developers building accounting and financial applications that need to
  interface with Israeli tax reporting systems

## 2. Repository Structure

```
shaam-6111/
├── src/
│   ├── index.ts                  # Main entry point and public API
│   ├── types/                    # TypeScript interfaces and types
│   │   ├── index.ts
│   │   ├── reportData.ts         # Main data structure interfaces
│   │   └── validationResult.ts   # Validation result interfaces
│   ├── schemas/                  # Zod validation schemas
│   │   ├── index.ts
│   │   ├── headerSchema.ts
│   │   └── [other record schemas].ts
│   ├── generators/               # Report generation logic
│   │   ├── index.ts
│   │   └── generators/           # Individual record type generators
│   ├── parsers/                  # Report parsing logic
│   │   ├── index.ts
│   │   └── parsers/              # Individual record type parsers
│   ├── validation/               # Validation logic
│   │   ├── index.ts
│   │   └── validators/           # Custom validators beyond schema
│   └── utils/                    # Utility functions
│       ├── encoding.ts           # Character encoding utilities
│       └── errors.ts             # Error handling utilities
├── tests/
│   ├── integration/              # Integration tests
│   │   ├── generation.test.ts
│   │   ├── parsing.test.ts
│   │   └── validation.test.ts
│   └── fixtures/                 # Test data fixtures
│       ├── validReports/         # Valid SHAAM 6111 reports for testing
│       └── invalidReports/       # Invalid SHAAM 6111 reports for testing
├── package.json
├── tsconfig.json
├── README.md                     # Basic documentation
└── LICENSE
```

## 3. Technical Requirements

### Framework & Technologies

- **Node.js**: Runtime environment
- **TypeScript**: Programming language for type safety
- **Zod**: Schema validation library
- **Vitest**: Testing framework

### Dependencies

```json
{
  "dependencies": {
    "zod": "^3.x",
    "iconv-lite": "^0.6.x" // For handling Hebrew character encoding
  },
  "devDependencies": {
    "typescript": "^5.x",
    "vitest": "^1.x",
    "@types/node": "^18.x"
  }
}
```

## 4. API Specification

### Core Functions

```typescript
/**
 * Generates a SHAAM 6111 report from the provided data
 * @param data Structured report data
 * @returns The formatted SHAAM 6111 report as a string
 * @throws Error if validation fails
 */
export function generateReport(data: ReportData): string;

/**
 * Parses a SHAAM 6111 report into structured data
 * @param reportContent The SHAAM 6111 report content as a string
 * @returns Structured report data
 * @throws Error if the report is invalid or malformed
 */
export function parseReport(reportContent: string): ReportData;

/**
 * Validates report data against SHAAM 6111 requirements
 * @param data Structured report data to validate
 * @returns Validation result with errors if applicable
 */
export function validateData(data: ReportData): ValidationResult;

/**
 * Validates an existing SHAAM 6111 report
 * @param reportContent The SHAAM 6111 report content as a string
 * @returns Validation result with errors if applicable
 */
export function validateReport(reportContent: string): ValidationResult;
```

### Type Definitions

Based on the SHAAM 6111 specification, the following types will be implemented:

```typescript
// Main data structure
export interface ReportData {
  header: HeaderRecord;
  profitAndLoss: ReportEntry[];
  taxAdjustment: ReportEntry[];
  balanceSheet: ReportEntry[];
}

// Validation results
export interface ValidationResult {
  isValid: boolean;
  errors?: ValidationError[];
}

export interface ValidationErrorDetail {
  path?: string; // Path to the invalid field
  message: string; // Developer-friendly error message
  code?: string; // Error code (if applicable)
  value?: unknown; // The invalid value
}

// Record types based on SHAAM 6111 specification
// These interfaces will use developer-friendly property names
// that will be mapped to/from the numeric field IDs in the spec

export interface HeaderRecord {
  taxFileNumber: string;
  taxYear: string;
  idNumber: string;
  vatFileNumber?: string;
  // Other fields as specified in the SHAAM 6111 documentation
}

export interface ReportEntry {
  code: string;
  amount: number;
}

// Additional record type interfaces will be defined according to the spec
// with intuitive, developer-friendly property names
```

## 5. Data Handling Details

### Character Encoding

- The library will automatically handle Hebrew character encoding (Windows-1255) for SHAAM 6111
  reports
- Ensure proper conversion between UTF-8 (used in JavaScript) and Windows-1255 (used in SHAAM
  reports)

### Field Mapping

- Each report entry in the SHAAM 6111 specification has a numeric ID
- The library will maintain an internal mapping between the developer-friendly property names and
  these IDs
- Strict adherence to field length, padding, and formatting requirements as defined in the spec

## 6. Error Handling Strategy

### Throwing Errors

- The `generateReport` and `parseReport` functions will throw errors when validation fails or when
  parsing corrupt/malformed reports
- Error messages will be detailed and developer-friendly
- Custom error classes will be used to distinguish between different types of errors

```typescript
// Error classes
export class ValidationError extends Error {
  public errors: ValidationErrorDetail[];
  constructor(message: string, errors: ValidationErrorDetail[]) {
    super(message);
    this.name = 'ValidationError';
    this.errors = errors;
  }
}

export class ParsingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ParsingError';
  }
}
```

### Validation Results

- The `validateData` and `validateReport` functions will return objects indicating success/failure
  with detailed error information
- Validation errors will include the path to the invalid field, a developer-friendly message, and
  the invalid value

## 7. Validation Implementation

### Zod Schemas

- Separate Zod validation schemas will be created for each record type
- Schemas will enforce field types, lengths, formats, and other constraints defined in the SHAAM
  6111 specification

```typescript
// Example schema for HeaderRecord
export const headerSchema = z.object({
  taxFileNumber: z
    .string()
    .length(9, { message: 'Tax file number must be exactly 9 digits' })
    .regex(/^\d+$/, { message: 'Tax file number must contain only digits' }),
  taxYear: z
    .string()
    .length(4, { message: 'Tax year must be exactly 4 digits' })
    .regex(/^\d{4}$/, { message: 'Tax year must be a valid year in YYYY format' }),
  idNumber: z
    .string()
    .length(9, { message: 'ID number must be exactly 9 digits' })
    .regex(/^\d+$/, { message: 'ID number must contain only digits' }),
  vatFileNumber: z
    .string()
    .length(9, { message: 'VAT file number must be exactly 9 digits' })
    .regex(/^\d+$/, { message: 'VAT file number must contain only digits' })
    .optional(),
  // Additional fields with appropriate validations
});
```

### Custom Validators

- Additional validators beyond Zod will be implemented for complex business rules
- Cross-field validations and record relationship validations will be included

## 8. Testing Plan

### Integration Tests

- Test the complete flow of generating and parsing SHAAM 6111 reports
- Verify bidirectional conversion between object structures and SHAAM 6111 format
- Test validation against valid and invalid data inputs

### Test Fixtures

- Include sample valid SHAAM 6111 reports for testing parsing functionality
- Include invalid reports to test error handling and validation
- Create fixture data representing different business scenarios

### Test Cases

1. **Generation Tests**
   - Generate reports from complete valid data
   - Attempt generation with invalid data to verify errors
   - Test each record type individually
   - Test full reports with multiple record types

2. **Parsing Tests**
   - Parse valid reports of different structures
   - Attempt parsing of malformed reports to verify error handling
   - Verify bidirectional consistency by generating, parsing, and comparing data

3. **Validation Tests**
   - Validate complete valid data structures
   - Validate individual record types with valid and invalid data
   - Test each validation rule defined in the schemas
   - Verify validation result format and error details

## 9. Implementation Guidelines

1. **Type Safety**
   - Use strict TypeScript typing throughout the codebase
   - Avoid any `any` types or type assertions where possible
   - Leverage TypeScript's advanced type features for better developer experience

2. **Code Organization**
   - Keep the codebase modular with clear separation of concerns
   - Isolate parsing, generation, and validation logic
   - Use namespaces or submodules to organize related functionality

3. **Performance Considerations**
   - While there are no specific performance requirements, avoid unnecessary processing
   - Use efficient algorithms for parsing and generation
   - Consider memory usage when handling large reports

4. **Documentation**
   - Provide JSDoc comments for all public APIs
   - Include examples in README.md for common use cases
   - Document any known limitations or edge cases

## 10. Future Considerations (Out of Scope for Initial Implementation)

- Support for future SHAAM 6111 specification versions
- Performance optimizations for very large reports
- Advanced utility functions beyond core operations
- Extensive documentation beyond basic examples
- Extended metadata in parsed output

## 11. Deliverables

The final package should include:

1. Complete TypeScript implementation as outlined
2. Integration tests covering core functionality
3. Basic documentation and usage examples
4. Published npm package with proper TypeScript typings
5. MIT license

---

This specification provides comprehensive guidance for implementing the SHAAM 6111 report tool
according to the requirements discussed. Developers should refer to the official SHAAM 6111
specification for detailed field definitions and record structures.
