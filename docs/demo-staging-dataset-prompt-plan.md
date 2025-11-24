# Demo Staging Dataset Implementation Prompt Plan

**Owner**: Accounter Fullstack Team  
**Status**: Ready for Sequential Execution  
**Created**: 2024-11-24  
**Related**: `docs/demo-staging-dataset-spec.md`

---

## Overview

This document provides a step-by-step prompt sequence for implementing the demo staging dataset
system via code-generation LLM. Each prompt is self-contained, references prior outputs, and builds
incrementally without creating orphaned code.

**Usage**: Execute prompts sequentially. Verify compilation/tests after each step before proceeding.

---

## Implementation Phases

### Phase 1: Foundation & Setup (Prompts 1-4)

- Directory structure
- Type definitions
- UUID utility
- Placeholder resolver
- Registry skeleton

### Phase 2: Use-Case Implementations (Prompts 5-8)

- Foreign currency expense
- Shareholder dividend
- Client payment + refund
- Registry population

### Phase 3: Foundation Helpers (Prompts 9-11)

- Admin context extraction
- Exchange rates seeder
- VAT default seeder

### Phase 4: Seed Orchestrator (Prompts 12-15)

- Script skeleton with guards
- Destructive reset
- Foundation integration
- Use-case loading

### Phase 5: Validation Layer (Prompts 16-21)

- Script skeleton
- Admin business check
- Charge count reconciliation
- Ledger balance validation
- VAT presence check

### Phase 6: Testing (Prompts 22-24)

- UUID determinism tests
- Registry integrity tests
- Integration seed/validate test

### Phase 7: Hardening (Prompts 25-26)

- Structured logging
- Error handling

### Phase 8: Documentation & Wiring (Prompts 27-30)

- Developer guide
- README updates
- Package.json scripts
- Final consistency pass

### Phase 9: Optional Enhancements (Prompt 31+)

- Zod validation
- Future features (deferred)

---

## Sequential Prompts

### Prompt 1: Directory & Types

```text
You are implementing the demo staging dataset system.

Task:
1. Create directory: packages/server/src/demo-fixtures/{helpers,use-cases/expenses,use-cases/income,use-cases/equity}
2. Create file packages/server/src/demo-fixtures/types.ts defining:
   - Interface UseCaseSpec: id, name, description, category ('expenses'|'income'|'equity'|'payroll'|'other'), fixtures (businesses, taxCategories, financialAccounts, charges, transactions, documents, tags?), metadata (author, createdAt, updatedAt, volumeMultiplier?), expectations? (ledgerRecordCount, totalDebitILS?, totalCreditILS?)
   - Define minimal fixture interfaces: BusinessFixture, TaxCategoryFixture, FinancialAccountFixture (include taxCategoryMappings?), ChargeFixture, TransactionFixture, DocumentFixture, TagFixture.

Constraints:
- No external dependencies yet (no Zod).
- Use explicit types; keep fields optional only where logically nullable.
- Export all interfaces.
Return the file content only.
```

**Expected Output**: `types.ts` with all interfaces exported.

**Verification**: TypeScript compiles without errors.

---

### Prompt 2: Deterministic UUID Utility

```text
Implement packages/server/src/demo-fixtures/helpers/deterministic-uuid.ts.

Requirements:
- Use uuid v5 (assume dependency exists).
- Constant DEMO_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8'.
- Export function makeUUID(namespace: string, name: string): string combining as `${namespace}:${name}`.
- Add JSDoc with examples and warnings about name stability.

Return full file.
```

**Expected Output**: `deterministic-uuid.ts` with UUID v5 implementation.

**Verification**: Import compiles; manual test shows consistent output.

---

### Prompt 3: Placeholder Resolver

```text
Create packages/server/src/demo-fixtures/helpers/placeholder.ts.

Export function:
- resolveAdminPlaceholders<T>(fixture: T, adminBusinessId: string): T
Implementation:
- JSON stringify fixture, replace all occurrences of {{ADMIN_BUSINESS_ID}}, parse back.

Return full file.
```

**Expected Output**: `placeholder.ts` with generic resolver function.

**Verification**: Type safety preserved; manual test with sample object.

---

### Prompt 4: Use-Case Registry Skeleton

```text
Create packages/server/src/demo-fixtures/use-cases/index.ts.

Export:
- const USE_CASE_REGISTRY: Record<string, UseCaseSpec[]> with keys: expenses, income, equity (all empty arrays initially).
- function getAllUseCases(): UseCaseSpec[] flattening registry.

Import UseCaseSpec from ../types.

Return file.
```

