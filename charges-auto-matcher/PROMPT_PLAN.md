# Transaction-Document Matching System: Implementation Blueprint

## Phase 0: Analysis and Planning

Before diving into prompts, let me outline the implementation strategy:

### Architecture Overview

```
Layer 1: Type Definitions & Data Models
Layer 2: Core Calculation Functions (Pure, Testable)
  ├─ Amount Confidence Calculator
  ├─ Currency Confidence Calculator
  ├─ Business Confidence Calculator
  ├─ Date Confidence Calculator
  └─ Overall Confidence Calculator
Layer 3: Data Aggregation & Normalization
  ├─ Transaction Aggregator
  ├─ Document Aggregator
  └─ Business ID Extractor
Layer 4: Candidate Management
  ├─ Candidate Filter
  └─ Candidate Scorer
Layer 5: High-Level Functions
  ├─ Single-Match Function
  └─ Auto-Match Function
Layer 6: Integration Layer
```

### Iteration 1: Initial Breakdown (Too Large)

1. Setup and types
2. All confidence calculators
3. Aggregation logic
4. Single-match function
5. Auto-match function
6. Integration

**Assessment:** Steps 2-3 are too large, need more granularity.

### Iteration 2: Refined Breakdown (Better)

1. Project setup + type definitions
2. Amount confidence calculator
3. Currency confidence calculator
4. Business ID extraction + business confidence calculator
5. Date confidence calculator
6. Overall confidence calculator
7. Transaction aggregator
8. Document aggregator
9. Candidate filtering logic
10. Single-match function core
11. Auto-match function core
12. Final integration + error handling

**Assessment:** Still some complex steps. Let's break down further.

### Iteration 3: Right-Sized Breakdown (Final)

1. **Project Setup**: Types, interfaces, test framework
2. **Amount Confidence**: Pure calculation function with comprehensive tests
3. **Currency Confidence**: Simple comparison function
4. **Business Extraction**: Document business ID extraction logic
5. **Business Confidence**: Business matching confidence calculation
6. **Date Confidence**: Date-based confidence with multiple scenarios
7. **Overall Confidence**: Weighted combination of all confidences
8. **Transaction Aggregation**: Multi-transaction handling
9. **Document Normalization**: Amount normalization logic
10. **Document Aggregation**: Multi-document handling with normalization
11. **Candidate Filtering**: Date window and exclusion rules
12. **Match Scoring**: Combine aggregation + confidence calculation
13. **Single-Match Core**: Main function without DB
14. **Single-Match Integration**: Add DB queries and wire up
15. **Auto-Match Core**: Matching logic without merge
16. **Auto-Match Integration**: Add merge calls and complete flow

**Assessment:** These steps are:

- Small enough to be safely tested (each ~100-300 lines)
- Large enough to make meaningful progress
- Build incrementally on each other
- No orphaned code - each integrates with previous

---

## Implementation Prompts

### Prompt 1: Project Setup and Type Definitions

```
You are building a transaction-document matching system for an accounting application. This will be implemented in TypeScript.

STEP 1: PROJECT SETUP AND TYPE DEFINITIONS

Create the foundational structure with:

1. Set up a basic TypeScript project with:
   - package.json with typescript, jest, and @types/jest
   - tsconfig.json with strict mode enabled
   - jest.config.js for testing

2. Create a types file (types.ts) with all the interfaces and types from the specification:
   - Transaction interface
   - Document interface
   - document_type union type
   - currency type (as string for now)

3. Create additional result types for function outputs:
   - MatchResult type: { chargeId: string; confidenceScore: number }
   - SingleMatchOutput type: { matches: MatchResult[] }
   - AutoMatchOutput type with totalMatches, mergedCharges, skippedCharges, errors

4. Set up the test infrastructure:
   - Create a __tests__ directory
   - Create a test utilities file for common test data factories
   - Add a sample test that validates the setup works

Requirements:
- All types should match the specification exactly
- Include JSDoc comments for each interface explaining its purpose
- Ensure strict null checks are enabled
- Test file should have at least one passing test to verify setup

Deliverable: Complete project structure with types and a passing test suite showing the setup works correctly.
```

---

### Prompt 2: Amount Confidence Calculator

````
Building on the previous step, implement the amount confidence calculation function.

STEP 2: AMOUNT CONFIDENCE CALCULATOR

