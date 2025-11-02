# Transaction-Document Matching System - Complete Specification

## 1. Overview

This specification defines a matching system for the Accounter fullstack application that suggests
and automatically links transactions with their corresponding financial documents (invoices,
receipts, etc.). The system uses a confidence-based scoring algorithm to identify potential matches
and provides both manual review and automatic matching capabilities.

**Project Context:**

- This is a GraphQL-based application using TypeScript
- Server: `packages/server/` - GraphQL modules architecture
- Client: `packages/client/` - React-based UI
- Database: PostgreSQL with schema in `accounter_schema`
- Uses UUID for IDs, not strings

## 2. Core Functionality

### 2.1 Functions (GraphQL API)

#### 2.1.1 Single-Match Function (Query)

**Purpose:** Find potential matches for a single unmatched charge

**GraphQL Query:**

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

**Input:**

- `chargeId: UUID` - The ID of an unmatched charge
- User ID is extracted from authentication context via `@auth` directive

**Output:**

```typescript
{
  matches: Array<{
    chargeId: string; // UUID
    confidenceScore: number; // 0.00 to 1.00, two decimal precision
  }>;
}
```

- Returns up to 5 matches, ordered by confidence score (highest first)
- Returns fewer than 5 if fewer candidates exist
- Returns empty array if no matches found

**Behavior:**

1. Validate input charge is unmatched (throw error if has both transactions and accounting docs)
2. Determine if charge has transactions or documents
3. Search for complementary charges (matched or unmatched) within 12-month window
4. Calculate confidence scores for all candidates
5. Return top 5 by confidence, with date proximity as tie-breaker

#### 2.1.2 Auto-Match Function (Mutation)

**Purpose:** Automatically match all unmatched charges above confidence threshold

**GraphQL Mutation:**

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

**Input:**

- User ID is extracted from authentication context via `@auth` directive

**Output:**

```typescript
{
  totalMatches: number;
  mergedCharges: Array<{
    chargeId: string; // UUID of the deleted/merged-away charge
    confidenceScore: number;
  }>;
  skippedCharges: string[]; // UUID array - Charge IDs with multiple ≥95% matches
  errors: any;
}
```

**Behavior:**

1. Retrieve all unmatched charges
2. For each unmatched charge:
   - Search for matches across all charges with complementary data (no time restriction)
   - Calculate confidence scores
   - If exactly one match ≥ 0.95: execute merge
   - If multiple matches ≥ 0.95: skip and add to `skippedCharges`
   - If no matches ≥ 0.95: skip silently
3. Exclude merged charges from further matching in same run
4. Return summary of actions taken

**Merge Priority:**

- If merging matched + unmatched: keep matched charge
- If merging two unmatched: keep transaction charge
- Transaction charge is always deleted (its data moved to surviving charge)
- Uses existing `mergeCharges` mutation

---

## 3. Data Definitions

### 3.1 Database Schema (PostgreSQL)

**Relevant tables from `accounter_schema`:**

```sql
-- charges table
CREATE TABLE accounter_schema.charges (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL REFERENCES accounter_schema.businesses,
  is_conversion BOOLEAN DEFAULT false,
  is_property BOOLEAN DEFAULT false,
  accountant_reviewed BOOLEAN DEFAULT false,
  user_description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  tax_category_id UUID REFERENCES accounter_schema.tax_categories
);

-- transactions table
CREATE TABLE accounter_schema.transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES accounter_schema.financial_accounts,
  charge_id UUID NOT NULL REFERENCES accounter_schema.charges,
  source_id UUID NOT NULL,
  source_description TEXT,
  currency accounter_schema.currency NOT NULL,
  event_date DATE NOT NULL,
  debit_date DATE,
  amount NUMERIC NOT NULL,
  current_balance NUMERIC NOT NULL,
  business_id UUID REFERENCES accounter_schema.businesses,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_fee BOOLEAN
);

-- documents table (charge_id is the actual FK)
CREATE TABLE accounter_schema.documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  image_url TEXT,
  file_url TEXT,
  type accounter_schema.document_type DEFAULT 'UNPROCESSED',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  modified_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  serial_number TEXT,
  date DATE,
  total_amount DOUBLE PRECISION,
  currency_code accounter_schema.currency,
  vat_amount DOUBLE PRECISION,
  debtor TEXT,
  creditor TEXT,
  is_reviewed BOOLEAN DEFAULT false,
  charge_id UUID REFERENCES accounter_schema.charges,
  debtor_id UUID,
  creditor_id UUID,
  description TEXT,
  no_vat_amount NUMERIC
);
```