**Expected Output**: `use-cases/index.ts` with empty registry.

**Verification**: Imports resolve; getAllUseCases returns empty array.

---

### Prompt 5: First Use-Case (Foreign Currency Expense)

```text
Create packages/server/src/demo-fixtures/use-cases/expenses/monthly-expense-foreign-currency.ts.

Implement a UseCaseSpec:
- id: 'monthly-expense-foreign-currency'
- name, description meaningful
- category: 'expenses'
- fixtures: one business (us supplier), one tax category (consulting), one financial account (USD bank), one charge, one transaction, one document.
- Use makeUUID for every id.
- Use placeholder '{{ADMIN_BUSINESS_ID}}' for owner references.
- expectations: ledgerRecordCount: 2 only (no totals yet)
Import dependencies from deterministic-uuid.ts and types file.

Return file.
```

**Expected Output**: Complete use-case file with fixtures using deterministic UUIDs.

**Verification**: TypeScript compiles; UUIDs are valid format.

---

### Prompt 6: Second Use-Case (Shareholder Dividend)

```text
Create packages/server/src/demo-fixtures/use-cases/equity/shareholder-dividend.ts.

Model:
- Business: 'Dividends Withholding Tax'
- Tax category: 'Dividend'
- Charge: 'dividend-distribution-2024-q4'
- Transaction: representing dividend payout (negative amount)
- Document: optional (type 'INVOICE' or 'STATEMENT') with date.

Expectations: ledgerRecordCount: 2.

Return file.
```

**Expected Output**: Dividend use-case with equity-specific fixtures.

**Verification**: All UUIDs deterministic; compiles cleanly.

---

### Prompt 7: Third Use-Case (Client Payment + Refund)

```text
Create packages/server/src/demo-fixtures/use-cases/income/client-payment-with-refund.ts.

Fixtures:
- Business: client 'Acme Retail Client'
- Tax category: 'Service Income'
- Financial account: ILS bank account
- Two charges:
  - charge 1: client invoice
  - charge 2: refund credit
- Transactions:
  - Payment transaction (negative -> income)
  - Refund transaction (positive -> reversal)
- Documents:
  - Invoice document
  - Credit invoice document

Expectations: omit totals; ledgerRecordCount: 4 (2 per charge if symmetrical).

Return file.
```

**Expected Output**: Income use-case with multi-charge refund scenario.

**Verification**: Relationships (charge_id, business_id) use consistent UUIDs.

---

### Prompt 8: Populate Registry

```text
Update packages/server/src/demo-fixtures/use-cases/index.ts to import the three use-case files and place them in the appropriate arrays (expenses, equity, income). Keep getAllUseCases unchanged.

Return updated file.
```

**Expected Output**: Registry with three use-cases registered.

**Verification**: `getAllUseCases()` returns array of 3 items.

---

### Prompt 9: Extract Admin Context Helper

```text
Create packages/server/src/demo-fixtures/helpers/admin-context.ts.

Goal:
- Extract minimal logic from existing scripts/seed.ts to create admin business context.
- Export async function createAdminBusinessContext(client): Promise<string> returning admin business entity id.
Simplifications:
- Insert 'Admin Business' financial entity if missing, set owner_id to itself.
- Return its id.

Do not yet migrate the full context from seed.ts (postponed).

Return file.
```

**Expected Output**: `admin-context.ts` with simplified admin business creation.

**Verification**: Function signature correct; SQL syntax valid.

---

### Prompt 10: Seed Exchange Rates Helper

```text
Create packages/server/src/demo-fixtures/helpers/seed-exchange-rates.ts.

Export async function seedExchangeRates(client).
Insert rows into exchange_rates (from_currency, to_currency, rate, date = CURRENT_DATE).
Rates: USD→ILS 3.5, EUR→ILS 4.0, GBP→ILS 4.5.
Use ON CONFLICT (from_currency, to_currency, date) DO UPDATE SET rate.

Return file.
```

**Expected Output**: `seed-exchange-rates.ts` with parameterized insert logic.

**Verification**: SQL parameterization correct; no SQL injection risk.

---

### Prompt 11: Seed VAT Helper

```text
Create packages/server/src/demo-fixtures/helpers/seed-vat.ts.

Export async function seedVATDefault(client).
Insert into vat_value (percentage, effective_date='2024-01-01').
Use ON CONFLICT (effective_date) DO NOTHING.

Return file.
```

