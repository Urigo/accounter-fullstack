# @accounter/shaam-uniform-format-generator

## 0.2.1

### Patch Changes

- [#2291](https://github.com/Urigo/accounter-fullstack/pull/2291)
  [`633a688`](https://github.com/Urigo/accounter-fullstack/commit/633a68824433dcd4df7be7e9c118ddadbf9a2029)
  Thanks [@renovate](https://github.com/apps/renovate)! - dependencies updates:
  - Updated dependency [`zod@4.0.17` ↗︎](https://www.npmjs.com/package/zod/v/4.0.17) (from
    `3.25.76`, in `dependencies`)

- [#2446](https://github.com/Urigo/accounter-fullstack/pull/2446)
  [`c56e276`](https://github.com/Urigo/accounter-fullstack/commit/c56e276f6e2addab88cd9fcd11b68fbc15c6f41a)
  Thanks [@renovate](https://github.com/apps/renovate)! - dependencies updates:
  - Updated dependency [`iconv-lite@0.7.0` ↗︎](https://www.npmjs.com/package/iconv-lite/v/0.7.0)
    (from `0.6.3`, in `dependencies`)

- [#2456](https://github.com/Urigo/accounter-fullstack/pull/2456)
  [`3fe961a`](https://github.com/Urigo/accounter-fullstack/commit/3fe961a8338359ed544ce4de5730a1898fb1cc43)
  Thanks [@renovate](https://github.com/apps/renovate)! - dependencies updates:
  - Updated dependency [`zod@4.1.0` ↗︎](https://www.npmjs.com/package/zod/v/4.1.0) (from `4.0.17`,
    in `dependencies`)

- [#2457](https://github.com/Urigo/accounter-fullstack/pull/2457)
  [`16b0040`](https://github.com/Urigo/accounter-fullstack/commit/16b0040862d1bf9d65eb9829e8eb33117d60a1c2)
  Thanks [@renovate](https://github.com/apps/renovate)! - dependencies updates:
  - Updated dependency [`zod@4.1.1` ↗︎](https://www.npmjs.com/package/zod/v/4.1.1) (from `4.1.0`,
    in `dependencies`)

- [#2469](https://github.com/Urigo/accounter-fullstack/pull/2469)
  [`7176d0d`](https://github.com/Urigo/accounter-fullstack/commit/7176d0d3e1808cc1800e1cabe121b380f0480d63)
  Thanks [@renovate](https://github.com/apps/renovate)! - dependencies updates:
  - Updated dependency [`zod@4.1.3` ↗︎](https://www.npmjs.com/package/zod/v/4.1.3) (from `4.1.1`,
    in `dependencies`)

- [#2478](https://github.com/Urigo/accounter-fullstack/pull/2478)
  [`86e628e`](https://github.com/Urigo/accounter-fullstack/commit/86e628e40cc0d8fac239cfea2563326094013df4)
  Thanks [@renovate](https://github.com/apps/renovate)! - dependencies updates:
  - Updated dependency [`zod@4.1.5` ↗︎](https://www.npmjs.com/package/zod/v/4.1.5) (from `4.1.3`,
    in `dependencies`)

- [#2483](https://github.com/Urigo/accounter-fullstack/pull/2483)
  [`43760d7`](https://github.com/Urigo/accounter-fullstack/commit/43760d77cb29ea44257d37ca0bc7a97e17aa1c89)
  Thanks [@renovate](https://github.com/apps/renovate)! - dependencies updates:
  - Updated dependency [`zod@4.1.8` ↗︎](https://www.npmjs.com/package/zod/v/4.1.8) (from `4.1.5`,
    in `dependencies`)

- [#2512](https://github.com/Urigo/accounter-fullstack/pull/2512)
  [`590823c`](https://github.com/Urigo/accounter-fullstack/commit/590823cf7105b018a3127abc2343ac714f2845ac)
  Thanks [@renovate](https://github.com/apps/renovate)! - dependencies updates:
  - Updated dependency [`zod@4.1.9` ↗︎](https://www.npmjs.com/package/zod/v/4.1.9) (from `4.1.8`,
    in `dependencies`)

- [#2522](https://github.com/Urigo/accounter-fullstack/pull/2522)
  [`df6b635`](https://github.com/Urigo/accounter-fullstack/commit/df6b63558a951ae7a318515d1d8b86b1b49a74a0)
  Thanks [@renovate](https://github.com/apps/renovate)! - dependencies updates:
  - Updated dependency [`zod@4.1.11` ↗︎](https://www.npmjs.com/package/zod/v/4.1.11) (from `4.1.9`,
    in `dependencies`)

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
