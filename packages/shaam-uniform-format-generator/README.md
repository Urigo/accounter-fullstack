# @accounter/shaam-uniform-format-generator

A fully typed TypeScript library for generating, parsing, and validating SHAAM uniform format tax
reports (`INI.TXT` and `BKMVDATA.TXT` files).

## 🧩 Overview

This package provides a comprehensive solution for working with SHAAM (Israeli tax authority)
uniform format files. It allows you to:

1. **Generate** `INI.TXT` and `BKMVDATA.TXT` files from a high-level JSON object
2. **Parse** those files back into structured, validated JSON
3. **Validate** data against SHAAM 1.31 specifications
4. **Format** output with spec-compliant field widths, padding, and CRLF line endings

## 🚀 Features

- **Type Safety**: Full TypeScript support with strict typing
- **Validation**: Built-in Zod schemas for data validation
- **Format Compliance**: Generates files that meet SHAAM 1.31 specifications
- **Developer Experience**: Excellent autocompletion and helpful error messages
- **File System Agnostic**: Returns content in memory without writing to disk
- **Comprehensive Testing**: Full test coverage with Vitest

## 📁 Supported Record Types

### `INI.TXT`

- `A000` — Header
- `A000Sum` — Count summary records for each record type

### `BKMVDATA.TXT`

- `A100` — Business opening record
- `C100` — Document header
- `D110` — Document line
- `D120` — Payment/receipt
- `B100` — Journal entry line
- `B110` — Account
- `M100` — Inventory item
- `Z900` — Closing record

## 🛠️ Installation

```bash
npm install @accounter/shaam-uniform-format-generator
# or
yarn add @accounter/shaam-uniform-format-generator
```

## 📖 API Documentation

### Main Functions

#### `generateUniformFormatReport(input, options?)`

Generates SHAAM uniform format report files from a high-level JSON input object.

```typescript
import {
  generateUniformFormatReport,
  type ReportInput
} from '@accounter/shaam-uniform-format-generator'

const reportInput: ReportInput = {
  business: {
    businessId: '12345',
    name: 'Example Business Ltd',
    taxId: '123456789',
    reportingPeriod: {
      startDate: '2023-01-01',
      endDate: '2023-12-31'
    }
  },
  documents: [
    {
      id: 'INV001',
      type: '320', // Invoice
      date: '2023-06-15',
      amount: 1000.0,
      description: 'Service invoice'
    }
  ],
  journalEntries: [
    {
      id: 'JE001',
      date: '2023-06-15',
      amount: 1000.0,
      accountId: '1100',
      description: 'Revenue entry'
    }
  ],
  accounts: [
    {
      id: '1100',
      name: 'Revenue Account',
      type: '4', // Revenue
      balance: 1000.0
    }
  ],
  inventory: [
    {
      id: 'ITEM001',
      name: 'Service Item',
      quantity: 1,
      unitPrice: 1000.0
    }
  ]
}

const result = generateUniformFormatReport(reportInput, {
  validationMode: 'fail-fast', // or 'collect-all'
  fileNameBase: 'my-report'
})

console.log(result.iniText) // INI.TXT content
console.log(result.dataText) // BKMVDATA.TXT content
console.log(result.summary) // Generation summary
```

#### `parseUniformFormatFiles(iniContent, dataContent)`

Parses SHAAM uniform format files back into structured JSON.

```typescript
import { parseUniformFormatFiles } from '@accounter/shaam-uniform-format-generator'

const parsedData = parseUniformFormatFiles(iniFileContent, dataFileContent)
console.log(parsedData.business) // Parsed business metadata
console.log(parsedData.documents) // Parsed documents
```

### Types and Interfaces

#### `ReportInput`

```typescript
interface ReportInput {
  business: BusinessMetadata
  documents: Document[]
  journalEntries: JournalEntry[]
  accounts: Account[]
  inventory: InventoryItem[]
}
```

#### `BusinessMetadata`