### 3.2 TypeScript Interfaces (for matching logic)

```typescript
// Simplified for matching purposes
interface Transaction {
  id: string; // UUID
  account_id: string; // UUID
  charge_id: string; // UUID
  amount: number; // numeric in DB
  business_id: string | null; // UUID
  currency: Currency;
  event_date: Date;
  debit_date: Date | null;
  source_description: string | null;
  current_balance: number; // numeric in DB
  created_at: Date;
  updated_at: Date;
  is_fee: boolean | null;
}

interface Document {
  id: string; // UUID
  charge_id: string | null; // UUID (actual FK name in DB)
  creditor_id: string | null; // UUID
  debtor_id: string | null; // UUID
  currency_code: Currency | null;
  date: Date | null;
  total_amount: number | null; // double precision in DB
  type: DocumentType;
  vat_amount: number | null;
  no_vat_amount: number | null;
  serial_number: string | null;
  is_reviewed: boolean;
  created_at: Date;
  modified_at: Date;
  image_url: string | null;
  file_url: string | null;
}

type Currency = 'ILS' | 'USD' | 'EUR' | 'GBP' | 'USDC' | 'GRT' | 'ETH';

type DocumentType =
  | 'CREDIT_INVOICE'
  | 'INVOICE'
  | 'INVOICE_RECEIPT'
  | 'OTHER'
  | 'PROFORMA'
  | 'RECEIPT'
  | 'UNPROCESSED';
```

### 3.3 Key Definitions

**Accounting Document Types:** INVOICE, CREDIT_INVOICE, RECEIPT, INVOICE_RECEIPT

**Unmatched Charge:**

- Has ≥1 transactions AND 0 accounting documents, OR
- Has 0 transactions AND ≥1 accounting documents
- Note: PROFORMA, OTHER, UNPROCESSED documents don't count toward matched/unmatched status

**Matched Charge:**

- Has both ≥1 transactions AND ≥1 accounting documents

**Important Field Notes:**

- All IDs are UUIDs
- Amounts are stored as `numeric` or `double precision` in DB
- Transaction amounts already have correct sign (positive/negative)
- Document `debtor` and `creditor` text fields are deprecated, use `debtor_id` and `creditor_id`
  UUIDs

---

## 4. Matching Algorithm

### 4.1 Candidate Filtering

**Exclusions:**

- Transactions where `is_fee = true`
- Documents where `total_amount` is null
- Documents where `currency_code` is null
- Charges that share the same `charge_id` as the input (data integrity check - throw error if found)

**Time Window (Single-Match Only):**

- 12 months before and after the reference date
- Reference date determination:
  - For transaction charges: use aggregated transaction date
  - For document charges: use aggregated document date
  - Window centers on this date ± 12 months

**Direction:**

- Transaction charges match against document charges only
- Document charges match against transaction charges only
- No transaction-to-transaction or document-to-document matching

### 4.2 Multi-Item Charge Aggregation

When a charge contains multiple transactions or documents:

**Transaction Aggregation:**

1. Exclude transactions where `is_fee = true`
2. If multiple currencies exist: **throw error**
3. If multiple non-null business IDs exist: **throw error**
4. Amount: sum of all amounts
5. Currency: the common currency
6. Business ID: the single non-null business ID (or null if all null)
7. Date: earliest `event_date`
8. Description: concatenate all `source_description` values with line breaks

**Document Aggregation:**

1. If both invoices/credit-invoices AND receipts/invoice-receipts exist: use only
   invoices/credit-invoices
2. If multiple currencies exist: **throw error**
3. If multiple non-null business IDs exist: **throw error**
4. Amount: sum of all normalized amounts (see 4.3.1)
5. Currency: the common currency
6. Business ID: the single non-null business ID (or null if all null)
7. Date: latest `date`
8. Description: concatenate identifiers (serial numbers, file names) with line breaks
9. Document type: use for date matching logic

### 4.3 Confidence Score Calculation

**Final Score Formula:**

```
confidence = (amount_conf × 0.4) + (currency_conf × 0.2) + (business_conf × 0.3) + (date_conf × 0.1)
```

