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
- `B100`, `B110`, `C100`, `D110`, `D120`, `M100` — Count summary records

### `BKMVDATA.TXT`

- `A100` — Opening
- `C100` — Document header
- `D110` — Document line
- `D120` — Payment/receipt
- `B100` — Journal entry line
- `B110` — Account
- `M100` — Inventory item
- `Z900` — Closing

## 🛠️ Installation

```bash
npm install @accounter/shaam-uniform-format-generator
# or
yarn add @accounter/shaam-uniform-format-generator
```

## 📖 Usage

```typescript
import { generateUniformFormatReport } from '@accounter/shaam-uniform-format-generator'

const reportInput = {
  business: {
    // Business metadata
  },
  documents: [
    // Document records
  ],
  journalEntries: [
    // Journal entry records
  ],
  accounts: [
    // Account records
  ],
  inventory: [
    // Inventory records
  ]
}

const result = generateUniformFormatReport(reportInput)

console.log(result.iniText) // INI.TXT content
console.log(result.dataText) // BKMVDATA.TXT content
console.log(result.summary) // Generation summary
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

## 📄 License

MIT

## 🤝 Contributing

Contributions are welcome! Please read our contributing guidelines and submit pull requests to our
repository.

## 📚 Documentation

For detailed documentation about SHAAM format specifications, see the `documentation/` folder.
