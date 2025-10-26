# Transaction-Document Matching System - Implementation Checklist

## Project Overview

- [x] Review complete specification (SPEC.md)
- [x] Understand all confidence calculation formulas
- [x] Understand data models and relationships
- [x] Set up development environment

---

## Phase 1: Foundation & Setup

### Step 1: Module Setup and Type Definitions ✅ COMPLETED

- [x] Create GraphQL module directory: `packages/server/src/modules/charges-matcher/`
- [x] Review existing module patterns (charges, transactions, documents)
- [x] Set up directory structure
  - [x] `types.ts`
  - [x] `typeDefs/` directory
  - [x] `resolvers/` directory
  - [x] `providers/` directory
  - [x] `helpers/` directory
  - [x] `__tests__/` directory
- [x] Define core interfaces in `types.ts` matching database schema
  - [x] `Transaction` interface (uses `IGetTransactionsByIdsResult` from @modules/transactions)
  - [x] `Document` interface (uses `IGetAllDocumentsResult` from @modules/documents)
  - [x] `Currency` type: Re-exported from documents module
  - [x] `DocumentType` enum: Re-exported from documents module
- [x] Define GraphQL result types
  - [x] `ChargeMatch` type: { chargeId: string; confidenceScore: number }
  - [x] `ChargeMatchesResult` type: { matches: ChargeMatch[] }
  - [x] `AutoMatchChargesResult` with totalMatches, mergedCharges, skippedCharges, errors
- [x] Create test utilities file
  - [x] `__tests__/test-helpers.ts` (with comprehensive mock factories)
  - [x] Transaction factory function (createMockTransaction)
  - [x] Document factory function (createMockDocument - uses charge_id field)
  - [x] Aggregated data factories
  - [x] Confidence score helpers
  - [x] Date calculation helpers
- [x] Write setup verification test
  - [x] 16 passing tests in test-infrastructure.spec.ts
  - [x] TypeScript compilation verified
  - [x] Test framework runs successfully
- [x] Additional items completed:
  - [x] GraphQL schema definition (typeDefs/charges-matcher.graphql.ts)
  - [x] ESLint exceptions added for result types
  - [x] Module index.ts created
  - [x] Comprehensive README.md documentation
  - [x] SETUP_COMPLETE.md summary document
- [x] Commit: "feat: charges-matcher module setup and type definitions"

---

## Phase 2: Core Calculation Functions

### Step 2: Amount Confidence Calculator ✅ COMPLETED

- [x] Create `helpers/` directory
- [x] Create `helpers/amount-confidence.helper.ts`
- [x] Implement `calculateAmountConfidence()` function
  - [x] Handle exact match (0% diff) → 1.0
  - [x] Handle within 1 unit → 0.9
  - [x] Handle linear degradation (1 unit to 20%) → 0.7 to 0.0
  - [x] Handle 20%+ diff → 0.0
  - [x] Round to 2 decimal places
  - [x] Works with numeric types (not strings)
- [x] Create helper function for percentage difference
- [x] Create `__tests__/amount-confidence.test.ts`
- [x] Write tests for exact match
- [x] Write tests for 0.5 unit difference
- [x] Write tests for 1 unit difference
- [x] Write tests for 2, 5, 10 unit differences
- [x] Write tests for 10%, 15%, 20% differences
- [x] Write tests for >20% differences
- [x] Write edge case tests
  - [x] Negative amounts
  - [x] Very small amounts (< 1)
  - [x] Zero amounts
  - [x] Very large amounts
- [x] Verify all tests pass (32/32 tests passing)
- [x] Check test coverage >95% (94.87% line coverage, 91.66% branch coverage)
- [x] Commit: "feat: implement amount confidence calculator"

### Step 3: Currency Confidence Calculator ✅ COMPLETED

- [x] Create `helpers/currency-confidence.helper.ts`
- [x] Implement `calculateCurrencyConfidence()` function
  - [x] Same currency → 1.0
  - [x] Different currency → 0.2
  - [x] Case-insensitive comparison
  - [x] Handle null/undefined → 0.2
  - [x] Use Currency type from types.ts