```typescript
interface BusinessMetadata {
  businessId: string
  name: string
  taxId: string
  reportingPeriod: {
    startDate: string // YYYY-MM-DD format
    endDate: string // YYYY-MM-DD format
  }
}
```

#### `Document`

```typescript
interface Document {
  id: string
  type: DocumentType // e.g., "320" for invoice, "330" for credit note
  date: string // YYYY-MM-DD format
  amount: number
  description?: string
}
```

#### `JournalEntry`

```typescript
interface JournalEntry {
  id: string
  date: string // YYYY-MM-DD format
  amount: number
  accountId: string
  description?: string
  // Extended fields for B100 records (all optional)
  batchNumber?: string
  transactionType?: string
  referenceDocument?: string
  currencyCode?: string // Currency code (e.g., "USD", "EUR")
  foreignCurrencyAmount?: number // Amount in foreign currency
}
```

#### `Account`

```typescript
interface Account {
  id: string
  name: string
  type: string // Account type code
  balance: number
}
```

#### `InventoryItem`

```typescript
interface InventoryItem {
  id: string
  name: string
  quantity: number
  unitPrice: number
}
```

#### `ReportOutput`

```typescript
interface ReportOutput {
  iniText: string // INI.TXT file content
  dataText: string // BKMVDATA.TXT file content
  iniFile: File // Virtual File object for INI.TXT
  dataFile: File // Virtual File object for BKMVDATA.TXT
  summary: {
    totalRecords: number
    perType: Record<string, number>
    errors?: ValidationError[]
  }
}
```

### Options

#### `GenerationOptions`

```typescript
interface GenerationOptions {
  validationMode?: 'fail-fast' | 'collect-all' // Default: 'fail-fast'
  fileNameBase?: string // Default: 'report'
}
```

- **`validationMode`**:
  - `'fail-fast'`: Stop validation on first error and throw immediately
  - `'collect-all'`: Collect all validation errors before throwing
- **`fileNameBase`**: Base name for generated files (without extension)

### Enums and Constants

The package exports comprehensive enums for SHAAM code tables:

```typescript
import {
  CountryCodeEnum,
  CurrencyCodeEnum,
  DocumentTypeEnum,
  PaymentMethodEnum
} from '@accounter/shaam-uniform-format-generator'

// Document types
const invoiceType = DocumentTypeEnum.enum['320'] // Invoice
const creditNoteType = DocumentTypeEnum.enum['330'] // Credit note

// Currency codes
const ils = CurrencyCodeEnum.enum.ILS // Israeli Shekel
const usd = CurrencyCodeEnum.enum.USD // US Dollar

// Payment methods
const cash = PaymentMethodEnum.enum['1'] // Cash
const check = PaymentMethodEnum.enum['2'] // Check
```

## 🎯 Complete Example