According to the specification, amount confidence follows this logic:
- Exact match (0% difference): 1.0
- Within 1 currency unit: 0.9
- Between 1 unit and 20% difference: Linear degradation from 0.7 to 0.0
- 20%+ difference: 0.0

Create:

1. A new file: src/calculators/amountConfidence.ts

2. Implement the function:
```typescript
/**
 * Calculate confidence score based on amount similarity
 * @param transactionAmount - The transaction amount (signed number)
 * @param documentAmount - The normalized document amount (signed number)
 * @returns Confidence score between 0.0 and 1.0
 */
export function calculateAmountConfidence(
  transactionAmount: number,
  documentAmount: number
): number
````

3. Create comprehensive tests in **tests**/amountConfidence.test.ts covering:
   - Exact match (0 difference)
   - Amounts within 0.5 units
   - Amounts within exactly 1 unit
   - Amounts with 1.5, 2, 5, 10 units difference
   - Amounts at exactly 20% difference
   - Amounts beyond 20% difference
   - Edge cases: negative amounts, very small amounts, zero amounts
   - The formula for linear degradation in the middle range

4. Add helper functions if needed for clarity (e.g., calculatePercentageDiff)

Requirements:

- Function must be pure (no side effects)
- Return values rounded to 2 decimal places (0.00 format)
- Handle edge cases gracefully
- All tests must pass
- Test coverage should be >95% for this function

Deliverable: Amount confidence calculator with comprehensive test coverage demonstrating correctness
of all edge cases.

```

---

### Prompt 3: Currency Confidence Calculator

```

Building on the previous steps, implement the currency confidence calculation.

STEP 3: CURRENCY CONFIDENCE CALCULATOR

This is a simpler function - same currency gets 1.0, different currencies get 0.2.

Create:

1. A new file: src/calculators/currencyConfidence.ts

2. Implement the function:

```typescript
/**
 * Calculate confidence score based on currency match
 * @param transactionCurrency - Currency code from transaction
 * @param documentCurrency - Currency code from document
 * @returns 1.0 if same, 0.2 if different
 */
export function calculateCurrencyConfidence(
  transactionCurrency: string,
  documentCurrency: string,
): number;
```

3. Create tests in **tests**/currencyConfidence.test.ts:
   - Same currency (various examples: USD, EUR, ILS)
   - Different currencies
   - Case sensitivity handling
   - Edge cases: empty strings, null/undefined handling

Requirements:

- Currency comparison should be case-insensitive
- Return exactly 1.0 or 0.2 (no rounding needed)
- Handle null/undefined by returning 0.2
- All tests must pass

Deliverable: Simple, well-tested currency confidence calculator.

```

---

### Prompt 4: Business ID Extraction from Documents

```

Building on the previous steps, implement the logic to extract business ID from documents.

STEP 4: BUSINESS ID EXTRACTION

Per the specification, documents have creditor_id and debtor_id. One will be the userId, the other
is the business. We need to extract the business ID and determine if the business is the creditor.

Create:

1. A new file: src/extractors/documentBusiness.ts

2. Implement the function:

```typescript
export interface DocumentBusinessInfo {
  businessId: string | null;
  isBusinessCreditor: boolean;
}

/**
 * Extract business information from a document
 * @param creditorId - Document's creditor_id
 * @param debtorId - Document's debtor_id
 * @param userId - Current user's ID
 * @returns Business ID and whether business is the creditor
 * @throws Error if both or neither IDs match userId
 */
export function extractDocumentBusiness(
  creditorId: string | null,
  debtorId: string | null,
  userId: string,
): DocumentBusinessInfo;
```

3. Create tests in **tests**/documentBusiness.test.ts:
   - User is debtor, creditor is business (returns creditor as business, isCreditor=true)
   - User is creditor, debtor is business (returns debtor as business, isCreditor=false)
   - User is creditor, debtor is null (returns null, isCreditor=false)
   - User is debtor, creditor is null (returns null, isCreditor=true)
   - Both are user - should throw error
   - Neither are user - should throw error
   - All null - should throw error

Requirements:

- Must throw descriptive errors for invalid states
- Handle null values appropriately
- All tests must pass
- Error messages should be clear and actionable

Deliverable: Document business extractor with thorough error handling and tests.

```

---

### Prompt 5: Business Confidence Calculator