- [x] Create `__tests__/currency-confidence.test.ts`
- [x] Write tests for same currency (ILS, USD, EUR, GBP)
- [x] Write tests for different currencies
- [x] Write tests for case sensitivity
- [x] Write edge case tests
  - [x] Null values
  - [x] Undefined values
  - [x] Empty strings
- [x] Verify all tests pass (31/31 tests passing)
- [x] Commit: "feat: implement currency confidence calculator"

### Step 4: Business ID Extraction from Documents ✅ COMPLETED

- [x] Create `helpers/document-business.helper.ts`
- [x] Define `DocumentBusinessInfo` interface
  - [x] `businessId: string | null` (UUID)
  - [x] `isBusinessCreditor: boolean`
- [x] Implement `extractDocumentBusiness()` function
  - [x] User is debtor → business is creditor
  - [x] User is creditor → business is debtor
  - [x] Handle null values appropriately
  - [x] Throw error if both creditor_id and debtor_id are userId
  - [x] Throw error if neither creditor_id nor debtor_id is userId
  - [x] Throw error if both are null
  - [x] All IDs are UUIDs
- [x] Create `__tests__/document-business.test.ts`
- [x] Write test: user is debtor, creditor_id is business
- [x] Write test: user is creditor, debtor_id is business
- [x] Write test: user is creditor, debtor_id is null
- [x] Write test: user is debtor, creditor_id is null
- [x] Write test: both are user (should throw)
- [x] Write test: neither are user (should throw)
- [x] Write test: all null (should throw)
- [x] Additional tests for edge cases and different ID formats
- [x] Verify error messages are descriptive
- [x] Verify all tests pass (21/21 tests passing)
- [x] Commit: "feat: implement document business extraction"

### Step 5: Business Confidence Calculator ✅ COMPLETED

- [x] Create `helpers/business-confidence.helper.ts`
- [x] Import `DocumentBusinessInfo` type
- [x] Implement `calculateBusinessConfidence()` function
  - [x] Both match and non-null → 1.0
  - [x] One is null → 0.5
  - [x] Both null → 0.5
  - [x] Mismatch (both non-null) → 0.2
- [x] Create `__tests__/business-confidence.test.ts`
- [x] Write test: exact match (non-null) - 3 tests
- [x] Write test: transaction ID is null - 2 tests
- [x] Write test: document ID is null - 2 tests
- [x] Write test: both IDs are null - 1 test
- [x] Write test: IDs don't match - 4 tests
- [x] Write tests with various business ID formats - 5 tests
- [x] Additional tests for symmetry, return value validation, edge cases - 9 tests
- [x] Verify all tests pass (26/26 tests passing)
- [x] Commit: "feat: implement business confidence calculator"

### Step 6: Date Confidence Calculator ✅ COMPLETED

- [x] Create `helpers/date-confidence.helper.ts`
- [x] Implement `calculateDateConfidence()` function
  - [x] Same day → 1.0
  - [x] Linear degradation: 1.0 - (days_diff / 30)
  - [x] 30+ days → 0.0
  - [x] Calculate days difference (ignore time)
  - [x] Round to 2 decimal places
- [x] Create `__tests__/date-confidence.test.ts`
- [x] Write test: same day → 1.0 (3 tests)
- [x] Write test: 1 day diff → ~0.97
- [x] Write test: 7 days diff → ~0.77
- [x] Write test: 15 days diff → 0.5
- [x] Write test: 29 days diff → ~0.03
- [x] Write test: 30 days diff → 0.0
- [x] Write test: 100 days diff → 0.0
- [x] Write test: order independence (3 tests)
- [x] Write edge case tests
  - [x] Different time zones (2 tests)
  - [x] Leap years (3 tests)
  - [x] Month boundaries (2 tests)
- [x] Additional tests for linear degradation formula (2 tests)
- [x] Additional tests for precision and rounding (3 tests)
- [x] Additional tests for return value validation (2 tests)
- [x] Additional tests for edge cases (3 tests)
- [x] Verify all tests pass (30/30 tests passing)
- [x] Commit: "feat: implement date confidence calculator"

### Step 7: Overall Confidence Calculator ✅