```typescript
import {
  generateUniformFormatReport,
  parseUniformFormatFiles,
  type ReportInput
} from '@accounter/shaam-uniform-format-generator'

// 1. Prepare your data
const reportData: ReportInput = {
  business: {
    businessId: 'COMP001',
    name: 'Acme Corp Ltd',
    taxId: '123456789',
    reportingPeriod: {
      startDate: '2023-01-01',
      endDate: '2023-12-31'
    }
  },
  documents: [
    {
      id: 'INV-2023-001',
      type: '320', // Invoice
      date: '2023-03-15',
      amount: 2340.0,
      description: 'Consulting services'
    },
    {
      id: 'CN-2023-001',
      type: '330', // Credit note
      date: '2023-04-10',
      amount: -340.0,
      description: 'Service adjustment'
    }
  ],
  journalEntries: [
    {
      id: 'JE-2023-001',
      date: '2023-03-15',
      amount: 2340.0,
      accountId: '4000',
      description: 'Consulting revenue',
      batchNumber: 'BATCH-Q1-2023',
      transactionType: 'SALE',
      referenceDocument: 'INV-2023-001'
    },
    {
      id: 'JE-2023-002',
      date: '2023-04-10',
      amount: -340.0,
      accountId: '4000',
      description: 'Revenue adjustment',
      currencyCode: 'USD',
      foreignCurrencyAmount: -290.0
    }
  ],
  accounts: [
    {
      id: '4000',
      name: 'Consulting Revenue',
      type: '4', // Revenue account
      balance: 2000.0
    },
    {
      id: '1200',
      name: 'Accounts Receivable',
      type: '1', // Asset account
      balance: 1500.0
    }
  ],
  inventory: [
    {
      id: 'SERV-001',
      name: 'Consulting Hour',
      quantity: 20,
      unitPrice: 117.0
    }
  ]
}

// 2. Generate the files
try {
  const result = generateUniformFormatReport(reportData, {
    validationMode: 'fail-fast',
    fileNameBase: 'quarterly-report-2023-q1'
  })

  // 3. Access the generated content
  console.log('Generated INI.TXT:')
  console.log(result.iniText)

  console.log('\nGenerated BKMVDATA.TXT:')
  console.log(result.dataText)

  console.log('\nSummary:')
  console.log(`Total records: ${result.summary.totalRecords}`)
  console.log('Records per type:', result.summary.perType)

  // 4. Save files (example using Node.js fs)
  // import { writeFileSync } from 'fs'
  // writeFileSync('report.INI.TXT', result.iniText, 'utf8')
  // writeFileSync('report.BKMVDATA.TXT', result.dataText, 'utf8')

  // 5. Parse files back (round-trip test)
  const parsedData = parseUniformFormatFiles(result.iniText, result.dataText)
  console.log('\nParsed business data:', parsedData.business)
} catch (error) {
  console.error('Generation failed:', error.message)
  if (error.errors) {
    console.error('Validation errors:', error.errors)
  }
}
```

## 🔧 Advanced Usage

### Custom Validation

```typescript
import { ReportInputSchema } from '@accounter/shaam-uniform-format-generator'

// Validate data before generation
const validationResult = ReportInputSchema.safeParse(yourData)
if (!validationResult.success) {
  console.error('Validation errors:', validationResult.error.issues)
}
```

### Working with Individual Records

```typescript
import { encodeC100, parseC100, type C100Input } from '@accounter/shaam-uniform-format-generator'

// Encode a single document record
const documentRecord: C100Input = {
  code: 'C100',
  recordNumber: '1',
  vatId: '123456789',
  documentType: '320',
  documentId: 'INV001',
  documentIssueDate: '20230315'
  // ... other fields
}

const encodedLine = encodeC100(documentRecord)
console.log(encodedLine) // Fixed-width formatted line

// Parse it back
const parsedRecord = parseC100(encodedLine)
console.log(parsedRecord) // Structured object
```

## 🏗️ Development

This project uses:

- **TypeScript** in strict mode for type safety
- **Zod** for runtime validation
- **Vitest** for testing
- **Bob the Bundler** for building

### Commands

```bash
# Development
yarn dev

# Testing
yarn test
yarn test:watch

# Building
yarn build

# Linting
yarn lint
```

## 📋 Requirements

- Node.js ^20.0.0 || >= 22
- TypeScript support

## � Error Handling

The library provides detailed error information:

```typescript
import { ShaamFormatError } from '@accounter/shaam-uniform-format-generator'

try {
  const result = generateUniformFormatReport(invalidData)
} catch (error) {
  if (error instanceof ShaamFormatError) {
    console.error('SHAAM format error:', error.message)
    console.error('Validation errors:', error.errors)
  }
}
```

## �📄 License

MIT

## 🤝 Contributing

Contributions are welcome! Please read our contributing guidelines and submit pull requests to our
repository.

## 📚 Documentation

For detailed documentation about SHAAM format specifications, see the `documentation/` folder.

## 🔗 Related

- [SHAAM Specification 1.31](documentation/) - Official specification documents
- [Israeli Tax Authority](https://www.gov.il/he/departments/taxes) - Official tax authority website