**Expected Output**: `seed-vat.ts` with idempotent VAT row insertion.

**Verification**: ON CONFLICT clause matches schema constraints.

---

### Prompt 12: Seed Script Skeleton

```text
Create scripts/seed-demo-data.ts skeleton:
- Reads env via dotenv
- Guard checks: NODE_ENV !== 'production', ALLOW_DEMO_SEED === '1'
- Connect pg.Client
- Logs connection
- Exits after connection (no logic yet)

Return file.
```

**Expected Output**: Seed script with guardrails and connection setup.

**Verification**: Script runs and exits cleanly with guards active.

---

### Prompt 13: Add Destructive Reset

```text
Update scripts/seed-demo-data.ts:
- After connection, add TRUNCATE statement for domain tables as per spec.
- Log success.

Return updated file only.
```

**Expected Output**: Seed script with TRUNCATE block added.

**Verification**: SQL syntax correct; logs appear.

---

### Prompt 14: Integrate Foundation Seeders

```text
Update scripts/seed-demo-data.ts:
- Import seedCountries, seedExchangeRates, seedVATDefault, createAdminBusinessContext.
- Call them in sequence.
- Capture adminBusinessId.

Return updated file.
```

**Expected Output**: Foundation seeders wired into main seed flow.

**Verification**: All imports resolve; adminBusinessId captured.

---

### Prompt 15: Registry Iteration & Fixture Insertion

```text
Update scripts/seed-demo-data.ts:
- Import getAllUseCases, resolveAdminPlaceholders, insertFixture.
- Iterate use-cases; resolve placeholders; call insertFixture(client, resolved.fixtures).
- Add logging per use-case.
- Add updateEnvFile helper inline (simple append/replace).
- On success: console.log completion; ensure client.end in finally.

Return updated file.
```

**Expected Output**: Complete seed script with use-case loading.

**Verification**: Script runs end-to-end (dry run or against test DB); no errors.

---

### Prompt 16: Validation Script Skeleton

```text
Create packages/server/src/demo-fixtures/validate-demo-data.ts:
- Connect to DB.
- Skeleton function validateDemoData with try/finally.
- Placeholder comments for steps.

Return file.
```

**Expected Output**: Validation script scaffold.

**Verification**: Compiles; connects and disconnects cleanly.

---

### Prompt 17: Implement Admin Business Check

```text
Update validate-demo-data.ts:
- Query financial_entities for Admin Business.
- If missing, push error.
- If no errors yet, log progress.

Return updated file.
```

**Expected Output**: Admin business existence check added.

**Verification**: Query runs; error accumulation works.

---

### Prompt 18: Implement Charge Count Reconciliation

```text
Update validate-demo-data.ts:
- Import getAllUseCases.
- Compute expectedChargeCount (sum of charges length).
- Query actual charge count.
- Push error on mismatch.

Return updated file.
```

**Expected Output**: Charge count validation added.

**Verification**: Count query correct; comparison logic sound.

---

### Prompt 19: Single Ledger Balance Check

```text
Update validate-demo-data.ts:
- For first use-case with expectations, fetch ledger_records by first charge id.
- Sum debit/credit local amounts.
- Check balance tolerance 0.01; push error if mismatch.

Return updated file.
```

**Expected Output**: Ledger balance check for one use-case.

**Verification**: Arithmetic correct; tolerance applied.

---

### Prompt 20: Expand Ledger Balance to All With Expectations

```text
Update validate-demo-data.ts:
- Iterate all use-cases with expectations.
- Perform same debit/credit balance logic.
- Include ledgerRecordCount check.

Return updated file.
```

**Expected Output**: Comprehensive ledger validation.

**Verification**: Iterates correctly; no duplicate checks.

---

### Prompt 21: VAT Presence Check

```text
Update validate-demo-data.ts:
- Query vat_value for percentage=17.
- Push error if none.

If errors exist: log each and exit 1; else log success.

Return updated file.
```

**Expected Output**: Complete validation script with VAT check and exit logic.

**Verification**: Exits 0 on success, 1 on any error.

---

### Prompt 22: UUID Unit Test

```text
Create packages/server/src/demo-fixtures/__tests__/deterministic-uuid.test.ts:
- Tests: same inputs produce same UUID; different names produce different UUID; different namespaces differ.

Return file.
```