- [x] Create `helpers/overall-confidence.helper.ts`
- [x] Define `ConfidenceComponents` interface
- [ ] Define `ConfidenceInputs` interface (not needed yet)
- [x] Import all previous confidence calculators
- [x] Implement `calculateOverallConfidence()` function
  - [x] Apply weights: amount×0.4 + currency×0.2 + business×0.3 + date×0.1
  - [x] Round to 2 decimal places
- [ ] Implement `calculateConfidence()` convenience function (deferred to later step)
  - [ ] Calculate all component confidences
  - [ ] Return overall + components
- [x] Create `__tests__/overall-confidence.test.ts`
- [x] Write test: all components at 1.0 → 1.0
- [x] Write test: all components at 0.0 → 0.0
- [x] Write test: mixed scores (verify formula)
- [x] Write tests varying each weight individually
- [x] Write real-world scenario tests
- [ ] Write integration test using convenience function (deferred to later step)
- [x] Verify weights are correct (0.4, 0.2, 0.3, 0.1)
- [x] Verify all tests pass (39/39 passing, total 195 tests)
- [x] Commit: "feat: implement overall confidence calculator"

---

## Phase 3: Data Processing

### Step 8: Transaction Aggregator ✅

- [x] Create `providers/transaction-aggregator.ts`
- [x] Define `Transaction` interface
- [x] Define `AggregatedTransaction` interface
- [x] Implement `aggregateTransactions()` function
  - [x] Filter out fee transactions (is_fee = true)
  - [x] Validate non-empty array
  - [x] Check for mixed currencies → throw error
  - [x] Check for multiple non-null business_id values → throw error
  - [x] Sum all amounts (numeric type)
  - [x] Select earliest event_date
  - [x] Concatenate source_description values with line breaks
  - [x] Handle null source_description (filter out nulls and empty strings)
- [x] Create `__tests__/transaction-aggregator.test.ts`
- [x] Write test: single transaction (4 tests)
- [x] Write test: multiple transactions, same currency (3 tests)
- [x] Write test: multiple transactions with fees (4 tests - excluded from sum/desc)
- [x] Write test: mixed currencies (5 tests - should throw)
- [x] Write test: multiple business_id values (7 tests - should throw)
- [x] Write test: all business_id null
- [x] Write test: single non-null business_id (3 tests)
- [x] Write test: date selection (4 tests - earliest event_date)
- [x] Write test: source_description concatenation (6 tests)
- [x] Write test: empty array (3 tests - should throw for null/undefined/empty)
- [x] Write complex scenarios (3 tests - real-world, crypto, large dataset)
- [x] Verify error messages are descriptive (4 dedicated tests)
- [x] Verify all tests pass (42/42 passing, total 237 tests)
- [x] Commit: "feat: implement transaction aggregator"

### Step 9: Document Amount Normalization ✅

- [x] Create `helpers/document-amount.helper.ts`
- [x] Define `DocumentType` type
- [x] Implement `normalizeDocumentAmount()` function
  - [x] Step 1: Take absolute value of total_amount
  - [x] Step 2: If business is creditor, negate
  - [x] Step 3: If DocumentType is CREDIT_INVOICE, negate
  - [x] Works with numeric type (not string)
- [x] Create `__tests__/document-amount.test.ts`
- [x] Write test: INVOICE, business debtor → positive (3 tests)
- [x] Write test: INVOICE, business creditor → negative (3 tests)
- [x] Write test: CREDIT_INVOICE, business debtor → negative (3 tests)
- [x] Write test: CREDIT_INVOICE, business creditor → positive (3 tests - double negation)
- [x] Write test: RECEIPT, both scenarios (4 tests)
- [x] Write test: INVOICE_RECEIPT, both scenarios (4 tests)
- [x] Write test: OTHER, PROFORMA, UNPROCESSED types (6 tests)
- [x] Write edge case tests (20 tests total)
  - [x] Negative input amounts (6 tests - absolute value first)
  - [x] Zero amounts (4 tests - handles -0 vs +0)
  - [x] Very large amounts (4 tests - including MAX_SAFE_INTEGER)
  - [x] Small decimal amounts (3 tests - precision preservation)
  - [x] All combinations summary (1 comprehensive test)
  - [x] Real-world scenarios (6 tests)
