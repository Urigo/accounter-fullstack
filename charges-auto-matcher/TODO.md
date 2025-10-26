# Transaction-Document Matching System - Implementation Checklist

## Project Overview

- [ ] Review complete specification (SPEC.md)
- [ ] Understand all confidence calculation formulas
- [ ] Understand data models and relationships
- [ ] Set up development environment

---

## Phase 1: Foundation & Setup

### Step 1: Project Setup and Type Definitions

- [ ] Initialize npm project with `npm init`
- [ ] Install dependencies
  - [ ] TypeScript (`typescript`)
  - [ ] Jest (`jest`, `@types/jest`, `ts-jest`)
  - [ ] Node types (`@types/node`)
- [ ] Create `tsconfig.json` with strict mode
- [ ] Create `jest.config.js` for TypeScript
- [ ] Set up directory structure
  - [ ] `src/` directory
  - [ ] `__tests__/` directory
  - [ ] `src/types.ts`
- [ ] Define core interfaces in `src/types.ts`
  - [ ] `Transaction` interface
  - [ ] `Document` interface
  - [ ] `document_type` union type
  - [ ] `currency` type
- [ ] Define result types
  - [ ] `MatchResult` type
  - [ ] `SingleMatchOutput` type
  - [ ] `AutoMatchOutput` type
- [ ] Create test utilities file
  - [ ] `__tests__/testUtils.ts`
  - [ ] Transaction factory function
  - [ ] Document factory function
  - [ ] Charge factory function
- [ ] Write setup verification test
  - [ ] At least one passing test
  - [ ] Verify TypeScript compilation works
  - [ ] Verify Jest runs successfully
- [ ] Run tests: `npm test`
- [ ] Commit: "feat: project setup and type definitions"

---

## Phase 2: Core Calculation Functions

### Step 2: Amount Confidence Calculator

- [ ] Create `src/calculators/` directory
- [ ] Create `src/calculators/amountConfidence.ts`
- [ ] Implement `calculateAmountConfidence()` function
  - [ ] Handle exact match (0% diff) → 1.0
  - [ ] Handle within 1 unit → 0.9
  - [ ] Handle linear degradation (1 unit to 20%) → 0.7 to 0.0
  - [ ] Handle 20%+ diff → 0.0
  - [ ] Round to 2 decimal places
- [ ] Create helper function for percentage difference
- [ ] Create `__tests__/amountConfidence.test.ts`
- [ ] Write tests for exact match
- [ ] Write tests for 0.5 unit difference
- [ ] Write tests for 1 unit difference
- [ ] Write tests for 2, 5, 10 unit differences
- [ ] Write tests for 10%, 15%, 20% differences
- [ ] Write tests for >20% differences
- [ ] Write edge case tests
  - [ ] Negative amounts
  - [ ] Very small amounts (< 1)
  - [ ] Zero amounts
  - [ ] Very large amounts
- [ ] Verify all tests pass
- [ ] Check test coverage >95%
- [ ] Commit: "feat: implement amount confidence calculator"

### Step 3: Currency Confidence Calculator

- [ ] Create `src/calculators/currencyConfidence.ts`
- [ ] Implement `calculateCurrencyConfidence()` function
  - [ ] Same currency → 1.0
  - [ ] Different currency → 0.2
  - [ ] Case-insensitive comparison
  - [ ] Handle null/undefined → 0.2
- [ ] Create `__tests__/currencyConfidence.test.ts`
- [ ] Write tests for same currency (USD, EUR, ILS)
- [ ] Write tests for different currencies
- [ ] Write tests for case sensitivity (USD vs usd)
- [ ] Write edge case tests
  - [ ] Empty strings
  - [ ] Null values
  - [ ] Undefined values
- [ ] Verify all tests pass
- [ ] Commit: "feat: implement currency confidence calculator"

### Step 4: Business ID Extraction from Documents