#### 4.3.1 Amount Confidence

**Document Amount Normalization:**

1. Start with absolute value of `total_amount`
2. If business is creditor (see 4.3.3): negate
3. If document type is CREDIT_INVOICE: negate
4. Result is normalized amount for comparison

**Transaction Amount:** Use as-is (already correctly signed)

**Confidence Calculation:**

```
percentage_diff = |transaction_amount - normalized_doc_amount| / |transaction_amount|

if percentage_diff = 0:
  amount_conf = 1.0
else if percentage_diff <= (1 / |transaction_amount|):  // Within 1 currency unit
  amount_conf = 0.9
else if percentage_diff < 0.20:  // Between 1 unit and 20%
  // Linear degradation from 0.7 to 0.0
  amount_conf = 0.7 × (1 - (percentage_diff - 1/|transaction_amount|) / (0.20 - 1/|transaction_amount|))
else:
  amount_conf = 0.0
```

#### 4.3.2 Currency Confidence

```
if transaction.currency is null OR document.currency_code is null:
  currency_conf = 0.2
else if transaction.currency = document.currency_code:
  currency_conf = 1.0
else:
  currency_conf = 0.0
```

Note: No currency conversion - compare raw amounts even across currencies. Missing currency data
(null/undefined) receives partial confidence (0.2) to allow potential matches when other factors are
strong, while actual currency mismatches receive 0.0 confidence.

#### 4.3.3 Business Confidence

**Document Business Extraction:**

```
if creditor_id = userId AND debtor_id = userId:
  throw error  // Both sides are user
if creditor_id ≠ userId AND debtor_id ≠ userId:
  throw error  // Neither side is user

if debtor_id = userId:
  business_is_creditor = true
  document_business_id = creditor_id
else:  // creditor_id = userId
  business_is_creditor = false
  document_business_id = debtor_id
```

**Confidence Calculation:**

```
if transaction.business_id = document_business_id AND both not null:
  business_conf = 1.0
else if transaction.business_id is null OR document_business_id is null:
  business_conf = 0.5
else:  // Mismatch (both non-null but different)
  business_conf = 0.2
```

#### 4.3.4 Date Confidence

**Date Field Selection:**

Transaction date selection:

```
calculate confidence for event_date
```

Document date: use `date` field

**Confidence Calculation:**

```
days_diff = |transaction_date - document_date| in days

if days_diff >= 30:
  date_conf = 0.0
else:
  // Linear degradation from 1.0 to 0.0 over 30 days
  date_conf = 1.0 - (days_diff / 30)
```

### 4.4 Sorting and Selection

1. Calculate confidence for all candidates
2. Sort by confidence score (descending)
3. For ties: sort by date proximity (closer dates first)
4. Return top 5 matches

---

## 5. Error Handling

### 5.1 Single-Match Function

**Throw errors for:**

- Input charge is not unmatched (has both transactions and accounting docs)
- Input charge has mixed currencies in multi-item aggregation
- Input charge has multiple non-null business IDs in multi-item aggregation
- Document has both/neither creditor_id and debtor_id equal to userId
- Any database/query failures

### 5.2 Auto-Match Function

**Capture in `errors` field:**

- Any error that occurs during execution
- Return error details in response object
- Continue processing other charges when possible

**Skip and add to `skippedCharges`:**

- Charges with multiple matches ≥ 0.95 confidence

---

## 6. User Interface Requirements

### 6.1 Single-Match Modal (React Component)

**Location:** `packages/client/src/components/charges/ChargeMatchingModal.tsx`

**Trigger:**

- Button/action on charge detail screen
- Only available for unmatched charges
- Uses GraphQL query: `findChargeMatches`

**Display:**

- Modal/popup overlay (using existing modal component from UI library)
- List of up to 5 suggested matches showing:
  - Amount (formatted with currency symbol)
  - Currency code
  - Date(s) - appropriate date field for the match type
  - Business name (resolved from business_id)
  - Description (truncated if long)
  - Confidence score (formatted as percentage with color coding)
  - Badge/indicator if match is already matched

**Actions:**

- Click match to approve → triggers charge merge dialog
- Dismiss/reject suggestion (no tracking in v1)
- Close modal without action
- "View details" link → navigates to charge detail page of suggested match