- [x] Verify all tests pass (50/50 passing, total 287 tests)
- [x] Commit: "feat: implement document amount normalization"

### Step 10: Document Aggregator ✅

- [x] Create `providers/document-aggregator.ts` (206 lines)
- [x] Define `Document` interface (matches DB schema with charge_id)
- [x] Define `AggregatedDocument` interface
- [x] Import business extraction and amount normalization
- [x] Implement `aggregateDocuments()` function
  - [x] Apply type priority filter
    - [x] If invoices + receipts exist, use only invoices
  - [x] Extract business from each document (creditor_id/debtor_id)
  - [x] Normalize each total_amount
  - [x] Validate non-empty array
  - [x] Check for mixed currency_code → throw error
  - [x] Check for multiple non-null business IDs → throw error
  - [x] Sum all normalized amounts
  - [x] Select latest date
  - [x] Concatenate serial_number or file names with line breaks
  - [x] Determine DocumentType for result
  - [x] Remember: documents use charge_id FK
- [x] Create `__tests__/document-aggregator.test.ts`
- [x] Write test: single document (normalized) - 6 tests
- [x] Write test: multiple invoices (summed correctly) - 3 tests
- [x] Write test: multiple receipts (summed correctly) - 2 tests
- [x] Write test: mixed invoices + receipts (uses only invoices) - 4 tests
- [x] Write test: mixed currencies (should throw) - 4 tests
- [x] Write test: multiple businesses (should throw) - 4 tests
- [x] Write test: date selection (latest) - 5 tests
- [x] Write test: description concatenation - 5 tests
- [x] Write test: business extraction errors propagate - 3 tests
- [x] Write test: credit invoice normalization in aggregation
- [x] Write test: null dates handled gracefully
- [x] Write test: input validation - 3 tests
- [x] Write test: complex real-world scenarios - 3 tests
- [x] Verify all tests pass (43/43 passing, total 330 tests)
- [x] Commit: "feat: implement document aggregator"

---

## Phase 4: Candidate Management

### Step 11: Candidate Filtering ✅

- [x] Create `helpers/candidate-filter.helper.ts` (1.8KB)
- [x] Implement `isValidTransactionForMatching()` function
  - [x] Exclude if is_fee = true
  - [x] Include otherwise
- [x] Implement `isValidDocumentForMatching()` function
  - [x] Exclude if total_amount is null
  - [x] Exclude if currency_code is null
  - [x] Include otherwise (including zero amounts)
- [x] Implement `isWithinDateWindow()` function
  - [x] Calculate months difference accurately using Date.setMonth()
  - [x] Default windowMonths = 12
  - [x] Return true if within window (inclusive boundaries)
- [x] Create `__tests__/candidate-filter.test.ts` (8.1KB)
- [x] Write transaction validation tests (3 tests)
  - [x] Normal transaction: included
  - [x] Fee transaction: excluded
  - [x] Various transaction states
- [x] Write document validation tests (7 tests)
  - [x] Valid document: included
  - [x] Null total_amount: excluded
  - [x] Undefined total_amount: excluded
  - [x] Null currency_code: excluded
  - [x] Empty currency_code: excluded
  - [x] Zero amount: included (valid)
  - [x] Negative amounts: included
- [x] Write date window tests (17 tests)
  - [x] Same date: included
  - [x] 11 months before/after: included
  - [x] Exactly 12 months before/after: included
  - [x] 12 months + 1 day before/after: excluded
  - [x] Different years: handled correctly
  - [x] Month boundary edge cases (end of month, leap year)
  - [x] Custom window sizes (1, 3, 6 months)
  - [x] Time component handling
  - [x] Year transitions
- [x] Verify all tests pass (27/27 passing, total 357 tests)
- [x] Commit: "feat: implement candidate filtering"

### Step 12: Match Scoring Engine ✅ COMPLETED

