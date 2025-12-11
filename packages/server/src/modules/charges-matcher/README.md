# Charges Matcher Module

This module implements a transaction-document matching system for the Accounter fullstack
application. It provides both manual matching suggestions and automatic matching capabilities for
unmatched charges.

## Overview

The charges-matcher module uses a confidence-based scoring algorithm to identify potential matches
between:

- Charges with only transactions (transaction charges)
- Charges with only accounting documents (document charges)

The system provides two main operations:

1. **Single-Match Query**: Find potential matches for a specific unmatched charge
2. **Auto-Match Mutation**: Automatically match all unmatched charges above a confidence threshold

## Module Structure

```
charges-matcher/
├── index.ts                          # Module exports and GraphQL module definition
├── types.ts                          # TypeScript type definitions
├── typeDefs/
│   └── charges-matcher.graphql.ts    # GraphQL schema definitions
├── resolvers/                        # GraphQL resolvers (to be implemented)
├── providers/                        # Business logic providers (to be implemented)
├── helpers/                          # Helper functions (to be implemented)
└── __tests__/
    ├── test-helpers.ts               # Test utilities and mock factories
    └── test-infrastructure.spec.ts   # Infrastructure tests
```

## Type Definitions

### Shared Types

The module reuses types from existing modules:

- `Transaction`: From `@modules/transactions/types.js` (`IGetTransactionsByIdsResult`)
- `Document`: From `@modules/documents/types.js` (`IGetAllDocumentsResult`)
- `Currency`: Re-exported from documents module
- `DocumentType`: Re-exported from documents module

### GraphQL Response Types

- `ChargeMatch`: Single match with charge ID and confidence score
- `ChargeMatchesResult`: Array of matches (up to 5)
- `MergedCharge`: Record of a merged charge with confidence score
- `AutoMatchChargesResult`: Summary of auto-match operation

### Internal Types

- `AggregatedTransaction`: Aggregated data from multiple transactions
- `AggregatedDocument`: Aggregated data from multiple documents
- `ConfidenceScores`: Individual confidence scores for each matching factor
- `ConfidenceResult`: Complete confidence calculation result
- `ChargeType`: Enum for charge classification (TRANSACTION_ONLY, DOCUMENT_ONLY, MATCHED)
- `ChargeWithData`: Charge with its associated transactions and documents
- `MatchCandidate`: Candidate charge with aggregated data

## Database Schema

The module works with these existing tables:

### charges

- `id`: UUID (primary key)
- `owner_id`: UUID (references businesses)
- Other fields not directly used in matching logic

### transactions

- `id`: UUID
- `charge_id`: UUID (foreign key to charges)
- `amount`: numeric (PostgreSQL numeric type)
- `currency`: enum
- `business_id`: UUID (nullable)
- `event_date`: DATE
- `debit_date`: DATE (nullable)
- `debit_timestamp`: TIMESTAMP (nullable)
- `is_fee`: boolean
- `source_description`: text (nullable)

### documents

- `id`: UUID
- `charge_id`: UUID (foreign key to charges)
- `total_amount`: double precision (nullable)
- `currency_code`: enum (nullable)
- `creditor_id`: UUID (nullable)
- `debtor_id`: UUID (nullable)
- `date`: DATE (nullable)
- `type`: enum (INVOICE, CREDIT_INVOICE, RECEIPT, etc.)
- `serial_number`: text (nullable)

## Testing Infrastructure

### Mock Factories

Test helpers provide factory functions for creating mock data:

```typescript
import {
  createMockTransaction,
  createMockDocument,
  createMockAggregatedTransaction,
  createMockAggregatedDocument
} from './__tests__/test-helpers.js'

// Create a transaction with defaults
const transaction = createMockTransaction()

// Create with overrides
const customTransaction = createMockTransaction({
  amount: '250.00',
  currency: 'USD'
})
```

### Helper Functions

```typescript
import {
  calculateExpectedConfidence,
  roundConfidence,
  isValidConfidenceScore,
  daysDifference,
  isWithinDays
} from './__tests__/test-helpers.js'

// Calculate weighted confidence
const scores = { amount: 0.9, currency: 1.0, business: 0.5, date: 0.8 }
const confidence = calculateExpectedConfidence(scores) // 0.79

// Round to 2 decimal places
const rounded = roundConfidence(0.956789) // 0.96

// Validate score range
isValidConfidenceScore(0.95) // true
isValidConfidenceScore(1.5) // false
```

## Key Concepts

### Unmatched Charge

A charge is considered unmatched if it has:

- ≥1 transactions AND 0 accounting documents, OR
- 0 transactions AND ≥1 accounting documents

**Note**: PROFORMA, OTHER, and UNPROCESSED document types don't count toward matched/unmatched
status.

### Matched Charge

A charge is considered matched if it has:

- ≥1 transactions AND ≥1 accounting documents

### Accounting Documents

Documents with types: INVOICE, CREDIT_INVOICE, RECEIPT, INVOICE_RECEIPT

### Confidence Score

A value between 0.00 and 1.00 calculated using:

```
confidence = (amount × 0.4) + (currency × 0.2) + (business × 0.3) + (date × 0.1)
```

Where each component score is between 0.0 and 1.0.

### Auto-Match Threshold

Charges are automatically matched only when:

- Exactly one match has confidence ≥ 0.95
- Multiple matches ≥ 0.95 result in the charge being skipped

## GraphQL API

### Query: findChargeMatches

Find potential matches for a single unmatched charge.

```graphql
query findChargeMatches($chargeId: UUID!) {
  findChargeMatches(chargeId: $chargeId) {
    matches {
      chargeId
      confidenceScore
    }
  }
}
```

**Returns**: Up to 5 matches, ordered by confidence score (highest first)

### Mutation: autoMatchCharges

Automatically match all unmatched charges above the confidence threshold.

```graphql
mutation autoMatchCharges {
  autoMatchCharges {
    totalMatches
    mergedCharges {
      chargeId
      confidenceScore
    }
    skippedCharges
    errors
  }
}
```

**Returns**: Summary of matches made, skipped charges, and any errors

## Implementation Roadmap

### Step 1: Module Setup (✓ Complete)

- [x] Create module structure
- [x] Define TypeScript types
- [x] Create GraphQL schema
- [x] Set up test infrastructure

### Step 2: Core Logic (To Do)

- [ ] Implement charge classification
- [ ] Implement multi-item aggregation
- [ ] Implement confidence calculation helpers
- [ ] Implement candidate filtering

### Step 3: GraphQL Integration (To Do)

- [ ] Implement findChargeMatches resolver
- [ ] Implement autoMatchCharges resolver
- [ ] Implement providers for data access
- [ ] Add integration tests

### Step 4: UI Integration (To Do)

- [ ] Create ChargeMatchingModal component
- [ ] Create AutoMatchButton component
- [ ] Add to charge detail screens
- [ ] Add to charges list view

## Dependencies

This module depends on:

- `@modules/charges`: For charge data access and merge operations
- `@modules/transactions`: For transaction data access
- `@modules/documents`: For document data access
- `@modules/common`: For error handling and common utilities
- `@modules/financial-entities`: For business name resolution

## Running Tests

```bash
# Run all tests
yarn test

# Run specific test file
yarn test packages/server/src/modules/charges-matcher/__tests__/test-infrastructure.spec.ts

# Run tests in watch mode
yarn test --watch
```

## License

See the main project LICENSE file.
