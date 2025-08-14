# @accounter/shaam-uniform-format-generator

## 0.2.0

### Minor Changes

- [#2314](https://github.com/Urigo/accounter-fullstack/pull/2314)
  [`88207b1`](https://github.com/Urigo/accounter-fullstack/commit/88207b1f3fbafbd67b67fe8edca6a576d42e25bd)
  Thanks [@gilgardosh](https://github.com/gilgardosh)! - Initial package

### Patch Changes

- [#2321](https://github.com/Urigo/accounter-fullstack/pull/2321)
  [`9915dd2`](https://github.com/Urigo/accounter-fullstack/commit/9915dd2c0f7f78103320bc99dabd2de2384bbfbc)
  Thanks [@gilgardosh](https://github.com/gilgardosh)! - \* **New Integration Test Suite**: I've
  added a comprehensive integration test suite for validating the uniform format report generation
  process using real-world fixture files.
  - **Round-trip Validation**: I've implemented tests to perform a full round-trip: parsing existing
    `BKMVDATA.txt` and `ini.txt` fixtures, generating new reports from the parsed data, and then
    re-parsing the generated reports to ensure data integrity and consistency.
  - **Data Parsing and Generation Coverage**: The tests cover parsing and generation of various
    record types (A100, B100, B110, C100, D110, D120, M100, Z900 for `BKMVDATA.txt` and A000,
    A000Sum for `ini.txt`), ensuring broad coverage of the uniform format specification.
  - **Robustness Testing**: I've included tests for handling edge cases such as different line
    endings, whitespace, and gracefully skipping invalid or unknown record types during parsing,
    enhancing the robustness of the parsing logic.
  - **Monetary Precision Verification**: A test has been added to ensure that monetary values from
    B100 records are correctly parsed and can be part of the round-trip process, implying that
    precision is maintained throughout data transformation.

- [#2322](https://github.com/Urigo/accounter-fullstack/pull/2322)
  [`408b287`](https://github.com/Urigo/accounter-fullstack/commit/408b287588f1753776cd98755383fc269d7410fb)
  Thanks [@gilgardosh](https://github.com/gilgardosh)! - \* **New Client-Side Feature**: I've added
  a new modal component (`FileDownloadModal`) to the client application, allowing users to select a
  date range and trigger the generation and download of uniform format files (bkmvdata and ini)
  directly from the UI.
  - **Data Model Extension**: The `JournalEntry` and `BusinessMetadata` schemas have been extended
    to support additional optional fields, such as `batchNumber`, `transactionType`,
    `referenceDocument`, `currencyCode`, `foreignCurrencyAmount` for journal entries, and `address`
    details for business metadata. This enriches the data available for reporting.
  - **Uniform Format Generator Enhancement**: The `generateUniformFormatReport` function in the
    generator package has been updated to consume and incorporate these new extended fields from the
    `JournalEntry` and `BusinessMetadata` into the generated uniform format files, ensuring more
    comprehensive reports.
  - **Testing**: New unit tests have been added to verify that the uniform format generator
    correctly handles journal entries with the newly introduced extended fields, ensuring data
    integrity and proper report generation.