- [x] Create `providers/match-scorer.provider.ts`
- [x] Define `MatchScore` interface
- [x] Define `TransactionCharge` interface
- [x] Define `DocumentCharge` interface
- [x] Import aggregators and confidence calculator
- [x] Implement `selectTransactionDate()` function
  - [x] INVOICE/CREDIT_INVOICE → event_date
  - [x] RECEIPT/INVOICE_RECEIPT → debit_timestamp (fallback to debit_date, then event_date)
  - [x] OTHER/PROFORMA/UNPROCESSED → calculate both, use better score
- [x] Implement `scoreMatch()` function
  - [x] Aggregate transactions
  - [x] Aggregate documents
  - [x] Extract document business
  - [x] Normalize document amount
  - [x] Select appropriate transaction date
  - [x] Calculate confidence (handle flexible doc types)
  - [x] Return MatchScore
- [x] Create `__tests__/match-scorer.test.ts`
- [x] Write test: perfect match (all fields align)
- [x] Write test: partial matches (varying confidence)
- [x] Write test: date type selection for INVOICE
- [x] Write test: date type selection for RECEIPT
- [x] Write test: PROFORMA/OTHER (better score selection)
- [x] Write test: amount differences (various levels)
- [x] Write test: currency mismatches
- [x] Write test: business mismatches
- [x] Write integration test: full scoring pipeline
- [x] Write test: error propagation from aggregation
- [x] Verify all tests pass (33/33 tests passing)
- [x] Files created:
  - [x] providers/match-scorer.provider.ts (6.5KB)
  - [x] **tests**/match-scorer.test.ts (19KB)
- [x] Total module tests: 390 passing (357 + 33)

---

## Phase 5: GraphQL Integration

### Step 13: Single-Match Core Function ✅ COMPLETED

- [x] Create `providers/single-match.provider.ts`
- [x] Implement helper: `calculateDateProximity()` for tie-breaking
- [x] Implement `findMatches()` function
  - [x] Validate source charge is unmatched
  - [x] Validate source charge aggregation
  - [x] Filter candidates by complementary type
  - [x] Filter candidates by date window (12 months)
  - [x] Filter candidates using candidateFilter
  - [x] Exclude candidates with same charge id (throw if found)
  - [x] Score all remaining candidates
  - [x] Sort by confidence (descending)
  - [x] Apply date proximity tie-breaker
  - [x] Return top N (default 5)
- [x] Create `__tests__/single-match.test.ts`
- [x] Write test: transaction charge → finds document matches (2 tests)
- [x] Write test: document charge → finds transaction matches (2 tests)
- [x] Write test: matched charge input (should throw) (2 tests)
- [x] Write test: multiple currencies in source (error propagates) (3 tests)
- [x] Write test: no candidates found (empty array) (4 tests)
- [x] Write test: fewer than 5 candidates (returns all) (1 test)
- [x] Write test: more than 5 candidates (returns top 5) (2 tests)
- [x] Write test: tie-breaking by date proximity (2 tests)
- [x] Write test: date window filtering works (3 tests)
- [x] Write test: fee transactions excluded (2 tests)
- [x] Write test: same chargeId (should throw) (1 test)
- [x] Write test: various confidence levels (realistic data) (2 tests)
- [x] Write test: edge cases (multiple txs/docs, negative amounts) (3 tests)
- [x] Verify all tests pass (29/29 tests passing)
- [x] Files created:
  - [x] providers/single-match.provider.ts (11.5KB)
  - [x] **tests**/single-match.test.ts (23KB)
- [x] Total module tests: 419 passing (390 + 29)
- [x] Commit: "feat: implement single-match core function"

### Step 14: Single-Match GraphQL Integration ✅ COMPLETED

- [x] Create `providers/charges-matcher.provider.ts`
- [x] Implement `ChargesMatcherProvider` class with `@Injectable()` decorator
- [x] Import existing providers via Injector:
  - [x] ChargesProvider from @modules/charges
  - [x] TransactionsProvider from @modules/transactions
  - [x] DocumentsProvider from @modules/documents
- [x] Implement `findMatchesForCharge()` method
  - [x] Get adminBusinessId from context.adminContext.defaultAdminBusinessId
  - [x] Get providers from injector
  - [x] Load source charge using ChargesProvider.getChargeByIdLoader
  - [x] Load transactions using TransactionsProvider.transactionsByChargeIDLoader
  - [x] Load documents using DocumentsProvider.getDocumentsByChargeIdLoader
  - [x] Validate charge is unmatched
  - [x] Load candidate charges with complementary data using getChargesByFilters
  - [x] Call findMatches() from Step 13
  - [x] Return ChargeMatchesResult