```

Building on the previous steps, implement business confidence calculation.

STEP 5: BUSINESS CONFIDENCE CALCULATOR

This uses the business ID extraction from Step 4.

Create:

1. A new file: src/calculators/businessConfidence.ts

2. Import the DocumentBusinessInfo type and implement:

```typescript
/**
 * Calculate confidence score based on business ID match
 * @param transactionBusinessId - Business ID from transaction (can be null)
 * @param documentBusinessId - Business ID from document (can be null)
 * @returns Confidence score: 1.0 (exact match), 0.5 (one null), 0.2 (mismatch)
 */
export function calculateBusinessConfidence(
  transactionBusinessId: string | null,
  documentBusinessId: string | null,
): number;
```

3. Create tests in **tests**/businessConfidence.test.ts:
   - Both IDs match and non-null: 1.0
   - Transaction ID is null: 0.5
   - Document ID is null: 0.5
   - Both IDs are null: 0.5
   - IDs don't match (both non-null): 0.2
   - Various business ID formats

Requirements:

- Function must handle all null combinations
- Return exactly 1.0, 0.5, or 0.2
- All tests must pass

Deliverable: Business confidence calculator integrated with business extraction logic.

```

---

### Prompt 6: Date Confidence Calculator

```

Building on the previous steps, implement date confidence calculation.

STEP 6: DATE CONFIDENCE CALCULATOR

Date confidence uses linear degradation from 1.0 at 0 days to 0.0 at 30+ days difference.

Create:

1. A new file: src/calculators/dateConfidence.ts

2. Implement the function:

```typescript
/**
 * Calculate confidence score based on date proximity
 * @param date1 - First date
 * @param date2 - Second date
 * @returns Confidence score from 0.0 (30+ days) to 1.0 (same day)
 */
export function calculateDateConfidence(date1: Date, date2: Date): number;
```

3. Create tests in **tests**/dateConfidence.test.ts:
   - Same day: 1.0
   - 1 day difference: ~0.967
   - 7 days difference: ~0.767
   - 15 days difference: 0.5
   - 29 days difference: ~0.033
   - 30 days difference: 0.0
   - 100 days difference: 0.0
   - Order independence (date1 > date2 vs date2 > date1)
   - Different time zones
   - Leap years

Requirements:

- Calculate days difference accurately (ignore time components)
- Use linear formula: 1.0 - (days_diff / 30)
- Return exactly 0.0 for 30+ days
- Round to 2 decimal places
- All tests must pass

Deliverable: Date confidence calculator with precise day-difference calculation.

```

---

### Prompt 7: Overall Confidence Calculator

```

Building on all previous calculators, implement the overall confidence score.

STEP 7: OVERALL CONFIDENCE CALCULATOR

This combines all four confidence scores using weighted formula: confidence = (amount × 0.4) +
(currency × 0.2) + (business × 0.3) + (date × 0.1)

Create:

1. A new file: src/calculators/overallConfidence.ts

2. Import all previous confidence calculators and implement:

```typescript
export interface ConfidenceComponents {
  amount: number;
  currency: number;
  business: number;
  date: number;
}

/**
 * Calculate overall confidence score from individual components
 * @param components - Individual confidence scores
 * @returns Weighted overall confidence score (0.0 to 1.0)
 */
export function calculateOverallConfidence(components: ConfidenceComponents): number;
```

3. Also create a convenience function that calculates everything:

```typescript
export interface ConfidenceInputs {
  transactionAmount: number;
  transactionCurrency: string;
  transactionBusinessId: string | null;
  transactionDate: Date;
  documentAmount: number;
  documentCurrency: string;
  documentBusinessId: string | null;
  documentDate: Date;
}

/**
 * Calculate overall confidence from raw inputs
 * @param inputs - All required values for confidence calculation
 * @returns Object with overall score and individual components
 */
export function calculateConfidence(inputs: ConfidenceInputs): {
  overall: number;
  components: ConfidenceComponents;
};
```

4. Create tests in **tests**/overallConfidence.test.ts:
   - All components at 1.0: result is 1.0
   - All components at 0.0: result is 0.0
   - Mixed scores: verify weighted formula
   - Each weight individually (set 3 to 0, vary 1)
   - Real-world scenarios with typical values
   - Integration test using the convenience function

Requirements:

- Weights must be exactly: 0.4, 0.2, 0.3, 0.1
- Result rounded to 2 decimal places
- All tests must pass
- Include both unit tests and integration tests

Deliverable: Overall confidence calculator that orchestrates all previous calculators with
comprehensive tests.

```