**Merge Flow:**

- On approval, opens existing merge charge dialog
- Pre-fills with current charge and selected match
- User selects which charge to keep (baseChargeID)
- Calls existing `mergeCharges` mutation
- On success, refreshes charge data and closes modal

### 6.2 Auto-Match Action (React Component)

**Location:** `packages/client/src/components/charges/AutoMatchButton.tsx` or integrated into
charges list toolbar

**Trigger:**

- Manual button/action in charges list view
- Requires admin/accountant role via `@auth` directive
- Shows confirmation dialog before execution

**Behavior:**

- Shows loading indicator/progress overlay
- Executes `autoMatchCharges` GraphQL mutation
- Displays summary dialog on completion:
  - Total matches made (bold number)
  - Expandable list of merged charges with:
    - Original charge ID (clickable link)
    - Target charge ID (clickable link)
    - Confidence score (with percentage)
  - Skipped charges section (if any):
    - Charge IDs with "multiple high-confidence matches" warning
  - Error section (if any):
    - Error details with actionable messages

**Post-Action:**

- Refreshes charges list to reflect merged charges
- Shows toast notification with success/partial success/failure status
- Allows user to review merged charges

**Threshold:**

- Fixed at 0.95 (95% confidence) in backend
- May be configurable via environment variable in future

---

## 7. Implementation Notes

### 7.1 Assumptions

- User ID is extracted from GraphQL context via authentication middleware
- Existing charge merge mutation is available in GraphQL schema:
  ```graphql
  mutation mergeCharges(
    baseChargeID: UUID!
    chargeIdsToMerge: [UUID!]!
    fields: UpdateChargeInput
  ): MergeChargeResult!
  ```
- Database queries can efficiently filter by date ranges and charge relationships
- Transaction amounts are stored as PostgreSQL `numeric` type
- Document amounts are stored as PostgreSQL `double precision` type
- The matching logic will be implemented as a new GraphQL module in
  `packages/server/src/modules/charges-matcher/`

### 7.2 Fields Ignored

- `account_id` - matching is account-agnostic
- `source_id` - internal reference only
- `exchange_rate_override` - not used for matching
- `created_at`, `updated_at`, `modified_at` - not used for matching logic
- Document legacy text fields: `debtor`, `creditor` - use UUID references instead
- `is_reviewed`, `accountant_reviewed` - not used for matching
- All other fields not explicitly mentioned in matching criteria

### 7.3 Performance Considerations

- Single-match: 12-month window reduces search space
- Auto-match: No time restriction - may need optimization for large datasets
- Existing database indexes are already in place:
  - `transactions_charge_id_index` on `charge_id`
  - `transactions_event_date_index` on `event_date`
  - `transactions_debit_date_index` on `debit_date`
  - `transactions_amount_index` on `amount`
  - `documents_charge_id_index` on `charge_id`
  - `documents_date_index` on `date`
  - `documents_total_amount_index` on `total_amount`
  - `documents_debtor_id_index` and `documents_creditor_id_index`
- May want to batch database queries in auto-match function
- Consider using GraphQL DataLoader for charge queries to prevent N+1 issues

---

## 8. Testing Plan

### 8.1 Unit Tests

**Amount Confidence:**

- Exact match (0% diff) → 1.0
- 0.5 unit diff → 0.9
- 1 unit diff → 0.9
- 2 unit diff → starts degrading from 0.7
- 10% diff → mid-range degradation
- 20% diff → 0.0
- > 20% diff → 0.0

**Currency Confidence:**

- Same currency → 1.0
- One or both null → 0.2
- Different currency → 0.0

**Business Confidence:**

- Exact match → 1.0
- One null → 0.5
- Both null → 0.5
- Mismatch → 0.2

**Date Confidence:**

- Same day → 1.0
- 1 day diff → ~0.967
- 15 days diff → 0.5
- 29 days diff → ~0.033
- 30+ days diff → 0.0

**Document Amount Normalization:**

- Regular invoice, business debtor: positive
- Regular invoice, business creditor: negative
- Credit invoice, business debtor: negative
- Credit invoice, business creditor: positive

**Final Score Calculation:**

- Verify weighted formula: (0.4 × amount) + (0.2 × currency) + (0.3 × business) + (0.1 × date)
- Test edge cases: all 1.0, all 0.0, mixed scores