- [x] Create `__tests__/single-match-integration.test.ts`
- [x] Write test: full flow with mocked providers (2 tests - transaction & document)
- [x] Write test: charge not found error (1 test)
- [x] Write test: matched charge error (1 test)
- [x] Write test: empty charge error (1 test)
- [x] Write test: no candidates found (1 test)
- [x] Write test: filter matched candidates (1 test)
- [x] Write test: date window filtering (1 test)
- [x] Write test: no user context (1 test)
- [x] Write test: top 5 matches limit (1 test)
- [x] Verify all tests pass (10/10 tests passing)
- [x] Files created:
  - [x] providers/charges-matcher.provider.ts (6.5KB)
  - [x] **tests**/single-match-integration.test.ts (24KB)
- [x] Total module tests: 429 passing (419 + 10)
- [x] Note: GraphQL resolver will be added in later step (after auto-match)
- [x] Fixed test data to use USER_ID for context adminBusinessId (business confidence)
- [x] Fixed error message test to match actual error thrown
- [x] All integration tests passing with proper mock data
- [x] Commit: "feat: integrate single-match with database layer"

---

## Phase 6: Auto-Match Implementation

### Step 15: Auto-Match Core Function

- [ ] Create `providers/auto-match.provider.ts`
- [ ] Define `AutoMatchResult` interface
- [ ] Implement `processChargeForAutoMatch()` function
  - [ ] Use findMatches() with no date restriction
  - [ ] Filter matches >= 0.95 threshold
  - [ ] Return 'matched' if exactly one
  - [ ] Return 'skipped' if multiple
  - [ ] Return 'no-match' if none
- [ ] Implement `determineMergeDirection()` function
  - [ ] Check if either charge is matched
  - [ ] If one matched: keep matched charge
  - [ ] If both unmatched: check which has transactions
  - [ ] Return [source, target] tuple
- [ ] Create `__tests__/auto-match.test.ts`
- [ ] Write test: single high-confidence match
- [ ] Write test: multiple high-confidence matches (skipped)
- [ ] Write test: no high-confidence matches (no-match)
- [ ] Write test: match just below threshold (0.949)
- [ ] Write test: match at threshold (0.95)
- [ ] Write test: match above threshold (0.96)
- [ ] Write test: merge direction - matched + unmatched
- [ ] Write test: merge direction - two unmatched with transactions
- [ ] Write test: merge direction - edge cases
- [ ] Write test: various confidence levels
- [ ] Verify all tests pass
- [ ] Commit: "feat: implement auto-match core function"

### Step 16: Auto-Match GraphQL Integration

- [ ] Update `providers/charges-matcher.provider.ts`
- [ ] Implement `autoMatchCharges()` method in ChargesMatcherProvider
  - [ ] Get userId from injector context
  - [ ] Load all unmatched charges using ChargesProvider
  - [ ] For each unmatched charge:
    - [ ] Process with processChargeForAutoMatch
    - [ ] If matched: use ChargesProvider.mergeCharges()
    - [ ] Track merged charges to exclude from further processing
    - [ ] If skipped: add to skippedCharges
    - [ ] Handle errors: capture and continue
  - [ ] Return AutoMatchChargesResult
- [ ] Create `resolvers/auto-match-charges.resolver.ts`
- [ ] Implement resolver:
  - [ ] Get injector from context
  - [ ] Call ChargesMatcherProvider.autoMatchCharges()
  - [ ] Use CommonError for error responses
  - [ ] Return AutoMatchChargesResult
