# Demo / Staging Dataset TODO Checklist

Owner: Accounter Fullstack Team  
Status: In Progress  
Related: `docs/demo-staging-dataset-spec.md`, `docs/demo-staging-dataset-prompt-plan.md`

---

## Legend

- [ ] = Not started
- [~] = In progress / partially done
- [>] = Blocked / needs input
- [x] = Complete

You can replace markers as work progresses.

---

## Phase 1: Foundation & Setup

- [x] 1. Create directories:
     `packages/server/src/demo-fixtures/{helpers,use-cases/expenses,use-cases/income,use-cases/equity}`
- [x] 2. Implement `types.ts` with all fixture & `UseCaseSpec` interfaces
  - [x] Compile TS after creation (no errors)
- [x] 3. Add `helpers/deterministic-uuid.ts` (UUID v5 utility)
  - [x] Smoke test deterministic output (same inputs => same UUID)
- [x] 4. Add `helpers/placeholder.ts` (admin placeholder resolver)
  - [x] Test placeholder replacement with sample object
- [x] 5. Create `use-cases/index.ts` registry skeleton (empty arrays)
  - [x] Confirm `getAllUseCases()` returns `[]`

## Phase 2: Use-Case Implementations

- [x] 6. Add expense use-case: `monthly-expense-foreign-currency.ts`
  - [x] Ensure all IDs via `makeUUID`
  - [x] Include expectations.ledgerRecordCount
- [x] 7. Add equity use-case: `shareholder-dividend.ts`
  - [x] Include basic ledger expectations
- [x] 8. Add income use-case: `client-payment-with-refund.ts`
  - [x] Two charges, two transactions, two documents
- [x] 9. Update registry to include all three use-cases
  - [x] Verify `getAllUseCases().length === 3`
  - [x] Check for duplicate IDs

## Phase 3: Foundation Helpers

- [x] 10. Extract `admin-context.ts` helper (create / fetch Admin Business)
  - [x] Returns stable admin business entity ID
- [x] 11. Implement `seed-exchange-rates.ts` (USD/EUR/GBP → ILS)
  - [x] Uses ON CONFLICT upsert pattern
- [x] 12. Implement `seed-vat.ts` (VAT 17% default row)
  - [x] ON CONFLICT DO NOTHING

## Phase 4: Seed Orchestrator

- [x] 13. Create `scripts/seed-demo-data.ts` skeleton (env guards + DB connect)
  - [x] Guard: refuse if `NODE_ENV=production`
  - [x] Guard: require `ALLOW_DEMO_SEED=1`
- [x] 14. Add destructive reset TRUNCATE block (domain tables only)
  - [x] Verify reset does not drop schema
- [x] 15. Integrate foundation seeders (countries, FX rates, VAT, admin context)
  - [x] Log each step success
- [x] 16. Iterate registry use-cases, resolve placeholders, insert fixtures
  - [x] Add per-use-case logging
- [x] 17. Implement inline `updateEnvFile` for `DEFAULT_FINANCIAL_ENTITY_ID`
  - [x] Ensure id written / updated idempotently
- [x] 18. Finalize script with error handling + clean shutdown

## Phase 5: Validation Layer

- [x] 19. Create `validate-demo-data.ts` skeleton (connect + try/finally)
- [x] 20. Admin business existence check
- [ ] 21. Charge count reconciliation vs registry
- [ ] 22. Single ledger balance check (initial)
- [ ] 23. Expand to all use-cases with expectations
- [ ] 24. VAT presence check (percentage=17)
- [ ] 25. Aggregate errors and exit with code 1 if any
  - [ ] Log success with ✅ when all pass

## Phase 6: Testing

- [ ] 26. Add `__tests__/deterministic-uuid.test.ts`
  - [ ] Same inputs produce same UUID
  - [ ] Different namespaces differ
- [x] 27. Add `__tests__/use-case-registry.test.ts`
  - [x] No duplicate IDs
  - [x] All required fields present
- [ ] 28. Optional integration test `seed-and-validate.test.ts`
  - [ ] Run seed then validate (expect both exit 0)

## Phase 7: Hardening