### 8.2 Integration Tests

**Single-Match Function:**

- Valid unmatched transaction charge → returns matches
- Valid unmatched document charge → returns matches
- Matched charge input → throws error
- Charge with mixed currencies → throws error
- Charge with multiple businesses → throws error
- No candidates found → returns empty array
- Fewer than 5 candidates → returns available matches
- Tie-breaking on confidence score → sorts by date proximity
- 12-month window filtering → excludes out-of-range candidates
- Fee transactions excluded from matching

**Auto-Match Function:**

- Single high-confidence match → merges correctly
- Multiple high-confidence matches → skips and reports
- No high-confidence matches → skips silently
- Mixed scenarios → processes correctly
- Merged charges excluded from further matching in same run
- Merge direction priority: matched > transaction charge
- Time window: no restrictions

**Multi-Item Aggregation:**

- Multiple transactions: sum amounts, use earliest date, concatenate descriptions
- Multiple documents: sum amounts, use latest date, filter by type priority
- Mixed currencies → throws error
- Multiple businesses → throws error
- Fee transactions ignored in aggregation

**Date Field Selection:**

- Invoice → uses event_date
- Credit invoice → uses event_date
- Receipt → uses event_date
- Invoice-receipt → uses event_date
- Proforma/Other/Unprocessed → uses event_date

**Business Identification:**

- Debtor is user → business is creditor
- Creditor is user → business is debtor
- Both are user → throws error
- Neither is user → throws error
- One is user, other is null → business is null but side is known

### 8.3 End-to-End Tests

**Single-Match User Flow:**

1. User views unmatched transaction
2. Clicks "Find Matches"
3. Modal displays top 5 suggestions with all required fields
4. User clicks "View Details" → new tab opens with charge details
5. User approves a match → merge UI appears with both charge IDs
6. User selects destination charge → merge executes
7. Verify final state: one merged charge with both transaction and document

**Auto-Match User Flow:**

1. System has mix of matched/unmatched charges
2. User clicks "Auto-Match All"
3. Loading indicator appears
4. Function processes all unmatched charges
5. Summary displays: matches made, skipped charges, errors
6. Verify database state: appropriate charges merged, skipped ones unchanged
7. Verify merge direction: matched charges preserved, transaction charges prioritized

**Edge Cases:**

- Empty database → functions handle gracefully
- All charges already matched → auto-match reports 0 matches
- Single unmatched charge, no candidates → returns empty matches
- Cross-currency matching → heavily penalized but still suggested
- Documents without dates → skipped (date is mandatory via null currency/amount check)
- Transactions without debit dates → fallback to event_date

### 8.4 Data Validation Tests

**Mandatory Fields:**

- Document missing total_amount → excluded
- Document missing currency_code → excluded
- Transaction is_fee = true → excluded
- Document with null date → excluded (via amount/currency mandatory check)

**Boundary Conditions:**

- Exactly 12 months difference → included in single-match
- 12 months + 1 day → excluded from single-match
- Confidence exactly 0.95 → auto-matches
- Confidence 0.9499... → does not auto-match
- Amount difference exactly 1 unit → 0.9 confidence
- Amount difference exactly 20% → 0.0 confidence

---

## 9. Future Considerations

### 9.1 Open Questions for Future Enhancement

1. **Configurable Parameters:**
   - Allow user to adjust auto-match confidence threshold
   - Configurable time window for single-match (currently fixed at 12 months)
   - Adjustable confidence weights for different factors

2. **Match Rejection Tracking:**
   - Currently not tracking when users reject suggestions
   - Could implement learning from user behavior
   - Potentially suppress repeatedly rejected pairs

3. **Many-to-Many Matching:**
   - Current scope is 1-to-1 only
   - Future: handle scenarios like:
     - Single transaction covering multiple invoices
     - Multiple transactions for one invoice (partial payments)
   - Would require more complex UI and logic

4. **Description-Based Matching:**
   - Currently descriptions are display-only
   - Could add text similarity scoring to confidence calculation
   - NLP/fuzzy matching on merchant names, transaction descriptions

5. **Performance Optimization:**
   - Auto-match on large datasets may be slow
   - Consider: background job processing, incremental matching
   - Caching strategies for frequently accessed charges

6. **Machine Learning:**
   - Learn from user's approval/rejection patterns
   - Adjust weights dynamically per user/business
   - Identify new matching patterns

