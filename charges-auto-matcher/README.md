# Charges Auto-Matcher Module

## Overview

This directory contains the specification and implementation plan for a transaction-document
matching system for the Accounter fullstack application. The matcher uses a confidence-based
algorithm to automatically suggest and link financial transactions with their corresponding
documents (invoices, receipts, etc.).

## Documentation Files

### 📋 [SPEC.md](./SPEC.md)

**Complete technical specification** - Fully adjusted for the Accounter project

- GraphQL API definitions (queries and mutations)
- Database schema alignment (PostgreSQL)
- Confidence scoring algorithms (amount, currency, business, date)
- Data aggregation and normalization rules
- Project-specific implementation guide

### 🔨 [PROMPT_PLAN.md](./PROMPT_PLAN.md)

**Step-by-step implementation prompts** - 17 prompts for systematic development

- Updated for GraphQL module architecture
- Uses correct database field names (charge_id_new, source_description, etc.)
- Follows project module patterns
- Includes test strategies for each step

### ✅ [TODO.md](./TODO.md)

**Detailed implementation checklist** - Task-by-task breakdown

- Phase-by-phase implementation tasks
- Updated with correct types (UUID, Currency enum, DocumentType)
- GraphQL resolver and provider tasks
- Integration with existing modules

### 📝 [ADJUSTMENTS.md](./ADJUSTMENTS.md)

**Summary of changes** - What was adjusted and why

- List of all modifications made to align with the project
- Key field name corrections
- Architecture changes
- Database schema alignment notes

## Quick Start

### 1. Review the Specification

Start by reading [SPEC.md](./SPEC.md) to understand:

- The matching algorithm
- Confidence scoring formulas
- Database schema
- GraphQL API design

### 2. Follow the Implementation Plan

Use [PROMPT_PLAN.md](./PROMPT_PLAN.md) for step-by-step guidance:

- 17 implementation prompts
- Each builds on the previous
- Comprehensive test coverage at each step
- Can be used with AI coding assistants

### 3. Track Your Progress

Use [TODO.md](./TODO.md) as a checklist:

- Check off tasks as you complete them
- Verify specification compliance
- Track test coverage
- Ensure all edge cases are handled

## Module Structure

The matcher will be implemented at:

```
packages/server/src/modules/charges-matcher/
├── index.ts                          # Module exports
├── types.ts                          # TypeScript types
├── typeDefs/
│   └── charges-matcher.graphql.ts    # GraphQL schema
├── resolvers/
│   ├── index.ts
│   ├── find-charge-matches.resolver.ts
│   └── auto-match-charges.resolver.ts
├── providers/
│   ├── charges-matcher.provider.ts   # Main matching logic
│   ├── confidence-calculator.provider.ts
│   └── charge-aggregator.provider.ts
├── helpers/
│   ├── amount-confidence.helper.ts
│   ├── currency-confidence.helper.ts
│   ├── business-confidence.helper.ts
│   ├── date-confidence.helper.ts
│   ├── document-business.helper.ts
│   ├── document-amount.helper.ts
│   ├── transaction-aggregator.helper.ts
│   └── document-aggregator.helper.ts
└── __tests__/
    ├── integration/
    └── [unit test files]
```

## Key Features

### Single-Match Query

Find up to 5 potential matches for an unmatched charge:

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

### Auto-Match Mutation

Automatically match all unmatched charges above 95% confidence:

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

## Confidence Scoring

The matcher uses a weighted formula combining four factors:

| Factor       | Weight | Description                    |
| ------------ | ------ | ------------------------------ |
| **Amount**   | 40%    | How close the amounts are      |
| **Currency** | 20%    | Same currency vs. different    |
| **Business** | 30%    | Business ID match              |
| **Date**     | 10%    | Date proximity (30-day window) |

**Formula:** `confidence = (amount × 0.4) + (currency × 0.2) + (business × 0.3) + (date × 0.1)`

## Database Schema Alignment

### Key Field Names

- ✅ Documents use `charge_id_new` (FK to charges)
- ✅ Transactions use `source_description`
- ✅ All IDs are UUIDs
- ✅ Amounts are `numeric` or `double precision`
- ✅ Currency is an enum: `'ILS' | 'USD' | 'EUR' | 'GBP' | 'USDC' | 'GRT' | 'ETH'`

### No Migrations Needed

All required tables, indexes, and enums already exist in the database! ✨

## Integration Points

### Existing Modules

- **ChargesProvider**: Use `mergeCharges()` mutation
- **TransactionsProvider**: Load transaction data
- **DocumentsProvider**: Load document data
- **FinancialEntitiesProvider**: Resolve business names

### Authentication

User context is extracted via `@auth(role: ACCOUNTANT)` directive

### Error Handling

Use existing `CommonError` pattern for GraphQL error responses

## Testing Strategy

- **Unit tests**: All helper functions (>95% coverage)
- **Integration tests**: Providers with database
- **End-to-end tests**: Full GraphQL mutations/queries
- **Edge case tests**: Null handling, extreme values, boundary conditions

## Implementation Timeline

Following the 17 prompts in PROMPT_PLAN.md:

- **Phase 1-2** (Steps 1-7): Foundation & core calculations (~2-3 days)
- **Phase 3-4** (Steps 8-12): Data processing & scoring (~2-3 days)
- **Phase 5-6** (Steps 13-16): GraphQL integration (~2-3 days)
- **Phase 7-8** (Step 17 + testing): Polish & QA (~1-2 days)

**Total estimate**: 7-11 days for full implementation with comprehensive testing

## Success Criteria

- ✅ All unit tests pass (>85% coverage)
- ✅ Integration tests pass with real database
- ✅ GraphQL queries/mutations work correctly
- ✅ Follows existing project patterns
- ✅ Handles all edge cases from specification
- ✅ Performance: Single-match completes in <2 seconds

## Future Enhancements

See SPEC.md Section 9 for potential improvements:

- Configurable confidence thresholds
- Match rejection tracking (learning from user behavior)
- Description-based matching with NLP
- Many-to-many matching support
- Currency conversion with real-time rates

## References

- [Accounter Project Structure](../packages/server/src/modules/)
- [GraphQL Modules Documentation](https://the-guild.dev/graphql/modules)
- [PostgreSQL Database](../packages/migrations/)
- [Existing Charge Patterns](../packages/server/src/modules/charges/)

---

**Ready to start?** Begin with [SPEC.md](./SPEC.md) → [PROMPT_PLAN.md](./PROMPT_PLAN.md) →
[TODO.md](./TODO.md)
