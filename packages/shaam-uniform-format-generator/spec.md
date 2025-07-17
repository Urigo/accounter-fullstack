# 📘 Project Specification: SHAAM Uniform Format Generator & Parser

**Name (suggested):** @accounter/shaam-uniform-format-generator` **Version:** 0.1.0 **Target
environment:** Node.js + TypeScript **Tech stack:**

- **TypeScript** (strict mode)
- **Zod** for validation
- **Vitest** for testing
- **Vite** as test runner/bundler

---

## 🧩 Goal

Develop a TypeScript package that:

1. **Generates** `INI.TXT` and `BKMVDATA.TXT` files from a high-level JSON object.
2. **Parses** those files back into structured, validated JSON.
3. Performs full spec-compliant formatting (field widths, padding, CRLF endings).
4. Offers excellent developer experience (autocompletion, strict typing, helpful errors).
5. Is file system agnostic – returns content + virtual `File` objects, but does not write to disk.

---

## 📁 File & Record Types

The tool must support the following **record types** (from SHAAM 1.31 spec):

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

---

## 📥 Input Structure (High-Level Semantic Model)

```ts
interface ReportInput {
  business: BusinessMetadata // from INI.TXT and A100
  documents: Document[] // C100 + D110 + D120
  journalEntries: JournalEntry[] // B100s
  accounts: Account[] // B110s
  inventory: InventoryItem[] // M100s
}
```

- All values are **explicitly supplied** by the user
- No derived or default fields; timestamps, metadata, and file info must be included
- Values are validated against **embedded enums** and **field constraints**

### Notable Constraints

- A `document` may contain zero D110s or D120s
- `accounts` must include only **active accounts**
- `inventory` should contain **aggregated totals**, not raw logs

---

## 📤 Output Structure

```ts
interface ReportOutput {
  iniText: string
  dataText: string
  iniFile: File
  dataFile: File
  summary: {
    totalRecords: number
    perType: Record<string, number>
    errors?: ValidationError[]
  }
}
```

- Line endings are `\r\n`
- Fields are fixed-width with spec-correct padding
- Output is **not saved** — just returned in memory

---

## 🛠️ Public API

### Main Function

```ts
generateUniformFormatReport(
  input: ReportInput,
  options?: {
    validationMode?: 'fail-fast' | 'collect-all';
    fileNameBase?: string; // Optional override for file names
  }
): ReportOutput
```

---

## 🧪 Testing Strategy

Use **Vitest** with the following principles:

### ✅ Unit Tests

- Every record module (`C100`, `D110`, etc.):
  - Schema validation
  - Encode → Decode roundtrip
  - Encode output matches fixed-width spec
  - Invalid inputs throw expected errors

### ✅ Integration Tests

- Full `ReportInput` → `INI.TXT` + `BKMVDATA.TXT` generation
- Parse real INI/DATA files into valid JSON
- Compare against SHAAM spec examples

### ✅ Type Safety Tests

- Use `expect-type` to confirm exported types match developer expectations
- All enums (e.g. `DocumentType`, `CurrencyCode`) strictly typed and exported

---

## 🧱 Architecture & File Layout

```
src/
├── index.ts                    // Public API
├── types/
│   ├── input-schema.ts        // Zod + TypeScript input
│   ├── enums.ts               // Document types, currencies, countries, etc.
├── records/                   // Each spec-defined record
│   ├── C100.ts
│   ├── D110.ts
│   └── ...
├── format/
│   ├── encoder.ts             // Fixed-width encoding helpers
│   ├── decoder.ts             // Record parsing
├── validation/
│   ├── validateInput.ts
│   └── errors.ts
├── utils/
│   ├── fileHelpers.ts
│   └── dateHelpers.ts
└── config/
    ├── document-types.ts      // Spec appendix values
    └── currency-codes.ts
```

Each `record/*.ts` module should export:

```ts
export const C100Schema: z.ZodType<C100>
export function encodeC100(input: C100): string
export function parseC100(line: string): C100
```

---

## 🔐 Error Handling

Validation errors will follow this structure:

```ts
interface ValidationError {
  recordType: string
  recordIndex: number
  field: string
  message: string
}
```

- If `fail-fast` mode: throw immediately on first error
- If `collect-all`: return all errors in `ReportOutput.summary.errors`

---

## 🧠 Developer Experience (DX)

- All schemas and enums are exported
- Record types are available via:

  ```ts
  import { DocumentType } from '@your-org/shaam-ufgen'
  ```

- Types align closely with real business use cases (no cryptic field names)
- Tool is composable — every record can be encoded/decoded standalone

---

## 🚧 Future Extensions

- Add support for newer SHAAM versions (e.g. 1.32)
- Allow partial file generation (e.g. just accounts)
- Provide CLI for local testing and report diffing