- [ ] Create `src/extractors/` directory
- [ ] Create `src/extractors/documentBusiness.ts`
- [ ] Define `DocumentBusinessInfo` interface
  - [ ] `businessId: string | null`
  - [ ] `isBusinessCreditor: boolean`
- [ ] Implement `extractDocumentBusiness()` function
  - [ ] User is debtor → business is creditor
  - [ ] User is creditor → business is debtor
  - [ ] Handle null values appropriately
  - [ ] Throw error if both IDs are userId
  - [ ] Throw error if neither ID is userId
- [ ] Create `__tests__/documentBusiness.test.ts`
- [ ] Write test: user is debtor, creditor is business
- [ ] Write test: user is creditor, debtor is business
- [ ] Write test: user is creditor, debtor is null
- [ ] Write test: user is debtor, creditor is null
- [ ] Write test: both are user (should throw)
- [ ] Write test: neither are user (should throw)
- [ ] Write test: all null (should throw)
- [ ] Verify error messages are descriptive
- [ ] Verify all tests pass
- [ ] Commit: "feat: implement document business extraction"

### Step 5: Business Confidence Calculator

- [ ] Create `src/calculators/businessConfidence.ts`
- [ ] Import `DocumentBusinessInfo` type
- [ ] Implement `calculateBusinessConfidence()` function
  - [ ] Both match and non-null → 1.0
  - [ ] One is null → 0.5
  - [ ] Both null → 0.5
  - [ ] Mismatch (both non-null) → 0.2
- [ ] Create `__tests__/businessConfidence.test.ts`
- [ ] Write test: exact match (non-null)
- [ ] Write test: transaction ID is null
- [ ] Write test: document ID is null
- [ ] Write test: both IDs are null
- [ ] Write test: IDs don't match
- [ ] Write tests with various business ID formats
- [ ] Verify all tests pass
- [ ] Commit: "feat: implement business confidence calculator"

### Step 6: Date Confidence Calculator

- [ ] Create `src/calculators/dateConfidence.ts`
- [ ] Implement `calculateDateConfidence()` function
  - [ ] Same day → 1.0
  - [ ] Linear degradation: 1.0 - (days_diff / 30)
  - [ ] 30+ days → 0.0
  - [ ] Calculate days difference (ignore time)
  - [ ] Round to 2 decimal places
- [ ] Create `__tests__/dateConfidence.test.ts`
- [ ] Write test: same day → 1.0
- [ ] Write test: 1 day diff → ~0.967
- [ ] Write test: 7 days diff → ~0.767
- [ ] Write test: 15 days diff → 0.5
- [ ] Write test: 29 days diff → ~0.033
- [ ] Write test: 30 days diff → 0.0
- [ ] Write test: 100 days diff → 0.0
- [ ] Write test: order independence (date1 > date2 vs date2 > date1)
- [ ] Write edge case tests
  - [ ] Different time zones
  - [ ] Leap years
  - [ ] Month boundaries
- [ ] Verify all tests pass
- [ ] Commit: "feat: implement date confidence calculator"

### Step 7: Overall Confidence Calculator

- [ ] Create `src/calculators/overallConfidence.ts`
- [ ] Define `ConfidenceComponents` interface
- [ ] Define `ConfidenceInputs` interface
- [ ] Import all previous confidence calculators
- [ ] Implement `calculateOverallConfidence()` function
  - [ ] Apply weights: amount×0.4 + currency×0.2 + business×0.3 + date×0.1
  - [ ] Round to 2 decimal places
- [ ] Implement `calculateConfidence()` convenience function
  - [ ] Calculate all component confidences
  - [ ] Return overall + components
- [ ] Create `__tests__/overallConfidence.test.ts`
- [ ] Write test: all components at 1.0 → 1.0
- [ ] Write test: all components at 0.0 → 0.0
- [ ] Write test: mixed scores (verify formula)
- [ ] Write tests varying each weight individually
- [ ] Write real-world scenario tests
- [ ] Write integration test using convenience function
- [ ] Verify weights are correct (0.4, 0.2, 0.3, 0.1)
- [ ] Verify all tests pass
- [ ] Commit: "feat: implement overall confidence calculator"