**Expected Output**: Unit test file with 3 test cases.

**Verification**: Tests pass when run via vitest.

---

### Prompt 23: Registry Integrity Test

```text
Create packages/server/src/demo-fixtures/__tests__/use-case-registry.test.ts:
- Ensure no duplicate ids.
- Ensure required fields (id, name, category, fixtures).

Return file.
```

**Expected Output**: Registry validation tests.

**Verification**: Tests pass with current 3 use-cases.

---

### Prompt 24: Integration Seed/Validate Test (Optional)

```text
Create packages/server/src/demo-fixtures/__tests__/seed-and-validate.test.ts:
- Spawns seed-demo-data via child_process.
- Then runs validate-demo-data.
- Asserts both exit codes = 0.

Return file.
```

**Expected Output**: End-to-end integration test.

**Verification**: Test passes locally with `ALLOW_DEMO_SEED=1`.

---

### Prompt 25: Structured Logging Enhancements

```text
Update scripts/seed-demo-data.ts:
- Prefix logs: ✅ success, ❌ errors, 📦 use-case load, 🧹 purge step.
- Wrap main body in try/catch with custom DemoSeedError class defined inline.

Return updated file.
```

**Expected Output**: Enhanced logging with emoji prefixes.

**Verification**: Logs readable and consistent.

---

### Prompt 26: Add DemoSeedError Class

```text
Update scripts/seed-demo-data.ts:
- Add class DemoSeedError extends Error { constructor(message, cause?) { super(message); this.cause = cause; } }
- Use new DemoSeedError in catch blocks when wrapping thrown errors.

Return updated file.
```

**Expected Output**: Custom error class integrated.

**Verification**: Error wrapping preserves stack traces.

---

### Prompt 27: Developer Guide Creation

```text
Create packages/server/docs/demo-staging-guide.md:
Sections:
- Overview
- Quick Start (local seed/validate commands)
- Adding a Use-Case (step list)
- Deterministic UUID Best Practices
- Troubleshooting
- Render Build Command Example

Return file.
```

**Expected Output**: Complete developer guide markdown.

**Verification**: Links resolve; commands accurate.

---

### Prompt 28: Root README Update

```text
Update packages/server/README.md:
- Add new section 'Demo Staging Dataset'
- Reference commands: yarn seed:demo, yarn validate:demo
- Link to spec and guide files.

Return diff only.
```

**Expected Output**: README diff with new section.

**Verification**: Markdown renders correctly.

---

### Prompt 29: Add Scripts to package.json

```text
Update root package.json:
- Add "seed:demo": "tsx scripts/seed-demo-data.ts"
- Add "validate:demo": "tsx packages/server/src/demo-fixtures/validate-demo-data.ts"

Return modified snippet.
```

**Expected Output**: Package.json scripts section with new entries.

**Verification**: `yarn seed:demo --help` shows script exists.

---

### Prompt 30: Final Consistency Pass

```text
List all imports in new files; ensure relative paths correct (no missing .js in ESM if required).
Do not change logic, only adjust paths or extensions.

Return list of corrections applied.
```

**Expected Output**: List of import path fixes.

**Verification**: All files compile; no module resolution errors.

---

### Prompt 31: Optional Zod Validation (Deferred Feature)

```text
Add zod schema in types.ts (UseCaseSpecSchema) validating structure.
Integrate schema check inside use-cases/index.ts when building registry (throw descriptive error if invalid).

Return updated files.
```

**Expected Output**: Runtime schema validation via Zod.

**Verification**: Invalid use-case throws descriptive error.

**Note**: Defer this to post-MVP unless requested.

---

## Post-Implementation Checklist

After completing all prompts:

- [ ] All TypeScript files compile without errors
- [ ] Unit tests pass (deterministic-uuid, registry integrity)
- [ ] Integration test passes locally with `ALLOW_DEMO_SEED=1`
- [ ] Seed script guards prevent production runs
- [ ] Validation script exits 0 on success, 1 on failures
- [ ] Developer guide accessible and accurate
- [ ] Package.json scripts callable via `yarn seed:demo` / `yarn validate:demo`
- [ ] All imports use correct relative paths with `.js` extensions if ESM
- [ ] No orphaned code or unused files
- [ ] Documentation references match actual file locations

---

## Optional Future Enhancements (Not in Current Plan)

### Selective Use-Case Loading

