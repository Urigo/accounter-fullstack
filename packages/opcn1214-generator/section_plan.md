## 1. Ingesting the Official Spec into Machine-Readable Definitions

Typically, the Tax Authority publishes a PDF or Word document listing each record type, field names,
positions, lengths, types, allowed values, and textual descriptions. Manually retyping dozens of
fields per record is error-prone. A good practice is to use a two-step approach:

1. **Create a structured review template (spreadsheet or CSV) for each record type**

   - Columns in the spreadsheet for each field:

     - `recordType` (e.g., “1000”)
     - `fieldCode` or internal identifier (e.g., “1000_01”)
     - `fieldName` (e.g., “taxpayerId”)
     - `start` (e.g., 0-based index or 1-based position; pick one convention consistently)
     - `length` (number of characters)
     - `type` (e.g., `string`, `number`, `date`)
     - `required` (`yes`/`no`)
     - `format` (for dates: e.g., `"ddMMyyyy"`; for numbers: maybe precision or implied decimal
       places)
     - `padding` (`left` or `right`)
     - `alignment` if needed (e.g., numeric fields often right-aligned with zero padding; text often
       left-aligned with space padding)
     - `rtl` flag (`yes` if Hebrew text that needs bidi controls)
     - `enumValues` if there’s a closed list of allowed codes (e.g., “A”, “B”, “C”)
     - `defaultValue` if spec says default (e.g., zeros or spaces)
     - `description` (text from spec explaining the field)
     - `businessRules` notes (e.g., “if this flag = 1, then next field must be > 0”; “sum of these
       fields must equal …”)

   - For each record type, prepare a separate sheet or CSV file. This allows domain experts to
     review and catch typos before generating JSON.

2. **Export each sheet to a standardized CSV or JSON**

   - Once the spreadsheet is complete and reviewed, export a CSV.
   - Write a small Node.js or Python script to convert each CSV into the JSON structure matching
     your `SpecField` and `RecordSpec` types. For example:

     ```ts
     interface SpecField {
       fieldCode: string
       fieldName: string
       start: number
       length: number
       type: 'string' | 'number' | 'date'
       required: boolean
       format?: string
       rtl?: boolean
       enumValues?: string[]
       defaultValue?: string | number | null
       padding?: 'left' | 'right'
       description?: string
     }
     interface RecordSpec {
       recordType: string
       recordLength: number
       repeatable: boolean
       minOccurs?: number
       maxOccurs?: number
       orderIndex: number
       fields: SpecField[]
       description?: string
     }
     ```

   - The conversion script should:

     - Parse numeric columns for `start`, `length`, `minOccurs`, `maxOccurs`, etc.
     - Map “yes”/“no” to boolean.
     - For enum lists, split comma-separated values into arrays.
     - Validate that `start + length` does not exceed the declared `recordLength`.

   - Emit a JSON file (e.g., `src/config/2024/1000.json`). Then combine into a top-level `2024.json`
     referencing all record specs:

     ```json
     {
       "year": 2024,
       "records": [
         { /* contents of 1000.json */ },
         { /* 1010.json */ },
         ...
       ]
     }
     ```

   - If the spec documentation changes, update the spreadsheet and re-export.

3. **Runtime or build-time validation of the spec JSON**

   - In your loader (`src/config/loader.ts`), after loading the JSON, validate it against a Zod
     schema for `RecordSpec` and `SpecField`. This catches mistakes early (e.g., missing required
     keys, invalid types).
   - Example Zod schema:

     ```ts
     const specFieldSchema = z.object({
       fieldCode: z.string(),
       fieldName: z.string(),
       start: z.number().int().nonnegative(),
       length: z.number().int().positive(),
       type: z.enum(['string', 'number', 'date']),
       required: z.boolean(),
       format: z.string().optional(),
       rtl: z.boolean().optional(),
       enumValues: z.array(z.string()).optional(),
       defaultValue: z.union([z.string(), z.number(), z.null()]).optional(),
       padding: z.enum(['left', 'right']).optional(),
       description: z.string().optional()
     })
     const recordSpecSchema = z.object({
       recordType: z.string(),
       recordLength: z.number().int().positive(),
       repeatable: z.boolean(),
       minOccurs: z.number().int().nonnegative().optional(),
       maxOccurs: z.number().int().nonnegative().optional(),
       orderIndex: z.number().int().positive(),
       description: z.string().optional(),
       fields: z.array(specFieldSchema)
     })
     const yearSpecSchema = z.object({
       year: z.number().int(),
       records: z.array(recordSpecSchema)
     })
     ```

   - Load JSON, run `yearSpecSchema.parse(json)`. If invalid, show errors indicating which part of
     spec JSON is malformed.

4. **Version control and diffing spec changes**

   - Keep the CSV/spreadsheet and the generated JSON under version control. When adding a new year,
     copy previous year’s CSV and modify only changed fields. Version control diff helps reviewers
     see exactly what changed in the official spec.
   - Optionally include textual notes in the spreadsheet for changed or new fields.