---

## Phase 3: Data Processing

### Step 8: Transaction Aggregator

- [ ] Create `src/aggregators/` directory
- [ ] Create `src/aggregators/transactionAggregator.ts`
- [ ] Define `AggregatedTransaction` interface
- [ ] Implement `aggregateTransactions()` function
  - [ ] Filter out fee transactions (is_fee = true)
  - [ ] Validate non-empty array
  - [ ] Check for mixed currencies → throw error
  - [ ] Check for multiple non-null business IDs → throw error
  - [ ] Sum all amounts
  - [ ] Select earliest event_date
  - [ ] Concatenate descriptions with line breaks
  - [ ] Handle null descriptions
- [ ] Create `__tests__/transactionAggregator.test.ts`
- [ ] Write test: single transaction
- [ ] Write test: multiple transactions, same currency
- [ ] Write test: multiple transactions with fees (excluded)
- [ ] Write test: mixed currencies (should throw)
- [ ] Write test: multiple business IDs (should throw)
- [ ] Write test: all business IDs null
- [ ] Write test: single non-null business ID
- [ ] Write test: date selection (earliest)
- [ ] Write test: description concatenation
- [ ] Write test: empty array (should throw)
- [ ] Verify error messages are descriptive
- [ ] Verify all tests pass
- [ ] Commit: "feat: implement transaction aggregator"

### Step 9: Document Amount Normalization

- [ ] Create `src/normalizers/` directory
- [ ] Create `src/normalizers/documentAmount.ts`
- [ ] Implement `normalizeDocumentAmount()` function
  - [ ] Step 1: Take absolute value
  - [ ] Step 2: If business is creditor, negate
  - [ ] Step 3: If CREDIT_INVOICE, negate
- [ ] Create `__tests__/documentAmount.test.ts`
- [ ] Write test: INVOICE, business debtor → positive
- [ ] Write test: INVOICE, business creditor → negative
- [ ] Write test: CREDIT_INVOICE, business debtor → negative
- [ ] Write test: CREDIT_INVOICE, business creditor → positive
- [ ] Write test: RECEIPT, both scenarios
- [ ] Write test: INVOICE_RECEIPT, both scenarios
- [ ] Write test: OTHER, PROFORMA, UNPROCESSED types
- [ ] Write edge case tests
  - [ ] Negative input amounts
  - [ ] Zero amounts
  - [ ] Very large amounts
- [ ] Verify all tests pass
- [ ] Commit: "feat: implement document amount normalization"

### Step 10: Document Aggregator

- [ ] Create `src/aggregators/documentAggregator.ts`
- [ ] Define `AggregatedDocument` interface
- [ ] Import business extraction and amount normalization
- [ ] Implement `aggregateDocuments()` function
  - [ ] Apply type priority filter
    - [ ] If invoices + receipts exist, use only invoices
  - [ ] Extract business from each document
  - [ ] Normalize each amount
  - [ ] Validate non-empty array
  - [ ] Check for mixed currencies → throw error
  - [ ] Check for multiple non-null business IDs → throw error
  - [ ] Sum all normalized amounts
  - [ ] Select latest date
  - [ ] Concatenate serial numbers/file names with line breaks
  - [ ] Determine document type for result
- [ ] Create `__tests__/documentAggregator.test.ts`
- [ ] Write test: single document (normalized)
- [ ] Write test: multiple invoices (summed correctly)
- [ ] Write test: multiple receipts (summed correctly)
- [ ] Write test: mixed invoices + receipts (uses only invoices)
- [ ] Write test: mixed currencies (should throw)
- [ ] Write test: multiple businesses (should throw)
- [ ] Write test: date selection (latest)
- [ ] Write test: description concatenation
- [ ] Write test: business extraction errors propagate
- [ ] Write test: credit invoice normalization in aggregation
- [ ] Write test: null dates handled gracefully
- [ ] Verify all tests pass
- [ ] Commit: "feat: implement document aggregator"