---

### Prompt 8: Transaction Aggregator

```

Building on the previous steps, implement transaction aggregation logic.

STEP 8: TRANSACTION AGGREGATOR

Per specification, when a charge has multiple transactions, we need to aggregate them following
specific rules.

Create:

1. A new file: src/aggregators/transactionAggregator.ts

2. Import the Transaction type and implement:

```typescript
export interface AggregatedTransaction {
  amount: number;
  currency: string;
  businessId: string | null;
  date: Date;
  description: string;
}

/**
 * Aggregate multiple transactions into a single representation
 * @param transactions - Array of transactions from a charge
 * @returns Aggregated transaction data
 * @throws Error if mixed currencies or multiple business IDs
 */
export function aggregateTransactions(transactions: Transaction[]): AggregatedTransaction;
```

3. Implementation must:
   - Filter out transactions where is_fee = true
   - Throw error if multiple currencies exist
   - Throw error if multiple non-null business IDs exist
   - Sum all amounts
   - Use earliest event_date
   - Concatenate descriptions with line breaks
   - Handle null descriptions gracefully

4. Create tests in **tests**/transactionAggregator.test.ts:
   - Single transaction: returns as-is
   - Multiple transactions, same currency: sums correctly
   - Multiple transactions with fees: fees excluded
   - Mixed currencies: throws error
   - Multiple business IDs: throws error
   - All business IDs null: returns null
   - Single non-null business ID: returns that ID
   - Date selection (earliest)
   - Description concatenation
   - Empty array: throws error

Requirements:

- Must validate input (non-empty array)
- Error messages should be descriptive
- Handle all edge cases
- All tests must pass

Deliverable: Transaction aggregator with robust validation and error handling.

```

---

### Prompt 9: Document Amount Normalization

```

Building on the previous steps, implement document amount normalization.

STEP 9: DOCUMENT AMOUNT NORMALIZATION

Per specification, document amounts need special handling:

1. Start with absolute value
2. If business is creditor: negate
3. If document type is CREDIT_INVOICE: negate

Create:

1. A new file: src/normalizers/documentAmount.ts

2. Import the document_type and implement:

```typescript
/**
 * Normalize document amount for comparison with transaction amount
 * @param totalAmount - Raw total_amount from document
 * @param isBusinessCreditor - Whether the business is the creditor (from extraction)
 * @param documentType - Type of document
 * @returns Normalized amount (signed)
 */
export function normalizeDocumentAmount(
  totalAmount: number,
  isBusinessCreditor: boolean,
  documentType: document_type,
): number;
```

3. Create tests in **tests**/documentAmount.test.ts:
   - INVOICE, business is debtor: positive (100 → 100)
   - INVOICE, business is creditor: negative (100 → -100)
   - CREDIT_INVOICE, business is debtor: negative (100 → -100)
   - CREDIT_INVOICE, business is creditor: positive (100 → 100, double negation)
   - RECEIPT, both scenarios
   - INVOICE_RECEIPT, both scenarios
   - OTHER, PROFORMA, UNPROCESSED types
   - Negative input amounts (absolute value first)
   - Zero amounts
   - Very large amounts

Requirements:

- Always start with absolute value of input
- Apply negations in correct order
- All document types handled
- All tests must pass

Deliverable: Document amount normalizer with comprehensive test coverage for all document type and
business role combinations.

```

---

### Prompt 10: Document Aggregator

```

Building on the previous steps, implement document aggregation logic.

STEP 10: DOCUMENT AGGREGATOR

Per specification, aggregate multiple documents with type priority and amount normalization.

Create:

1. A new file: src/aggregators/documentAggregator.ts

2. Import Document type, business extraction, and amount normalization:

```typescript
export interface AggregatedDocument {
  amount: number;
  currency: string;
  businessId: string | null;
  date: Date;
  documentType: document_type;
  description: string;
}

/**
 * Aggregate multiple documents into a single representation
 * @param documents - Array of documents from a charge
 * @param userId - Current user ID for business extraction
 * @returns Aggregated document data
 * @throws Error if mixed currencies, multiple business IDs, or invalid business setup
 */