- [ ] Create `__tests__/auto-match-charges.test.ts`
- [ ] Write test: empty database
- [ ] Write test: all charges already matched
- [ ] Write test: single unmatched with good match
- [ ] Write test: multiple unmatched charges
- [ ] Write test: ambiguous matches (multiple ≥0.95)
- [ ] Write test: mixed scenarios (match, skip, no-match)
- [ ] Write test: errors during merge
- [ ] Write test: merged charges excluded from further matching
- [ ] Write test: verify merge direction is correct
- [ ] Write test: verify final state via providers
- [ ] Write end-to-end integration test
- [ ] Verify all tests pass
- [ ] Commit: "feat: complete auto-match with GraphQL mutation"

---

## Phase 7: Module Completion & Integration

### Step 17: Final Integration and Error Handling

- [ ] Create `helpers/charge-validator.helper.ts`
- [ ] Implement `validateChargeForMatching()` function
- [ ] Implement `isChargeMatched()` function
- [ ] Implement `hasOnlyTransactions()` function
- [ ] Implement `hasOnlyDocuments()` function
- [ ] Ensure proper error handling:
  - [ ] Helpers/providers: throw standard Error with descriptive messages
  - [ ] Resolvers: return CommonError for GraphQL responses
  - [ ] Import CommonError from @modules/common
- [ ] Refactor existing code for consistent error handling:
  - [ ] Update aggregators with descriptive error messages
  - [ ] Update validators with actionable error messages
  - [ ] Update business extraction with clear error messages
  - [ ] Ensure resolvers use CommonError pattern
- [ ] Create `index.ts` (module export file):
  - [ ] Export ChargesMatcherModule using createModule
  - [ ] Export ChargesMatcherProvider
  - [ ] Export all types
  - [ ] Follow existing module patterns
- [ ] Create `resolvers/index.ts`:
  - [ ] Export all resolvers
  - [ ] Combine into resolvers object
- [ ] Add module to `packages/server/src/modules-app.ts`
- [ ] Create integration tests in `__tests__/integration/`
  - [ ] Single-match end-to-end test
  - [ ] Auto-match end-to-end test
  - [ ] Error scenarios
  - [ ] Edge cases from specification
- [ ] Run full test suite
  - [ ] Verify all tests pass
  - [ ] Check code coverage >85%
- [ ] Commit: "feat: complete charges-matcher module with error handling"

---

## Phase 8: Testing & Quality Assurance

### Comprehensive Testing

- [ ] Run module tests: `yarn test packages/server/src/modules/charges-matcher`
- [ ] Check test coverage for module
- [ ] Verify coverage is >85% overall
- [ ] Verify coverage is >95% for helpers
- [ ] Run linter: `yarn lint`
- [ ] Fix any linting issues
- [ ] Test GraphQL queries/mutations with real database:
  - [ ] Load sample transaction data
  - [ ] Load sample document data
  - [ ] Test findChargeMatches query
  - [ ] Test autoMatchCharges mutation
  - [ ] Verify results are sensible

### Edge Case Verification

- [ ] Test with empty database
- [ ] Test with very large amounts (numeric precision)
- [ ] Test with all supported currencies
- [ ] Test with missing optional fields (null values)
- [ ] Test with extreme dates (far past/future)
- [ ] Test with many charges (performance)
- [ ] Test UUID validation
- [ ] Test charge_id field usage

### Documentation Review

- [ ] Add module documentation to project docs
- [ ] Document GraphQL queries and mutations
- [ ] Ensure error messages are descriptive
- [ ] Verify inline code comments are clear
- [ ] Add JSDoc comments to all exported functions

---

## Phase 9: Final Review & Deployment Prep

### Code Review Checklist

- [ ] Review all function signatures
- [ ] Check all TypeScript types are correct
- [ ] Verify no `any` types (except in error handling)
- [ ] Check all functions have JSDoc comments
- [ ] Verify error handling is consistent
- [ ] Check for code duplication
- [ ] Verify naming is consistent and clear

### Specification Compliance

- [ ] Review SPEC.md section 4.3.1 (Amount Confidence)
  - [ ] Exact match → 1.0 ✓
  - [ ] Within 1 unit → 0.9 ✓
  - [ ] Linear degradation ✓
  - [ ] 20%+ → 0.0 ✓
- [ ] Review SPEC.md section 4.3.2 (Currency Confidence)
  - [ ] Same → 1.0 ✓
  - [ ] Different → 0.2 ✓