---

## Phase 4: Candidate Management

### Step 11: Candidate Filtering

- [ ] Create `src/filters/` directory
- [ ] Create `src/filters/candidateFilter.ts`
- [ ] Implement `isValidTransactionForMatching()` function
  - [ ] Exclude if is_fee = true
  - [ ] Include otherwise
- [ ] Implement `isValidDocumentForMatching()` function
  - [ ] Exclude if total_amount is null
  - [ ] Exclude if currency_code is null
  - [ ] Include otherwise (including zero amounts)
- [ ] Implement `isWithinDateWindow()` function
  - [ ] Calculate months difference accurately
  - [ ] Default windowMonths = 12
  - [ ] Return true if within window
- [ ] Create `__tests__/candidateFilter.test.ts`
- [ ] Write transaction validation tests
  - [ ] Normal transaction: included
  - [ ] Fee transaction: excluded
- [ ] Write document validation tests
  - [ ] Valid document: included
  - [ ] Null total_amount: excluded
  - [ ] Null currency_code: excluded
  - [ ] Zero amount: included
- [ ] Write date window tests
  - [ ] Same date: included
  - [ ] 11 months apart: included
  - [ ] Exactly 12 months: included
  - [ ] 12 months + 1 day: excluded
  - [ ] Different years
  - [ ] Month boundary edge cases
- [ ] Verify all tests pass
- [ ] Commit: "feat: implement candidate filtering"

### Step 12: Match Scoring Engine

- [ ] Create `src/scoring/` directory
- [ ] Create `src/scoring/matchScorer.ts`
- [ ] Define `MatchScore` interface
- [ ] Define `TransactionCharge` interface
- [ ] Define `DocumentCharge` interface
- [ ] Import aggregators and confidence calculator
- [ ] Implement `selectTransactionDate()` function
  - [ ] INVOICE/CREDIT_INVOICE → event_date
  - [ ] RECEIPT/INVOICE_RECEIPT → debit_timestamp (fallback to debit_date, then event_date)
  - [ ] OTHER/PROFORMA/UNPROCESSED → calculate both, use better score
- [ ] Implement `scoreMatch()` function
  - [ ] Aggregate transactions
  - [ ] Aggregate documents
  - [ ] Extract document business
  - [ ] Normalize document amount
  - [ ] Select appropriate transaction date
  - [ ] Calculate confidence (handle flexible doc types)
  - [ ] Return MatchScore
- [ ] Create `__tests__/matchScorer.test.ts`
- [ ] Write test: perfect match (all fields align)
- [ ] Write test: partial matches (varying confidence)
- [ ] Write test: date type selection for INVOICE
- [ ] Write test: date type selection for RECEIPT
- [ ] Write test: PROFORMA/OTHER (better score selection)
- [ ] Write test: amount differences (various levels)
- [ ] Write test: currency mismatches
- [ ] Write test: business mismatches
- [ ] Write integration test: full scoring pipeline
- [ ] Write test: error propagation from aggregation
- [ ] Verify all tests pass
- [ ] Commit: "feat: implement match scoring engine"

---

## Phase 5: Single-Match Implementation

### Step 13: Single-Match Core Function

- [ ] Create `src/matching/` directory
- [ ] Create `src/matching/singleMatch.ts`
- [ ] Import all required components
- [ ] Implement helper: `isUnmatchedCharge()` function
- [ ] Implement helper: `getComplementaryType()` function
- [ ] Implement helper: `calculateDateProximity()` for tie-breaking
- [ ] Implement `findMatches()` function
  - [ ] Validate source charge is unmatched
  - [ ] Validate source charge aggregation
  - [ ] Filter candidates by complementary type
  - [ ] Filter candidates by date window
  - [ ] Filter candidates using candidateFilter
  - [ ] Exclude candidates with same chargeId (throw if found)
  - [ ] Score all remaining candidates
  - [ ] Sort by confidence (descending)
  - [ ] Apply date proximity tie-breaker
  - [ ] Return top N (default 5)