---

## 2. Reasoning About Complex Field Rules

Many fields require more than just type and length; they may have business logic, conditional
requirements, or interdependencies within the record or across records. To handle these:

1. **Capture business rules in the spec metadata where possible**

   - In the spreadsheet, add a “businessRules” column with a short code or description, e.g.,:

     - `IF flagX = 'Y' THEN fieldZ > 0`
     - `SUM of fields A1..An must equal mainForm.totalAmount`
     - `Date field must be within tax year: between 01/01/{year} and 31/12/{year}`
     - `If section present, mainForm indicator must be '1'`

   - In JSON, you can include a `businessRules` array of strings. While the implementation cannot
     interpret arbitrary English, it documents intent for implementers.

2. **Translate business rules into code**

   - After schema-based (shape & format) validation passes, write specific functions in
     `src/validator` that enforce these rules:

     - For record-level: e.g. in `validateRecord1000Business`, read the relevant fields from the
       parsed object, run checks, and return `ValidationError[]`.
     - For cross-record: in a higher-level validation (e.g., `validateReportDataBusiness`), access
       multiple sections (e.g., sum shareholders percentages).

   - Use clear, descriptive error messages and consistent `code` values (`CROSS_FIELD_VALIDATION`,
     `INVALID_RANGE`, etc).

3. **Conditional presence**

   - For fields that are only meaningful if another field has a certain value, encode in the Zod
     schema via `.refine()` or after Zod parse via business-rule function. Example:

     ```ts
     record1000Schema.refine(
       data => {
         if (data.hasForeignIncome === true) {
           return data.foreignAppendixField != null
         }
         return true
       },
       {
         message: 'Foreign appendix field must be present when hasForeignIncome is true',
         path: ['foreignAppendixField'],
         params: { code: VALIDATION_CODES.REQUIRED_FIELD }
       }
     )
     ```

   - Alternatively, keep shape-level schema minimal and handle in a separate function so error codes
     are uniform.

4. **Enums and allowed values**

   - If spec enumerates allowed codes (e.g., field “paymentMethod” must be one of \["1","2","3"]),
     include `enumValues` in spec JSON. In Zod schema: `z.enum([...])`. If numeric codes, parse as
     number and check allowed numeric values.
   - Unit test each enum field: valid and invalid.

5. **Date-related rules**

   - Parse date strings into `Date` or keep as string but validate format. Use date-fns to parse and
     check validity and bounds.
   - For tax-year-specific date bounds: use the `year` parameter in validation.

6. **Numeric precision and format**

   - Some numeric fields implicitly have fixed decimal places. E.g., “amount” field of length 10
     where last 2 digits are decimals. In spec JSON, capture `format: "numeric(8,2)"` or similar. In
     generator, format number by multiplying by 100, then pad left with zeros. In parser, parse
     substring, convert to number by dividing by 100. Document this in spec JSON and code.

7. **String normalization**

   - Remove or escape disallowed characters. If spec prohibits certain ASCII control characters,
     enforce via `.refine()` or utility functions. For Hebrew strings, apply normalization (NFC) and
     inject bidi controls in generator; strip them in parser.

8. **Padding and trimming**

   - The spec may require trailing spaces on text fields, leading zeros on numeric. Ensure the
     utilities handle multi-byte characters (Hebrew). Decide whether length counts code units or
     bytes; often OPCN is fixed-width in bytes, but UTF-8 bytes vary. If spec actually counts bytes,
     more careful handling (e.g., ensure encoded UTF-8 length ≤ field length). Clarify spec: if
     fixed-width means characters in a restricted charset (e.g., only ASCII plus Hebrew letters
     fitting single code unit). If truly multi-byte in UTF-8, may need to limit to characters whose
     UTF-8 byte-length equals code unit length; this must be clarified with spec authors. For now,
     assume spec measures character count. Document this assumption and write tests.

9. **Cross-year differences**

   - Some fields shift positions or lengths across tax years. The JSON spec for each year will
     reflect start/length changes. When loading spec for a given year, Zod schemas, parser/generator
     functions automatically adapt because they reference spec JSON. Business rules too may vary:
     capture in `taxYearConfig` or in conditional code keyed by year.

---

## 3. Integrating Detailed Specs into the Iterative Plan

In the iterative chunks described earlier, insert or refine the following subtasks:

### Chunk 2 (Spec JSON Model & Loader)

- Emphasize building or adopting a spreadsheet-to-JSON pipeline so that spec ingestion is
  systematic.
- Validate spec JSON strictly via Zod at load time.
- Include a mechanism to flag suspicious overlaps: e.g., if two fields’ `start` ranges overlap or if
  there are gaps. Potentially check that the union of fields covers exactly 0..recordLength-1 or
  that any filler zones are explicitly documented.

### Chunk 3+ (Schema Generation)

