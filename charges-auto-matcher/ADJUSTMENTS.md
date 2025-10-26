# SPEC.md Adjustments for Accounter Fullstack Project

## Overview

The SPEC.md has been updated to align with the Accounter fullstack project's architecture, database
schema, and conventions.

## Key Changes Made

### 1. **Architecture Updates**

#### GraphQL API (instead of generic functions)

- **Before**: Generic function signatures with `userId` parameters
- **After**: GraphQL queries and mutations with `@auth` directive for user context
  - `Query.findChargeMatches(chargeId: UUID!)`
  - `Mutation.autoMatchCharges`

#### Module-Based Structure

- Added guidance for creating new module at `packages/server/src/modules/charges-matcher/`
- Follows existing module patterns (typeDefs, resolvers, providers, helpers)

### 2. **Database Schema Alignment**

#### Actual PostgreSQL Schema

- **Before**: Generic TypeScript interfaces with string IDs
- **After**: Actual database schema from `accounter_schema`:
  - `charges` table structure
  - `transactions` table structure
  - `documents` table structure with correct field names

#### Critical Field Name Corrections

- All IDs are UUIDs (not strings)
- Amount fields: `numeric` or `double precision` (not string)

#### Removed Non-Existent Fields

- Removed: `debit_date_override`, `debit_timestamp`, `counter_account`, `origin_key`,
  `source_origin`, `source_reference`, `allocation_number`, `vat_report_date_override`,
  `exchange_rate_override`, `file_hash`
- These fields don't exist in the actual database schema

### 3. **Type System Updates**

#### Currency Type

- **Before**: Generic `currency` type
- **After**: Actual PostgreSQL enum: `'ILS' | 'USD' | 'EUR' | 'GBP' | 'USDC' | 'GRT' | 'ETH'`

#### Document Type

- **Before**: Generic `document_type`
- **After**: Actual PostgreSQL enum matching database

#### UUID Usage

- Changed all ID types from `string` to UUID
- Added notes about UUID generation

### 4. **Performance Considerations**

#### Existing Database Indexes

Added documentation of already-existing indexes:

- `transactions_charge_id_index`
- `transactions_event_date_index`
- `transactions_debit_date_index`
- `transactions_amount_index`
- `documents_charge_id_new_index`
- `documents_date_index`
- `documents_total_amount_index`
- `documents_debtor_id_index`
- `documents_creditor_id_index`

#### GraphQL-Specific Optimizations

- Mentioned DataLoader for preventing N+1 queries
- Integration with existing providers

### 5. **Implementation Guide**

Added **Section 13: Project-Specific Implementation Guide** with:

- Recommended module structure
- GraphQL type definitions
- Database provider integration patterns
- Error handling following project conventions
- Testing strategy
- Migration requirements (none needed!)
- Integration points with existing modules
- Client-side component guidance

### 6. **Dependencies Section**

#### Before

- Generic `mergeCharges` function

#### After

- Actual GraphQL mutation structure:
  ```graphql
  mutation mergeCharges(
    baseChargeID: UUID!
    chargeIdsToMerge: [UUID!]!
    fields: UpdateChargeInput
  ): MergeChargeResult!
  ```
- References to existing modules (Charges, Transactions, Documents)
- SQL query examples for finding unmatched charges

### 7. **UI/UX Updates**

#### React Components

- Specified component locations in `packages/client/src/components/charges/`
- Added GraphQL query/mutation usage examples
- Referenced existing UI patterns and modal components
- Added color-coding for confidence scores
- Integration with existing merge charge dialog

### 8. **Fields Documentation**

#### Important Notes Added

- Transaction amounts already have correct sign
- Document legacy text fields (`debtor`, `creditor`) are deprecated
- Use UUID references (`debtor_id`, `creditor_id`) instead
- Clear documentation of which fields to ignore

### 9. **Authentication**

- **Before**: Explicit `userId` parameters
- **After**: `@auth(role: ACCOUNTANT)` directive in GraphQL
- User context extracted from authentication middleware

## What Stayed the Same

The following core logic remains unchanged:

- Confidence calculation algorithms
- Amount normalization rules
- Business identification logic
- Date selection logic
- Aggregation rules for multi-item charges
- 95% confidence threshold for auto-matching
- 12-month window for single-match
- Merge priority rules

## Migration Impact

**Good News**: No database migrations needed!

- All required tables exist
- All required indexes exist
- All required enums exist

## Next Steps

1. ✅ Review adjusted SPEC.md
2. ✅ Review updated PROMPT_PLAN.md and TODO.md
3. Implement following the Project-Specific Implementation Guide (SPEC.md Section 13)
4. Use existing modules as reference:
   - `packages/server/src/modules/charges/` for charge handling patterns
   - `packages/server/src/modules/transactions/` for transaction queries
   - `packages/server/src/modules/documents/` for document queries
5. Follow test patterns from existing modules
6. Integrate with client using existing component patterns

## Summary of PROMPT_PLAN.md and TODO.md Updates

### Architecture Changes

- Changed from standalone project to GraphQL module
- Use `packages/server/src/modules/charges-matcher/` structure
- Follow existing module patterns (typeDefs, resolvers, providers, helpers)
- Use dependency injection with `@Injectable()` and `@Inject()`

### Directory Structure Changes

- `src/calculators/` → `helpers/` (following project conventions)
- `src/matching/` → `providers/` (GraphQL provider pattern)
- `src/db/chargeRepository.ts` → use existing providers (ChargesProvider, TransactionsProvider,
  DocumentsProvider)

### Field Name Corrections

- Transactions use `source_description` (not just `description`)
- All IDs are UUIDs (string type, but semantically UUIDs)
- Amounts are `number` type (numeric/double precision in DB)
- Currency is enum type, not generic string

### Integration Points

- Use `ChargesProvider.mergeCharges()` for merging (existing mutation)
- Extract `userId` from GraphQL context via `@auth` directive
- Return errors using `CommonError` pattern
- Use DataLoader patterns to prevent N+1 queries

## Files Modified

- ✅ `charges-auto-matcher/SPEC.md` - Fully adjusted to project
- ✅ `charges-auto-matcher/PROMPT_PLAN.md` - Updated with GraphQL module architecture
- ✅ `charges-auto-matcher/TODO.md` - Updated with correct field names and module structure
- 📝 `charges-auto-matcher/ADJUSTMENTS.md` - This summary document