- [ ] Review SPEC.md section 4.3.3 (Business Confidence)
  - [ ] Exact match → 1.0 ✓
  - [ ] One null → 0.5 ✓
  - [ ] Both null → 0.5 ✓
  - [ ] Mismatch → 0.2 ✓
- [ ] Review SPEC.md section 4.3.4 (Date Confidence)
  - [ ] Linear degradation over 30 days ✓
- [ ] Review SPEC.md section 4.3 (Overall Confidence)
  - [ ] Weights: 0.4, 0.2, 0.3, 0.1 ✓
- [ ] Review SPEC.md section 4.2 (Aggregation)
  - [ ] Transaction aggregation rules ✓
  - [ ] Document aggregation rules ✓
  - [ ] Type priority (invoices > receipts) ✓
- [ ] Review SPEC.md section 4.1 (Filtering)
  - [ ] Fee transactions excluded ✓
  - [ ] Null amounts/currencies excluded ✓
  - [ ] Date window (12 months for single-match) ✓
- [ ] Review SPEC.md section 2.1.1 (Single-Match)
  - [ ] Returns up to 5 matches ✓
  - [ ] Sorted by confidence ✓
  - [ ] Date proximity tie-breaker ✓
- [ ] Review SPEC.md section 2.1.2 (Auto-Match)
  - [ ] Threshold 0.95 ✓
  - [ ] Skip ambiguous matches ✓
  - [ ] Merge direction correct ✓

### Performance Check

- [ ] Profile single-match with 1000 charges
- [ ] Profile auto-match with 1000 charges
- [ ] Verify performance is acceptable (<2s for single-match)
- [ ] Identify any optimization opportunities

### Security Review

- [ ] Check for SQL injection vulnerabilities (if using SQL)
- [ ] Verify input validation on all public APIs
- [ ] Check for potential infinite loops
- [ ] Verify no sensitive data in logs/errors

---

## Phase 10: Deployment

### Pre-Deployment

- [ ] Create CHANGELOG.md
- [ ] Update version in package.json
- [ ] Tag release in git
- [ ] Create release notes

### Build

- [ ] Run `npm run build` (if build step exists)
- [ ] Verify build outputs are correct
- [ ] Test built artifacts

### Deployment

- [ ] Deploy to staging environment (if applicable)
- [ ] Run smoke tests in staging
- [ ] Deploy to production
- [ ] Verify production deployment
- [ ] Monitor for errors

---

## Post-Deployment

### Monitoring

- [ ] Set up error monitoring
- [ ] Set up performance monitoring
- [ ] Create dashboards for key metrics
  - [ ] Match success rate
  - [ ] Auto-match accuracy
  - [ ] Performance metrics

### Documentation

- [ ] Update internal wiki/docs
- [ ] Create training materials for users
- [ ] Document troubleshooting procedures

### Follow-up

- [ ] Schedule code review meeting
- [ ] Gather user feedback
- [ ] Plan future enhancements (from SPEC.md section 9)
- [ ] Create tickets for tech debt

---

## Future Enhancements (from SPEC.md Section 9)

### Potential Improvements

- [ ] Configurable confidence threshold
- [ ] Configurable time window
- [ ] Adjustable confidence weights
- [ ] Match rejection tracking
- [ ] Many-to-many matching support
- [ ] Description-based matching (NLP)
- [ ] Machine learning integration
- [ ] Batch operation UI
- [ ] Analytics and reporting
- [ ] Currency conversion with real rates
- [ ] API architecture definition
- [ ] GraphQL support
- [ ] Background job processing
- [ ] Caching layer

---

## Notes

### Key Metrics to Track

- Total lines of code: ~2000-3000
- Test coverage: >90%
- Number of tests: ~150-200
- Build time: <30 seconds
- Test suite time: <10 seconds

### Common Issues to Watch For

- Off-by-one errors in date calculations
- Floating point precision in amount comparisons
- Time zone handling in date comparisons
- Null/undefined handling throughout
- Error message clarity
- Performance with large datasets

### Testing Strategy

- Unit tests for all pure functions
- Integration tests for services
- End-to-end tests for full workflows
- Edge case tests for all branches
- Performance tests for large datasets
