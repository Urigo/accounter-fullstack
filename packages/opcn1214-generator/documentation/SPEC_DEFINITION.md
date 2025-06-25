# OPCN 1214 Specification Definition

This document describes the structure and format of the JSON specification files used to define OPCN
1214 record formats for different tax years.

## Overview

The OPCN 1214 generator uses JSON configuration files to define the structure of fixed-width records
for each tax year. These specifications include field positions, data types, validation rules, and
formatting requirements.

## File Structure

### Location

Specification files are located in `src/config/` and named by tax year:

- `src/config/2024.json` - Specification for tax year 2024
- `src/config/2025.json` - Specification for tax year 2025 (when available)

### Format

Each specification file contains a JSON object with the following structure:

```json
{
  "year": 2024,
  "records": [
    // Array of record specifications
  ]
}
```

## Record Specification (`RecordSpec`)

Each record specification defines a complete record type with its fields:

```typescript
interface RecordSpec {
  recordType: string // Record type identifier (e.g., "1000")
  recordLength: number // Total record length in characters
  repeatable: boolean // Can this record appear multiple times?
  minOccurs?: number // Minimum number of occurrences
  maxOccurs?: number // Maximum number of occurrences
  orderIndex: number // Order in which records should appear
  fields: SpecField[] // Array of field specifications
  description?: string // Human-readable description
}
```

### Properties

- **recordType**: Unique identifier for the record type (e.g., "1000", "2000")
- **recordLength**: Total character length of the fixed-width record
- **repeatable**: Whether multiple instances of this record type can appear in a single file
- **minOccurs/maxOccurs**: Validation rules for number of occurrences (optional)
- **orderIndex**: Defines the sequence order of records (1-based)
- **fields**: Array of field specifications that make up the record
- **description**: Optional documentation string

## Field Specification (`SpecField`)

Each field specification defines a single field within a record:

```typescript
interface SpecField {
  fieldCode: string // Unique field identifier
  fieldName: string // Human-readable field name
  start: number // 0-based start position
  length: number // Field length in characters
  type: 'string' | 'number' | 'date' // Data type
  required: boolean // Is field mandatory?
  format?: string // Format pattern (e.g., "YYYYMMDD")
  rtl?: boolean // Right-to-left text (Hebrew)
  enumValues?: string[] // Valid enum values
  defaultValue?: string | number | null // Default value
  padding?: 'left' | 'right' // Padding direction
  description?: string // Field description
}
```

### Field Properties

#### Required Properties

- **fieldCode**: Unique identifier following pattern `{recordType}_{sequence}` (e.g., "1000_01")
- **fieldName**: Descriptive name for the field
- **start**: Zero-based character position where field begins in the record
- **length**: Number of characters the field occupies
- **type**: Data type - one of 'string', 'number', or 'date'
- **required**: Boolean indicating if the field must have a value

#### Optional Properties

- **format**: Format specification (especially useful for dates, e.g., "YYYYMMDD")
- **rtl**: Set to `true` for Hebrew text fields that should be right-to-left
- **enumValues**: Array of valid string values for validation
- **defaultValue**: Default value to use when field is not provided
- **padding**: Whether to pad field on 'left' (numeric) or 'right' (text)
- **description**: Human-readable documentation for the field

### Data Types

#### string

Used for text fields, including:

- Names and descriptions
- Codes and identifiers
- Hebrew text (use `rtl: true`)

#### number

Used for numeric fields, including:

- Amounts and quantities
- Counts and indices
- Numeric codes

#### date

Used for date fields. Specify format pattern in `format` property:

- `"YYYYMMDD"` - 8-character date (20241231)
- `"DDMMYYYY"` - Alternative date format
- `"YYYYMM"` - Year-month format

## Example Specification

Here's a complete example for a simple record:

```json
{
  "year": 2024,
  "records": [
    {
      "recordType": "1000",
      "recordLength": 50,
      "repeatable": false,
      "orderIndex": 1,
      "description": "Header record with report information",
      "fields": [
        {
          "fieldCode": "1000_01",
          "fieldName": "reportType",
          "start": 0,
          "length": 4,
          "type": "string",
          "required": true,
          "enumValues": ["1214"],
          "defaultValue": "1214",
          "padding": "right",
          "description": "Report type identifier"
        },
        {
          "fieldCode": "1000_02",
          "fieldName": "taxYear",
          "start": 4,
          "length": 4,
          "type": "number",
          "required": true,
          "padding": "left",
          "description": "Tax year (YYYY)"
        },
        {
          "fieldCode": "1000_03",
          "fieldName": "reportDate",
          "start": 8,
          "length": 8,
          "type": "date",
          "required": true,
          "format": "YYYYMMDD",
          "padding": "left",
          "description": "Report generation date"
        },
        {
          "fieldCode": "1000_04",
          "fieldName": "companyName",
          "start": 16,
          "length": 30,
          "type": "string",
          "required": false,
          "padding": "right",
          "rtl": true,
          "description": "Company name in Hebrew"
        }
      ]
    }
  ]
}
```

## Validation Rules

The specification loader validates the following:

### File-level Validation

- JSON structure matches expected schema
- Year is within reasonable range (2020-2050)
- All required properties are present

### Record-level Validation

- No duplicate record types
- No duplicate order indices
- Valid min/max occurs relationships

### Field-level Validation

- No overlapping field positions
- All fields fit within record length
- Field codes are unique within record
- Start positions are non-negative
- Field lengths are positive

## Adding New Specifications

To add support for a new tax year:

1. **Create the JSON file**: `src/config/{YEAR}.json`
2. **Follow the schema**: Use existing files as templates
3. **Update the loader**: Add the year to `getSupportedYears()`
4. **Add tests**: Create test cases for the new specification
5. **Document changes**: Update this file if new patterns are introduced

### Best Practices

1. **Consistent Naming**: Use clear, descriptive field names
2. **Field Codes**: Follow pattern `{recordType}_{sequence}` with zero-padded sequence
3. **Descriptions**: Always include descriptions for fields and records
4. **Validation**: Use `enumValues` for fields with limited valid values
5. **Hebrew Text**: Always set `rtl: true` for Hebrew text fields
6. **Padding**: Use 'left' for numbers, 'right' for text
7. **Testing**: Verify field positions don't overlap and fit within record length

## Common Patterns

### Date Fields

```json
{
  "fieldCode": "1000_03",
  "fieldName": "reportDate",
  "start": 10,
  "length": 8,
  "type": "date",
  "required": true,
  "format": "YYYYMMDD",
  "padding": "left"
}
```

### Amount Fields

```json
{
  "fieldCode": "2000_05",
  "fieldName": "totalAmount",
  "start": 20,
  "length": 15,
  "type": "number",
  "required": true,
  "padding": "left",
  "description": "Amount in agorot (multiply by 100)"
}
```

### Hebrew Text Fields

```json
{
  "fieldCode": "1000_10",
  "fieldName": "companyName",
  "start": 35,
  "length": 50,
  "type": "string",
  "required": false,
  "padding": "right",
  "rtl": true,
  "description": "Company name in Hebrew"
}
```

### Enum Fields

```json
{
  "fieldCode": "1000_02",
  "fieldName": "reportType",
  "start": 4,
  "length": 2,
  "type": "string",
  "required": true,
  "enumValues": ["01", "02", "03"],
  "defaultValue": "01",
  "padding": "left",
  "description": "Report type: 01=Annual, 02=Quarterly, 03=Amendment"
}
```

## Error Handling

The loader will throw descriptive errors for:

- Missing configuration files
- Invalid JSON structure
- Schema validation failures
- Business rule violations (overlapping fields, etc.)
- Unsupported tax years

Always handle these errors appropriately in calling code.