- Instead of hand-writing Zod schemas field-by-field, generate them programmatically from spec JSON:

  - For each `SpecField`, generate a Zod entry:

    - Base: `z.string()` or `z.number()` or `z.string().refine(...)` for dates/numerics with fixed
      format.
    - For string length: if spec requires exact length when generating but allows trimmed in input,
      you might accept shorter but enforce max length ≤ spec length.
    - For numeric: accept JS number within allowed range; but generator must format to exact width.

  - The generation script should output human-readable TS code with comments pulled from
    `description`.
  - After generation, review the generated schema file for semantic correctness.

- Maintain a script like `scripts/generateSchemas.ts` that reads `src/config/2024.json` and writes
  `src/schemas/recordXXXX.ts` files. Run this script whenever spec JSON changes.

### Chunk 4+ (Parser/Generator Implementation)

- Parser/generator functions reference spec JSON at runtime/build:

  - In parser: for each field:

    - If `type === 'number'` and spec indicates implicit decimals, parse substring accordingly
      (divide by power of 10). Use metadata in spec JSON like `decimalPlaces: 2`.
    - If `type === 'date'`, parse via date-fns using `format` from spec JSON.
    - If `enumValues` present, after parsing check that value is in allowed list.

  - In generator: the reverse operations.

- Write utilities that, given a `SpecField`, knows how to parse/format that field. E.g.:

  ```ts
  function parseField(raw: string, spec: SpecField): any {
    let trimmed = raw;
    if (spec.rtl) {
      trimmed = stripRTL(trimmed);
    }
    trimmed = trimmed.trim();
    if (spec.type === 'string') {
      return trimmed;
    }
    if (spec.type === 'number') {
      if (trimmed === '') {
        if (spec.required) throw parse error;
        else return null;
      }
      // If spec.format indicates decimals:
      if (spec.format?.startsWith('numeric(')) { ... }
      const num = Number(trimmed);
      if (isNaN(num)) throw parse error;
      return num;
    }
    if (spec.type === 'date') {
      const date = parseDate(trimmed, spec.format!);
      if (!date) throw parse error;
      return date;
    }
  }
  ```

- In generator:

  ```ts
  function formatField(value: any, spec: SpecField): string {
    let str: string
    if (spec.type === 'string') {
      str = String(value ?? '')
      // maybe normalize unicode
    } else if (spec.type === 'number') {
      // If implicit decimals: multiply, then pad
      str = formatNumber(value, spec.length, spec.format)
    } else if (spec.type === 'date') {
      str = formatDate(value as Date, spec.format!)
    }
    // Apply RTL if needed
    if (spec.rtl) {
      str = injectRTL(str)
    }
    // Pad to spec.length
    if (spec.padding === 'left') return padLeft(str, spec.length)
    else return padRight(str, spec.length)
  }
  ```

- This generic approach reduces manual per-field coding and adapts automatically when spec JSON
  changes.

### Chunk 5+ (Business Rules)

- Use the `businessRules` notes in spec JSON as guidance for writing validation code. For each rule:

  - Encode it in a function in `src/validator`.
  - Write unit tests capturing edge cases: e.g., boundary dates, sums exactly equal or off by one,
    conditional presence.

- Structure: group validations by record type in separate modules. For cross-record rules, have a
  higher-level module.
- When a rule is complex (e.g., sum of many fields equals main total), write focused unit tests
  enumerating example data.

### Chunk 6+ (Multiple Record Types)

- For each record spec JSON (e.g., 1010), run schema-generator script to produce Zod schema. Then
  implement parser/generator using generic utilities that reference spec. Write tests based on spec
  sample data.
- For repeatable sections, use `minOccurs`, `maxOccurs` from JSON. In validation orchestration,
  check length of arrays against these.

### Chunk 7+ (Orchestration)

- Ordering: spec JSON’s `orderIndex` guides the sequence. In orchestration, sort recordSpecs by
  `orderIndex`. While parsing, ensure that once you move past a recordType in order, you cannot go
  back. E.g., if order is \[1000, 1010, 1020, 1030, …, 9999], once you parse a 1020 line, a 1010
  line later is an error.
- Required presence: spec JSON may include `minOccurs: 1` for some record types. After parsing,
  check these minima.
- Optional but placeholder lines: If spec says “include zero-value placeholder if no records”,
  handle that in generator. The spec JSON could include a flag `placeholderIfEmpty: boolean`. If so,
  generator must create a placeholder line with defaultValue from spec for each field (often
  zeros/spaces).

### Chunk 9 (Utilities)

- For padding and length concerns: because Hebrew letters in UTF-8 can be multiple bytes, but string
  length in JS counts code units, confirm with spec authors whether field lengths count characters
  (codepoints) or bytes. If bytes, you need to measure UTF-8 byte length (e.g.,
  `Buffer.byteLength(str, 'utf8')`). If byte-based, pad accordingly with spaces or zeros until
  byte-length matches field length. Warn if character’s UTF-8 length > 1 byte. This is critical for
  fixed-width encoding in UTF-8.