- [ ] Create `__tests__/singleMatch.test.ts`
- [ ] Write test: transaction charge → finds document matches
- [ ] Write test: document charge → finds transaction matches
- [ ] Write test: matched charge input (should throw)
- [ ] Write test: multiple currencies in source (error propagates)
- [ ] Write test: no candidates found (empty array)
- [ ] Write test: fewer than 5 candidates (returns all)
- [ ] Write test: more than 5 candidates (returns top 5)
- [ ] Write test: tie-breaking by date proximity
- [ ] Write test: date window filtering works
- [ ] Write test: fee transactions excluded
- [ ] Write test: same chargeId (should throw)
- [ ] Write test: various confidence levels (realistic data)
- [ ] Verify all tests pass
- [ ] Commit: "feat: implement single-match core function"

### Step 14: Single-Match Database Integration

- [ ] Create `src/db/` directory
- [ ] Create `src/db/chargeRepository.ts`
- [ ] Define `ChargeRepository` interface
  - [ ] `getChargeById()` method
  - [ ] `getCandidateCharges()` method
- [ ] Define `Charge` interface
- [ ] Implement `MockChargeRepository` class
  - [ ] In-memory Map storage
  - [ ] `getChargeById()` implementation
  - [ ] `getCandidateCharges()` implementation with filtering
  - [ ] Helper methods for test data setup
- [ ] Create `src/matching/singleMatchService.ts`
- [ ] Implement `findMatchesForCharge()` function
  - [ ] Load source charge from repository
  - [ ] Validate it's unmatched
  - [ ] Determine reference date from aggregation
  - [ ] Load candidate charges from repository
  - [ ] Call findMatches() from Step 13
  - [ ] Format and return result
- [ ] Create `__tests__/singleMatchService.test.ts`
- [ ] Set up MockChargeRepository with test data
- [ ] Write test: full flow with database
- [ ] Write test: charge not found error
- [ ] Write test: matched charge error
- [ ] Write test: various data scenarios
- [ ] Write test: date window filtering at DB level
- [ ] Write integration tests with realistic data
- [ ] Verify all tests pass
- [ ] Commit: "feat: integrate single-match with database layer"

---

## Phase 6: Auto-Match Implementation

### Step 15: Auto-Match Core Function

- [ ] Create `src/matching/autoMatch.ts`
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
- [ ] Create `__tests__/autoMatch.test.ts`
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

### Step 16: Auto-Match Complete Integration

- [ ] Extend `src/db/chargeRepository.ts` interface
  - [ ] Add `getUnmatchedCharges()` method
  - [ ] Add `getAllCharges()` method
  - [ ] Add `mergeCharges()` method
- [ ] Update `MockChargeRepository` implementation
  - [ ] Implement `getUnmatchedCharges()`
  - [ ] Implement `getAllCharges()`
  - [ ] Implement `mergeCharges()` (move data, delete source)
  - [ ] Add helper to track merge operations
- [ ] Create `src/matching/autoMatchService.ts`
- [ ] Implement `autoMatchAllCharges()` function
  - [ ] Load all unmatched charges
  - [ ] Load all charges for candidate pool
  - [ ] Initialize result tracking
  - [ ] For each unmatched charge:
    - [ ] Process with processChargeForAutoMatch()
    - [ ] If matched: determine merge direction
    - [ ] Execute merge via repository
    - [ ] Track merged charge in result
    - [ ] Exclude from further processing
    - [ ] If skipped: add to skippedCharges
    - [ ] Handle errors: capture and continue
  - [ ] Return AutoMatchOutput