7. **Batch Operations:**
   - Currently auto-match is all-or-nothing
   - Future: allow selecting specific date ranges or businesses
   - Bulk approve/reject functionality

8. **Reporting:**
   - Match success rate analytics
   - Common reasons for skipped matches
   - Unmatched items aging report

9. **API Architecture:**
   - Current spec focuses on core logic only
   - Future: define REST/GraphQL API structure
   - Rate limiting, authentication, pagination

10. **Currency Conversion:**
    - Currently comparing raw amounts across currencies
    - Future: integrate real exchange rate service
    - Historical rates for accurate comparisons

---

## 10. Dependencies

### 10.1 Required GraphQL Modules/Services

- **Existing Charges Module** (`packages/server/src/modules/charges/`)
  - Provides `mergeCharges` mutation
  - Charge queries and resolvers
  - Charge data providers

- **Existing Transactions Module** (`packages/server/src/modules/transactions/`)
  - Transaction queries and providers
  - Transaction data access

- **Existing Documents Module** (`packages/server/src/modules/documents/`)
  - Document queries and providers
  - Document data access

- **New Charges Matcher Module** (to be created at `packages/server/src/modules/charges-matcher/`)
  - Will contain matching logic
  - GraphQL typeDefs, resolvers, providers
  - Confidence calculation algorithms

### 10.2 Database Access Patterns

The matcher module will need database queries for:

- Charges (by UUID, by owner_id, by matched/unmatched status)
- Transactions (by charge_id, filtered by is_fee, with date ranges)
- Documents (by charge_id, filtered by type and null checks)
- Efficient filtering by:
  - Date ranges (event_date, debit_date, documents.date)
  - Currency codes
  - Business IDs (business_id, debtor_id, creditor_id)
  - Charge ownership (owner_id)

**Query Examples:**

```sql
-- Find unmatched charges with transactions only
SELECT c.* FROM accounter_schema.charges c
WHERE c.owner_id = $1
AND EXISTS (SELECT 1 FROM accounter_schema.transactions t WHERE t.charge_id = c.id)
AND NOT EXISTS (
  SELECT 1 FROM accounter_schema.documents d
  WHERE d.charge_id = c.id
  AND d.type IN ('INVOICE', 'CREDIT_INVOICE', 'RECEIPT', 'INVOICE_RECEIPT')
);

-- Find unmatched charges with documents only
SELECT c.* FROM accounter_schema.charges c
WHERE c.owner_id = $1
AND NOT EXISTS (SELECT 1 FROM accounter_schema.transactions t WHERE t.charge_id = c.id)
AND EXISTS (
  SELECT 1 FROM accounter_schema.documents d
  WHERE d.charge_id = c.id
  AND d.type IN ('INVOICE', 'CREDIT_INVOICE', 'RECEIPT', 'INVOICE_RECEIPT')
);
```

---

## 11. Success Criteria

### 11.1 Functional Requirements Met

- ✓ Single-match function returns relevant suggestions
- ✓ Auto-match function processes all unmatched charges
- ✓ Confidence scoring accurately reflects match quality
- ✓ UI allows manual review and approval
- ✓ Merge operations execute correctly with proper priority

### 11.2 Quality Metrics

- **Precision:** >90% of auto-matched pairs (≥95% confidence) are correct matches
- **Recall:** System suggests correct match in top 5 for >80% of matchable items
- **Performance:** Single-match completes in <2 seconds for typical dataset
- **User Satisfaction:** Users prefer automated matching over manual search

### 11.3 Acceptance Criteria

- All unit tests pass
- All integration tests pass
- End-to-end user flows work as specified
- Error handling prevents data corruption
- No matches created for ambiguous scenarios (multiple high-confidence options)

---

## 12. Glossary

- **Accounting Document:** INVOICE, CREDIT_INVOICE, RECEIPT, or INVOICE_RECEIPT type documents
- **Charge:** Parent entity linking transactions and documents
- **Complementary Data:** If charge has transactions, complementary is documents (and vice versa)
- **Confidence Score:** 0.0-1.0 value indicating match likelihood
- **Fee Transaction:** Transaction where `is_fee = true`, excluded from matching
- **Matched Charge:** Has both transactions and accounting documents
- **Normalized Amount:** Document amount after applying business side and credit invoice adjustments
- **Unmatched Charge:** Has only transactions OR only accounting documents, not both

