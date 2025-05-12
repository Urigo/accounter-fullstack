# @accounter/shaam6111-generator

Fully typed application that generates, parses, and validates SHAAM 6111 tax reports for Israeli
businesses.

## Installation

```bash
# Using npm
npm install @accounter/shaam6111-generator

# Using yarn
yarn add @accounter/shaam6111-generator

# Using pnpm
pnpm add @accounter/shaam6111-generator
```

## Features

- 🏗️ **Generate** compliant SHAAM 6111 reports from structured data
- 🔍 **Parse** existing SHAAM 6111 reports into structured data
- ✅ **Validate** reports against SHAAM 6111 specification rules
- 🔤 **Encoding** support for Windows-1255 (Hebrew)
- 📂 **File utilities** for reading and writing reports
- 📋 **Fully typed** with TypeScript for better development experience

## Usage Examples

### Generating a Report

Create a structured report and generate a compliant SHAAM 6111 report string:

```typescript
import { generateReport, IndividualOrCompanyEnum, ReportData } from '@accounter/shaam6111-generator'

// Create report data structure
const reportData: ReportData = {
  header: {
    taxFileNumber: '123456789',
    taxYear: '2023',
    idNumber: '987654321',
    industryCode: '6201', // Software development
    businessDescription: 'חברת תוכנה בע"מ',
    businessType: 2, // Commercial
    reportingMethod: 2, // Accrual basis
    accountingMethod: 2, // Double-entry
    accountingSystem: 2, // Computerized
    includesProfitLoss: 1, // Yes
    includesTaxAdjustment: 1, // Yes
    includesBalanceSheet: 1, // Yes
    profitLossEntryCount: 3,
    taxAdjustmentEntryCount: 2,
    balanceSheetEntryCount: 2,
    currencyType: 1, // Shekels
    amountsInThousands: 2 // No
  },
  profitAndLoss: [
    { code: 1001, amount: 500000 }, // Revenue
    { code: 2001, amount: 300000 }, // Expenses
    { code: 6666, amount: 200000 } // Profit
  ],
  taxAdjustment: [
    { code: 100, amount: 200000 }, // Accounting profit
    { code: 400, amount: 200000 } // Taxable income
  ],
  balanceSheet: [
    { code: 6000, amount: 300000 }, // Assets
    { code: 7800, amount: 300000 } // Liabilities + Equity
  ],
  individualOrCompany: IndividualOrCompanyEnum.COMPANY
}

// Generate the report
const reportString = generateReport(reportData)

console.log(reportString)
// Output: Properly formatted SHAAM 6111 report string
```

### Parsing a Report

Parse an existing SHAAM 6111 report into structured data:

```typescript
import fs from 'fs'
import { parseReport } from '@accounter/shaam6111-generator'

// Read report content
const reportContent = fs.readFileSync('path/to/report.txt', 'utf-8')

// Parse the report
try {
  const reportData = parseReport(reportContent)

  console.log('Tax File Number:', reportData.header.taxFileNumber)
  console.log('Tax Year:', reportData.header.taxYear)
  console.log('Business Type:', reportData.header.businessType)
  console.log('Profit & Loss Entries:', reportData.profitAndLoss.length)
  console.log('Tax Adjustment Entries:', reportData.taxAdjustment.length)
  console.log('Balance Sheet Entries:', reportData.balanceSheet.length)
} catch (error) {
  console.error('Error parsing report:', error)
}
```

### Validating a Report

Validate a report against SHAAM 6111 specifications:

```typescript
import fs from 'fs'
// Option 2: Validate report data (if you already have parsed data)
import { ReportData, validateData, validateReport } from '@accounter/shaam6111-generator'

// Option 1: Validate a report string
const reportContent = fs.readFileSync('path/to/report.txt', 'utf-8')
const validationResult = validateReport(reportContent)

if (validationResult.isValid) {
  console.log('Report is valid!')
} else {
  console.error('Report validation failed:')
  validationResult.errors.forEach(error => {
    console.error(`- ${error.path}: ${error.message}`)
  })
}

const reportData: ReportData = {
  /* ... */
}
const dataValidationResult = validateData(reportData)

if (dataValidationResult.isValid) {
  console.log('Report data is valid!')
} else {
  console.error('Report data validation failed:')
  dataValidationResult.errors.forEach(error => {
    console.error(`- ${error.path}: ${error.message}`)
  })
}
```

### Working with Files

Save a report to a file or read a report from a file with proper Windows-1255 encoding:

```typescript
import fs from 'fs'
import { convertReportToFile, readReportFromFile, ReportData } from '@accounter/shaam6111-generator'

// Browser environment: Create a File object from report data
const reportData: ReportData = {
  /* ... */
}
const reportFile = convertReportToFile(reportData, 'SHAAM6111.dat')

// Handle the File object (e.g., in a browser environment)
// For example, trigger a download:
const url = URL.createObjectURL(reportFile)
const a = document.createElement('a')
a.href = url
a.download = reportFile.name
document.body.appendChild(a)
a.click()
document.body.removeChild(a)
URL.revokeObjectURL(url)

// Reading a report file (in browser)
const fileInput = document.getElementById('fileInput') as HTMLInputElement
fileInput.addEventListener('change', async event => {
  const file = fileInput.files?.[0]
  if (file) {
    try {
      const reportData = await readReportFromFile(file, true)
      console.log('Parsed report data:', reportData)
    } catch (error) {
      console.error('Error reading report file:', error)
    }
  }
})
```

### Handling Hebrew Text (Windows-1255 Encoding)

Working with Hebrew text and Windows-1255 encoding:

```typescript
import fs from 'fs'
import { fromWindows1255, toWindows1255 } from '@accounter/shaam6111-generator'

// Convert Hebrew text to Windows-1255 encoding
const hebrewText = 'חברת תוכנה בע"מ'
const encoded = toWindows1255(hebrewText)

// Save encoded text to a file
fs.writeFileSync('hebrew.dat', encoded)

// Read encoded text from a file
const readBuffer = fs.readFileSync('hebrew.dat')
const decoded = fromWindows1255(readBuffer)

console.log(decoded) // 'חברת תוכנה בע"מ'
```

## API Reference

### Types

- `ReportData` - Main interface for structured report data
- `HeaderRecord` - Interface for report header data
- `ReportEntry` - Interface for financial entries (code and amount)
- `ValidationResult` - Interface for validation results
- `ValidationErrorDetails` - Interface for validation error details
- `IndividualOrCompanyEnum` - Enum for individual or company classification

### Generators

- `generateReport(data: ReportData): string` - Generate a complete report
- `generateHeaderRecord(header: HeaderRecord): string` - Generate just the header section
- `generateReportEntriesSection(entries: ReportEntry[]): string` - Generate a section of entries

### Parsers

- `parseReport(content: string): ReportData` - Parse a complete report
- `parseHeaderRecord(headerLine: string): HeaderRecord` - Parse just the header section
- `parseReportEntries(content: string, section: string): ReportEntry[]` - Parse a section of entries

### Validators

- `validateReport(content: string): ValidationResult` - Validate a report string
- `validateData(data: ReportData): ValidationResult` - Validate report data

### Encoding Utilities

- `toWindows1255(input: string): Buffer` - Convert UTF-8 string to Windows-1255 buffer
- `fromWindows1255(buffer: Buffer): string` - Convert Windows-1255 buffer to UTF-8 string

### File Utilities

- `convertReportToFile(report: string | ReportData, fileName?: string, validate?: boolean): File` -
  Convert report to file
- `readReportFromFile(reportFile: File, parseToObject?: boolean, validate?: boolean): Promise<string | ReportData>` -
  Read report from file

## License

MIT