- Build utilities to measure and pad by byte length if required. Write unit tests using known Hebrew
  letters (which have 2-byte or 3-byte UTF-8 lengths) to verify correct behavior.

---

## 4. Verifying Correctness & Edge Cases

1. **Unit Tests for Each Field**

   - For each field in a record, write minimal tests:

     - Valid minimal value (e.g., empty or zero) and valid maximal value (longest allowed string,
       largest allowed number).
     - Invalid too-long or out-of-range values produce errors.
     - For date fields: invalid dates, boundary dates.
     - For enum fields: invalid codes.

   - Automate generation of these tests from spec JSON if possible: e.g., script that for each field
     generates a test template (with placeholders to fill actual valid/invalid examples).

2. **Integration Fixtures for Each Record**

   - For each record type, prepare a sample fixed-width line representing a valid case and one or
     more invalid cases. Store in `tests/fixtures/<year>/record1000-valid.txt`,
     `record1000-invalid-...txt`. Write tests to parse these and expect success or specific errors.

3. **Cross-Record Integration**

   - Full-report fixtures covering combinations: minimal case, maximal case, edge-case counts (e.g.,
     exactly maxOccurs, just over maxOccurs).
   - Roundtrip tests: starting from structured JSON, generate text, then parse back and compare with
     original JSON normalized.

4. **Byte-level Checking**

   - For generator output, assert that each line’s byte length (e.g., using Node’s
     `Buffer.byteLength(line, 'utf8')`) equals `recordLength`. This ensures fixed-width exactly per
     spec. Include this assertion in generator tests.

5. **Ordering and Placeholder Checks**

   - In parse tests, feed lines out of order; expect parse errors pointing to line numbers and
     record types.
   - In generate tests, for optional sections, if `placeholderIfEmpty` is true, expect a placeholder
     line. If spec says omit entirely if empty, confirm correct behavior.

6. **Version Differences**

   - If spec changed between 2024 and 2025, have fixtures and tests for both years. E.g., record
     1010’s field “X” shifts from length 10 to length 12: test that generator for year 2025 uses new
     length, parser expects new length. Spec JSON for each year drives behavior automatically.

---

## 5. Iterative Implementation with TDD

Tie this into the earlier prompts plan by emphasizing:

1. **First, build the spreadsheet/CSV ingestion pipeline**

   - Before writing any parser/generator code, ensure spec JSON is correct. Automate generation of
     JSON from CSV, then Zod-validate the JSON. This becomes the single source of truth.
   - This addresses “each section has detailed spec which will require reasoning and implementation”
     by providing a clear, reviewable medium (the spreadsheet) for domain experts to confirm field
     definitions.

2. **Generate Zod schemas from spec JSON**

   - Use a code-generation script that reads the JSON definitions and outputs TypeScript/Zod schema
     files. This enforces consistency and reduces manual coding errors.
   - After schema generation, write unit tests for schema behavior (valid/invalid values). Because
     the schema code is generated, you may also generate corresponding test templates. A human then
     fills in example valid/invalid values based on domain knowledge.

3. **Implement generic parser/generator utilities keyed off spec JSON**

   - Instead of writing custom parsing logic per field, write generic logic that uses `SpecField`
     metadata. This ensures that new or changed fields are handled automatically.
   - Write unit tests for these utilities (e.g., parsing a number with implicit decimals, formatting
     date fields).
   - For each record type, the parser/generator module simply loops over its `fields` array from
     spec JSON and calls the generic utility, collecting results or errors.

4. **Business-rule implementations**

   - For each record type’s business rules, after schema validation, write focused functions. Use
     spec JSON’s `businessRules` notes as guidance.
   - For cross-record rules, write higher-level validation that inspects multiple sections in
     `ReportData`.

5. **Progress in small increments**

   - Begin with a single record type (1000) fully: spreadsheet→JSON→schema→parser/generator→business
     rules→tests. Only after passing all tests do you move on to the next record type.
   - This matches the earlier Chunk 3–6 approach but enriched with the spreadsheet ingestion step.

6. **Review after each record**

   - After implementing record1000, review test coverage, edge cases, spec alignment. Only proceed
     when confident.
   - Maintain a running suite of unit tests for record1000 as spec evolves.

7. **Evolve orchestration gradually**

   - Once multiple record types are implemented, connect them in parse/generate orchestration. Write
     integration tests at each addition.

8. **Frequent spec reviews**

   - Whenever the official spec document is updated or when adding a new year, compare the new
     spreadsheet version with previous. Use diff tools to highlight additions/removals/changes to
     fields. Update JSON, regenerate schemas and tests, and run the suite.

---

## 6. Detailed Reasoning Practices for Each Section

When tackling each record’s detailed spec, adopt this reasoning workflow:

1. **Read spec documentation carefully**

   - Note field positions, lengths, allowed characters, type semantics (e.g., numeric fields:
     integer-only vs decimal with implicit decimal places).
   - Understand field interdependencies and context: e.g., “This section only appears if X indicator
     in main form = 1.”
   - Note if some fields are “filler” or reserved (often they must be spaces or zeros). Represent
     filler fields in spec JSON with `fieldName: "_filler"` or similar, with `defaultValue: null` or
     spaces; parser may ignore them but generator must output correct filler.

2. **Translate spec lines into spreadsheet rows**

   - For each field specification row in PDF/table, create a row in your spreadsheet. Include
     descriptive notes in the “description” column so the implementer and future maintainer can
     understand context.

3. **Clarify ambiguities early**

   - If spec says “field X: numeric, length 10, implied two decimal places,” clarify: is
     input/output in generator numeric type or string? Our API uses JS number; generator formats to
     string. Document that in spec JSON as `format: "numeric(8,2)"`: 8 digits integer part, 2 digits
     decimal part. Parser parses substring to number by dividing last 2 digits by 100.

4. **Decide data types in TS**

   - For “date” fields: do we expose as JS `Date` or as ISO string? Prefer JS `Date` for validation
     convenience; in structured `ReportData`, fields of type Date. Zod schema: accept `Date` object
     or string? You might accept ISO string or `Date` and transform to `Date`. Document in API.

5. **Implement field-level parsing logic**

   - For each `SpecField`, ensure the generic parser utility handles:

     - Trimming or zero-check for optional fields.
     - For numeric: detect empty or zero.
     - For date: strict format and invalid date detection.
     - For strings: strip padding, strip RTL controls, normalize Unicode.
     - For enums: verify membership.

   - Write unit tests with sample raw substrings: e.g., `'0000123456'` -> number 123456 or 1234.56
     depending on format.

6. **Padding/formatting logic**

   - Ensure generator uses same logic in reverse: number → numeric string with implicit decimals,
     padded left with zeros or spaces; date → format with leading zeros; string → normalized and
     padded right with spaces; RTL if needed.

7. **Edge-case reasoning**

   - For numeric fields: extremely large numbers exceeding width → error. Negative numbers? If
     allowed? Clarify spec. If not allowed, validation must reject negative.
   - For date: Feb 29 on non-leap year must error.
   - For optional fields: if omitted in structured input, generator must output default filler
     (spaces or zeros) per spec JSON’s `defaultValue`.
   - For boolean indicators encoded as numeric codes (“1”/“0”): represent fields in TS as boolean or
     number? Probably boolean in structured API; generator maps to “1” or “0”. Document in schema
     generation.

8. **Cross-field and cross-record reasoning**

   - Some sums or ratios: e.g., sum of shareholder percentages must equal 100. Validate with a
     tolerance? Likely exact integer. Write test cases: \[50, 50], \[33, 33, 34], \[100 alone for
     single shareholder], error if sum ≠ 100.
   - If R\&D section present, certain mainForm flags must be “yes”. Validate both ways: if mainForm
     says no but R\&D entries exist → error; if mainForm says yes but no R\&D entries → maybe
     warning or error depending on spec.
   - Foreign income and appendix: if any foreign income entries, foreignAppendix must appear; if
     appendix appears but no incomes, error.
   - Capital gains appendices: if a particular appendix present, ensure mainForm summary fields
     reflect presence; validate totals match sum of detailed entries.

9. **Record ordering and counts**

   - The spec JSON’s `orderIndex`, `minOccurs` and `maxOccurs` guide orchestration:

     - In parsing: count occurrences, if > maxOccurs → error; if < minOccurs → error.
     - In generation: if structured data supplies too many entries → validation error before
       generating lines.
     - If structured data supplies fewer than minOccurs: if spec indicates placeholder should be
       generated automatically, generator must create placeholder lines; otherwise error.

10. **Testing with real-world examples**

    - If available, get sample OPCN 1214 files from actual use (masked personal data). Use those as
      fixtures. Parse them, examine fields; compare parsed object to expected values. Generate from
      object and diff against original text (taking care that whitespace differences beyond spec
      might exist).
    - Use these real-world fixtures to discover spec nuances: e.g., how Hebrew text is encoded,
      whether they include bidi controls explicitly or expect generator to add them.

---

## 7. Example: Handling Record 1020 (Shareholders) in Detail

To illustrate the process, here’s a hypothetical walkthrough for record 1020 (Shareholders):

1. **Spec Analysis (from official documentation)**

   - Suppose spec lists record 1020 with length 1160, fields such as:

     - Positions 0–3: form type “1214”
     - Positions 4–7: record type “1020”
     - Positions 8–17: shareholder ID (numeric, 10 digits, left-padded zeros)
     - Positions 18–67: shareholder name (string, 50 chars, Hebrew or English; RTL if Hebrew)
     - Positions 68–75: percent ownership (numeric, length 8, implied 2 decimals: e.g., “00001250”
       => 12.50%)
     - Positions 76–83: date of acquisition (date format “ddMMyyyy”)
     - Positions 84–XYZ: other fields…
     - Filler zones as needed.

   - Business rules:

     - At least one shareholder, at most 99.
     - Sum of percent ownership fields across all shareholder records must equal 100.00% (i.e.,
       10000 in implied integer).
     - If corporate shareholder, certain additional fields required; if individual, other fields.
     - Date of acquisition must be ≤ tax-year-end date.

   - RTL handling: `shareholderName` if Hebrew: wrap with bidi controls.