- [ ] Create `__tests__/autoMatchService.test.ts`
- [ ] Write test: empty database
- [ ] Write test: all charges already matched
- [ ] Write test: single unmatched with good match
- [ ] Write test: multiple unmatched charges
- [ ] Write test: ambiguous matches (multiple ≥0.95)
- [ ] Write test: mixed scenarios (match, skip, no-match)
- [ ] Write test: errors during merge
- [ ] Write test: merged charges excluded from further matching
- [ ] Write test: verify merge direction is correct
- [ ] Write test: verify final database state
- [ ] Write end-to-end integration test
- [ ] Verify all tests pass
- [ ] Commit: "feat: complete auto-match with full integration"

---

## Phase 7: Polish & Production Ready

### Step 17: Final Integration and Error Handling

- [ ] Create `src/validation/` directory
- [ ] Create `src/validation/chargeValidator.ts`
- [ ] Implement `validateChargeForMatching()` function
- [ ] Implement `isChargeMatched()` function
- [ ] Implement `hasOnlyTransactions()` function
- [ ] Implement `hasOnlyDocuments()` function
- [ ] Create `src/errors.ts`
- [ ] Define `MatchingError` base class
- [ ] Define `ValidationError` class
- [ ] Define `AggregationError` class
- [ ] Define `BusinessExtractionError` class
- [ ] Define `DatabaseError` class
- [ ] Refactor existing code to use proper error types
  - [ ] Update transaction aggregator
  - [ ] Update document aggregator
  - [ ] Update business extraction
  - [ ] Update validators
  - [ ] Update single-match service
  - [ ] Update auto-match service
- [ ] Ensure all error messages are descriptive
- [ ] Create `src/index.ts` (main export file)
  - [ ] Export `findMatchesForCharge`
  - [ ] Export `autoMatchAllCharges`
  - [ ] Export all result types
  - [ ] Export `ChargeRepository` interface
  - [ ] Export error classes
- [ ] Create `__tests__/integration/` directory
- [ ] Create `__tests__/integration/singleMatch.integration.test.ts`
  - [ ] Test realistic end-to-end scenarios
  - [ ] Test all error paths
  - [ ] Test edge cases from specification
- [ ] Create `__tests__/integration/autoMatch.integration.test.ts`
  - [ ] Test realistic batch processing
  - [ ] Test mixed match/skip/error scenarios
  - [ ] Test merge direction in various cases
  - [ ] Test performance with larger datasets
- [ ] Create `README.md`
  - [ ] Project overview
  - [ ] Installation instructions
  - [ ] Quick start guide
  - [ ] API documentation
    - [ ] `findMatchesForCharge()`
    - [ ] `autoMatchAllCharges()`
  - [ ] Error handling guide
  - [ ] Configuration options
  - [ ] Usage examples
  - [ ] Contributing guidelines
- [ ] Run full test suite
  - [ ] Verify all tests pass
  - [ ] Check code coverage >90%
- [ ] Commit: "feat: add error handling, validation, and documentation"

---

## Phase 8: Testing & Quality Assurance

### Comprehensive Testing

- [ ] Run full test suite: `npm test`
- [ ] Check test coverage: `npm run test:coverage`
- [ ] Verify coverage is >90% overall
- [ ] Verify coverage is >95% for calculators
- [ ] Run linter (if configured): `npm run lint`
- [ ] Fix any linting issues
- [ ] Test with real-world data patterns
  - [ ] Load sample transaction data
  - [ ] Load sample document data
  - [ ] Run single-match tests
  - [ ] Run auto-match tests
  - [ ] Verify results are sensible

### Edge Case Verification

- [ ] Test with empty databases
- [ ] Test with very large amounts
- [ ] Test with many currencies
- [ ] Test with missing optional fields
- [ ] Test with extreme dates (far past/future)
- [ ] Test with many charges (performance)
- [ ] Test concurrent modifications (if applicable)

### Documentation Review

- [ ] Review README for clarity
- [ ] Verify all examples work
- [ ] Check API documentation is complete
- [ ] Ensure error messages are documented
- [ ] Verify inline code comments are clear

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