- [ ] 29. Enhance logging prefixes (✅ / ❌ / 📦 / 🧹 / 💱 / 📊)
- [ ] 30. Add `DemoSeedError` class and wrap critical sections
  - [ ] Ensure original stack preserved

## Phase 8: Documentation & Wiring

- [ ] 31. Create developer guide `packages/server/docs/demo-staging-guide.md`
  - [ ] Sections: Overview, Quick Start, Adding Use-Case, UUID Best Practices, Troubleshooting
- [ ] 32. Update `packages/server/README.md` with Demo Dataset section
  - [ ] Link to spec & guide
- [ ] 33. Add scripts to root `package.json` (`seed:demo`, `validate:demo`)
  - [ ] Test scripts locally
- [ ] 34. Consistency pass (imports, `.js` extensions if needed under ESM)
  - [ ] Confirm `tsc` and `vitest` pass cleanly

## Acceptance Criteria Verification

- [ ] Registry has ≥3 categories (expenses, income, equity)
- [ ] ≥3 initial use-cases implemented (extendable to 5+ later)
- [ ] Deterministic UUID utility stable across runs
- [ ] Seed script refuses production
- [ ] Seed performance < 60s (target) on clean staging DB
- [ ] Validation catches: missing admin, charge mismatch, unbalanced ledger
- [ ] Exchange rates seeded (USD/EUR/GBP → ILS)
- [ ] VAT default (17%) present
- [ ] Use-cases use enums (`Currency`, `CountryCode`) where applicable
- [ ] Developer guide published
- [ ] Ledger expectations present in at least one use-case

## Deployment / Environment Tasks

- [ ] Render build command updated to include seed + validate
- [ ] Set `ALLOW_DEMO_SEED=1` in staging env
- [ ] Set `AUTHORIZED_USERS` (demo accounts) in staging env
- [ ] Confirm `DEFAULT_FINANCIAL_ENTITY_ID` written or manually set
- [ ] Post-deploy: run `yarn validate:demo` (expect success)

## Post-Seed Manual Verification (Staging UI)

- [ ] Login with authorized demo user
- [ ] Charges visible across categories
- [ ] Foreign currency transaction shows converted ILS ledger amounts
- [ ] Dividend use-case ledger balanced
- [ ] Refund scenario shows both payment + reversal
- [ ] VAT calculations consistent in documents (if applicable)

## Maintenance Tasks (Future)

- [ ] Add new use-case (follow guide steps)
- [ ] Annual exchange rate update (helper edit)
- [ ] VAT change: insert new effective_date row
- [ ] Add selective loading flags (deferred)
- [ ] Implement volumeMultiplier logic (deferred)
- [ ] Optional Zod schema validation integration
- [ ] HTML catalog generation script

## Quality & Consistency Checks

- [ ] No orphaned helper files
- [ ] All imports resolve without relative path errors
- [ ] No duplicate deterministic UUID semantic names
- [ ] Placeholder replacement verified (`{{ADMIN_BUSINESS_ID}}`)
- [ ] Validation script exits 0 (success) / 1 (fail) reliably
- [ ] Logs use consistent emoji prefixes

## Risk / Blockers Tracking

- [ ] DB schema changes requiring fixture updates
- [ ] Missing enum exports causing compile errors
- [ ] Foreign key constraints failing during insertion
- [ ] Environment variable misconfiguration (connection failures)

## Rollback Procedure (If Seed Fails in Staging)

- [ ] Capture logs (seed + validate)
- [ ] Re-run migrations
- [ ] Rerun seed with `ALLOW_DEMO_SEED=1`
- [ ] If persistent failure: disable seed step and investigate locally

---

### Quick Command Reference

```
# Local seed & validate
ALLOW_DEMO_SEED=1 yarn seed:demo && yarn validate:demo

# Run tests
yarn test

# Single script
ALLOW_DEMO_SEED=1 yarn seed:demo
yarn validate:demo
```

---

### Progress Notes

Use this section to record decisions, blockers, and clarifications as you progress.

- (Add dated entries here)

---

### Next Additions (Deferred Enhancements)

- Selective include/exclude flags
- volumeMultiplier duplication logic
- Zod runtime schema validation
- HTML catalog generation
- Live exchange rate API integration

---

This checklist is derived from the specification and prompt plan; update it if scope changes.