export function aggregateDocuments(documents: Document[], userId: string): AggregatedDocument;
```

3. Implementation must:
   - Filter by type priority: if both invoices AND receipts exist, use only invoices
   - Extract business ID from each document (reuse Step 4)
   - Normalize each amount (reuse Step 9)
   - Throw error if multiple currencies
   - Throw error if multiple non-null business IDs
   - Sum all normalized amounts
   - Use latest date
   - Concatenate serial_numbers or file names
   - Determine document type for result (use first after filtering)

4. Create tests in **tests**/documentAggregator.test.ts:
   - Single document: returns normalized
   - Multiple invoices: sums correctly with normalization
   - Multiple receipts: sums correctly
   - Mixed invoices + receipts: uses only invoices
   - Mixed currencies: throws error
   - Multiple businesses: throws error
   - Date selection (latest)
   - Description concatenation
   - Business extraction errors propagate
   - Credit invoice normalization in aggregation

Requirements:

- Must integrate with business extraction and amount normalization
- Type priority logic must be correct
- All tests must pass
- Handle null dates gracefully

Deliverable: Document aggregator that integrates business extraction and amount normalization with
type-priority filtering.

```

---

### Prompt 11: Candidate Filtering

```

Building on the previous steps, implement candidate filtering logic.

STEP 11: CANDIDATE FILTERING

Create logic to filter potential match candidates based on date windows and exclusion rules.

Create:

1. A new file: src/filters/candidateFilter.ts

2. Implement filtering functions:

```typescript
/**
 * Filter transactions that should be excluded from matching
 * @param transaction - Transaction to check
 * @returns true if transaction should be included in matching
 */
export function isValidTransactionForMatching(transaction: Transaction): boolean;

/**
 * Filter documents that should be excluded from matching
 * @param document - Document to check
 * @returns true if document should be included in matching
 */
export function isValidDocumentForMatching(document: Document): boolean;

/**
 * Check if a date falls within the matching window
 * @param candidateDate - Date to check
 * @param referenceDate - Center point of the window
 * @param windowMonths - Number of months before/after (default 12)
 * @returns true if within window
 */
export function isWithinDateWindow(
  candidateDate: Date,
  referenceDate: Date,
  windowMonths: number = 12,
): boolean;
```

3. Create tests in **tests**/candidateFilter.test.ts:
   - Transaction validation:
     - Normal transaction: included
     - Fee transaction: excluded
     - Various transaction states
   - Document validation:
     - Valid document: included
     - Null total_amount: excluded
     - Null currency_code: excluded
     - Zero amount: included (valid)
   - Date window:
     - Same date: included
     - 11 months apart: included
     - Exactly 12 months: included
     - 12 months + 1 day: excluded
     - Different years
     - Edge cases around month boundaries

Requirements:

- Transaction filtering must check is_fee
- Document filtering must check mandatory fields
- Date window calculation must be accurate
- All tests must pass

Deliverable: Candidate filtering logic with comprehensive validation rules.

```

---

### Prompt 12: Match Scoring Engine

```

Building on all previous steps, create the core match scoring engine.

STEP 12: MATCH SCORING ENGINE

This combines aggregation and confidence calculation to score a potential match.

Create:

1. A new file: src/scoring/matchScorer.ts

2. Implement the scoring function:

```typescript
export interface MatchScore {
  chargeId: string;
  confidenceScore: number;
  components: ConfidenceComponents;
}

export interface TransactionCharge {
  chargeId: string;
  transactions: Transaction[];
}

export interface DocumentCharge {
  chargeId: string;
  documents: Document[];
}

/**
 * Score a potential match between transaction charge and document charge
 * @param txCharge - Transaction charge to match
 * @param docCharge - Document charge candidate
 * @param userId - Current user ID
 * @returns Match score with confidence and components
 * @throws Error if aggregation or business extraction fails
 */
export function scoreMatch(
  txCharge: TransactionCharge,
  docCharge: DocumentCharge,
  userId: string,
): MatchScore;
```

3. Also implement date selection logic:

```typescript
/**
 * Select appropriate transaction date based on document type
 * @param transaction - Aggregated transaction
 * @param documentType - Document type being matched
 * @returns The date to use for matching
 */