2. **Spreadsheet Entry for 1020**

   - Each row: fieldCode “1020_01”, fieldName “shareholderId”, start 8, length 10, type number,
     required true, format “numeric(8,2)”? Actually for ID it’s integer, so format “numeric(10,0)”,
     padding “left”, defaultValue “0000000000”?
   - fieldCode “1020_02”, fieldName “shareholderName”, start 18, length 50, type string, required
     true, padding “right”, rtl true, description “Name of shareholder (Hebrew or English)”
   - fieldCode “1020_03”, fieldName “ownershipPercent”, start 68, length 8, type number, required
     true, format “numeric(6,2)” (i.e., up to 9999.99? but since percent ≤ 100.00, fits “0010000”?
     Clarify), padding “left”, description “Ownership percentage with 2 decimal places”
   - fieldCode “1020_04”, fieldName “acquisitionDate”, start 76, length 8, type date, required
     false, format “ddMMyyyy”, padding N/A
   - … and so on.

3. **Generate JSON Spec**

   - After exporting CSV to JSON:

     ```json
     {
       "recordType": "1020",
       "recordLength": 1160,
       "repeatable": true,
       "minOccurs": 1,
       "maxOccurs": 99,
       "orderIndex": 3,
       "description": "Shareholder records",
       "fields": [
         {
           "fieldCode": "1020_01",
           "fieldName": "shareholderId",
           "start": 8,
           "length": 10,
           "type": "number",
           "required": true,
           "format": "numeric(10,0)",
           "padding": "left",
           "description": "Numeric shareholder identifier"
         },
         {
           "fieldCode": "1020_02",
           "fieldName": "shareholderName",
           "start": 18,
           "length": 50,
           "type": "string",
           "required": true,
           "padding": "right",
           "rtl": true,
           "description": "Name of shareholder"
         },
         {
           "fieldCode": "1020_03",
           "fieldName": "ownershipPercent",
           "start": 68,
           "length": 8,
           "type": "number",
           "required": true,
           "format": "numeric(6,2)",
           "padding": "left",
           "description": "Share ownership percentage (two decimals)"
         },
         {
           "fieldCode": "1020_04",
           "fieldName": "acquisitionDate",
           "start": 76,
           "length": 8,
           "type": "date",
           "required": false,
           "format": "ddMMyyyy",
           "description": "Date of acquisition"
         }
         // ... other fields ...
       ]
     }
     ```

   - Validate with Zod that start+length never exceed recordLength, and fields do not overlap.

4. **Schema Generation**

   - The script reads this JSON, for each field creates a Zod entry:

     - `shareholderId: z.number().int().nonnegative()` plus possibly a refinement that it fits
       within the digit count: e.g.,
       `refine(n => n < 10**10, { message: ..., path: ['shareholderId'], params: { code: VALIDATION_CODES.INVALID_RANGE } })`.
     - `shareholderName: z.string().max(50).refine(s => /* optionally disallow control chars */ true, ... )`.
     - `ownershipPercent: z.number().refine(n => n >= 0 && n <= 100, { message: ..., params: { code: VALIDATION_CODES.INVALID_RANGE } })`.
     - Optionally transform: if structured input provides `"12.5"` or `12.5`, ensure it’s a number.
       If input is string, consider schema accepting string or number then transform to number.
     - `acquisitionDate: z.date().optional()` or accept string and transform:
       `z.string().refine(str => parseDate(...) not null).transform(str => parseDate(str))`.

   - Export `record1020Schema` and `type ShareholderData = z.infer<typeof record1020Schema>`.

5. **Parser Implementation**

   - Generic parser iterates fields:

     - Extract raw substring: `raw = line.slice( start, start + length )`.
     - For `rtl` fields: `valueStr = stripRTL(raw).trimEnd()`.
     - For number: if `format: "numeric(6,2)"`, parse `raw.trim()` into integer string, e.g.
       “0001250” → 1250, then divide by 100 → 12.50. If empty or all zeros and required true?
       Probably zero means 0.00; but spec may say percent cannot be zero—business rule will catch
       that.
     - For date: parse with date-fns; if invalid but field optional and raw is spaces or zeros,
       treat as undefined or null.

   - After building an object
     `{ shareholderId: number, shareholderName: string, ownershipPercent: number, acquisitionDate: Date | undefined, ... }`,
     run `record1020Schema.safeParse(...)` to catch type-level issues.