---

## 13. Project-Specific Implementation Guide

### 13.1 Module Structure

Create new module at `packages/server/src/modules/charges-matcher/`:

```
packages/server/src/modules/charges-matcher/
├── index.ts                          # Module exports
├── types.ts                          # TypeScript types for matching
├── typeDefs/
│   └── charges-matcher.graphql.ts    # GraphQL schema definitions
├── resolvers/
│   ├── find-charge-matches.resolver.ts
│   └── auto-match-charges.resolver.ts
├── providers/
│   ├── charges-matcher.provider.ts   # Main matching logic
│   ├── confidence-calculator.provider.ts
│   └── charge-aggregator.provider.ts
└── helpers/
    ├── amount-confidence.helper.ts
    ├── currency-confidence.helper.ts
    ├── business-confidence.helper.ts
    ├── date-confidence.helper.ts
    └── document-normalizer.helper.ts
```

### 13.2 GraphQL Type Definitions

```typescript
// typeDefs/charges-matcher.graphql.ts
import { gql } from 'graphql-modules';

export default gql`
  extend type Query {
    findChargeMatches(chargeId: UUID!): ChargeMatchesResult! @auth(role: ACCOUNTANT)
  }

  extend type Mutation {
    autoMatchCharges: AutoMatchChargesResult! @auth(role: ACCOUNTANT)
  }

  type ChargeMatchesResult {
    matches: [ChargeMatch!]!
  }

  type ChargeMatch {
    chargeId: UUID!
    confidenceScore: Float!
  }

  type AutoMatchChargesResult {
    totalMatches: Int!
    mergedCharges: [MergedCharge!]!
    skippedCharges: [UUID!]!
    errors: [String!]
  }

  type MergedCharge {
    chargeId: UUID!
    confidenceScore: Float!
  }
`;
```

### 13.3 Database Provider Integration

Use existing providers from other modules:

```typescript
import { ChargesProvider } from '@modules/charges';
import { TransactionsProvider } from '@modules/transactions';
import { DocumentsProvider } from '@modules/documents';
```

### 13.4 Data Access Patterns

```typescript
// Example: Get charge with related data
async getChargeWithRelations(chargeId: string, injector: Injector) {
  const chargesProvider = injector.get(ChargesProvider);
  const transactionsProvider = injector.get(TransactionsProvider);
  const documentsProvider = injector.get(DocumentsProvider);

  const charge = await chargesProvider.getChargeById(chargeId);
  const transactions = await transactionsProvider.getTransactionsByChargeId(chargeId);
  const documents = await documentsProvider.getDocumentsByChargeId(chargeId);

  return { charge, transactions, documents };
}
```

### 13.5 Error Handling

Follow project patterns:

```typescript
import { CommonError } from '@modules/common';

// In resolver
if (!isUnmatchedCharge(charge, transactions, documents)) {
  return {
    __typename: 'CommonError',
    message: 'Charge is already matched and cannot be used for matching',
  };
}
```

### 13.6 Testing Strategy

Create tests following project structure:

```
packages/server/src/modules/charges-matcher/__tests__/
├── confidence-calculator.spec.ts
├── amount-confidence.spec.ts
├── charge-aggregation.spec.ts
├── find-matches.spec.ts
└── auto-match.spec.ts
```

Use existing test utilities and database helpers from other modules.

### 13.7 Migration Requirements

No database schema changes required - all necessary tables and indexes already exist.

Consider adding:

- Logging/audit trail for auto-match operations
- Performance monitoring for large-scale matching
- Optional: `charge_match_history` table for tracking rejected matches (future enhancement)

### 13.8 Integration with Existing Modules

1. **Charges Module**: Use existing merge logic
2. **Ledger Module**: Matching should respect ledger locks
3. **Financial Entities Module**: Use for business name resolution
4. **Tags Module**: Consider excluding charges with certain tags (e.g., "mistake")

### 13.9 Client Integration

Create components in `packages/client/src/components/charges/`:

```typescript
// ChargeMatchingModal.tsx - for single-match UI
// AutoMatchButton.tsx - for auto-match trigger
// ChargeMatchList.tsx - for displaying match results
```

Use existing UI components and patterns from the client package.