export function selectTransactionDate(
  transaction: AggregatedTransaction,
  documentType: document_type,
): Date;
```

4. Create tests in **tests**/matchScorer.test.ts:
   - Perfect match: all fields align (should be ~1.0)
   - Partial matches: varying confidence levels
   - Date type selection: INVOICE uses event_date, RECEIPT uses debit_date
   - PROFORMA/OTHER: tests better score selection
   - Amount differences: various levels
   - Currency mismatches: 0.2 penalty
   - Business mismatches: appropriate confidence
   - Integration: full scoring pipeline
   - Error propagation from aggregation

Requirements:

- Must use all previous components correctly
- Date selection logic per specification
- For flexible doc types, calculate both dates and use better score
- All tests must pass
- Include integration tests with real-ish data

Deliverable: Complete match scoring engine that integrates all calculation components.

```

---

### Prompt 13: Single-Match Core Function

```

Building on all previous steps, implement the core single-match function.

STEP 13: SINGLE-MATCH CORE FUNCTION

Create the main single-match logic without database integration (will use mock data).

Create:

1. A new file: src/matching/singleMatch.ts

2. Implement the core function:

```typescript
/**
 * Find top matches for an unmatched charge
 * @param sourceCharge - The unmatched charge (transactions OR documents)
 * @param candidateCharges - All potential match candidates
 * @param userId - Current user ID
 * @param options - Optional configuration (maxMatches, dateWindowMonths)
 * @returns Top matches sorted by confidence
 * @throws Error if source charge is matched or has validation issues
 */
export function findMatches(
  sourceCharge: TransactionCharge | DocumentCharge,
  candidateCharges: Array<TransactionCharge | DocumentCharge>,
  userId: string,
  options?: { maxMatches?: number; dateWindowMonths?: number },
): MatchResult[];
```

3. Implementation must:
   - Validate source charge is unmatched (has only transactions OR documents)
   - Validate source charge has valid aggregation
   - Filter candidates by type (transactions match to documents, vice versa)
   - Filter candidates by date window (for single-match, default 12 months)
   - Filter candidates using candidate filter logic (Step 11)
   - Exclude candidates with same chargeId (throw error if found)
   - Score all remaining candidates (Step 12)
   - Sort by confidence descending
   - Use date proximity as tie-breaker
   - Return top N (default 5)

4. Create tests in **tests**/singleMatch.test.ts:
   - Valid transaction charge → finds document matches
   - Valid document charge → finds transaction matches
   - Matched charge input → throws error
   - Multiple currencies in source → error propagates
   - No candidates found → empty array
   - Fewer than 5 candidates → returns all
   - More than 5 candidates → returns top 5
   - Tie-breaking by date proximity
   - Date window filtering works
   - Fee transactions excluded
   - Same chargeId → throws error
   - Various confidence levels

Requirements:

- Function must be pure (deterministic given inputs)
- All validation and error handling must work
- Tie-breaking must be correct
- All tests must pass
- Use TypeScript discriminated unions for charge types

Deliverable: Core single-match function with comprehensive business logic and tests.

```

---

### Prompt 14: Single-Match Database Integration

```

Building on the previous step, add database integration to single-match.

STEP 14: SINGLE-MATCH DATABASE INTEGRATION

Create the database layer and wire up the complete single-match function.

Create:

1. A new file: src/db/chargeRepository.ts (interface/mock for now):

```typescript
export interface ChargeRepository {
  /**
   * Get a charge by ID with all transactions and documents
   */
  getChargeById(chargeId: string): Promise<Charge>;

  /**
   * Get all charges within date window that have complementary data
   * @param hasTransactions - If true, return charges with documents; if false, return charges with transactions
   * @param referenceDate - Center of date window
   * @param windowMonths - Months before/after
   */
  getCandidateCharges(
    hasTransactions: boolean,
    referenceDate: Date,
    windowMonths: number,
  ): Promise<Charge[]>;
}

export interface Charge {
  id: string;
  transactions: Transaction[];
  documents: Document[];
}

/**
 * Mock repository for testing (implement with in-memory data)
 */
export class MockChargeRepository implements ChargeRepository {
  // Implementation with in-memory Map
}
```

2. A new file: src/matching/singleMatchService.ts:

```typescript
/**
 * Find matches for an unmatched charge (with database integration)
 * @param chargeId - ID of unmatched charge
 * @param userId - Current user ID
 * @param repository - Charge repository
 * @returns Top 5 matches
 */