6. **Generator Implementation**

   - For each `ShareholderData`:

     - For `shareholderId` (number): convert to integer string, pad left with zeros to length 10.
     - For `shareholderName`: normalize, optionally detect Hebrew vs Latin? Spec may not require
       detection; always wrap in bidi controls if rtl=true; pad right with spaces to length 50.
     - For `ownershipPercent`: multiply by 100 to get integer (e.g., 12.50 → 1250), convert to
       string, pad left zeros to length 8.
     - For `acquisitionDate`: if provided Date, format with `ddMMyyyy`; if undefined and optional,
       fill with spaces or zeros per spec default; pad to length 8.
     - Concatenate with prefix “1214” and “1020” at fixed positions if spec says so; or those
       positions may be captured as separate fields in spec JSON.

   - After building the full line (length must be exactly 1160), test
     `Buffer.byteLength(line, 'utf8') === 1160`.

7. **Business Validation**

   - In `validateShareholders(dataArray: ShareholderData[], year: number)`:

     - If `dataArray.length < 1` → error `MIN_RECORDS_NOT_MET`.
     - If `dataArray.length > 99` → error `MAX_RECORDS_EXCEEDED`.
     - Sum percentages:

       ```ts
       const sum = dataArray.reduce((acc, sh) => acc + sh.ownershipPercent, 0)
       if (Math.round(sum * 100) !== 10000) {
         errors.push({
           recordType: '1020',
           field: 'ownershipPercent',
           message: `Sum of ownershipPercent must equal 100.00; got ${sum.toFixed(2)}.`,
           code: VALIDATION_CODES.CROSS_FIELD_VALIDATION
         })
       }
       ```

     - For each shareholder: if corporate vs individual rules: if `isCorporate` flag in data exists,
       check required fields (e.g., corporate ID vs personal ID). These rules come from spec JSON’s
       `businessRules` notes.

   - Write unit tests covering:

     - Exactly summing to 100 passes.
     - Off-by-0.01 fails.
     - Single shareholder with 100% passes.
     - Too many shareholders fails.

8. **Integration**

   - Once `record1020Parser` and `record1020Generator` and `validateShareholders` exist, integrate
     in orchestration: after parsing all lines, collect array, then run validation. In generation:
     if `ReportData.shareholders` present, validate array length and content before generating
     lines.

9. **Tests and Fixtures**

   - Create a fixture line: manually craft a sample record 1020 line according to spec: e.g.

     ```
     "12141020" + "0000000123" + "יוסי כהן                    " + "00010000" + "01012024" + ... filler spaces ...
     ```

     (Adjust positions precisely). Store in `tests/fixtures/2024/record1020-sample.txt`. In test,
     call parseRecord1020 on that string, expect an object with `shareholderId: 123`,
     `shareholderName: "יוסי כהן"`, `ownershipPercent: 100.00`,
     `acquisitionDate: new Date(2024,0,1)`, etc.

   - In generator test: given object with those fields, generate line and compare to stored sample.

---

## 8. Handling Record 9999 (End Record)

- Often the “end record” is simpler: fixed-length line, filled with specific code “9999” in
  recordType position, and rest is filler (spaces or zeros). In spec JSON:

  ```json
  {
    "recordType": "9999",
    "recordLength": 150,
    "repeatable": false,
    "orderIndex": 999,
    "fields": [
      {
        "fieldCode": "9999_01",
        "fieldName": "formType",
        "start": 0,
        "length": 4,
        "type": "string",
        "required": true,
        "defaultValue": "1214",
        "padding": "right"
      },
      {
        "fieldCode": "9999_02",
        "fieldName": "recordType",
        "start": 4,
        "length": 4,
        "type": "string",
        "required": true,
        "defaultValue": "9999",
        "padding": "right"
      },
      {
        "fieldCode": "9999_03",
        "fieldName": "_filler",
        "start": 8,
        "length": 142,
        "type": "string",
        "required": true,
        "defaultValue": " "
      }
    ]
  }
  ```

- Parser: typically, when encountering 9999, signal end-of-report. If extra lines after 9999 appear,
  treat as error or warning.
- Generator: always append 9999 line at end. No user-specified data needed.
- Add tests: parsing a 9999 line yields no object (or a sentinel), but signals successful end. In
  orchestration, stop parsing further lines.

---

## 9. Continuous Review & Collaboration

- **Peer review of spreadsheet/JSON spec**: Have domain experts or accountants review the field
  definitions before coding. The spreadsheet is easy to review and annotate.
- **Code review of generated schemas and parser/generator code**: Even if code is generated, review
  to ensure complexity is correctly captured (e.g., decimal handling).
- **Automated CI checks on spec JSON**: Include in CI a step that runs `yearSpecSchema.parse` on
  each `src/config/<year>.json` to catch mistakes immediately.
- **Monitoring for spec updates**: When the Tax Authority publishes a new spec year, update
  spreadsheet, produce JSON, run tests. Maintain backward compatibility only if required; otherwise
  increment major version.

---

## 10. Summary & How to Integrate into the Earlier Prompt Series

In your iterative plan and prompts, ensure that:

