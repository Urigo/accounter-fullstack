# @accounter-toolkit/green-invoice-graphql

## 0.8.1

### Patch Changes

- [#2478](https://github.com/Urigo/accounter-fullstack/pull/2478)
  [`86e628e`](https://github.com/Urigo/accounter-fullstack/commit/86e628e40cc0d8fac239cfea2563326094013df4)
  Thanks [@renovate](https://github.com/apps/renovate)! - dependencies updates:
  - Updated dependency
    [`@graphql-mesh/config@0.108.11` ↗︎](https://www.npmjs.com/package/@graphql-mesh/config/v/0.108.11)
    (from `0.108.8`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/http@0.106.10` ↗︎](https://www.npmjs.com/package/@graphql-mesh/http/v/0.106.10)
    (from `0.106.7`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/json-schema@0.109.11` ↗︎](https://www.npmjs.com/package/@graphql-mesh/json-schema/v/0.109.11)
    (from `0.109.8`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/runtime@0.106.10` ↗︎](https://www.npmjs.com/package/@graphql-mesh/runtime/v/0.106.10)
    (from `0.106.7`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/store@0.104.10` ↗︎](https://www.npmjs.com/package/@graphql-mesh/store/v/0.104.10)
    (from `0.104.7`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/types@0.104.10` ↗︎](https://www.npmjs.com/package/@graphql-mesh/types/v/0.104.10)
    (from `0.104.7`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/utils@0.104.10` ↗︎](https://www.npmjs.com/package/@graphql-mesh/utils/v/0.104.10)
    (from `0.104.7`, in `dependencies`)

- [#2483](https://github.com/Urigo/accounter-fullstack/pull/2483)
  [`43760d7`](https://github.com/Urigo/accounter-fullstack/commit/43760d77cb29ea44257d37ca0bc7a97e17aa1c89)
  Thanks [@renovate](https://github.com/apps/renovate)! - dependencies updates:
  - Updated dependency
    [`@graphql-mesh/config@0.108.13` ↗︎](https://www.npmjs.com/package/@graphql-mesh/config/v/0.108.13)
    (from `0.108.11`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/http@0.106.12` ↗︎](https://www.npmjs.com/package/@graphql-mesh/http/v/0.106.12)
    (from `0.106.10`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/json-schema@0.109.13` ↗︎](https://www.npmjs.com/package/@graphql-mesh/json-schema/v/0.109.13)
    (from `0.109.11`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/runtime@0.106.12` ↗︎](https://www.npmjs.com/package/@graphql-mesh/runtime/v/0.106.12)
    (from `0.106.10`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/store@0.104.12` ↗︎](https://www.npmjs.com/package/@graphql-mesh/store/v/0.104.12)
    (from `0.104.10`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/types@0.104.12` ↗︎](https://www.npmjs.com/package/@graphql-mesh/types/v/0.104.12)
    (from `0.104.10`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/utils@0.104.12` ↗︎](https://www.npmjs.com/package/@graphql-mesh/utils/v/0.104.12)
    (from `0.104.10`, in `dependencies`)

- [#2518](https://github.com/Urigo/accounter-fullstack/pull/2518)
  [`e0d72c7`](https://github.com/Urigo/accounter-fullstack/commit/e0d72c7c0fac89997f9c96b0180523ac7d889b43)
  Thanks [@renovate](https://github.com/apps/renovate)! - dependencies updates:
  - Updated dependency
    [`@graphql-mesh/config@0.108.14` ↗︎](https://www.npmjs.com/package/@graphql-mesh/config/v/0.108.14)
    (from `0.108.13`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/http@0.106.13` ↗︎](https://www.npmjs.com/package/@graphql-mesh/http/v/0.106.13)
    (from `0.106.12`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/json-schema@0.109.14` ↗︎](https://www.npmjs.com/package/@graphql-mesh/json-schema/v/0.109.14)
    (from `0.109.13`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/runtime@0.106.13` ↗︎](https://www.npmjs.com/package/@graphql-mesh/runtime/v/0.106.13)
    (from `0.106.12`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/store@0.104.13` ↗︎](https://www.npmjs.com/package/@graphql-mesh/store/v/0.104.13)
    (from `0.104.12`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/types@0.104.13` ↗︎](https://www.npmjs.com/package/@graphql-mesh/types/v/0.104.13)
    (from `0.104.12`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/utils@0.104.13` ↗︎](https://www.npmjs.com/package/@graphql-mesh/utils/v/0.104.13)
    (from `0.104.12`, in `dependencies`)

## 0.8.0

### Minor Changes

- [#2334](https://github.com/Urigo/accounter-fullstack/pull/2334)
  [`0c6ac6c`](https://github.com/Urigo/accounter-fullstack/commit/0c6ac6c0fd8d7afe96ce26260a514ccb682e621b)
  Thanks [@gilgardosh](https://github.com/gilgardosh)! - \* **New UI for Document Generation**: A
  comprehensive new UI screen (`IssueDocumentScreen`) has been added, allowing users to create and
  configure various accounting documents (e.g., invoices, receipts) with detailed settings for
  document type, language, currency, and VAT.
  - **Real-time Document Preview**: Users can now preview generated documents (likely PDFs) directly
    within the UI before officially issuing them, powered by the `pdfjs-dist` library for
    client-side rendering.
  - **Detailed Document Configuration**: The new UI provides extensive fields for capturing client
    information, managing multiple income items (description, price, quantity, VAT), and specifying
    various payment methods with their unique details (e.g., bank, credit card, PayPal, payment
    app).
  - **GraphQL API Extension for Preview**: The backend GraphQL API has been extended with a new
    `previewGreenInvoiceDocument` mutation, enabling the client to send detailed document input and
    receive a base64-encoded PDF preview.
  - **Improved Green Invoice Integration**: New helper functions and schema updates ensure proper
    mapping of UI inputs to the Green Invoice API's complex data structures for document generation
    and preview, handling various enums and nested objects.

- [#2365](https://github.com/Urigo/accounter-fullstack/pull/2365)
  [`1be8c87`](https://github.com/Urigo/accounter-fullstack/commit/1be8c87be477204ddfc57c38d1ab8cfc66cea1a9)
  Thanks [@gilgardosh](https://github.com/gilgardosh)! - Extend and update the JSON schema

### Patch Changes

- [#2402](https://github.com/Urigo/accounter-fullstack/pull/2402)
  [`b1352c4`](https://github.com/Urigo/accounter-fullstack/commit/b1352c4190bad2d93d1be823d96ff2b53df7387a)
  Thanks [@renovate](https://github.com/apps/renovate)! - dependencies updates:
  - Updated dependency
    [`@graphql-mesh/config@0.108.8` ↗︎](https://www.npmjs.com/package/@graphql-mesh/config/v/0.108.8)
    (from `0.108.7`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/http@0.106.7` ↗︎](https://www.npmjs.com/package/@graphql-mesh/http/v/0.106.7)
    (from `0.106.6`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/json-schema@0.109.8` ↗︎](https://www.npmjs.com/package/@graphql-mesh/json-schema/v/0.109.8)
    (from `0.109.7`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/runtime@0.106.7` ↗︎](https://www.npmjs.com/package/@graphql-mesh/runtime/v/0.106.7)
    (from `0.106.6`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/store@0.104.7` ↗︎](https://www.npmjs.com/package/@graphql-mesh/store/v/0.104.7)
    (from `0.104.6`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/types@0.104.7` ↗︎](https://www.npmjs.com/package/@graphql-mesh/types/v/0.104.7)
    (from `0.104.6`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/utils@0.104.7` ↗︎](https://www.npmjs.com/package/@graphql-mesh/utils/v/0.104.7)
    (from `0.104.6`, in `dependencies`)

- [#2334](https://github.com/Urigo/accounter-fullstack/pull/2334)
  [`0c6ac6c`](https://github.com/Urigo/accounter-fullstack/commit/0c6ac6c0fd8d7afe96ce26260a514ccb682e621b)
  Thanks [@gilgardosh](https://github.com/gilgardosh)! - - **New Document Generation UI**: I've
  introduced a brand new UI screen, `IssueDocumentScreen`, that allows users to create and configure
  various accounting documents like invoices and receipts with extensive settings for document type,
  language, currency, and VAT.
  - **Real-time PDF Document Preview**: Users can now preview generated documents in real-time
    directly within the UI before issuing them, powered by the `pdfjs-dist` library for client-side
    PDF rendering.
  - **Comprehensive Document Configuration**: The new UI provides detailed configuration options,
    including fields for client information, managing multiple income items (description, price,
    quantity, VAT), and specifying various payment methods with their unique details (e.g., bank,
    credit card, PayPal, payment app).
  - **GraphQL API Extensions for Document Management**: I've extended the GraphQL API with a new
    `previewGreenInvoiceDocument` mutation for generating PDF previews and a `newDocumentInfoDraft`
    query to pre-populate document forms based on existing charge data.
  - **Enhanced Document Actions in Table View**: I've added the ability to close and re-issue
    documents directly from the documents table, providing a more streamlined workflow for managing
    document statuses.
  - **New 'With Open Documents' Filter**: A new filter, 'With Open Documents', has been added to the
    charges filter, allowing users to easily identify and manage charges that have associated open
    documents.
  - **GraphQL Query Refactoring**: I've refactored several GraphQL queries from fetching multiple
    charges (`chargesByIDs`) to fetching a single charge (`charge`), simplifying data retrieval for
    individual charge details.
  - **Database Migration for Open Documents Flag**: A new database migration introduces an
    `open_docs_flag` to the `extended_charges` view, enabling efficient filtering of charges based
    on their associated open documents.

## 0.7.4

### Patch Changes

- [#2026](https://github.com/Urigo/accounter-fullstack/pull/2026)
  [`7d70618`](https://github.com/Urigo/accounter-fullstack/commit/7d706185e337c05efd2c8cbeb3b4b919522c5336)
  Thanks [@renovate](https://github.com/apps/renovate)! - dependencies updates:
  - Updated dependency
    [`@graphql-mesh/config@0.108.3` ↗︎](https://www.npmjs.com/package/@graphql-mesh/config/v/0.108.3)
    (from `0.108.2`, in `dependencies`)

- [#2028](https://github.com/Urigo/accounter-fullstack/pull/2028)
  [`ed1758c`](https://github.com/Urigo/accounter-fullstack/commit/ed1758ccebf849fde17a4c6e208a6e76913aea2c)
  Thanks [@gilgardosh](https://github.com/gilgardosh)! - dependencies updates:
  - Updated dependency
    [`@graphql-mesh/config@0.108.3` ↗︎](https://www.npmjs.com/package/@graphql-mesh/config/v/0.108.3)
    (from `0.108.2`, in `dependencies`)

- [#2060](https://github.com/Urigo/accounter-fullstack/pull/2060)
  [`4efa957`](https://github.com/Urigo/accounter-fullstack/commit/4efa9571e0bdb634ba77156a5c353656b814a595)
  Thanks [@renovate](https://github.com/apps/renovate)! - dependencies updates:
  - Updated dependency
    [`@graphql-mesh/config@0.108.4` ↗︎](https://www.npmjs.com/package/@graphql-mesh/config/v/0.108.4)
    (from `0.108.3`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/http@0.106.3` ↗︎](https://www.npmjs.com/package/@graphql-mesh/http/v/0.106.3)
    (from `0.106.2`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/json-schema@0.109.4` ↗︎](https://www.npmjs.com/package/@graphql-mesh/json-schema/v/0.109.4)
    (from `0.109.3`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/runtime@0.106.3` ↗︎](https://www.npmjs.com/package/@graphql-mesh/runtime/v/0.106.3)
    (from `0.106.2`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/store@0.104.3` ↗︎](https://www.npmjs.com/package/@graphql-mesh/store/v/0.104.3)
    (from `0.104.2`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/types@0.104.3` ↗︎](https://www.npmjs.com/package/@graphql-mesh/types/v/0.104.3)
    (from `0.104.2`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/utils@0.104.3` ↗︎](https://www.npmjs.com/package/@graphql-mesh/utils/v/0.104.3)
    (from `0.104.2`, in `dependencies`)

- [#2086](https://github.com/Urigo/accounter-fullstack/pull/2086)
  [`5308911`](https://github.com/Urigo/accounter-fullstack/commit/530891185ab33f53299fa7fc8c623104e1b1dc94)
  Thanks [@gilgardosh](https://github.com/gilgardosh)! - dependencies updates:
  - Updated dependency [`graphql@16.11.0` ↗︎](https://www.npmjs.com/package/graphql/v/16.11.0)
    (from `16.10.0`, in `dependencies`)

- [#2186](https://github.com/Urigo/accounter-fullstack/pull/2186)
  [`4797e93`](https://github.com/Urigo/accounter-fullstack/commit/4797e9366fae9393252dfdcf68b862f0991a8761)
  Thanks [@renovate](https://github.com/apps/renovate)! - dependencies updates:
  - Updated dependency
    [`@graphql-mesh/config@0.108.5` ↗︎](https://www.npmjs.com/package/@graphql-mesh/config/v/0.108.5)
    (from `0.108.4`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/http@0.106.4` ↗︎](https://www.npmjs.com/package/@graphql-mesh/http/v/0.106.4)
    (from `0.106.3`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/json-schema@0.109.5` ↗︎](https://www.npmjs.com/package/@graphql-mesh/json-schema/v/0.109.5)
    (from `0.109.4`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/runtime@0.106.4` ↗︎](https://www.npmjs.com/package/@graphql-mesh/runtime/v/0.106.4)
    (from `0.106.3`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/store@0.104.4` ↗︎](https://www.npmjs.com/package/@graphql-mesh/store/v/0.104.4)
    (from `0.104.3`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/types@0.104.4` ↗︎](https://www.npmjs.com/package/@graphql-mesh/types/v/0.104.4)
    (from `0.104.3`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/utils@0.104.4` ↗︎](https://www.npmjs.com/package/@graphql-mesh/utils/v/0.104.4)
    (from `0.104.3`, in `dependencies`)

- [#2218](https://github.com/Urigo/accounter-fullstack/pull/2218)
  [`2325c46`](https://github.com/Urigo/accounter-fullstack/commit/2325c467ab09cd9414f4dcf82a0646847d2dc974)
  Thanks [@renovate](https://github.com/apps/renovate)! - dependencies updates:
  - Updated dependency
    [`@graphql-mesh/config@0.108.6` ↗︎](https://www.npmjs.com/package/@graphql-mesh/config/v/0.108.6)
    (from `0.108.5`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/http@0.106.5` ↗︎](https://www.npmjs.com/package/@graphql-mesh/http/v/0.106.5)
    (from `0.106.4`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/json-schema@0.109.6` ↗︎](https://www.npmjs.com/package/@graphql-mesh/json-schema/v/0.109.6)
    (from `0.109.5`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/runtime@0.106.5` ↗︎](https://www.npmjs.com/package/@graphql-mesh/runtime/v/0.106.5)
    (from `0.106.4`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/store@0.104.5` ↗︎](https://www.npmjs.com/package/@graphql-mesh/store/v/0.104.5)
    (from `0.104.4`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/types@0.104.5` ↗︎](https://www.npmjs.com/package/@graphql-mesh/types/v/0.104.5)
    (from `0.104.4`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/utils@0.104.5` ↗︎](https://www.npmjs.com/package/@graphql-mesh/utils/v/0.104.5)
    (from `0.104.4`, in `dependencies`)

- [#2232](https://github.com/Urigo/accounter-fullstack/pull/2232)
  [`e69a0f8`](https://github.com/Urigo/accounter-fullstack/commit/e69a0f8fd2003bf6b834d3ca0830974110a23c8e)
  Thanks [@renovate](https://github.com/apps/renovate)! - dependencies updates:
  - Updated dependency
    [`@graphql-mesh/config@0.108.7` ↗︎](https://www.npmjs.com/package/@graphql-mesh/config/v/0.108.7)
    (from `0.108.6`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/http@0.106.6` ↗︎](https://www.npmjs.com/package/@graphql-mesh/http/v/0.106.6)
    (from `0.106.5`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/json-schema@0.109.7` ↗︎](https://www.npmjs.com/package/@graphql-mesh/json-schema/v/0.109.7)
    (from `0.109.6`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/runtime@0.106.6` ↗︎](https://www.npmjs.com/package/@graphql-mesh/runtime/v/0.106.6)
    (from `0.106.5`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/store@0.104.6` ↗︎](https://www.npmjs.com/package/@graphql-mesh/store/v/0.104.6)
    (from `0.104.5`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/types@0.104.6` ↗︎](https://www.npmjs.com/package/@graphql-mesh/types/v/0.104.6)
    (from `0.104.5`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/utils@0.104.6` ↗︎](https://www.npmjs.com/package/@graphql-mesh/utils/v/0.104.6)
    (from `0.104.5`, in `dependencies`)

## 0.7.3

### Patch Changes

- [#1510](https://github.com/Urigo/accounter-fullstack/pull/1510)
  [`e5acaa1`](https://github.com/Urigo/accounter-fullstack/commit/e5acaa1fd5e4bc3027d308425a235ba55d93902f)
  Thanks [@renovate](https://github.com/apps/renovate)! - dependencies updates:
  - Updated dependency
    [`@graphql-mesh/config@0.106.13` ↗︎](https://www.npmjs.com/package/@graphql-mesh/config/v/0.106.13)
    (from `0.106.12`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/http@0.105.9` ↗︎](https://www.npmjs.com/package/@graphql-mesh/http/v/0.105.9)
    (from `0.105.8`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/json-schema@0.108.9` ↗︎](https://www.npmjs.com/package/@graphql-mesh/json-schema/v/0.108.9)
    (from `0.108.8`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/runtime@0.105.9` ↗︎](https://www.npmjs.com/package/@graphql-mesh/runtime/v/0.105.9)
    (from `0.105.8`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/store@0.103.9` ↗︎](https://www.npmjs.com/package/@graphql-mesh/store/v/0.103.9)
    (from `0.103.8`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/types@0.103.9` ↗︎](https://www.npmjs.com/package/@graphql-mesh/types/v/0.103.9)
    (from `0.103.8`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/utils@0.103.9` ↗︎](https://www.npmjs.com/package/@graphql-mesh/utils/v/0.103.9)
    (from `0.103.8`, in `dependencies`)

- [#1511](https://github.com/Urigo/accounter-fullstack/pull/1511)
  [`6afccff`](https://github.com/Urigo/accounter-fullstack/commit/6afccfff0e669c7e57ba4b7faea13d5cb6995fec)
  Thanks [@renovate](https://github.com/apps/renovate)! - dependencies updates:
  - Updated dependency
    [`@graphql-mesh/config@0.106.14` ↗︎](https://www.npmjs.com/package/@graphql-mesh/config/v/0.106.14)
    (from `0.106.13`, in `dependencies`)

- [#1551](https://github.com/Urigo/accounter-fullstack/pull/1551)
  [`3edcf26`](https://github.com/Urigo/accounter-fullstack/commit/3edcf268807300fe70dfe5a57f6241677768c496)
  Thanks [@renovate](https://github.com/apps/renovate)! - dependencies updates:
  - Updated dependency
    [`@graphql-mesh/config@0.106.15` ↗︎](https://www.npmjs.com/package/@graphql-mesh/config/v/0.106.15)
    (from `0.106.14`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/http@0.105.10` ↗︎](https://www.npmjs.com/package/@graphql-mesh/http/v/0.105.10)
    (from `0.105.9`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/json-schema@0.108.10` ↗︎](https://www.npmjs.com/package/@graphql-mesh/json-schema/v/0.108.10)
    (from `0.108.9`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/runtime@0.105.10` ↗︎](https://www.npmjs.com/package/@graphql-mesh/runtime/v/0.105.10)
    (from `0.105.9`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/store@0.103.10` ↗︎](https://www.npmjs.com/package/@graphql-mesh/store/v/0.103.10)
    (from `0.103.9`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/types@0.103.10` ↗︎](https://www.npmjs.com/package/@graphql-mesh/types/v/0.103.10)
    (from `0.103.9`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/utils@0.103.10` ↗︎](https://www.npmjs.com/package/@graphql-mesh/utils/v/0.103.10)
    (from `0.103.9`, in `dependencies`)

- [#1552](https://github.com/Urigo/accounter-fullstack/pull/1552)
  [`745dfe6`](https://github.com/Urigo/accounter-fullstack/commit/745dfe6a644ed43c6a2bb02814bb08182edbd465)
  Thanks [@renovate](https://github.com/apps/renovate)! - dependencies updates:
  - Updated dependency
    [`@graphql-mesh/config@0.106.16` ↗︎](https://www.npmjs.com/package/@graphql-mesh/config/v/0.106.16)
    (from `0.106.15`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/http@0.105.11` ↗︎](https://www.npmjs.com/package/@graphql-mesh/http/v/0.105.11)
    (from `0.105.10`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/runtime@0.105.11` ↗︎](https://www.npmjs.com/package/@graphql-mesh/runtime/v/0.105.11)
    (from `0.105.10`, in `dependencies`)

- [#1573](https://github.com/Urigo/accounter-fullstack/pull/1573)
  [`16d7c0a`](https://github.com/Urigo/accounter-fullstack/commit/16d7c0ab3965699cda4e9fa1b32838932d127622)
  Thanks [@renovate](https://github.com/apps/renovate)! - dependencies updates:
  - Updated dependency
    [`@graphql-mesh/config@0.106.17` ↗︎](https://www.npmjs.com/package/@graphql-mesh/config/v/0.106.17)
    (from `0.106.16`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/http@0.105.12` ↗︎](https://www.npmjs.com/package/@graphql-mesh/http/v/0.105.12)
    (from `0.105.11`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/json-schema@0.108.11` ↗︎](https://www.npmjs.com/package/@graphql-mesh/json-schema/v/0.108.11)
    (from `0.108.10`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/runtime@0.105.12` ↗︎](https://www.npmjs.com/package/@graphql-mesh/runtime/v/0.105.12)
    (from `0.105.11`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/store@0.103.11` ↗︎](https://www.npmjs.com/package/@graphql-mesh/store/v/0.103.11)
    (from `0.103.10`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/types@0.103.11` ↗︎](https://www.npmjs.com/package/@graphql-mesh/types/v/0.103.11)
    (from `0.103.10`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/utils@0.103.11` ↗︎](https://www.npmjs.com/package/@graphql-mesh/utils/v/0.103.11)
    (from `0.103.10`, in `dependencies`)

- [#1587](https://github.com/Urigo/accounter-fullstack/pull/1587)
  [`6d56b87`](https://github.com/Urigo/accounter-fullstack/commit/6d56b87180d569a263fc382b1614a0f27145a3ba)
  Thanks [@renovate](https://github.com/apps/renovate)! - dependencies updates:
  - Updated dependency
    [`@graphql-mesh/json-schema@0.108.12` ↗︎](https://www.npmjs.com/package/@graphql-mesh/json-schema/v/0.108.12)
    (from `0.108.11`, in `dependencies`)

- [#1596](https://github.com/Urigo/accounter-fullstack/pull/1596)
  [`c845a24`](https://github.com/Urigo/accounter-fullstack/commit/c845a24450cecedf40b9e32568a5008cd0d63da9)
  Thanks [@gilgardosh](https://github.com/gilgardosh)! - dependencies updates:
  - Updated dependency
    [`@graphql-mesh/json-schema@0.108.13` ↗︎](https://www.npmjs.com/package/@graphql-mesh/json-schema/v/0.108.13)
    (from `0.108.12`, in `dependencies`)

- [#1600](https://github.com/Urigo/accounter-fullstack/pull/1600)
  [`6c9a985`](https://github.com/Urigo/accounter-fullstack/commit/6c9a98525f1423b46f90b66baea71a0c8705df72)
  Thanks [@renovate](https://github.com/apps/renovate)! - dependencies updates:
  - Updated dependency
    [`@graphql-mesh/json-schema@0.108.13` ↗︎](https://www.npmjs.com/package/@graphql-mesh/json-schema/v/0.108.13)
    (from `0.108.12`, in `dependencies`)

- [#1629](https://github.com/Urigo/accounter-fullstack/pull/1629)
  [`424065e`](https://github.com/Urigo/accounter-fullstack/commit/424065ea0311f8293b3b5f00d69b0fc561e47442)
  Thanks [@renovate](https://github.com/apps/renovate)! - dependencies updates:
  - Updated dependency
    [`@graphql-mesh/config@0.106.18` ↗︎](https://www.npmjs.com/package/@graphql-mesh/config/v/0.106.18)
    (from `0.106.17`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/http@0.105.13` ↗︎](https://www.npmjs.com/package/@graphql-mesh/http/v/0.105.13)
    (from `0.105.12`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/json-schema@0.108.14` ↗︎](https://www.npmjs.com/package/@graphql-mesh/json-schema/v/0.108.14)
    (from `0.108.13`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/runtime@0.105.13` ↗︎](https://www.npmjs.com/package/@graphql-mesh/runtime/v/0.105.13)
    (from `0.105.12`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/store@0.103.12` ↗︎](https://www.npmjs.com/package/@graphql-mesh/store/v/0.103.12)
    (from `0.103.11`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/types@0.103.12` ↗︎](https://www.npmjs.com/package/@graphql-mesh/types/v/0.103.12)
    (from `0.103.11`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/utils@0.103.12` ↗︎](https://www.npmjs.com/package/@graphql-mesh/utils/v/0.103.12)
    (from `0.103.11`, in `dependencies`)

- [#1666](https://github.com/Urigo/accounter-fullstack/pull/1666)
  [`53d22fc`](https://github.com/Urigo/accounter-fullstack/commit/53d22fcaf5481a19c026a361931bd4df67d98f8f)
  Thanks [@renovate](https://github.com/apps/renovate)! - dependencies updates:
  - Updated dependency
    [`@graphql-mesh/json-schema@0.108.15` ↗︎](https://www.npmjs.com/package/@graphql-mesh/json-schema/v/0.108.15)
    (from `0.108.14`, in `dependencies`)

- [#1706](https://github.com/Urigo/accounter-fullstack/pull/1706)
  [`eaf31e9`](https://github.com/Urigo/accounter-fullstack/commit/eaf31e9cfe56ac1f2a954dc986148fcb38d1e63b)
  Thanks [@renovate](https://github.com/apps/renovate)! - dependencies updates:
  - Updated dependency
    [`@graphql-mesh/config@0.106.23` ↗︎](https://www.npmjs.com/package/@graphql-mesh/config/v/0.106.23)
    (from `0.106.18`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/cross-helpers@0.4.10` ↗︎](https://www.npmjs.com/package/@graphql-mesh/cross-helpers/v/0.4.10)
    (from `0.4.9`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/http@0.105.18` ↗︎](https://www.npmjs.com/package/@graphql-mesh/http/v/0.105.18)
    (from `0.105.13`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/json-schema@0.108.20` ↗︎](https://www.npmjs.com/package/@graphql-mesh/json-schema/v/0.108.20)
    (from `0.108.15`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/runtime@0.105.18` ↗︎](https://www.npmjs.com/package/@graphql-mesh/runtime/v/0.105.18)
    (from `0.105.13`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/store@0.103.17` ↗︎](https://www.npmjs.com/package/@graphql-mesh/store/v/0.103.17)
    (from `0.103.12`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/types@0.103.17` ↗︎](https://www.npmjs.com/package/@graphql-mesh/types/v/0.103.17)
    (from `0.103.12`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/utils@0.103.17` ↗︎](https://www.npmjs.com/package/@graphql-mesh/utils/v/0.103.17)
    (from `0.103.12`, in `dependencies`)

- [#1757](https://github.com/Urigo/accounter-fullstack/pull/1757)
  [`ddae74a`](https://github.com/Urigo/accounter-fullstack/commit/ddae74ac7f9911fb6b6ad2bdadb934973fcec7a9)
  Thanks [@renovate](https://github.com/apps/renovate)! - dependencies updates:
  - Updated dependency
    [`@graphql-mesh/config@0.106.24` ↗︎](https://www.npmjs.com/package/@graphql-mesh/config/v/0.106.24)
    (from `0.106.23`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/http@0.105.19` ↗︎](https://www.npmjs.com/package/@graphql-mesh/http/v/0.105.19)
    (from `0.105.18`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/runtime@0.105.19` ↗︎](https://www.npmjs.com/package/@graphql-mesh/runtime/v/0.105.19)
    (from `0.105.18`, in `dependencies`)

- [#1778](https://github.com/Urigo/accounter-fullstack/pull/1778)
  [`8c48509`](https://github.com/Urigo/accounter-fullstack/commit/8c48509db682ef4f928966abd98c2e01f0ce14c9)
  Thanks [@renovate](https://github.com/apps/renovate)! - dependencies updates:
  - Updated dependency
    [`@graphql-mesh/config@0.106.25` ↗︎](https://www.npmjs.com/package/@graphql-mesh/config/v/0.106.25)
    (from `0.106.24`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/http@0.105.20` ↗︎](https://www.npmjs.com/package/@graphql-mesh/http/v/0.105.20)
    (from `0.105.19`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/json-schema@0.108.21` ↗︎](https://www.npmjs.com/package/@graphql-mesh/json-schema/v/0.108.21)
    (from `0.108.20`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/runtime@0.105.20` ↗︎](https://www.npmjs.com/package/@graphql-mesh/runtime/v/0.105.20)
    (from `0.105.19`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/store@0.103.18` ↗︎](https://www.npmjs.com/package/@graphql-mesh/store/v/0.103.18)
    (from `0.103.17`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/types@0.103.18` ↗︎](https://www.npmjs.com/package/@graphql-mesh/types/v/0.103.18)
    (from `0.103.17`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/utils@0.103.18` ↗︎](https://www.npmjs.com/package/@graphql-mesh/utils/v/0.103.18)
    (from `0.103.17`, in `dependencies`)

- [#1786](https://github.com/Urigo/accounter-fullstack/pull/1786)
  [`59c0b6c`](https://github.com/Urigo/accounter-fullstack/commit/59c0b6cc3dd29921af7de0f601c791bbdb630148)
  Thanks [@renovate](https://github.com/apps/renovate)! - dependencies updates:
  - Updated dependency
    [`@graphql-mesh/http@0.105.21` ↗︎](https://www.npmjs.com/package/@graphql-mesh/http/v/0.105.21)
    (from `0.105.20`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/json-schema@0.108.22` ↗︎](https://www.npmjs.com/package/@graphql-mesh/json-schema/v/0.108.22)
    (from `0.108.21`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/runtime@0.105.21` ↗︎](https://www.npmjs.com/package/@graphql-mesh/runtime/v/0.105.21)
    (from `0.105.20`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/store@0.103.19` ↗︎](https://www.npmjs.com/package/@graphql-mesh/store/v/0.103.19)
    (from `0.103.18`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/types@0.103.19` ↗︎](https://www.npmjs.com/package/@graphql-mesh/types/v/0.103.19)
    (from `0.103.18`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/utils@0.103.19` ↗︎](https://www.npmjs.com/package/@graphql-mesh/utils/v/0.103.19)
    (from `0.103.18`, in `dependencies`)

- [#1787](https://github.com/Urigo/accounter-fullstack/pull/1787)
  [`564e868`](https://github.com/Urigo/accounter-fullstack/commit/564e868011f732d63cc725dc55014940eda99a24)
  Thanks [@renovate](https://github.com/apps/renovate)! - dependencies updates:
  - Updated dependency
    [`@graphql-mesh/config@0.107.0` ↗︎](https://www.npmjs.com/package/@graphql-mesh/config/v/0.107.0)
    (from `0.106.25`, in `dependencies`)

- [#1790](https://github.com/Urigo/accounter-fullstack/pull/1790)
  [`56a0d24`](https://github.com/Urigo/accounter-fullstack/commit/56a0d243c46ec3bf22f31c5b2ef8276e4a79ced5)
  Thanks [@gilgardosh](https://github.com/gilgardosh)! - dependencies updates:
  - Updated dependency
    [`@graphql-mesh/config@0.107.0` ↗︎](https://www.npmjs.com/package/@graphql-mesh/config/v/0.107.0)
    (from `0.106.25`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/http@0.105.21` ↗︎](https://www.npmjs.com/package/@graphql-mesh/http/v/0.105.21)
    (from `0.105.20`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/json-schema@0.108.22` ↗︎](https://www.npmjs.com/package/@graphql-mesh/json-schema/v/0.108.22)
    (from `0.108.21`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/runtime@0.105.21` ↗︎](https://www.npmjs.com/package/@graphql-mesh/runtime/v/0.105.21)
    (from `0.105.20`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/store@0.103.19` ↗︎](https://www.npmjs.com/package/@graphql-mesh/store/v/0.103.19)
    (from `0.103.18`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/types@0.103.19` ↗︎](https://www.npmjs.com/package/@graphql-mesh/types/v/0.103.19)
    (from `0.103.18`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/utils@0.103.19` ↗︎](https://www.npmjs.com/package/@graphql-mesh/utils/v/0.103.19)
    (from `0.103.18`, in `dependencies`)

- [#1792](https://github.com/Urigo/accounter-fullstack/pull/1792)
  [`3119fcb`](https://github.com/Urigo/accounter-fullstack/commit/3119fcbbf5a10dc80574224af1cfe037e2149c1b)
  Thanks [@gilgardosh](https://github.com/gilgardosh)! - dependencies updates:
  - Updated dependency
    [`@graphql-mesh/config@0.107.0` ↗︎](https://www.npmjs.com/package/@graphql-mesh/config/v/0.107.0)
    (from `0.106.25`, in `dependencies`)

- [#1810](https://github.com/Urigo/accounter-fullstack/pull/1810)
  [`79ef4e2`](https://github.com/Urigo/accounter-fullstack/commit/79ef4e2e2401562732be3eabf73571889bd7cd0f)
  Thanks [@renovate](https://github.com/apps/renovate)! - dependencies updates:
  - Updated dependency
    [`@graphql-mesh/config@0.107.2` ↗︎](https://www.npmjs.com/package/@graphql-mesh/config/v/0.107.2)
    (from `0.107.0`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/http@0.105.23` ↗︎](https://www.npmjs.com/package/@graphql-mesh/http/v/0.105.23)
    (from `0.105.21`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/json-schema@0.108.24` ↗︎](https://www.npmjs.com/package/@graphql-mesh/json-schema/v/0.108.24)
    (from `0.108.22`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/runtime@0.105.23` ↗︎](https://www.npmjs.com/package/@graphql-mesh/runtime/v/0.105.23)
    (from `0.105.21`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/store@0.103.21` ↗︎](https://www.npmjs.com/package/@graphql-mesh/store/v/0.103.21)
    (from `0.103.19`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/types@0.103.21` ↗︎](https://www.npmjs.com/package/@graphql-mesh/types/v/0.103.21)
    (from `0.103.19`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/utils@0.103.21` ↗︎](https://www.npmjs.com/package/@graphql-mesh/utils/v/0.103.21)
    (from `0.103.19`, in `dependencies`)

- [#1859](https://github.com/Urigo/accounter-fullstack/pull/1859)
  [`5a66a5b`](https://github.com/Urigo/accounter-fullstack/commit/5a66a5b9b93dac30b1dc46321dfd44794a651468)
  Thanks [@renovate](https://github.com/apps/renovate)! - dependencies updates:
  - Updated dependency
    [`@graphql-mesh/config@0.108.0` ↗︎](https://www.npmjs.com/package/@graphql-mesh/config/v/0.108.0)
    (from `0.107.2`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/http@0.106.0` ↗︎](https://www.npmjs.com/package/@graphql-mesh/http/v/0.106.0)
    (from `0.105.23`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/json-schema@0.109.0` ↗︎](https://www.npmjs.com/package/@graphql-mesh/json-schema/v/0.109.0)
    (from `0.108.24`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/runtime@0.106.0` ↗︎](https://www.npmjs.com/package/@graphql-mesh/runtime/v/0.106.0)
    (from `0.105.23`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/store@0.104.0` ↗︎](https://www.npmjs.com/package/@graphql-mesh/store/v/0.104.0)
    (from `0.103.21`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/types@0.104.0` ↗︎](https://www.npmjs.com/package/@graphql-mesh/types/v/0.104.0)
    (from `0.103.21`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/utils@0.104.0` ↗︎](https://www.npmjs.com/package/@graphql-mesh/utils/v/0.104.0)
    (from `0.103.21`, in `dependencies`)

- [#1871](https://github.com/Urigo/accounter-fullstack/pull/1871)
  [`fb3fc0a`](https://github.com/Urigo/accounter-fullstack/commit/fb3fc0a1b409c088561d1aa4197221c5559f5763)
  Thanks [@renovate](https://github.com/apps/renovate)! - dependencies updates:
  - Updated dependency
    [`@graphql-mesh/config@0.108.1` ↗︎](https://www.npmjs.com/package/@graphql-mesh/config/v/0.108.1)
    (from `0.108.0`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/http@0.106.1` ↗︎](https://www.npmjs.com/package/@graphql-mesh/http/v/0.106.1)
    (from `0.106.0`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/json-schema@0.109.2` ↗︎](https://www.npmjs.com/package/@graphql-mesh/json-schema/v/0.109.2)
    (from `0.109.0`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/runtime@0.106.1` ↗︎](https://www.npmjs.com/package/@graphql-mesh/runtime/v/0.106.1)
    (from `0.106.0`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/store@0.104.1` ↗︎](https://www.npmjs.com/package/@graphql-mesh/store/v/0.104.1)
    (from `0.104.0`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/types@0.104.1` ↗︎](https://www.npmjs.com/package/@graphql-mesh/types/v/0.104.1)
    (from `0.104.0`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/utils@0.104.1` ↗︎](https://www.npmjs.com/package/@graphql-mesh/utils/v/0.104.1)
    (from `0.104.0`, in `dependencies`)

- [#1966](https://github.com/Urigo/accounter-fullstack/pull/1966)
  [`7c6679c`](https://github.com/Urigo/accounter-fullstack/commit/7c6679cd5843722a90abce00b1590dfa701a2689)
  Thanks [@renovate](https://github.com/apps/renovate)! - dependencies updates:
  - Updated dependency
    [`@graphql-mesh/config@0.108.2` ↗︎](https://www.npmjs.com/package/@graphql-mesh/config/v/0.108.2)
    (from `0.108.1`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/http@0.106.2` ↗︎](https://www.npmjs.com/package/@graphql-mesh/http/v/0.106.2)
    (from `0.106.1`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/json-schema@0.109.3` ↗︎](https://www.npmjs.com/package/@graphql-mesh/json-schema/v/0.109.3)
    (from `0.109.2`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/runtime@0.106.2` ↗︎](https://www.npmjs.com/package/@graphql-mesh/runtime/v/0.106.2)
    (from `0.106.1`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/store@0.104.2` ↗︎](https://www.npmjs.com/package/@graphql-mesh/store/v/0.104.2)
    (from `0.104.1`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/types@0.104.2` ↗︎](https://www.npmjs.com/package/@graphql-mesh/types/v/0.104.2)
    (from `0.104.1`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/utils@0.104.2` ↗︎](https://www.npmjs.com/package/@graphql-mesh/utils/v/0.104.2)
    (from `0.104.1`, in `dependencies`)

## 0.7.2

### Patch Changes

- [#1261](https://github.com/Urigo/accounter-fullstack/pull/1261)
  [`f5ae7a3`](https://github.com/Urigo/accounter-fullstack/commit/f5ae7a346d7309a7d24a04641c667de0a483aff4)
  Thanks [@renovate](https://github.com/apps/renovate)! - dependencies updates:
  - Updated dependency
    [`@graphql-mesh/config@0.104.7` ↗︎](https://www.npmjs.com/package/@graphql-mesh/config/v/0.104.7)
    (from `0.104.6`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/http@0.103.7` ↗︎](https://www.npmjs.com/package/@graphql-mesh/http/v/0.103.7)
    (from `0.103.6`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/json-schema@0.106.8` ↗︎](https://www.npmjs.com/package/@graphql-mesh/json-schema/v/0.106.8)
    (from `0.106.7`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/runtime@0.103.7` ↗︎](https://www.npmjs.com/package/@graphql-mesh/runtime/v/0.103.7)
    (from `0.103.6`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/store@0.102.6` ↗︎](https://www.npmjs.com/package/@graphql-mesh/store/v/0.102.6)
    (from `0.102.5`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/types@0.102.6` ↗︎](https://www.npmjs.com/package/@graphql-mesh/types/v/0.102.6)
    (from `0.102.5`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/utils@0.102.6` ↗︎](https://www.npmjs.com/package/@graphql-mesh/utils/v/0.102.6)
    (from `0.102.5`, in `dependencies`)

- [#1265](https://github.com/Urigo/accounter-fullstack/pull/1265)
  [`147de78`](https://github.com/Urigo/accounter-fullstack/commit/147de78aead9f79589c6c7a2fae5e84be6b6c545)
  Thanks [@renovate](https://github.com/apps/renovate)! - dependencies updates:
  - Updated dependency
    [`@graphql-mesh/json-schema@0.107.0` ↗︎](https://www.npmjs.com/package/@graphql-mesh/json-schema/v/0.107.0)
    (from `0.106.8`, in `dependencies`)

- [#1279](https://github.com/Urigo/accounter-fullstack/pull/1279)
  [`a324408`](https://github.com/Urigo/accounter-fullstack/commit/a324408adc12d5dfbc76dc65765886811d56823b)
  Thanks [@renovate](https://github.com/apps/renovate)! - dependencies updates:
  - Updated dependency
    [`@graphql-mesh/config@0.104.8` ↗︎](https://www.npmjs.com/package/@graphql-mesh/config/v/0.104.8)
    (from `0.104.7`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/cross-helpers@0.4.7` ↗︎](https://www.npmjs.com/package/@graphql-mesh/cross-helpers/v/0.4.7)
    (from `0.4.6`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/http@0.103.8` ↗︎](https://www.npmjs.com/package/@graphql-mesh/http/v/0.103.8)
    (from `0.103.7`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/json-schema@0.107.1` ↗︎](https://www.npmjs.com/package/@graphql-mesh/json-schema/v/0.107.1)
    (from `0.107.0`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/runtime@0.103.8` ↗︎](https://www.npmjs.com/package/@graphql-mesh/runtime/v/0.103.8)
    (from `0.103.7`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/store@0.102.7` ↗︎](https://www.npmjs.com/package/@graphql-mesh/store/v/0.102.7)
    (from `0.102.6`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/types@0.102.7` ↗︎](https://www.npmjs.com/package/@graphql-mesh/types/v/0.102.7)
    (from `0.102.6`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/utils@0.102.7` ↗︎](https://www.npmjs.com/package/@graphql-mesh/utils/v/0.102.7)
    (from `0.102.6`, in `dependencies`)

- [#1292](https://github.com/Urigo/accounter-fullstack/pull/1292)
  [`f454038`](https://github.com/Urigo/accounter-fullstack/commit/f45403846f1c394cc26001534961421544fc609a)
  Thanks [@renovate](https://github.com/apps/renovate)! - dependencies updates:
  - Updated dependency
    [`@graphql-mesh/config@0.104.11` ↗︎](https://www.npmjs.com/package/@graphql-mesh/config/v/0.104.11)
    (from `0.104.8`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/http@0.103.11` ↗︎](https://www.npmjs.com/package/@graphql-mesh/http/v/0.103.11)
    (from `0.103.8`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/json-schema@0.107.4` ↗︎](https://www.npmjs.com/package/@graphql-mesh/json-schema/v/0.107.4)
    (from `0.107.1`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/runtime@0.103.11` ↗︎](https://www.npmjs.com/package/@graphql-mesh/runtime/v/0.103.11)
    (from `0.103.8`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/store@0.102.10` ↗︎](https://www.npmjs.com/package/@graphql-mesh/store/v/0.102.10)
    (from `0.102.7`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/types@0.102.10` ↗︎](https://www.npmjs.com/package/@graphql-mesh/types/v/0.102.10)
    (from `0.102.7`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/utils@0.102.10` ↗︎](https://www.npmjs.com/package/@graphql-mesh/utils/v/0.102.10)
    (from `0.102.7`, in `dependencies`)

- [#1311](https://github.com/Urigo/accounter-fullstack/pull/1311)
  [`09a3624`](https://github.com/Urigo/accounter-fullstack/commit/09a36248c62bd7949cc41a00222e1d3f8cc31b1e)
  Thanks [@renovate](https://github.com/apps/renovate)! - dependencies updates:
  - Updated dependency
    [`@graphql-mesh/config@0.104.12` ↗︎](https://www.npmjs.com/package/@graphql-mesh/config/v/0.104.12)
    (from `0.104.11`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/http@0.103.12` ↗︎](https://www.npmjs.com/package/@graphql-mesh/http/v/0.103.12)
    (from `0.103.11`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/json-schema@0.107.5` ↗︎](https://www.npmjs.com/package/@graphql-mesh/json-schema/v/0.107.5)
    (from `0.107.4`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/runtime@0.103.12` ↗︎](https://www.npmjs.com/package/@graphql-mesh/runtime/v/0.103.12)
    (from `0.103.11`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/store@0.102.11` ↗︎](https://www.npmjs.com/package/@graphql-mesh/store/v/0.102.11)
    (from `0.102.10`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/types@0.102.11` ↗︎](https://www.npmjs.com/package/@graphql-mesh/types/v/0.102.11)
    (from `0.102.10`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/utils@0.102.11` ↗︎](https://www.npmjs.com/package/@graphql-mesh/utils/v/0.102.11)
    (from `0.102.10`, in `dependencies`)

- [#1326](https://github.com/Urigo/accounter-fullstack/pull/1326)
  [`aec397d`](https://github.com/Urigo/accounter-fullstack/commit/aec397d307d403223226546e2f54dfd6cef2afb5)
  Thanks [@renovate](https://github.com/apps/renovate)! - dependencies updates:
  - Updated dependency
    [`@graphql-mesh/config@0.105.0` ↗︎](https://www.npmjs.com/package/@graphql-mesh/config/v/0.105.0)
    (from `0.104.12`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/http@0.104.0` ↗︎](https://www.npmjs.com/package/@graphql-mesh/http/v/0.104.0)
    (from `0.103.12`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/runtime@0.104.0` ↗︎](https://www.npmjs.com/package/@graphql-mesh/runtime/v/0.104.0)
    (from `0.103.12`, in `dependencies`)

- [#1340](https://github.com/Urigo/accounter-fullstack/pull/1340)
  [`840ea17`](https://github.com/Urigo/accounter-fullstack/commit/840ea175933014f51453b9c18cf965feeed9160f)
  Thanks [@renovate](https://github.com/apps/renovate)! - dependencies updates:
  - Updated dependency
    [`@graphql-mesh/config@0.105.1` ↗︎](https://www.npmjs.com/package/@graphql-mesh/config/v/0.105.1)
    (from `0.105.0`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/http@0.104.1` ↗︎](https://www.npmjs.com/package/@graphql-mesh/http/v/0.104.1)
    (from `0.104.0`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/json-schema@0.107.6` ↗︎](https://www.npmjs.com/package/@graphql-mesh/json-schema/v/0.107.6)
    (from `0.107.5`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/runtime@0.104.1` ↗︎](https://www.npmjs.com/package/@graphql-mesh/runtime/v/0.104.1)
    (from `0.104.0`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/store@0.102.12` ↗︎](https://www.npmjs.com/package/@graphql-mesh/store/v/0.102.12)
    (from `0.102.11`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/types@0.102.12` ↗︎](https://www.npmjs.com/package/@graphql-mesh/types/v/0.102.12)
    (from `0.102.11`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/utils@0.102.12` ↗︎](https://www.npmjs.com/package/@graphql-mesh/utils/v/0.102.12)
    (from `0.102.11`, in `dependencies`)

- [#1379](https://github.com/Urigo/accounter-fullstack/pull/1379)
  [`4689ab0`](https://github.com/Urigo/accounter-fullstack/commit/4689ab0fae6cf9e009e8aff74aa46c069cfc2a7b)
  Thanks [@renovate](https://github.com/apps/renovate)! - dependencies updates:
  - Updated dependency
    [`@graphql-mesh/config@0.105.2` ↗︎](https://www.npmjs.com/package/@graphql-mesh/config/v/0.105.2)
    (from `0.105.1`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/http@0.104.2` ↗︎](https://www.npmjs.com/package/@graphql-mesh/http/v/0.104.2)
    (from `0.104.1`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/json-schema@0.107.7` ↗︎](https://www.npmjs.com/package/@graphql-mesh/json-schema/v/0.107.7)
    (from `0.107.6`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/runtime@0.104.2` ↗︎](https://www.npmjs.com/package/@graphql-mesh/runtime/v/0.104.2)
    (from `0.104.1`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/store@0.102.13` ↗︎](https://www.npmjs.com/package/@graphql-mesh/store/v/0.102.13)
    (from `0.102.12`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/types@0.102.13` ↗︎](https://www.npmjs.com/package/@graphql-mesh/types/v/0.102.13)
    (from `0.102.12`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/utils@0.102.13` ↗︎](https://www.npmjs.com/package/@graphql-mesh/utils/v/0.102.13)
    (from `0.102.12`, in `dependencies`)

- [#1382](https://github.com/Urigo/accounter-fullstack/pull/1382)
  [`1061c1d`](https://github.com/Urigo/accounter-fullstack/commit/1061c1dc5b38962a009857c4d328b08e1311e4db)
  Thanks [@gilgardosh](https://github.com/gilgardosh)! - dependencies updates:
  - Updated dependency
    [`@graphql-mesh/config@0.105.2` ↗︎](https://www.npmjs.com/package/@graphql-mesh/config/v/0.105.2)
    (from `0.105.1`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/http@0.104.2` ↗︎](https://www.npmjs.com/package/@graphql-mesh/http/v/0.104.2)
    (from `0.104.1`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/json-schema@0.107.7` ↗︎](https://www.npmjs.com/package/@graphql-mesh/json-schema/v/0.107.7)
    (from `0.107.6`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/runtime@0.104.2` ↗︎](https://www.npmjs.com/package/@graphql-mesh/runtime/v/0.104.2)
    (from `0.104.1`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/store@0.102.13` ↗︎](https://www.npmjs.com/package/@graphql-mesh/store/v/0.102.13)
    (from `0.102.12`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/types@0.102.13` ↗︎](https://www.npmjs.com/package/@graphql-mesh/types/v/0.102.13)
    (from `0.102.12`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/utils@0.102.13` ↗︎](https://www.npmjs.com/package/@graphql-mesh/utils/v/0.102.13)
    (from `0.102.12`, in `dependencies`)

- [#1390](https://github.com/Urigo/accounter-fullstack/pull/1390)
  [`a2cd4f4`](https://github.com/Urigo/accounter-fullstack/commit/a2cd4f4925e99932a085abbe99b57f0848d31c44)
  Thanks [@renovate](https://github.com/apps/renovate)! - dependencies updates:
  - Updated dependency
    [`@graphql-mesh/json-schema@0.107.8` ↗︎](https://www.npmjs.com/package/@graphql-mesh/json-schema/v/0.107.8)
    (from `0.107.7`, in `dependencies`)

- [#1395](https://github.com/Urigo/accounter-fullstack/pull/1395)
  [`1cfc0c9`](https://github.com/Urigo/accounter-fullstack/commit/1cfc0c948c77efda00b5fd1f568215574b8015a5)
  Thanks [@renovate](https://github.com/apps/renovate)! - dependencies updates:
  - Updated dependency
    [`@graphql-mesh/config@0.106.1` ↗︎](https://www.npmjs.com/package/@graphql-mesh/config/v/0.106.1)
    (from `0.105.2`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/http@0.105.1` ↗︎](https://www.npmjs.com/package/@graphql-mesh/http/v/0.105.1)
    (from `0.104.2`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/json-schema@0.108.1` ↗︎](https://www.npmjs.com/package/@graphql-mesh/json-schema/v/0.108.1)
    (from `0.107.8`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/runtime@0.105.1` ↗︎](https://www.npmjs.com/package/@graphql-mesh/runtime/v/0.105.1)
    (from `0.104.2`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/store@0.103.1` ↗︎](https://www.npmjs.com/package/@graphql-mesh/store/v/0.103.1)
    (from `0.102.13`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/types@0.103.1` ↗︎](https://www.npmjs.com/package/@graphql-mesh/types/v/0.103.1)
    (from `0.102.13`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/utils@0.103.1` ↗︎](https://www.npmjs.com/package/@graphql-mesh/utils/v/0.103.1)
    (from `0.102.13`, in `dependencies`)

- [#1400](https://github.com/Urigo/accounter-fullstack/pull/1400)
  [`8b29bd1`](https://github.com/Urigo/accounter-fullstack/commit/8b29bd14c51422bf17ac488bd0296c4d239d1b76)
  Thanks [@renovate](https://github.com/apps/renovate)! - dependencies updates:
  - Updated dependency
    [`@graphql-mesh/cross-helpers@0.4.8` ↗︎](https://www.npmjs.com/package/@graphql-mesh/cross-helpers/v/0.4.8)
    (from `0.4.7`, in `dependencies`)

- [#1410](https://github.com/Urigo/accounter-fullstack/pull/1410)
  [`a230f9b`](https://github.com/Urigo/accounter-fullstack/commit/a230f9bd6ccf545fdd031b123514cedef04b1d2a)
  Thanks [@renovate](https://github.com/apps/renovate)! - dependencies updates:
  - Updated dependency
    [`@graphql-mesh/config@0.106.4` ↗︎](https://www.npmjs.com/package/@graphql-mesh/config/v/0.106.4)
    (from `0.106.1`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/http@0.105.4` ↗︎](https://www.npmjs.com/package/@graphql-mesh/http/v/0.105.4)
    (from `0.105.1`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/json-schema@0.108.4` ↗︎](https://www.npmjs.com/package/@graphql-mesh/json-schema/v/0.108.4)
    (from `0.108.1`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/runtime@0.105.4` ↗︎](https://www.npmjs.com/package/@graphql-mesh/runtime/v/0.105.4)
    (from `0.105.1`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/store@0.103.4` ↗︎](https://www.npmjs.com/package/@graphql-mesh/store/v/0.103.4)
    (from `0.103.1`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/types@0.103.4` ↗︎](https://www.npmjs.com/package/@graphql-mesh/types/v/0.103.4)
    (from `0.103.1`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/utils@0.103.4` ↗︎](https://www.npmjs.com/package/@graphql-mesh/utils/v/0.103.4)
    (from `0.103.1`, in `dependencies`)

- [#1435](https://github.com/Urigo/accounter-fullstack/pull/1435)
  [`de23ce0`](https://github.com/Urigo/accounter-fullstack/commit/de23ce015297c2b1dba17f7ad6159a54fab1bd60)
  Thanks [@renovate](https://github.com/apps/renovate)! - dependencies updates:
  - Updated dependency
    [`@graphql-mesh/config@0.106.5` ↗︎](https://www.npmjs.com/package/@graphql-mesh/config/v/0.106.5)
    (from `0.106.4`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/http@0.105.5` ↗︎](https://www.npmjs.com/package/@graphql-mesh/http/v/0.105.5)
    (from `0.105.4`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/json-schema@0.108.5` ↗︎](https://www.npmjs.com/package/@graphql-mesh/json-schema/v/0.108.5)
    (from `0.108.4`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/runtime@0.105.5` ↗︎](https://www.npmjs.com/package/@graphql-mesh/runtime/v/0.105.5)
    (from `0.105.4`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/store@0.103.5` ↗︎](https://www.npmjs.com/package/@graphql-mesh/store/v/0.103.5)
    (from `0.103.4`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/types@0.103.5` ↗︎](https://www.npmjs.com/package/@graphql-mesh/types/v/0.103.5)
    (from `0.103.4`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/utils@0.103.5` ↗︎](https://www.npmjs.com/package/@graphql-mesh/utils/v/0.103.5)
    (from `0.103.4`, in `dependencies`)

- [#1450](https://github.com/Urigo/accounter-fullstack/pull/1450)
  [`307c69a`](https://github.com/Urigo/accounter-fullstack/commit/307c69a44df87e1b85272e11de2245927d0a5153)
  Thanks [@renovate](https://github.com/apps/renovate)! - dependencies updates:
  - Updated dependency
    [`@graphql-mesh/config@0.106.6` ↗︎](https://www.npmjs.com/package/@graphql-mesh/config/v/0.106.6)
    (from `0.106.5`, in `dependencies`)

- [#1455](https://github.com/Urigo/accounter-fullstack/pull/1455)
  [`58cb7ee`](https://github.com/Urigo/accounter-fullstack/commit/58cb7ee7689772081ebf23771399fecbbf4c9983)
  Thanks [@renovate](https://github.com/apps/renovate)! - dependencies updates:
  - Updated dependency
    [`@graphql-mesh/config@0.106.7` ↗︎](https://www.npmjs.com/package/@graphql-mesh/config/v/0.106.7)
    (from `0.106.6`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/cross-helpers@0.4.9` ↗︎](https://www.npmjs.com/package/@graphql-mesh/cross-helpers/v/0.4.9)
    (from `0.4.8`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/http@0.105.6` ↗︎](https://www.npmjs.com/package/@graphql-mesh/http/v/0.105.6)
    (from `0.105.5`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/json-schema@0.108.6` ↗︎](https://www.npmjs.com/package/@graphql-mesh/json-schema/v/0.108.6)
    (from `0.108.5`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/runtime@0.105.6` ↗︎](https://www.npmjs.com/package/@graphql-mesh/runtime/v/0.105.6)
    (from `0.105.5`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/store@0.103.6` ↗︎](https://www.npmjs.com/package/@graphql-mesh/store/v/0.103.6)
    (from `0.103.5`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/types@0.103.6` ↗︎](https://www.npmjs.com/package/@graphql-mesh/types/v/0.103.6)
    (from `0.103.5`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/utils@0.103.6` ↗︎](https://www.npmjs.com/package/@graphql-mesh/utils/v/0.103.6)
    (from `0.103.5`, in `dependencies`)

- [#1457](https://github.com/Urigo/accounter-fullstack/pull/1457)
  [`dd5facb`](https://github.com/Urigo/accounter-fullstack/commit/dd5facb1ed9186d062479b25998bfe7855f6ca1c)
  Thanks [@gilgardosh](https://github.com/gilgardosh)! - dependencies updates:
  - Updated dependency
    [`@graphql-mesh/config@0.106.7` ↗︎](https://www.npmjs.com/package/@graphql-mesh/config/v/0.106.7)
    (from `0.106.6`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/cross-helpers@0.4.9` ↗︎](https://www.npmjs.com/package/@graphql-mesh/cross-helpers/v/0.4.9)
    (from `0.4.8`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/http@0.105.6` ↗︎](https://www.npmjs.com/package/@graphql-mesh/http/v/0.105.6)
    (from `0.105.5`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/json-schema@0.108.6` ↗︎](https://www.npmjs.com/package/@graphql-mesh/json-schema/v/0.108.6)
    (from `0.108.5`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/runtime@0.105.6` ↗︎](https://www.npmjs.com/package/@graphql-mesh/runtime/v/0.105.6)
    (from `0.105.5`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/store@0.103.6` ↗︎](https://www.npmjs.com/package/@graphql-mesh/store/v/0.103.6)
    (from `0.103.5`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/types@0.103.6` ↗︎](https://www.npmjs.com/package/@graphql-mesh/types/v/0.103.6)
    (from `0.103.5`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/utils@0.103.6` ↗︎](https://www.npmjs.com/package/@graphql-mesh/utils/v/0.103.6)
    (from `0.103.5`, in `dependencies`)

- [#1481](https://github.com/Urigo/accounter-fullstack/pull/1481)
  [`29ec26d`](https://github.com/Urigo/accounter-fullstack/commit/29ec26dc57abed99c7cab24f85e96909a4921aba)
  Thanks [@renovate](https://github.com/apps/renovate)! - dependencies updates:
  - Updated dependency
    [`@graphql-mesh/config@0.106.8` ↗︎](https://www.npmjs.com/package/@graphql-mesh/config/v/0.106.8)
    (from `0.106.7`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/http@0.105.7` ↗︎](https://www.npmjs.com/package/@graphql-mesh/http/v/0.105.7)
    (from `0.105.6`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/json-schema@0.108.7` ↗︎](https://www.npmjs.com/package/@graphql-mesh/json-schema/v/0.108.7)
    (from `0.108.6`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/runtime@0.105.7` ↗︎](https://www.npmjs.com/package/@graphql-mesh/runtime/v/0.105.7)
    (from `0.105.6`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/store@0.103.7` ↗︎](https://www.npmjs.com/package/@graphql-mesh/store/v/0.103.7)
    (from `0.103.6`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/types@0.103.7` ↗︎](https://www.npmjs.com/package/@graphql-mesh/types/v/0.103.7)
    (from `0.103.6`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/utils@0.103.7` ↗︎](https://www.npmjs.com/package/@graphql-mesh/utils/v/0.103.7)
    (from `0.103.6`, in `dependencies`)

- [#1484](https://github.com/Urigo/accounter-fullstack/pull/1484)
  [`50ea0a2`](https://github.com/Urigo/accounter-fullstack/commit/50ea0a2366a7b8f21cf5b6c26d8120dbaf067c10)
  Thanks [@renovate](https://github.com/apps/renovate)! - dependencies updates:
  - Updated dependency
    [`@graphql-mesh/config@0.106.9` ↗︎](https://www.npmjs.com/package/@graphql-mesh/config/v/0.106.9)
    (from `0.106.8`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/http@0.105.8` ↗︎](https://www.npmjs.com/package/@graphql-mesh/http/v/0.105.8)
    (from `0.105.7`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/json-schema@0.108.8` ↗︎](https://www.npmjs.com/package/@graphql-mesh/json-schema/v/0.108.8)
    (from `0.108.7`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/runtime@0.105.8` ↗︎](https://www.npmjs.com/package/@graphql-mesh/runtime/v/0.105.8)
    (from `0.105.7`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/store@0.103.8` ↗︎](https://www.npmjs.com/package/@graphql-mesh/store/v/0.103.8)
    (from `0.103.7`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/types@0.103.8` ↗︎](https://www.npmjs.com/package/@graphql-mesh/types/v/0.103.8)
    (from `0.103.7`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/utils@0.103.8` ↗︎](https://www.npmjs.com/package/@graphql-mesh/utils/v/0.103.8)
    (from `0.103.7`, in `dependencies`)

- [#1488](https://github.com/Urigo/accounter-fullstack/pull/1488)
  [`6581954`](https://github.com/Urigo/accounter-fullstack/commit/6581954f05f7d216c24d7fb13772d2941ca241a4)
  Thanks [@renovate](https://github.com/apps/renovate)! - dependencies updates:
  - Updated dependency
    [`@graphql-mesh/config@0.106.10` ↗︎](https://www.npmjs.com/package/@graphql-mesh/config/v/0.106.10)
    (from `0.106.9`, in `dependencies`)

- [#1494](https://github.com/Urigo/accounter-fullstack/pull/1494)
  [`2e3417e`](https://github.com/Urigo/accounter-fullstack/commit/2e3417e60af5372f8b30ba4a2d1265aaa2864332)
  Thanks [@renovate](https://github.com/apps/renovate)! - dependencies updates:
  - Updated dependency
    [`@graphql-mesh/config@0.106.12` ↗︎](https://www.npmjs.com/package/@graphql-mesh/config/v/0.106.12)
    (from `0.106.10`, in `dependencies`)

- [#1496](https://github.com/Urigo/accounter-fullstack/pull/1496)
  [`36f1255`](https://github.com/Urigo/accounter-fullstack/commit/36f12555e4f68484f247e1677dd794b2dc2fcb59)
  Thanks [@renovate](https://github.com/apps/renovate)! - dependencies updates:
  - Updated dependency [`graphql@16.10.0` ↗︎](https://www.npmjs.com/package/graphql/v/16.10.0)
    (from `16.9.0`, in `dependencies`)

## 0.7.1

### Patch Changes

- [#1085](https://github.com/Urigo/accounter-fullstack/pull/1085)
  [`32489f3`](https://github.com/Urigo/accounter-fullstack/commit/32489f38a9bbca43b1e128f0643e3b16949a199f)
  Thanks [@renovate](https://github.com/apps/renovate)! - dependencies updates:
  - Updated dependency
    [`@graphql-mesh/http@0.102.1` ↗︎](https://www.npmjs.com/package/@graphql-mesh/http/v/0.102.1)
    (from `0.102.0`, in `dependencies`)

- [#1093](https://github.com/Urigo/accounter-fullstack/pull/1093)
  [`a5d144a`](https://github.com/Urigo/accounter-fullstack/commit/a5d144aa5ecf63491677a13568727ce49ced5b1a)
  Thanks [@renovate](https://github.com/apps/renovate)! - dependencies updates:
  - Updated dependency
    [`@graphql-mesh/config@0.104.0` ↗︎](https://www.npmjs.com/package/@graphql-mesh/config/v/0.104.0)
    (from `0.103.1`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/http@0.103.0` ↗︎](https://www.npmjs.com/package/@graphql-mesh/http/v/0.103.0)
    (from `0.102.1`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/json-schema@0.106.0` ↗︎](https://www.npmjs.com/package/@graphql-mesh/json-schema/v/0.106.0)
    (from `0.105.2`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/runtime@0.103.0` ↗︎](https://www.npmjs.com/package/@graphql-mesh/runtime/v/0.103.0)
    (from `0.102.0`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/store@0.102.0` ↗︎](https://www.npmjs.com/package/@graphql-mesh/store/v/0.102.0)
    (from `0.101.0`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/types@0.102.0` ↗︎](https://www.npmjs.com/package/@graphql-mesh/types/v/0.102.0)
    (from `0.101.0`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/utils@0.102.0` ↗︎](https://www.npmjs.com/package/@graphql-mesh/utils/v/0.102.0)
    (from `0.101.0`, in `dependencies`)

- [#1104](https://github.com/Urigo/accounter-fullstack/pull/1104)
  [`9e659bc`](https://github.com/Urigo/accounter-fullstack/commit/9e659bcebea37b4628ede218ecc09f6a1ecc8a16)
  Thanks [@renovate](https://github.com/apps/renovate)! - dependencies updates:
  - Updated dependency
    [`@graphql-mesh/config@0.104.2` ↗︎](https://www.npmjs.com/package/@graphql-mesh/config/v/0.104.2)
    (from `0.104.0`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/http@0.103.2` ↗︎](https://www.npmjs.com/package/@graphql-mesh/http/v/0.103.2)
    (from `0.103.0`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/json-schema@0.106.2` ↗︎](https://www.npmjs.com/package/@graphql-mesh/json-schema/v/0.106.2)
    (from `0.106.0`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/runtime@0.103.2` ↗︎](https://www.npmjs.com/package/@graphql-mesh/runtime/v/0.103.2)
    (from `0.103.0`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/store@0.102.2` ↗︎](https://www.npmjs.com/package/@graphql-mesh/store/v/0.102.2)
    (from `0.102.0`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/types@0.102.2` ↗︎](https://www.npmjs.com/package/@graphql-mesh/types/v/0.102.2)
    (from `0.102.0`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/utils@0.102.2` ↗︎](https://www.npmjs.com/package/@graphql-mesh/utils/v/0.102.2)
    (from `0.102.0`, in `dependencies`)

- [#1119](https://github.com/Urigo/accounter-fullstack/pull/1119)
  [`e5ae050`](https://github.com/Urigo/accounter-fullstack/commit/e5ae0509ab03b8fb2df74a962b15fd19cd509d23)
  Thanks [@renovate](https://github.com/apps/renovate)! - dependencies updates:
  - Updated dependency
    [`@graphql-mesh/config@0.104.3` ↗︎](https://www.npmjs.com/package/@graphql-mesh/config/v/0.104.3)
    (from `0.104.2`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/http@0.103.3` ↗︎](https://www.npmjs.com/package/@graphql-mesh/http/v/0.103.3)
    (from `0.103.2`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/json-schema@0.106.3` ↗︎](https://www.npmjs.com/package/@graphql-mesh/json-schema/v/0.106.3)
    (from `0.106.2`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/runtime@0.103.3` ↗︎](https://www.npmjs.com/package/@graphql-mesh/runtime/v/0.103.3)
    (from `0.103.2`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/store@0.102.3` ↗︎](https://www.npmjs.com/package/@graphql-mesh/store/v/0.102.3)
    (from `0.102.2`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/types@0.102.3` ↗︎](https://www.npmjs.com/package/@graphql-mesh/types/v/0.102.3)
    (from `0.102.2`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/utils@0.102.3` ↗︎](https://www.npmjs.com/package/@graphql-mesh/utils/v/0.102.3)
    (from `0.102.2`, in `dependencies`)

- [#1122](https://github.com/Urigo/accounter-fullstack/pull/1122)
  [`62d2729`](https://github.com/Urigo/accounter-fullstack/commit/62d272915d75063206f53305a3bfcf8a5b6277e8)
  Thanks [@renovate](https://github.com/apps/renovate)! - dependencies updates:
  - Updated dependency
    [`@graphql-mesh/config@0.104.4` ↗︎](https://www.npmjs.com/package/@graphql-mesh/config/v/0.104.4)
    (from `0.104.3`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/http@0.103.4` ↗︎](https://www.npmjs.com/package/@graphql-mesh/http/v/0.103.4)
    (from `0.103.3`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/json-schema@0.106.4` ↗︎](https://www.npmjs.com/package/@graphql-mesh/json-schema/v/0.106.4)
    (from `0.106.3`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/runtime@0.103.4` ↗︎](https://www.npmjs.com/package/@graphql-mesh/runtime/v/0.103.4)
    (from `0.103.3`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/store@0.102.4` ↗︎](https://www.npmjs.com/package/@graphql-mesh/store/v/0.102.4)
    (from `0.102.3`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/types@0.102.4` ↗︎](https://www.npmjs.com/package/@graphql-mesh/types/v/0.102.4)
    (from `0.102.3`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/utils@0.102.4` ↗︎](https://www.npmjs.com/package/@graphql-mesh/utils/v/0.102.4)
    (from `0.102.3`, in `dependencies`)

- [#1132](https://github.com/Urigo/accounter-fullstack/pull/1132)
  [`f2910cf`](https://github.com/Urigo/accounter-fullstack/commit/f2910cf1862f04899641bb13b5e691e5646f83b4)
  Thanks [@renovate](https://github.com/apps/renovate)! - dependencies updates:
  - Updated dependency
    [`@graphql-mesh/json-schema@0.106.5` ↗︎](https://www.npmjs.com/package/@graphql-mesh/json-schema/v/0.106.5)
    (from `0.106.4`, in `dependencies`)

- [#1145](https://github.com/Urigo/accounter-fullstack/pull/1145)
  [`b9bd839`](https://github.com/Urigo/accounter-fullstack/commit/b9bd8396bf73d77eccbf7f8681eeffebf2a5471b)
  Thanks [@renovate](https://github.com/apps/renovate)! - dependencies updates:
  - Updated dependency
    [`@graphql-mesh/config@0.104.5` ↗︎](https://www.npmjs.com/package/@graphql-mesh/config/v/0.104.5)
    (from `0.104.4`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/http@0.103.5` ↗︎](https://www.npmjs.com/package/@graphql-mesh/http/v/0.103.5)
    (from `0.103.4`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/json-schema@0.106.6` ↗︎](https://www.npmjs.com/package/@graphql-mesh/json-schema/v/0.106.6)
    (from `0.106.5`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/runtime@0.103.5` ↗︎](https://www.npmjs.com/package/@graphql-mesh/runtime/v/0.103.5)
    (from `0.103.4`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/store@0.102.5` ↗︎](https://www.npmjs.com/package/@graphql-mesh/store/v/0.102.5)
    (from `0.102.4`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/types@0.102.5` ↗︎](https://www.npmjs.com/package/@graphql-mesh/types/v/0.102.5)
    (from `0.102.4`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/utils@0.102.5` ↗︎](https://www.npmjs.com/package/@graphql-mesh/utils/v/0.102.5)
    (from `0.102.4`, in `dependencies`)

- [#1174](https://github.com/Urigo/accounter-fullstack/pull/1174)
  [`cd4be2b`](https://github.com/Urigo/accounter-fullstack/commit/cd4be2bb680eda1826e740e54c9a92d55accad18)
  Thanks [@renovate](https://github.com/apps/renovate)! - dependencies updates:
  - Updated dependency
    [`@graphql-mesh/config@0.104.6` ↗︎](https://www.npmjs.com/package/@graphql-mesh/config/v/0.104.6)
    (from `0.104.5`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/http@0.103.6` ↗︎](https://www.npmjs.com/package/@graphql-mesh/http/v/0.103.6)
    (from `0.103.5`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/runtime@0.103.6` ↗︎](https://www.npmjs.com/package/@graphql-mesh/runtime/v/0.103.6)
    (from `0.103.5`, in `dependencies`)

- [#1178](https://github.com/Urigo/accounter-fullstack/pull/1178)
  [`d67572c`](https://github.com/Urigo/accounter-fullstack/commit/d67572cbc82d7da308e7f37430c0d05ef8573915)
  Thanks [@renovate](https://github.com/apps/renovate)! - dependencies updates:
  - Updated dependency
    [`@graphql-mesh/json-schema@0.106.7` ↗︎](https://www.npmjs.com/package/@graphql-mesh/json-schema/v/0.106.7)
    (from `0.106.6`, in `dependencies`)

## 0.7.0

### Minor Changes

- [#964](https://github.com/Urigo/accounter-fullstack/pull/964)
  [`537ae05`](https://github.com/Urigo/accounter-fullstack/commit/537ae057bd575f99b6344a647b5de50def53c224)
  Thanks [@gilgardosh](https://github.com/gilgardosh)! - Introduce getBankTransactions API

- [#514](https://github.com/Urigo/accounter-fullstack/pull/514)
  [`1b5ed4b`](https://github.com/Urigo/accounter-fullstack/commit/1b5ed4b87bb83d6d552caecc5f20736ae416cfb9)
  Thanks [@gilgardosh](https://github.com/gilgardosh)! - Fix GreenInvoice numeric enums handling:
  use numbers instead of underscore-prefixed strings

### Patch Changes

- [#1007](https://github.com/Urigo/accounter-fullstack/pull/1007)
  [`8fa5fa3`](https://github.com/Urigo/accounter-fullstack/commit/8fa5fa38a2e0a2dc66e7d58434b0ab0b49501e8e)
  Thanks [@renovate](https://github.com/apps/renovate)! - dependencies updates:
  - Updated dependency
    [`@graphql-mesh/json-schema@0.103.2` ↗︎](https://www.npmjs.com/package/@graphql-mesh/json-schema/v/0.103.2)
    (from `0.102.7`, in `dependencies`)

- [#1008](https://github.com/Urigo/accounter-fullstack/pull/1008)
  [`e01539c`](https://github.com/Urigo/accounter-fullstack/commit/e01539c4a2e6a4df8b2c8b7e558a0c29b1f1e36e)
  Thanks [@renovate](https://github.com/apps/renovate)! - dependencies updates:
  - Updated dependency
    [`@graphql-mesh/http@0.100.7` ↗︎](https://www.npmjs.com/package/@graphql-mesh/http/v/0.100.7)
    (from `0.100.6`, in `dependencies`)

- [#1014](https://github.com/Urigo/accounter-fullstack/pull/1014)
  [`1aff4f0`](https://github.com/Urigo/accounter-fullstack/commit/1aff4f02f3b9f28f7f5f3b05eb87c9913ebf32da)
  Thanks [@renovate](https://github.com/apps/renovate)! - dependencies updates:
  - Updated dependency
    [`@graphql-mesh/config@0.101.8` ↗︎](https://www.npmjs.com/package/@graphql-mesh/config/v/0.101.8)
    (from `0.101.6`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/http@0.100.9` ↗︎](https://www.npmjs.com/package/@graphql-mesh/http/v/0.100.9)
    (from `0.100.7`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/runtime@0.100.8` ↗︎](https://www.npmjs.com/package/@graphql-mesh/runtime/v/0.100.8)
    (from `0.100.6`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/store@0.99.7` ↗︎](https://www.npmjs.com/package/@graphql-mesh/store/v/0.99.7)
    (from `0.99.5`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/types@0.99.7` ↗︎](https://www.npmjs.com/package/@graphql-mesh/types/v/0.99.7)
    (from `0.99.5`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/utils@0.99.7` ↗︎](https://www.npmjs.com/package/@graphql-mesh/utils/v/0.99.7)
    (from `0.99.5`, in `dependencies`)

- [#1035](https://github.com/Urigo/accounter-fullstack/pull/1035)
  [`395fa90`](https://github.com/Urigo/accounter-fullstack/commit/395fa900c3b40aab0346182abd304bf113fd4643)
  Thanks [@renovate](https://github.com/apps/renovate)! - dependencies updates:
  - Updated dependency
    [`@graphql-mesh/cross-helpers@0.4.5` ↗︎](https://www.npmjs.com/package/@graphql-mesh/cross-helpers/v/0.4.5)
    (from `0.4.4`, in `dependencies`)

- [#1036](https://github.com/Urigo/accounter-fullstack/pull/1036)
  [`d4342d4`](https://github.com/Urigo/accounter-fullstack/commit/d4342d4641b48a148bf8ba6ea473a44dfc4ff186)
  Thanks [@renovate](https://github.com/apps/renovate)! - dependencies updates:
  - Updated dependency
    [`@graphql-mesh/config@0.102.0` ↗︎](https://www.npmjs.com/package/@graphql-mesh/config/v/0.102.0)
    (from `0.101.8`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/http@0.101.0` ↗︎](https://www.npmjs.com/package/@graphql-mesh/http/v/0.101.0)
    (from `0.100.9`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/json-schema@0.104.0` ↗︎](https://www.npmjs.com/package/@graphql-mesh/json-schema/v/0.104.0)
    (from `0.103.2`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/runtime@0.101.0` ↗︎](https://www.npmjs.com/package/@graphql-mesh/runtime/v/0.101.0)
    (from `0.100.8`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/store@0.100.0` ↗︎](https://www.npmjs.com/package/@graphql-mesh/store/v/0.100.0)
    (from `0.99.7`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/types@0.100.0` ↗︎](https://www.npmjs.com/package/@graphql-mesh/types/v/0.100.0)
    (from `0.99.7`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/utils@0.100.0` ↗︎](https://www.npmjs.com/package/@graphql-mesh/utils/v/0.100.0)
    (from `0.99.7`, in `dependencies`)

- [#1060](https://github.com/Urigo/accounter-fullstack/pull/1060)
  [`544defb`](https://github.com/Urigo/accounter-fullstack/commit/544defb5a58aeef64c9e89beb7d470f7bd78bf06)
  Thanks [@renovate](https://github.com/apps/renovate)! - dependencies updates:
  - Updated dependency
    [`@graphql-mesh/cross-helpers@0.4.6` ↗︎](https://www.npmjs.com/package/@graphql-mesh/cross-helpers/v/0.4.6)
    (from `0.4.5`, in `dependencies`)

- [#1061](https://github.com/Urigo/accounter-fullstack/pull/1061)
  [`e33b9ae`](https://github.com/Urigo/accounter-fullstack/commit/e33b9ae42db7adf7e853d6f4765231352f261a55)
  Thanks [@renovate](https://github.com/apps/renovate)! - dependencies updates:
  - Updated dependency
    [`@graphql-mesh/config@0.103.0` ↗︎](https://www.npmjs.com/package/@graphql-mesh/config/v/0.103.0)
    (from `0.102.0`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/http@0.102.0` ↗︎](https://www.npmjs.com/package/@graphql-mesh/http/v/0.102.0)
    (from `0.101.0`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/json-schema@0.105.1` ↗︎](https://www.npmjs.com/package/@graphql-mesh/json-schema/v/0.105.1)
    (from `0.104.0`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/runtime@0.102.0` ↗︎](https://www.npmjs.com/package/@graphql-mesh/runtime/v/0.102.0)
    (from `0.101.0`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/store@0.101.0` ↗︎](https://www.npmjs.com/package/@graphql-mesh/store/v/0.101.0)
    (from `0.100.0`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/types@0.101.0` ↗︎](https://www.npmjs.com/package/@graphql-mesh/types/v/0.101.0)
    (from `0.100.0`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/utils@0.101.0` ↗︎](https://www.npmjs.com/package/@graphql-mesh/utils/v/0.101.0)
    (from `0.100.0`, in `dependencies`)

- [#1073](https://github.com/Urigo/accounter-fullstack/pull/1073)
  [`8d4658e`](https://github.com/Urigo/accounter-fullstack/commit/8d4658eff9a77e90e0e5f9b5df894fb9852684e5)
  Thanks [@renovate](https://github.com/apps/renovate)! - dependencies updates:
  - Updated dependency
    [`@graphql-mesh/config@0.103.1` ↗︎](https://www.npmjs.com/package/@graphql-mesh/config/v/0.103.1)
    (from `0.103.0`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/json-schema@0.105.2` ↗︎](https://www.npmjs.com/package/@graphql-mesh/json-schema/v/0.105.2)
    (from `0.105.1`, in `dependencies`)

- [#482](https://github.com/Urigo/accounter-fullstack/pull/482)
  [`85f6b47`](https://github.com/Urigo/accounter-fullstack/commit/85f6b471c29f7b5133cc8d40b7d185d6d3acad88)
  Thanks [@renovate](https://github.com/apps/renovate)! - dependencies updates:
  - Updated dependency
    [`@graphql-mesh/json-schema@0.99.2` ↗︎](https://www.npmjs.com/package/@graphql-mesh/json-schema/v/0.99.2)
    (from `0.99.0`, in `dependencies`)

- [#487](https://github.com/Urigo/accounter-fullstack/pull/487)
  [`92a3b41`](https://github.com/Urigo/accounter-fullstack/commit/92a3b4183ae433189b96a061464beb0b9b94de92)
  Thanks [@renovate](https://github.com/apps/renovate)! - dependencies updates:
  - Updated dependency
    [`@graphql-mesh/config@0.99.3` ↗︎](https://www.npmjs.com/package/@graphql-mesh/config/v/0.99.3)
    (from `0.99.0`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/http@0.98.3` ↗︎](https://www.npmjs.com/package/@graphql-mesh/http/v/0.98.3)
    (from `0.98.0`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/json-schema@0.99.4` ↗︎](https://www.npmjs.com/package/@graphql-mesh/json-schema/v/0.99.4)
    (from `0.99.2`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/runtime@0.98.3` ↗︎](https://www.npmjs.com/package/@graphql-mesh/runtime/v/0.98.3)
    (from `0.98.0`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/store@0.97.3` ↗︎](https://www.npmjs.com/package/@graphql-mesh/store/v/0.97.3)
    (from `0.97.0`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/types@0.97.3` ↗︎](https://www.npmjs.com/package/@graphql-mesh/types/v/0.97.3)
    (from `0.97.0`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/utils@0.97.3` ↗︎](https://www.npmjs.com/package/@graphql-mesh/utils/v/0.97.3)
    (from `0.97.0`, in `dependencies`)

- [#496](https://github.com/Urigo/accounter-fullstack/pull/496)
  [`b56e384`](https://github.com/Urigo/accounter-fullstack/commit/b56e38483b4a2b854f94f7a519e46c0fe11b9a5f)
  Thanks [@renovate](https://github.com/apps/renovate)! - dependencies updates:
  - Updated dependency
    [`@graphql-mesh/config@0.99.4` ↗︎](https://www.npmjs.com/package/@graphql-mesh/config/v/0.99.4)
    (from `0.99.3`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/http@0.98.4` ↗︎](https://www.npmjs.com/package/@graphql-mesh/http/v/0.98.4)
    (from `0.98.3`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/json-schema@0.99.5` ↗︎](https://www.npmjs.com/package/@graphql-mesh/json-schema/v/0.99.5)
    (from `0.99.4`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/runtime@0.98.4` ↗︎](https://www.npmjs.com/package/@graphql-mesh/runtime/v/0.98.4)
    (from `0.98.3`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/store@0.97.4` ↗︎](https://www.npmjs.com/package/@graphql-mesh/store/v/0.97.4)
    (from `0.97.3`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/types@0.97.4` ↗︎](https://www.npmjs.com/package/@graphql-mesh/types/v/0.97.4)
    (from `0.97.3`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/utils@0.97.4` ↗︎](https://www.npmjs.com/package/@graphql-mesh/utils/v/0.97.4)
    (from `0.97.3`, in `dependencies`)

- [#507](https://github.com/Urigo/accounter-fullstack/pull/507)
  [`e6ba95a`](https://github.com/Urigo/accounter-fullstack/commit/e6ba95a212fcb58f44ab183ccf209207bf35b3b6)
  Thanks [@renovate](https://github.com/apps/renovate)! - dependencies updates:
  - Updated dependency
    [`@graphql-mesh/config@0.99.6` ↗︎](https://www.npmjs.com/package/@graphql-mesh/config/v/0.99.6)
    (from `0.99.4`, in `dependencies`)

- [#516](https://github.com/Urigo/accounter-fullstack/pull/516)
  [`f4c917c`](https://github.com/Urigo/accounter-fullstack/commit/f4c917c7af5bf91f94a2457c0edf002db8298808)
  Thanks [@renovate](https://github.com/apps/renovate)! - dependencies updates:
  - Updated dependency
    [`@graphql-mesh/config@0.99.7` ↗︎](https://www.npmjs.com/package/@graphql-mesh/config/v/0.99.7)
    (from `0.99.6`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/http@0.98.6` ↗︎](https://www.npmjs.com/package/@graphql-mesh/http/v/0.98.6)
    (from `0.98.4`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/json-schema@0.99.6` ↗︎](https://www.npmjs.com/package/@graphql-mesh/json-schema/v/0.99.6)
    (from `0.99.5`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/runtime@0.98.6` ↗︎](https://www.npmjs.com/package/@graphql-mesh/runtime/v/0.98.6)
    (from `0.98.4`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/store@0.97.5` ↗︎](https://www.npmjs.com/package/@graphql-mesh/store/v/0.97.5)
    (from `0.97.4`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/types@0.97.5` ↗︎](https://www.npmjs.com/package/@graphql-mesh/types/v/0.97.5)
    (from `0.97.4`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/utils@0.97.5` ↗︎](https://www.npmjs.com/package/@graphql-mesh/utils/v/0.97.5)
    (from `0.97.4`, in `dependencies`)

- [#522](https://github.com/Urigo/accounter-fullstack/pull/522)
  [`0c0b2e2`](https://github.com/Urigo/accounter-fullstack/commit/0c0b2e24ddf9777262ced77f75f8044a0ad6990d)
  Thanks [@renovate](https://github.com/apps/renovate)! - dependencies updates:
  - Updated dependency
    [`@graphql-mesh/config@0.99.8` ↗︎](https://www.npmjs.com/package/@graphql-mesh/config/v/0.99.8)
    (from `0.99.7`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/http@0.98.7` ↗︎](https://www.npmjs.com/package/@graphql-mesh/http/v/0.98.7)
    (from `0.98.6`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/runtime@0.98.7` ↗︎](https://www.npmjs.com/package/@graphql-mesh/runtime/v/0.98.7)
    (from `0.98.6`, in `dependencies`)

- [#579](https://github.com/Urigo/accounter-fullstack/pull/579)
  [`d53495b`](https://github.com/Urigo/accounter-fullstack/commit/d53495b0efce17348795766b7cc88786507fe61e)
  Thanks [@renovate](https://github.com/apps/renovate)! - dependencies updates:
  - Updated dependency
    [`@graphql-mesh/config@0.99.9` ↗︎](https://www.npmjs.com/package/@graphql-mesh/config/v/0.99.9)
    (from `0.99.8`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/http@0.98.8` ↗︎](https://www.npmjs.com/package/@graphql-mesh/http/v/0.98.8)
    (from `0.98.7`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/runtime@0.98.8` ↗︎](https://www.npmjs.com/package/@graphql-mesh/runtime/v/0.98.8)
    (from `0.98.7`, in `dependencies`)

- [#628](https://github.com/Urigo/accounter-fullstack/pull/628)
  [`a610797`](https://github.com/Urigo/accounter-fullstack/commit/a6107970b9c6526860f862002246bd5be872db55)
  Thanks [@renovate](https://github.com/apps/renovate)! - dependencies updates:
  - Updated dependency
    [`@graphql-mesh/config@0.100.3` ↗︎](https://www.npmjs.com/package/@graphql-mesh/config/v/0.100.3)
    (from `0.99.9`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/http@0.99.3` ↗︎](https://www.npmjs.com/package/@graphql-mesh/http/v/0.99.3)
    (from `0.98.8`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/json-schema@0.100.4` ↗︎](https://www.npmjs.com/package/@graphql-mesh/json-schema/v/0.100.4)
    (from `0.99.6`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/runtime@0.99.3` ↗︎](https://www.npmjs.com/package/@graphql-mesh/runtime/v/0.99.3)
    (from `0.98.8`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/store@0.98.3` ↗︎](https://www.npmjs.com/package/@graphql-mesh/store/v/0.98.3)
    (from `0.97.5`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/types@0.98.3` ↗︎](https://www.npmjs.com/package/@graphql-mesh/types/v/0.98.3)
    (from `0.97.5`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/utils@0.98.3` ↗︎](https://www.npmjs.com/package/@graphql-mesh/utils/v/0.98.3)
    (from `0.97.5`, in `dependencies`)

- [#631](https://github.com/Urigo/accounter-fullstack/pull/631)
  [`b03449e`](https://github.com/Urigo/accounter-fullstack/commit/b03449ed32bbaec45975866a0b50257d0b99fb02)
  Thanks [@renovate](https://github.com/apps/renovate)! - dependencies updates:
  - Updated dependency
    [`@graphql-mesh/cross-helpers@0.4.2` ↗︎](https://www.npmjs.com/package/@graphql-mesh/cross-helpers/v/0.4.2)
    (from `0.4.1`, in `dependencies`)

- [#649](https://github.com/Urigo/accounter-fullstack/pull/649)
  [`a7a1ccb`](https://github.com/Urigo/accounter-fullstack/commit/a7a1ccbacb18ddc86d1de4b996900e1be3c12ad3)
  Thanks [@renovate](https://github.com/apps/renovate)! - dependencies updates:
  - Updated dependency
    [`@graphql-mesh/config@0.100.5` ↗︎](https://www.npmjs.com/package/@graphql-mesh/config/v/0.100.5)
    (from `0.100.3`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/http@0.99.5` ↗︎](https://www.npmjs.com/package/@graphql-mesh/http/v/0.99.5)
    (from `0.99.3`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/json-schema@0.100.6` ↗︎](https://www.npmjs.com/package/@graphql-mesh/json-schema/v/0.100.6)
    (from `0.100.4`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/runtime@0.99.5` ↗︎](https://www.npmjs.com/package/@graphql-mesh/runtime/v/0.99.5)
    (from `0.99.3`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/store@0.98.4` ↗︎](https://www.npmjs.com/package/@graphql-mesh/store/v/0.98.4)
    (from `0.98.3`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/types@0.98.4` ↗︎](https://www.npmjs.com/package/@graphql-mesh/types/v/0.98.4)
    (from `0.98.3`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/utils@0.98.4` ↗︎](https://www.npmjs.com/package/@graphql-mesh/utils/v/0.98.4)
    (from `0.98.3`, in `dependencies`)

- [#664](https://github.com/Urigo/accounter-fullstack/pull/664)
  [`ebc6252`](https://github.com/Urigo/accounter-fullstack/commit/ebc625216c68c0d5fade0cbdf7dde6bee8ee46c3)
  Thanks [@gilgardosh](https://github.com/gilgardosh)! - dependencies updates:
  - Updated dependency
    [`@graphql-mesh/json-schema@0.100.10-alpha-20240602174415-2f77f99bd10ec04faef9e942cf0bfd3340b80fca` ↗︎](https://www.npmjs.com/package/@graphql-mesh/json-schema/v/0.100.10)
    (from `0.100.11`, in `dependencies`)

- [#669](https://github.com/Urigo/accounter-fullstack/pull/669)
  [`589ec6b`](https://github.com/Urigo/accounter-fullstack/commit/589ec6bc3e987c8bc670b05b0022d59422131934)
  Thanks [@renovate](https://github.com/apps/renovate)! - dependencies updates:
  - Updated dependency
    [`@graphql-mesh/json-schema@0.100.7` ↗︎](https://www.npmjs.com/package/@graphql-mesh/json-schema/v/0.100.7)
    (from `0.100.6`, in `dependencies`)

- [#695](https://github.com/Urigo/accounter-fullstack/pull/695)
  [`6a14adf`](https://github.com/Urigo/accounter-fullstack/commit/6a14adfe23c354697b082c58c1df87d1fef9f53e)
  Thanks [@renovate](https://github.com/apps/renovate)! - dependencies updates:
  - Updated dependency
    [`@graphql-mesh/config@0.100.6` ↗︎](https://www.npmjs.com/package/@graphql-mesh/config/v/0.100.6)
    (from `0.100.5`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/http@0.99.6` ↗︎](https://www.npmjs.com/package/@graphql-mesh/http/v/0.99.6)
    (from `0.99.5`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/json-schema@0.100.8` ↗︎](https://www.npmjs.com/package/@graphql-mesh/json-schema/v/0.100.8)
    (from `0.100.7`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/runtime@0.99.6` ↗︎](https://www.npmjs.com/package/@graphql-mesh/runtime/v/0.99.6)
    (from `0.99.5`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/store@0.98.5` ↗︎](https://www.npmjs.com/package/@graphql-mesh/store/v/0.98.5)
    (from `0.98.4`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/types@0.98.5` ↗︎](https://www.npmjs.com/package/@graphql-mesh/types/v/0.98.5)
    (from `0.98.4`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/utils@0.98.5` ↗︎](https://www.npmjs.com/package/@graphql-mesh/utils/v/0.98.5)
    (from `0.98.4`, in `dependencies`)

- [#709](https://github.com/Urigo/accounter-fullstack/pull/709)
  [`60a0845`](https://github.com/Urigo/accounter-fullstack/commit/60a0845cdf5754c182fed84e36522e9555b4e30c)
  Thanks [@renovate](https://github.com/apps/renovate)! - dependencies updates:
  - Updated dependency
    [`@graphql-mesh/config@0.100.7` ↗︎](https://www.npmjs.com/package/@graphql-mesh/config/v/0.100.7)
    (from `0.100.6`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/cross-helpers@0.4.3` ↗︎](https://www.npmjs.com/package/@graphql-mesh/cross-helpers/v/0.4.3)
    (from `0.4.2`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/http@0.99.7` ↗︎](https://www.npmjs.com/package/@graphql-mesh/http/v/0.99.7)
    (from `0.99.6`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/json-schema@0.100.9` ↗︎](https://www.npmjs.com/package/@graphql-mesh/json-schema/v/0.100.9)
    (from `0.100.8`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/runtime@0.99.7` ↗︎](https://www.npmjs.com/package/@graphql-mesh/runtime/v/0.99.7)
    (from `0.99.6`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/store@0.98.6` ↗︎](https://www.npmjs.com/package/@graphql-mesh/store/v/0.98.6)
    (from `0.98.5`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/types@0.98.6` ↗︎](https://www.npmjs.com/package/@graphql-mesh/types/v/0.98.6)
    (from `0.98.5`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/utils@0.98.6` ↗︎](https://www.npmjs.com/package/@graphql-mesh/utils/v/0.98.6)
    (from `0.98.5`, in `dependencies`)

- [#745](https://github.com/Urigo/accounter-fullstack/pull/745)
  [`8f16dc6`](https://github.com/Urigo/accounter-fullstack/commit/8f16dc691c5fa9b011ee59191d62ece8b7aae1b3)
  Thanks [@renovate](https://github.com/apps/renovate)! - dependencies updates:
  - Updated dependency
    [`@graphql-mesh/config@0.100.8` ↗︎](https://www.npmjs.com/package/@graphql-mesh/config/v/0.100.8)
    (from `0.100.7`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/http@0.99.8` ↗︎](https://www.npmjs.com/package/@graphql-mesh/http/v/0.99.8)
    (from `0.99.7`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/json-schema@0.100.11` ↗︎](https://www.npmjs.com/package/@graphql-mesh/json-schema/v/0.100.11)
    (from `0.100.9`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/runtime@0.99.8` ↗︎](https://www.npmjs.com/package/@graphql-mesh/runtime/v/0.99.8)
    (from `0.99.7`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/store@0.98.7` ↗︎](https://www.npmjs.com/package/@graphql-mesh/store/v/0.98.7)
    (from `0.98.6`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/types@0.98.7` ↗︎](https://www.npmjs.com/package/@graphql-mesh/types/v/0.98.7)
    (from `0.98.6`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/utils@0.98.7` ↗︎](https://www.npmjs.com/package/@graphql-mesh/utils/v/0.98.7)
    (from `0.98.6`, in `dependencies`)
  - Updated dependency [`graphql@16.8.2` ↗︎](https://www.npmjs.com/package/graphql/v/16.8.2) (from
    `16.8.1`, in `dependencies`)

- [#788](https://github.com/Urigo/accounter-fullstack/pull/788)
  [`d6247ce`](https://github.com/Urigo/accounter-fullstack/commit/d6247ce0657c40a941c6e86a1c3ef260a8f52cf4)
  Thanks [@renovate](https://github.com/apps/renovate)! - dependencies updates:
  - Updated dependency
    [`@graphql-mesh/config@0.100.9` ↗︎](https://www.npmjs.com/package/@graphql-mesh/config/v/0.100.9)
    (from `0.100.8`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/http@0.99.9` ↗︎](https://www.npmjs.com/package/@graphql-mesh/http/v/0.99.9)
    (from `0.99.8`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/json-schema@0.100.12` ↗︎](https://www.npmjs.com/package/@graphql-mesh/json-schema/v/0.100.12)
    (from `0.100.10-alpha-20240602174415-2f77f99bd10ec04faef9e942cf0bfd3340b80fca`, in
    `dependencies`)
  - Updated dependency
    [`@graphql-mesh/runtime@0.99.9` ↗︎](https://www.npmjs.com/package/@graphql-mesh/runtime/v/0.99.9)
    (from `0.99.8`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/store@0.98.8` ↗︎](https://www.npmjs.com/package/@graphql-mesh/store/v/0.98.8)
    (from `0.98.7`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/types@0.98.8` ↗︎](https://www.npmjs.com/package/@graphql-mesh/types/v/0.98.8)
    (from `0.98.7`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/utils@0.98.8` ↗︎](https://www.npmjs.com/package/@graphql-mesh/utils/v/0.98.8)
    (from `0.98.7`, in `dependencies`)

- [#794](https://github.com/Urigo/accounter-fullstack/pull/794)
  [`3adbc26`](https://github.com/Urigo/accounter-fullstack/commit/3adbc26730bae4f147df93481f3d875a667fcc68)
  Thanks [@renovate](https://github.com/apps/renovate)! - dependencies updates:
  - Updated dependency [`graphql@16.9.0` ↗︎](https://www.npmjs.com/package/graphql/v/16.9.0) (from
    `16.8.2`, in `dependencies`)

- [#795](https://github.com/Urigo/accounter-fullstack/pull/795)
  [`c61694b`](https://github.com/Urigo/accounter-fullstack/commit/c61694bc859ce89ba04d1ea52629a1bc8657d070)
  Thanks [@renovate](https://github.com/apps/renovate)! - dependencies updates:
  - Updated dependency
    [`@graphql-mesh/config@0.100.10` ↗︎](https://www.npmjs.com/package/@graphql-mesh/config/v/0.100.10)
    (from `0.100.9`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/http@0.99.10` ↗︎](https://www.npmjs.com/package/@graphql-mesh/http/v/0.99.10)
    (from `0.99.9`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/json-schema@0.100.13` ↗︎](https://www.npmjs.com/package/@graphql-mesh/json-schema/v/0.100.13)
    (from `0.100.12`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/runtime@0.99.10` ↗︎](https://www.npmjs.com/package/@graphql-mesh/runtime/v/0.99.10)
    (from `0.99.9`, in `dependencies`)

- [#811](https://github.com/Urigo/accounter-fullstack/pull/811)
  [`10b4fa0`](https://github.com/Urigo/accounter-fullstack/commit/10b4fa03cd4a38fcdb4069a1c2ea42d1713c040c)
  Thanks [@renovate](https://github.com/apps/renovate)! - dependencies updates:
  - Updated dependency
    [`@graphql-mesh/config@0.100.11` ↗︎](https://www.npmjs.com/package/@graphql-mesh/config/v/0.100.11)
    (from `0.100.10`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/http@0.99.11` ↗︎](https://www.npmjs.com/package/@graphql-mesh/http/v/0.99.11)
    (from `0.99.10`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/runtime@0.99.11` ↗︎](https://www.npmjs.com/package/@graphql-mesh/runtime/v/0.99.11)
    (from `0.99.10`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/store@0.98.9` ↗︎](https://www.npmjs.com/package/@graphql-mesh/store/v/0.98.9)
    (from `0.98.8`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/types@0.98.9` ↗︎](https://www.npmjs.com/package/@graphql-mesh/types/v/0.98.9)
    (from `0.98.8`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/utils@0.98.9` ↗︎](https://www.npmjs.com/package/@graphql-mesh/utils/v/0.98.9)
    (from `0.98.8`, in `dependencies`)

- [#812](https://github.com/Urigo/accounter-fullstack/pull/812)
  [`be71797`](https://github.com/Urigo/accounter-fullstack/commit/be71797d59f358e1458d357aabd1996d3c5558ae)
  Thanks [@renovate](https://github.com/apps/renovate)! - dependencies updates:
  - Updated dependency
    [`@graphql-mesh/json-schema@0.101.0` ↗︎](https://www.npmjs.com/package/@graphql-mesh/json-schema/v/0.101.0)
    (from `0.100.14-alpha-20240624090904-0efa06eac80c025d51493ab4732a288c1d53fac1`, in
    `dependencies`)

- [#827](https://github.com/Urigo/accounter-fullstack/pull/827)
  [`c9d0e34`](https://github.com/Urigo/accounter-fullstack/commit/c9d0e34cf45f2e4a5f4ba2c3c09e62cd9ca1c929)
  Thanks [@renovate](https://github.com/apps/renovate)! - dependencies updates:
  - Updated dependency
    [`@graphql-mesh/config@0.100.12` ↗︎](https://www.npmjs.com/package/@graphql-mesh/config/v/0.100.12)
    (from `0.100.11`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/cross-helpers@0.4.4` ↗︎](https://www.npmjs.com/package/@graphql-mesh/cross-helpers/v/0.4.4)
    (from `0.4.3`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/http@0.99.12` ↗︎](https://www.npmjs.com/package/@graphql-mesh/http/v/0.99.12)
    (from `0.99.11`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/json-schema@0.101.1` ↗︎](https://www.npmjs.com/package/@graphql-mesh/json-schema/v/0.101.1)
    (from `0.101.0`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/runtime@0.99.12` ↗︎](https://www.npmjs.com/package/@graphql-mesh/runtime/v/0.99.12)
    (from `0.99.11`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/store@0.98.10` ↗︎](https://www.npmjs.com/package/@graphql-mesh/store/v/0.98.10)
    (from `0.98.9`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/types@0.98.10` ↗︎](https://www.npmjs.com/package/@graphql-mesh/types/v/0.98.10)
    (from `0.98.9`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/utils@0.98.10` ↗︎](https://www.npmjs.com/package/@graphql-mesh/utils/v/0.98.10)
    (from `0.98.9`, in `dependencies`)

- [#836](https://github.com/Urigo/accounter-fullstack/pull/836)
  [`c8db25c`](https://github.com/Urigo/accounter-fullstack/commit/c8db25cc858367df457445cb37116d4f79d7541e)
  Thanks [@renovate](https://github.com/apps/renovate)! - dependencies updates:
  - Updated dependency
    [`@graphql-mesh/json-schema@0.101.2` ↗︎](https://www.npmjs.com/package/@graphql-mesh/json-schema/v/0.101.2)
    (from `0.101.1`, in `dependencies`)

- [#894](https://github.com/Urigo/accounter-fullstack/pull/894)
  [`406859f`](https://github.com/Urigo/accounter-fullstack/commit/406859ff9d8edd9f7590d79acdeb9ef679dd1e89)
  Thanks [@renovate](https://github.com/apps/renovate)! - dependencies updates:
  - Updated dependency
    [`@graphql-mesh/config@0.101.0` ↗︎](https://www.npmjs.com/package/@graphql-mesh/config/v/0.101.0)
    (from `0.100.12`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/http@0.100.0` ↗︎](https://www.npmjs.com/package/@graphql-mesh/http/v/0.100.0)
    (from `0.99.12`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/json-schema@0.102.0` ↗︎](https://www.npmjs.com/package/@graphql-mesh/json-schema/v/0.102.0)
    (from `0.101.2`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/runtime@0.100.0` ↗︎](https://www.npmjs.com/package/@graphql-mesh/runtime/v/0.100.0)
    (from `0.99.12`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/store@0.99.0` ↗︎](https://www.npmjs.com/package/@graphql-mesh/store/v/0.99.0)
    (from `0.98.10`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/utils@0.99.0` ↗︎](https://www.npmjs.com/package/@graphql-mesh/utils/v/0.99.0)
    (from `0.98.10`, in `dependencies`)

- [#896](https://github.com/Urigo/accounter-fullstack/pull/896)
  [`12ac465`](https://github.com/Urigo/accounter-fullstack/commit/12ac4658cb9e4d4b5d023f054f5355465338218b)
  Thanks [@renovate](https://github.com/apps/renovate)! - dependencies updates:
  - Updated dependency
    [`@graphql-mesh/types@0.99.0` ↗︎](https://www.npmjs.com/package/@graphql-mesh/types/v/0.99.0)
    (from `0.98.10`, in `dependencies`)

- [#939](https://github.com/Urigo/accounter-fullstack/pull/939)
  [`695feef`](https://github.com/Urigo/accounter-fullstack/commit/695feef85cbadb487639ac951cb68a7387864e3f)
  Thanks [@renovate](https://github.com/apps/renovate)! - dependencies updates:
  - Updated dependency
    [`@graphql-mesh/config@0.101.2` ↗︎](https://www.npmjs.com/package/@graphql-mesh/config/v/0.101.2)
    (from `0.101.0`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/http@0.100.2` ↗︎](https://www.npmjs.com/package/@graphql-mesh/http/v/0.100.2)
    (from `0.100.0`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/json-schema@0.102.3` ↗︎](https://www.npmjs.com/package/@graphql-mesh/json-schema/v/0.102.3)
    (from `0.102.0`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/runtime@0.100.2` ↗︎](https://www.npmjs.com/package/@graphql-mesh/runtime/v/0.100.2)
    (from `0.100.0`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/store@0.99.2` ↗︎](https://www.npmjs.com/package/@graphql-mesh/store/v/0.99.2)
    (from `0.99.0`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/types@0.99.2` ↗︎](https://www.npmjs.com/package/@graphql-mesh/types/v/0.99.2)
    (from `0.99.0`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/utils@0.99.2` ↗︎](https://www.npmjs.com/package/@graphql-mesh/utils/v/0.99.2)
    (from `0.99.0`, in `dependencies`)

- [#963](https://github.com/Urigo/accounter-fullstack/pull/963)
  [`745c4d5`](https://github.com/Urigo/accounter-fullstack/commit/745c4d55e7d5337722c0a858c57c7dab5ffdbf07)
  Thanks [@renovate](https://github.com/apps/renovate)! - dependencies updates:
  - Updated dependency
    [`@graphql-mesh/config@0.101.3` ↗︎](https://www.npmjs.com/package/@graphql-mesh/config/v/0.101.3)
    (from `0.101.2`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/http@0.100.3` ↗︎](https://www.npmjs.com/package/@graphql-mesh/http/v/0.100.3)
    (from `0.100.2`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/json-schema@0.102.4` ↗︎](https://www.npmjs.com/package/@graphql-mesh/json-schema/v/0.102.4)
    (from `0.102.3`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/runtime@0.100.3` ↗︎](https://www.npmjs.com/package/@graphql-mesh/runtime/v/0.100.3)
    (from `0.100.2`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/store@0.99.3` ↗︎](https://www.npmjs.com/package/@graphql-mesh/store/v/0.99.3)
    (from `0.99.2`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/types@0.99.3` ↗︎](https://www.npmjs.com/package/@graphql-mesh/types/v/0.99.3)
    (from `0.99.2`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/utils@0.99.3` ↗︎](https://www.npmjs.com/package/@graphql-mesh/utils/v/0.99.3)
    (from `0.99.2`, in `dependencies`)

- [#978](https://github.com/Urigo/accounter-fullstack/pull/978)
  [`dd81ccb`](https://github.com/Urigo/accounter-fullstack/commit/dd81ccb4849607ef71a4859fe5e472b5e2126dc4)
  Thanks [@renovate](https://github.com/apps/renovate)! - dependencies updates:
  - Updated dependency
    [`@graphql-mesh/config@0.101.4` ↗︎](https://www.npmjs.com/package/@graphql-mesh/config/v/0.101.4)
    (from `0.101.3`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/http@0.100.4` ↗︎](https://www.npmjs.com/package/@graphql-mesh/http/v/0.100.4)
    (from `0.100.3`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/json-schema@0.102.6` ↗︎](https://www.npmjs.com/package/@graphql-mesh/json-schema/v/0.102.6)
    (from `0.102.4`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/runtime@0.100.4` ↗︎](https://www.npmjs.com/package/@graphql-mesh/runtime/v/0.100.4)
    (from `0.100.3`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/store@0.99.4` ↗︎](https://www.npmjs.com/package/@graphql-mesh/store/v/0.99.4)
    (from `0.99.3`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/types@0.99.4` ↗︎](https://www.npmjs.com/package/@graphql-mesh/types/v/0.99.4)
    (from `0.99.3`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/utils@0.99.4` ↗︎](https://www.npmjs.com/package/@graphql-mesh/utils/v/0.99.4)
    (from `0.99.3`, in `dependencies`)

- [#987](https://github.com/Urigo/accounter-fullstack/pull/987)
  [`2a154e6`](https://github.com/Urigo/accounter-fullstack/commit/2a154e63486f9637b59dd12a5296e831e5379210)
  Thanks [@renovate](https://github.com/apps/renovate)! - dependencies updates:
  - Updated dependency
    [`@graphql-mesh/config@0.101.5` ↗︎](https://www.npmjs.com/package/@graphql-mesh/config/v/0.101.5)
    (from `0.101.4`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/http@0.100.5` ↗︎](https://www.npmjs.com/package/@graphql-mesh/http/v/0.100.5)
    (from `0.100.4`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/json-schema@0.102.7` ↗︎](https://www.npmjs.com/package/@graphql-mesh/json-schema/v/0.102.7)
    (from `0.102.6`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/runtime@0.100.5` ↗︎](https://www.npmjs.com/package/@graphql-mesh/runtime/v/0.100.5)
    (from `0.100.4`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/store@0.99.5` ↗︎](https://www.npmjs.com/package/@graphql-mesh/store/v/0.99.5)
    (from `0.99.4`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/types@0.99.5` ↗︎](https://www.npmjs.com/package/@graphql-mesh/types/v/0.99.5)
    (from `0.99.4`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/utils@0.99.5` ↗︎](https://www.npmjs.com/package/@graphql-mesh/utils/v/0.99.5)
    (from `0.99.4`, in `dependencies`)

- [#993](https://github.com/Urigo/accounter-fullstack/pull/993)
  [`77dd3dc`](https://github.com/Urigo/accounter-fullstack/commit/77dd3dcb8160eac3ac75bb783cbc89185ff59f8b)
  Thanks [@renovate](https://github.com/apps/renovate)! - dependencies updates:
  - Updated dependency
    [`@graphql-mesh/config@0.101.6` ↗︎](https://www.npmjs.com/package/@graphql-mesh/config/v/0.101.6)
    (from `0.101.5`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/http@0.100.6` ↗︎](https://www.npmjs.com/package/@graphql-mesh/http/v/0.100.6)
    (from `0.100.5`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/runtime@0.100.6` ↗︎](https://www.npmjs.com/package/@graphql-mesh/runtime/v/0.100.6)
    (from `0.100.5`, in `dependencies`)

- [#470](https://github.com/Urigo/accounter-fullstack/pull/470)
  [`4c86678`](https://github.com/Urigo/accounter-fullstack/commit/4c866780ef1c78880f9b62854d5ab9a5eb74db95)
  Thanks [@gilgardosh](https://github.com/gilgardosh)! - Migrate accounter-toolkit into the monorepo

## 0.6.0

### Minor Changes

- [#210](https://github.com/gilgardosh/accounter-toolkit/pull/210)
  [`c84416c`](https://github.com/gilgardosh/accounter-toolkit/commit/c84416cb9c9f501b5f53b039985f5d2b24ea93c2)
  Thanks [@gilgardosh](https://github.com/gilgardosh)! - Drop support for NPM <18

## 0.5.2

### Patch Changes

- [#179](https://github.com/gilgardosh/accounter-toolkit/pull/179)
  [`5dc7844`](https://github.com/gilgardosh/accounter-toolkit/commit/5dc7844d72b4ce9bfe45402852b5858373a381e6)
  Thanks [@gilgardosh](https://github.com/gilgardosh)! - dependencies updates:
  - Removed dependency
    [`@graphql-mesh/cli@0.87.3` ↗︎](https://www.npmjs.com/package/@graphql-mesh/cli/v/0.87.3) (from
    `dependencies`)

- [#180](https://github.com/gilgardosh/accounter-toolkit/pull/180)
  [`753a8c4`](https://github.com/gilgardosh/accounter-toolkit/commit/753a8c46436c7905b12edc4f9847da900a0b2792)
  Thanks [@gilgardosh](https://github.com/gilgardosh)! - dependencies updates:
  - Added dependency
    [`@graphql-mesh/config@0.97.4` ↗︎](https://www.npmjs.com/package/@graphql-mesh/config/v/0.97.4)
    (to `dependencies`)
  - Added dependency
    [`@graphql-mesh/cross-helpers@0.4.0` ↗︎](https://www.npmjs.com/package/@graphql-mesh/cross-helpers/v/0.4.0)
    (to `dependencies`)
  - Added dependency
    [`@graphql-mesh/http@0.96.3` ↗︎](https://www.npmjs.com/package/@graphql-mesh/http/v/0.96.3) (to
    `dependencies`)
  - Added dependency
    [`@graphql-mesh/runtime@0.96.2` ↗︎](https://www.npmjs.com/package/@graphql-mesh/runtime/v/0.96.2)
    (to `dependencies`)
  - Added dependency
    [`@graphql-mesh/store@0.95.2` ↗︎](https://www.npmjs.com/package/@graphql-mesh/store/v/0.95.2)
    (to `dependencies`)
  - Added dependency
    [`@graphql-mesh/types@0.95.2` ↗︎](https://www.npmjs.com/package/@graphql-mesh/types/v/0.95.2)
    (to `dependencies`)
  - Added dependency
    [`@graphql-mesh/utils@0.95.2` ↗︎](https://www.npmjs.com/package/@graphql-mesh/utils/v/0.95.2)
    (to `dependencies`)
  - Removed dependency
    [`@graphql-mesh/transform-resolvers-composition@0.95.2` ↗︎](https://www.npmjs.com/package/@graphql-mesh/transform-resolvers-composition/v/0.95.2)
    (from `dependencies`)

- [#187](https://github.com/gilgardosh/accounter-toolkit/pull/187)
  [`46e0b42`](https://github.com/gilgardosh/accounter-toolkit/commit/46e0b42b2bda020601601338d1ddc79d840eb115)
  Thanks [@renovate](https://github.com/apps/renovate)! - dependencies updates:
  - Updated dependency [`graphql@16.8.1` ↗︎](https://www.npmjs.com/package/graphql/v/16.8.1) (from
    `16.8.0`, in `dependencies`)

- [#179](https://github.com/gilgardosh/accounter-toolkit/pull/179)
  [`5dc7844`](https://github.com/gilgardosh/accounter-toolkit/commit/5dc7844d72b4ce9bfe45402852b5858373a381e6)
  Thanks [@gilgardosh](https://github.com/gilgardosh)! - Rearrange packages dependencies

- [#180](https://github.com/gilgardosh/accounter-toolkit/pull/180)
  [`753a8c4`](https://github.com/gilgardosh/accounter-toolkit/commit/753a8c46436c7905b12edc4f9847da900a0b2792)
  Thanks [@gilgardosh](https://github.com/gilgardosh)! - Fix missing dependencies for Mesh artifacts

- [#177](https://github.com/gilgardosh/accounter-toolkit/pull/177)
  [`eb0746b`](https://github.com/gilgardosh/accounter-toolkit/commit/eb0746b23cf82668dfd3a7443a09de5a9d0be37b)
  Thanks [@gilgardosh](https://github.com/gilgardosh)! - Root dependencies reorder and cleanup

## 0.5.1

### Patch Changes

- [#175](https://github.com/gilgardosh/accounter-toolkit/pull/175)
  [`44b7d77`](https://github.com/gilgardosh/accounter-toolkit/commit/44b7d77049640e6eb11497914b459ec3cf319d9e)
  Thanks [@gilgardosh](https://github.com/gilgardosh)! - dependencies updates:
  - Updated dependency
    [`@graphql-mesh/cli@0.87.3` ↗︎](https://www.npmjs.com/package/@graphql-mesh/cli/v/0.87.3) (from
    `0.86.0`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/json-schema@0.95.3` ↗︎](https://www.npmjs.com/package/@graphql-mesh/json-schema/v/0.95.3)
    (from `0.95.0`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/transform-resolvers-composition@0.95.2` ↗︎](https://www.npmjs.com/package/@graphql-mesh/transform-resolvers-composition/v/0.95.2)
    (from `0.95.0`, in `dependencies`)
  - Updated dependency [`graphql@16.8.0` ↗︎](https://www.npmjs.com/package/graphql/v/16.8.0) (from
    `16.7.1`, in `dependencies`)

## 0.5.0

### Minor Changes

- [#155](https://github.com/gilgardosh/accounter-toolkit/pull/155)
  [`b830360`](https://github.com/gilgardosh/accounter-toolkit/commit/b83036050bae806fc6479c5f2410e98452bbab28)
  Thanks [@gilgardosh](https://github.com/gilgardosh)! - Schema minor updates: define updateExpense
  as mutation, workaround paymentTerms 0 value enum

### Patch Changes

- [#154](https://github.com/gilgardosh/accounter-toolkit/pull/154)
  [`4ef4b01`](https://github.com/gilgardosh/accounter-toolkit/commit/4ef4b01a5c455a0f00a4f42e0bca30805c75f13b)
  Thanks [@gilgardosh](https://github.com/gilgardosh)! - dependencies updates:
  - Updated dependency
    [`@graphql-mesh/cli@0.85.5` ↗︎](https://www.npmjs.com/package/@graphql-mesh/cli/v/0.85.5) (from
    `0.85.1`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/json-schema@0.94.8` ↗︎](https://www.npmjs.com/package/@graphql-mesh/json-schema/v/0.94.8)
    (from `0.94.6`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/transform-resolvers-composition@0.94.5` ↗︎](https://www.npmjs.com/package/@graphql-mesh/transform-resolvers-composition/v/0.94.5)
    (from `0.94.3`, in `dependencies`)

- [#159](https://github.com/gilgardosh/accounter-toolkit/pull/159)
  [`651b366`](https://github.com/gilgardosh/accounter-toolkit/commit/651b366adcc284d8459cbc7f91c90bbf9c51c44b)
  Thanks [@gilgardosh](https://github.com/gilgardosh)! - dependencies updates:
  - Updated dependency
    [`@graphql-mesh/cli@0.85.6-alpha-20230726100518-2fdb88ed0` ↗︎](https://www.npmjs.com/package/@graphql-mesh/cli/v/0.85.6)
    (from `0.85.5`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/json-schema@0.94.9-alpha-20230726100518-2fdb88ed0` ↗︎](https://www.npmjs.com/package/@graphql-mesh/json-schema/v/0.94.9)
    (from `0.94.8`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/transform-resolvers-composition@0.94.6-alpha-20230726100518-2fdb88ed0` ↗︎](https://www.npmjs.com/package/@graphql-mesh/transform-resolvers-composition/v/0.94.6)
    (from `0.94.5`, in `dependencies`)

- [#163](https://github.com/gilgardosh/accounter-toolkit/pull/163)
  [`b59d94f`](https://github.com/gilgardosh/accounter-toolkit/commit/b59d94fd07dc57063b0661d74da894954e0bc684)
  Thanks [@gilgardosh](https://github.com/gilgardosh)! - dependencies updates:
  - Updated dependency
    [`@graphql-mesh/cli@0.86.0` ↗︎](https://www.npmjs.com/package/@graphql-mesh/cli/v/0.86.0) (from
    `0.85.6-alpha-20230726100518-2fdb88ed0`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/json-schema@0.95.0` ↗︎](https://www.npmjs.com/package/@graphql-mesh/json-schema/v/0.95.0)
    (from `0.94.9-alpha-20230726100518-2fdb88ed0`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/transform-resolvers-composition@0.95.0` ↗︎](https://www.npmjs.com/package/@graphql-mesh/transform-resolvers-composition/v/0.95.0)
    (from `0.94.6-alpha-20230726100518-2fdb88ed0`, in `dependencies`)

- [#159](https://github.com/gilgardosh/accounter-toolkit/pull/159)
  [`651b366`](https://github.com/gilgardosh/accounter-toolkit/commit/651b366adcc284d8459cbc7f91c90bbf9c51c44b)
  Thanks [@gilgardosh](https://github.com/gilgardosh)! - Fix Mesh enums 0-value bug

## 0.4.0

### Minor Changes

- [#151](https://github.com/gilgardosh/accounter-toolkit/pull/151)
  [`5d90460`](https://github.com/gilgardosh/accounter-toolkit/commit/5d90460d610113c48d7461eea73a8e5e23e02edc)
  Thanks [@gilgardosh](https://github.com/gilgardosh)! - Introduce searchDocuments endpoint to SDK

### Patch Changes

- [#151](https://github.com/gilgardosh/accounter-toolkit/pull/151)
  [`5d90460`](https://github.com/gilgardosh/accounter-toolkit/commit/5d90460d610113c48d7461eea73a8e5e23e02edc)
  Thanks [@gilgardosh](https://github.com/gilgardosh)! - dependencies updates:
  - Updated dependency
    [`@graphql-mesh/cli@0.85.1` ↗︎](https://www.npmjs.com/package/@graphql-mesh/cli/v/0.85.1) (from
    `0.82.25`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/json-schema@0.94.6` ↗︎](https://www.npmjs.com/package/@graphql-mesh/json-schema/v/0.94.6)
    (from `0.37.18`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/transform-resolvers-composition@0.94.3` ↗︎](https://www.npmjs.com/package/@graphql-mesh/transform-resolvers-composition/v/0.94.3)
    (from `0.13.15`, in `dependencies`)
  - Updated dependency [`graphql@16.7.1` ↗︎](https://www.npmjs.com/package/graphql/v/16.7.1) (from
    `16.6.0`, in `dependencies`)

- [#151](https://github.com/gilgardosh/accounter-toolkit/pull/151)
  [`5d90460`](https://github.com/gilgardosh/accounter-toolkit/commit/5d90460d610113c48d7461eea73a8e5e23e02edc)
  Thanks [@gilgardosh](https://github.com/gilgardosh)! - Dependency upgrades

## 0.3.0

### Minor Changes

- [#113](https://github.com/gilgardosh/accounter-toolkit/pull/113)
  [`88871c9`](https://github.com/gilgardosh/accounter-toolkit/commit/88871c928457a136c3fcf255c78f216cc4f7d08d)
  Thanks [@gilgardosh](https://github.com/gilgardosh)! - Adjust to build as ES module. Enhance Mesh
  build configuration

### Patch Changes

- [#113](https://github.com/gilgardosh/accounter-toolkit/pull/113)
  [`88871c9`](https://github.com/gilgardosh/accounter-toolkit/commit/88871c928457a136c3fcf255c78f216cc4f7d08d)
  Thanks [@gilgardosh](https://github.com/gilgardosh)! - minor build enhancements

## 0.2.0

### Minor Changes

- [#100](https://github.com/gilgardosh/accounter-toolkit/pull/100)
  [`e5a62eb`](https://github.com/gilgardosh/accounter-toolkit/commit/e5a62eb08312845c88d0ac7c35e25795aab6f36f)
  Thanks [@ardatan](https://github.com/ardatan)! - ESM compatability fix

### Patch Changes

- [#114](https://github.com/gilgardosh/accounter-toolkit/pull/114)
  [`3faf888`](https://github.com/gilgardosh/accounter-toolkit/commit/3faf8888ef6921878c086490d6dd517e0d5230d3)
  Thanks [@gilgardosh](https://github.com/gilgardosh)! - dependencies updates:
  - Updated dependency
    [`@graphql-mesh/cli@0.82.25` ↗︎](https://www.npmjs.com/package/@graphql-mesh/cli/v/0.82.25)
    (from `0.80.1`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/json-schema@0.37.18` ↗︎](https://www.npmjs.com/package/@graphql-mesh/json-schema/v/0.37.18)
    (from `0.35.37`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/transform-resolvers-composition@0.13.15` ↗︎](https://www.npmjs.com/package/@graphql-mesh/transform-resolvers-composition/v/0.13.15)
    (from `0.12.110`, in `dependencies`)

- [#102](https://github.com/gilgardosh/accounter-toolkit/pull/102)
  [`ae5b4f8`](https://github.com/gilgardosh/accounter-toolkit/commit/ae5b4f81e1d78caa4b18d226f835130e753f80f0)
  Thanks [@gilgardosh](https://github.com/gilgardosh)! - ESLint fixes

- [#99](https://github.com/gilgardosh/accounter-toolkit/pull/99)
  [`e885781`](https://github.com/gilgardosh/accounter-toolkit/commit/e88578101745c3495127c084f6e616c834e8807a)
  Thanks [@gilgardosh](https://github.com/gilgardosh)! - Make Expense fields over draft response
  optional

## 0.1.0

### Minor Changes

- [#97](https://github.com/gilgardosh/accounter-toolkit/pull/97)
  [`685e751`](https://github.com/gilgardosh/accounter-toolkit/commit/685e751eabfc584ddf0d96c96ee1203a3a5f84b5)
  Thanks [@gilgardosh](https://github.com/gilgardosh)! - ESM compatibility

### Patch Changes

- [#97](https://github.com/gilgardosh/accounter-toolkit/pull/97)
  [`685e751`](https://github.com/gilgardosh/accounter-toolkit/commit/685e751eabfc584ddf0d96c96ee1203a3a5f84b5)
  Thanks [@gilgardosh](https://github.com/gilgardosh)! - dependencies updates:
  - Updated dependency
    [`@graphql-mesh/cli@0.80.1` ↗︎](https://www.npmjs.com/package/@graphql-mesh/cli/v/0.80.1) (from
    `0.79.3`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/json-schema@0.35.37` ↗︎](https://www.npmjs.com/package/@graphql-mesh/json-schema/v/0.35.37)
    (from `0.35.33`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/transform-resolvers-composition@0.12.110` ↗︎](https://www.npmjs.com/package/@graphql-mesh/transform-resolvers-composition/v/0.12.110)
    (from `0.12.108`, in `dependencies`)

## 0.0.2

### Patch Changes

- [#61](https://github.com/gilgardosh/accounter-toolkit/pull/61)
  [`ba890e5`](https://github.com/gilgardosh/accounter-toolkit/commit/ba890e535002ac793e6cc0b1dd992bb790af67d3)
  Thanks [@renovate](https://github.com/apps/renovate)! - dependencies updates:
  - Updated dependency
    [`@graphql-mesh/cli@0.78.12` ↗︎](https://www.npmjs.com/package/@graphql-mesh/cli/v/0.78.12)
    (from `0.78.10`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/json-schema@0.35.11` ↗︎](https://www.npmjs.com/package/@graphql-mesh/json-schema/v/0.35.11)
    (from `0.35.10`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/transform-resolvers-composition@0.12.89` ↗︎](https://www.npmjs.com/package/@graphql-mesh/transform-resolvers-composition/v/0.12.89)
    (from `0.12.88`, in `dependencies`)

- [#80](https://github.com/gilgardosh/accounter-toolkit/pull/80)
  [`d8590e4`](https://github.com/gilgardosh/accounter-toolkit/commit/d8590e473881e7bd33817d2ee2fdb67141599373)
  Thanks [@gilgardosh](https://github.com/gilgardosh)! - dependencies updates:
  - Updated dependency
    [`@graphql-mesh/cli@0.78.33` ↗︎](https://www.npmjs.com/package/@graphql-mesh/cli/v/0.78.33)
    (from `0.78.25`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/json-schema@0.35.25` ↗︎](https://www.npmjs.com/package/@graphql-mesh/json-schema/v/0.35.25)
    (from `0.35.19`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/transform-resolvers-composition@0.12.101` ↗︎](https://www.npmjs.com/package/@graphql-mesh/transform-resolvers-composition/v/0.12.101)
    (from `0.12.95`, in `dependencies`)

- [#89](https://github.com/gilgardosh/accounter-toolkit/pull/89)
  [`208d13f`](https://github.com/gilgardosh/accounter-toolkit/commit/208d13fe26273f6ef80bfbc1a62528e06c59cd68)
  Thanks [@gilgardosh](https://github.com/gilgardosh)! - dependencies updates:
  - Updated dependency
    [`@graphql-mesh/cli@0.79.3` ↗︎](https://www.npmjs.com/package/@graphql-mesh/cli/v/0.79.3) (from
    `0.78.33`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/json-schema@0.35.33` ↗︎](https://www.npmjs.com/package/@graphql-mesh/json-schema/v/0.35.33)
    (from `0.35.25`, in `dependencies`)
  - Updated dependency
    [`@graphql-mesh/transform-resolvers-composition@0.12.108` ↗︎](https://www.npmjs.com/package/@graphql-mesh/transform-resolvers-composition/v/0.12.108)
    (from `0.12.101`, in `dependencies`)

- [#90](https://github.com/gilgardosh/accounter-toolkit/pull/90)
  [`800deaf`](https://github.com/gilgardosh/accounter-toolkit/commit/800deaf0c7ebc5d2450510791eda39f89c7b4df8)
  Thanks [@gilgardosh](https://github.com/gilgardosh)! - Minor schema fixes

- [#64](https://github.com/gilgardosh/accounter-toolkit/pull/64)
  [`aa8acb3`](https://github.com/gilgardosh/accounter-toolkit/commit/aa8acb39ed2d21336fcfe45b1b229975ee9d722b)
  Thanks [@gilgardosh](https://github.com/gilgardosh)! - Internal structure minor enhancement

## 0.0.1

### Patch Changes

- [`f2916bc`](https://github.com/gilgardosh/accounter-toolkit/commit/f2916bc3a20aa6028845dd068506b62e319d9546)
  Thanks [@gilgardosh](https://github.com/gilgardosh)! - First publish