export async function findMatchesForCharge(
  chargeId: string,
  userId: string,
  repository: ChargeRepository,
): Promise<SingleMatchOutput>;
```

3. Wire everything together:
   - Load source charge from repository
   - Validate it's unmatched
   - Determine reference date from aggregated data
   - Load candidate charges from repository
   - Call findMatches from Step 13
   - Return formatted result

4. Create tests in **tests**/singleMatchService.test.ts:
   - Set up mock repository with test data
   - Test full flow with database
   - Test error handling for missing charges
   - Test error handling for matched charges
   - Test with various data scenarios
   - Test date window filtering at DB level

Requirements:

- Repository interface should be clean and testable
- MockRepository should work for all tests
- Service should handle all errors gracefully
- All tests must pass
- Integration tests with realistic scenarios

Deliverable: Fully integrated single-match function with database layer and complete end-to-end
tests.

```

---

### Prompt 15: Auto-Match Core Function

```

Building on all previous steps, implement the core auto-match logic.

STEP 15: AUTO-MATCH CORE FUNCTION

Create the auto-match function that processes all unmatched charges.

Create:

1. A new file: src/matching/autoMatch.ts:

```typescript
export interface AutoMatchResult {
  totalMatches: number;
  mergedCharges: Array<{
    chargeId: string;
    confidenceScore: number;
  }>;
  skippedCharges: string[];
  errors: any;
}

/**
 * Process a single unmatched charge and find best match
 * @param sourceCharge - Unmatched charge to process
 * @param allCharges - All charges to search
 * @param userId - Current user ID
 * @returns Match result if confidence >= 0.95 and unambiguous, null otherwise
 */
export function processChargeForAutoMatch(
  sourceCharge: Charge,
  allCharges: Charge[],
  userId: string,
): {
  match: MatchResult | null;
  status: 'matched' | 'skipped' | 'no-match';
  reason?: string;
};

/**
 * Determine merge direction for two charges
 * @param charge1 - First charge
 * @param charge2 - Second charge
 * @returns [source, target] where source will be merged into target
 */
export function determineMergeDirection(charge1: Charge, charge2: Charge): [Charge, Charge];
```

2. Implement the logic:
   - Use findMatches from Step 13 (no date window restriction)
   - Check if any matches >= 0.95
   - If exactly one: return for matching
   - If multiple: skip (ambiguous)
   - If none: no match
   - Merge direction: matched charge > transaction charge

3. Create tests in **tests**/autoMatch.test.ts:
   - Single high-confidence match: returns match
   - Multiple high-confidence matches: returns skipped
   - No high-confidence matches: returns no-match
   - Match just below threshold (0.949): no-match
   - Match at threshold (0.95): matched
   - Merge direction: matched + unmatched → keep matched
   - Merge direction: two unmatched, one has transactions → keep transaction one
   - Various confidence levels

Requirements:

- Threshold must be exactly 0.95
- Handle ambiguous matches correctly
- Merge direction logic must match spec
- All tests must pass

Deliverable: Core auto-match logic with comprehensive tests for all scenarios.

```

---

### Prompt 16: Auto-Match Complete Integration

```

Building on all previous steps, complete the auto-match function with merge integration.

STEP 16: AUTO-MATCH COMPLETE INTEGRATION

Wire up the auto-match function with database and merge functionality.

Create:

1. Extend src/db/chargeRepository.ts:

```typescript
export interface ChargeRepository {
  // ... existing methods ...

  /**
   * Get all unmatched charges
   */
  getUnmatchedCharges(): Promise<Charge[]>;

  /**
   * Get all charges (for auto-match candidate pool)
   */
  getAllCharges(): Promise<Charge[]>;

  /**
   * Merge source charge into target charge
   * @param sourceChargeId - Charge to be deleted
   * @param targetChargeId - Charge to receive data
   */
  mergeCharges(sourceChargeId: string, targetChargeId: string): Promise<void>;
}
```

2. Create src/matching/autoMatchService.ts:

```typescript
/**
 * Auto-match all unmatched charges
 * @param userId - Current user ID
 * @param repository - Charge repository
 * @returns Summary of matches made
 */