1. **Before writing any schema or parser code**, you have a reviewed spec JSON for record 1000. That
   means building/importing the spreadsheet-to-JSON converter or manually populating the JSON and
   validating it with Zod.
2. **Schema generation step**: Write or invoke a TypeScript/Node script (e.g.,
   `scripts/generate-schemas.ts`) that reads `src/config/2024.json` and writes
   `src/schemas/recordXXXX.ts` files automatically. In earlier prompts, adjust Prompt 3 to call this
   script or to generate schema modules rather than hand-writing them entirely.
3. **Generic parser/generator utilities**: In Prompt 4, instead of manually slicing fields for
   record1000, write generic logic that loops through spec fields. The prompt to the LLM can ask:
   “Implement a generic parseField and formatField utility that, given a `SpecField`, handles
   string/number/date with implicit formats from spec JSON. Then implement parseRecord1000 by
   fetching spec fields and invoking parseField for each.”
4. **Testing emphasis**: For each record type prompt (e.g., Prompt 6 for 1010/1020), instruct the
   LLM to generate tests derived from spec JSON: e.g., “Write unit tests that verify that for each
   field, a minimal valid example and an invalid example are correctly handled. Use spec JSON
   metadata to craft test values (e.g., if length 10, test value of length 10 and length 11).”
5. **Byte-length checks**: In generator tests, assert
   `Buffer.byteLength(line, 'utf8') === spec.recordLength`.
6. **Business rule encoding**: For each record’s businessRules noted in spec JSON, have a validation
   module. In the prompt to LLM, supply a list of business rules extracted from spec and ask it to
   encode them.
7. **Orchestration based on spec orderIndex**: In Prompt 7, ensure the orchestration logic reads
   `orderIndex` from spec JSON to enforce parsing order dynamically, not hard-coded sequence.
8. **Versioning**: In Prompt 10, ensure dynamic import or static map approach handles spec JSON per
   year. If using bundler limitations, instruct to create a mapping object:
   `{ 2024: spec2024, 2025: spec2025 }`.
9. **Fixtures generation**: In Prompt 11, you can auto-generate fixture lines from spec JSON for
   minimal valid values: e.g., for each field, if required numeric field, default to zero; for
   required string, default to spaces or a known test string; for dates, choose e.g., “01012024”.
   Then assemble full-line fixtures programmatically. The prompt can instruct the LLM to write a
   small Node script to generate these fixture lines automatically given the spec JSON, so you don’t
   hand-craft dozens of long lines manually.
10. **Documentation references**: In Prompt 13, document the spec ingestion process: link to
    `SPEC_DEFINITION.md` describing how to update spreadsheet, regenerate JSON, then regenerate
    schemas.

---

## 11. Practical Next Steps for Detailed Spec Handling

- **Set up the spreadsheet-to-JSON pipeline**

  - Immediately create a template CSV/Excel for record1000. Populate with all fields from spec doc.
    Export to JSON. Validate with Zod. This becomes the basis for record1000 implementation.

- **Automate schema generation**

  - Write `scripts/generate-schemas.ts` that:

    1. Loads `src/config/2024.json`.
    2. For each recordSpec, produces `src/schemas/record${recordType}.ts` containing a Zod schema
       that mirrors the fields. Include comments with `description`.
    3. Export Zod schema and TS type.

  - Commit generated schema files so LLM prompts for parser/generator can import stable schema
    modules.

- **Generic parse/format utilities**

  - Implement in `src/utils/parserUtils.ts` and `src/utils/generatorUtils.ts` functions that operate
    on any `SpecField`.

- **Validation scaffolding**

  - For each recordSpec, generate a stub validation module where developers fill in businessRules
    logic. The LLM can help scaffold functions like
    `validateRecord${recordType}Business(data, year)`, with comments listing rules to implement.

- **Testing automation**

  - Write scripts to generate test templates: for each field, create test cases for max/min length,
    invalid values. LLM can be prompted to fill in details once spec metadata is available.

- **Integration orchestration**

  - Write orchestration that uses spec JSON’s ordering and occurrence constraints. Avoid hardcoding
    record types; base logic on `recordSpecs` array.

- **Continuous spec validation**

  - Include CI step that runs the spreadsheet-to-JSON conversion and validates JSON against Zod
    schema. If spec JSON is invalid, CI fails early.

---

## 12. Conclusion

Handling detailed specs for each section demands:

- A **structured ingestion pipeline** (spreadsheet → JSON → Zod-validated config).
- **Generic utilities** to parse/format fields based on metadata.
- **Automated schema generation** from spec JSON to ensure consistency and minimize manual errors.
- **Business-rule scaffolding** derived from spec notes, implemented in well-tested modules.
- **Integration tests and fixtures** programmatically generated from spec JSON when possible.
- **Dynamic orchestration** driven by spec metadata (orderIndex, minOccurs, maxOccurs).
- **Versioning support** for spec changes across tax years via separate JSON files and conditional
  logic.