```text
Update scripts/seed-demo-data.ts:
- Add CLI argument parsing (yargs or minimist)
- Support --include=category1,category2
- Support --exclude=category3
- Filter getAllUseCases() output before iteration

Return updated seed script.
```

### Volume Multipliers

```text
Update scripts/seed-demo-data.ts:
- Check useCase.metadata.volumeMultiplier
- If present, duplicate fixtures N times with incremented UUIDs (append -1, -2, etc.)
- Adjust dates proportionally (monthly intervals)

Return updated fixture duplication logic.
```

### HTML Use-Case Catalog

```text
Create scripts/generate-use-case-catalog.ts:
- Import getAllUseCases
- Generate HTML table with columns: Category, Name, Description, Fixtures Count, Expectations
- Write to packages/server/docs/use-case-catalog.html

Return script + sample HTML output.
```

### Live Exchange Rate Integration

```text
Update helpers/seed-exchange-rates.ts:
- Add optional API fetch (ECB or similar)
- Fallback to hardcoded rates on failure
- Store rate source timestamp in DB comment or metadata table

Return updated helper with API integration.
```

---

## Usage Instructions

1. **Sequential Execution**: Run prompts 1–30 in strict order
2. **Verification**: After each prompt, compile and run tests before proceeding
3. **No Skipping**: Do not combine or skip prompts unless explicitly deferred
4. **Error Handling**: If a prompt fails, fix the issue before continuing
5. **Context Preservation**: Each prompt assumes outputs from all prior prompts exist

---

## Troubleshooting Guide

### Import Path Errors

- Symptom: `Cannot find module` or `Module not found`
- Fix: Verify `.js` extension in ESM imports; check relative path depth
- Prompt to fix: Run Prompt 30 (Final Consistency Pass)

### Type Errors in Fixtures

- Symptom: `Type 'X' is not assignable to type 'Y'`
- Fix: Review fixture type definitions in `types.ts`; ensure all required fields present
- Prompt to revisit: Prompt 1 (Directory & Types)

### Seed Script Guards Failing

- Symptom: Script exits immediately with guard error
- Fix: Set `ALLOW_DEMO_SEED=1` and ensure `NODE_ENV !== 'production'`
- Prompt to review: Prompt 12 (Seed Script Skeleton)

### Validation Fails After Successful Seed

- Symptom: Validation script exits 1 despite seed success
- Fix: Check expected vs actual counts; verify ledger generation ran
- Prompt to review: Prompts 17–21 (Validation checks)

### UUID Collisions

- Symptom: Same UUID appears for different entities
- Fix: Ensure unique semantic names in `makeUUID` calls
- Prompt to review: Prompt 2 (Deterministic UUID Utility)

### Database Connection Errors

- Symptom: `ECONNREFUSED` or timeout errors
- Fix: Verify Postgres running, env vars correct (`POSTGRES_HOST`, etc.)
- Not a prompt issue: Check local Docker Compose setup

---

## Acceptance Criteria Mapping

| Acceptance Criterion                            | Covered by Prompts                       |
| ----------------------------------------------- | ---------------------------------------- |
| Use-case registry supports 3+ categories        | 4, 5–8                                   |
| MVP includes 5+ use-cases                       | 5–7 (3 initial; add 2+ via same pattern) |
| Deterministic UUID utility stable               | 2, 22                                    |
| Seed script refuses production                  | 12                                       |
| Seed completes in < 60 seconds                  | 15 (monitor during execution)            |
| Validation detects missing admin/charges/ledger | 17–21                                    |
| Render staging deploy integrates seed+validate  | 29 (scripts), 27 (guide)                 |
| Developer guide published                       | 27                                       |
| At least one use-case has ledger expectations   | 5, 6, 7                                  |
| Exchange rates seeded                           | 10, 14                                   |
| VAT default seeded                              | 11, 14                                   |
| All fixtures use enums (Currency, CountryCode)  | 5–7 (enforce in use-case prompts)        |

---

## Timeline Estimate

- **Prompts 1–11**: ~2–3 hours (foundation + helpers)
- **Prompts 12–15**: ~1–2 hours (seed orchestrator)
- **Prompts 16–21**: ~1–2 hours (validation layer)
- **Prompts 22–26**: ~1 hour (tests + hardening)
- **Prompts 27–30**: ~1 hour (docs + wiring)
- **Total**: ~6–9 hours for sequential implementation + verification

---

**End of Prompt Plan**

**Next Steps**: Begin execution at Prompt 1. Track progress in issue tracker. Report blockers
immediately.