export async function autoMatchAllCharges(
  userId: string,
  repository: ChargeRepository,
): Promise<AutoMatchOutput>;
```

3. Implement the full flow:
   - Load all unmatched charges
   - Load all charges (for candidate pool)
   - For each unmatched charge:
     - Process with processChargeForAutoMatch
     - If matched: execute merge via repository
     - Track merged charges to exclude from further processing
     - If skipped: add to skippedCharges
     - Handle errors: capture and continue
   - Return summary

4. Create tests in **tests**/autoMatchService.test.ts:
   - Empty database: returns 0 matches
   - All matched: returns 0 matches
   - Single unmatched with good match: executes merge
   - Multiple unmatched: processes all
   - Ambiguous matches: skips correctly
   - Mixed scenarios: some match, some skip, some no-match
   - Errors during merge: captured in errors field
   - Merged charges excluded from further matching in same run
   - Verify merge direction is correct
   - Verify final database state

Requirements:

- Must integrate with merge functionality
- Error handling must be robust
- Merged charges must be excluded from pool
- All tests must pass
- Include end-to-end integration test

Deliverable: Complete auto-match function with full integration and comprehensive testing.

```

---

### Prompt 17: Final Integration and Error Handling Polish

```

Final step: Polish error handling, add input validation, and create final integration tests.

STEP 17: FINAL INTEGRATION AND ERROR HANDLING

Complete the system with production-ready error handling and validation.

Create:

1. A new file: src/validation/chargeValidator.ts:

```typescript
/**
 * Validate a charge is properly formed for matching
 * @throws Error with descriptive message if invalid
 */
export function validateChargeForMatching(charge: Charge): void;

/**
 * Check if charge is matched or unmatched
 */
export function isChargeMatched(charge: Charge): boolean;

/**
 * Check if charge has only transactions (no accounting docs)
 */
export function hasOnlyTransactions(charge: Charge): boolean;

/**
 * Check if charge has only accounting documents (no transactions)
 */
export function hasOnlyDocuments(charge: Charge): boolean;
```

2. Update src/errors.ts (create if not exists):

```typescript
export class MatchingError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any,
  ) {
    super(message);
    this.name = 'MatchingError';
  }
}

export class ValidationError extends MatchingError {
  constructor(message: string, details?: any) {
    super(message, 'VALIDATION_ERROR', details);
  }
}

export class AggregationError extends MatchingError {
  constructor(message: string, details?: any) {
    super(message, 'AGGREGATION_ERROR', details);
  }
}

// Add other specific error types
```

3. Refactor existing functions to use proper error types:
   - Update aggregators to throw AggregationError
   - Update validators to throw ValidationError
   - Update business extraction to throw appropriate errors
   - Ensure all error messages are descriptive and actionable

4. Create src/index.ts (main export file):

```typescript
// Export main public API
export { findMatchesForCharge } from './matching/singleMatchService';
export { autoMatchAllCharges } from './matching/autoMatchService';
export type { SingleMatchOutput, AutoMatchOutput, MatchResult } from './types';

// Export repository interface for consumers
export type { ChargeRepository } from './db/chargeRepository';
```

5. Create comprehensive integration tests in **tests**/integration/:
   - integration/singleMatch.integration.test.ts
   - integration/autoMatch.integration.test.ts
   - Test realistic scenarios with full data
   - Test all error paths end-to-end
   - Test edge cases from specification
   - Performance tests with larger datasets

6. Create a README.md with:
   - Usage examples
   - API documentation
   - Error handling guide
   - Configuration options

Requirements:

- All errors must be properly typed
- Error messages must be clear and actionable
- Validation must be comprehensive
- All integration tests must pass
- Code coverage should be >90%
- README must have clear examples

Deliverable: Production-ready matching system with complete error handling, validation,
comprehensive tests, and documentation.

```

---

## Summary

This implementation plan breaks down the matching system into 17 carefully sized steps:

**Steps 1-7**: Foundation (types, setup, core calculators)
**Steps 8-10**: Data processing (aggregation, normalization)
**Steps 11-12**: Scoring infrastructure
**Steps 13-14**: Single-match function (core + integration)
**Steps 15-16**: Auto-match function (core + integration)
**Step 17**: Polish and production readiness

Each step:
- ✅ Builds on previous work
- ✅ Has clear deliverables
- ✅ Includes comprehensive tests
- ✅ Is small enough to implement safely
- ✅ Is large enough to make progress
- ✅ Integrates immediately (no orphaned code)
- ✅ Follows test-driven development

The prompts are designed to be given sequentially to a code-generation LLM, with each building on the complete context of previous steps. The implementation follows best practices with strong typing, pure functions where possible, comprehensive error handling, and thorough testing at every stage.
```
