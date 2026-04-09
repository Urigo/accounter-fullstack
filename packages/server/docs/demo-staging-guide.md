# Demo / Staging Dataset Developer Guide

**Owner**: Accounter Fullstack Team  
**Status**: Active  
**Last Updated**: 2024-11-30  
**Related**: `docs/archive/demo-staging-dataset-spec.md`,
`docs/archive/demo-staging-dataset-todo.md`

---

## Overview

The demo staging dataset system provides a **use-case-driven approach** to seeding rich,
deterministic financial data for staging environments. Each use-case represents a complete financial
scenario (e.g., "monthly expense with foreign currency", "shareholder dividend", "client payment +
refund cycle") that can be deployed with a single command.

### Key Features

- **Deterministic UUIDs**: Stable entity IDs across deploys via UUID v5 generation
- **Modular Registry**: Self-contained use-case fixtures with metadata
- **Destructive Reset**: Clean slate on each deploy (domain data only; schema preserved)
- **Production Safeguards**: Hard refusal to run in production environments
- **Comprehensive Validation**: Ledger balance checks, entity reconciliation, VAT verification

### Architecture Components

```
Use-Case Registry → Seed Orchestrator → Validation Layer
       ↓                   ↓                    ↓
  TypeScript modules   scripts/seed-demo    validate-demo
  (fixtures + meta)    (DB population)      (integrity checks)
```

---

## Quick Start

### Prerequisites

- Docker Compose Postgres running locally
- Migrations applied: `yarn workspace @accounter/migrations migration:run`
- Environment variables configured (see `.env.example`)

### Local Seed & Validate

```bash
# Seed demo data (requires explicit flag)
ALLOW_DEMO_SEED=1 yarn seed:staging-demo

# Validate seeded data
yarn validate:demo

# Combined workflow (recommended)
ALLOW_DEMO_SEED=1 yarn seed:staging-demo && yarn validate:demo
```

### Expected Output

**Seed Script** (successful run):

```
✅ Connected to database
🧹 Clearing existing demo data...
✅ Domain tables cleared
✅ Seeding countries...
✅ Seeding FIAT exchange rates...
✅ Seeding VAT defaults...
✅ Creating admin business context...
✅ Admin Business ID: e153a289-b7e7-5735-8379-e62e859c88ab
📦 Loading 3 use-cases...
📦 Monthly Expense (Foreign Currency) (monthly-expense-foreign-currency)
📦 Shareholder Dividend (Q4 2024) (shareholder-dividend)
📦 Client Payment with Refund (client-payment-with-refund)
✅ All use-cases seeded successfully
✅ Demo data seed complete
```

**Validation Script** (successful run):

```
✅ Demo data validation passed
```

### Local Development (No Auth0)

Use this flow when you want to run the app locally without logging in through Auth0.

1. Seed demo data and copy the printed demo user ids:

```bash
ALLOW_DEMO_SEED=1 yarn seed:staging-demo
```

The seed script prints both `adminUserId` and `accountantUserId`.

2. Configure local environment variables:

```bash
# Bypass toggle (server + client)
ALLOW_DEV_AUTH=1

# Optional: attach real Auth0 id to seeded demo admin user
DEMO_AUTH0_USER_ID=

# Choose which seeded user to impersonate
DEV_AUTH_USER_ID=<adminUserId-or-accountantUserId>
```

3. Switch roles by swapping `DEV_AUTH_USER_ID`:

- Use `adminUserId` for `business_owner` context.
- Use `accountantUserId` for `accountant` context.

Restart client and server after changing environment variables.

---

## Adding a Use-Case

Follow these steps to create a new financial scenario fixture:

### Step 1: Create Use-Case File

Create a new file in the appropriate category folder:

```bash
# Example: Adding a payroll use-case
touch packages/server/src/demo-fixtures/use-cases/payroll/monthly-salary-payment.ts
```

### Step 2: Define Use-Case Spec

```typescript
// packages/server/src/demo-fixtures/use-cases/payroll/monthly-salary-payment.ts

import { Currency, CountryCode } from '@shared/enums'
import { makeUUID } from '../../helpers/deterministic-uuid.js'
import type { UseCaseSpec } from '../../types.js'

export const monthlySalaryPayment: UseCaseSpec = {
  id: 'monthly-salary-payment',
  name: 'Monthly Salary Payment',
  description: 'Employee salary payment with tax withholding and social security deductions',
  category: 'payroll',
  fixtures: {
    businesses: [
      {
        id: makeUUID('business', 'employee-john-doe'),
        name: 'John Doe (Employee)',
        country: CountryCode.Isr,
        canSettleWithReceipt: true
      }
    ],
    taxCategories: [
      {
        id: makeUUID('tax-category', 'salary-expenses'),
        name: 'Salary Expenses'
      },
      {
        id: makeUUID('tax-category', 'bank-account-ils'),
        name: 'Bank Account (ILS)'
      }
    ],
    financialAccounts: [
      {
        accountNumber: 'PAYROLL-ACCOUNT-001',
        type: 'BANK_ACCOUNT',
        ownerId: '{{ADMIN_BUSINESS_ID}}',
        taxCategoryMappings: [
          {
            currency: Currency.Ils,
            taxCategoryId: makeUUID('tax-category', 'bank-account-ils')
          }
        ]
      }
    ],
    charges: [
      {
        id: makeUUID('charge', 'salary-payment-2024-11'),
        ownerId: '{{ADMIN_BUSINESS_ID}}',
        userDescription: 'November 2024 salary payment'
      }
    ],
    transactions: [
      {
        id: makeUUID('transaction', 'salary-payment-bank-transfer'),
        chargeId: makeUUID('charge', 'salary-payment-2024-11'),
        businessId: makeUUID('business', 'employee-john-doe'),
        accountNumber: 'PAYROLL-ACCOUNT-001',
        amount: '-15000', // 15,000 ILS expense
        currency: Currency.Ils,
        eventDate: '2024-11-30',
        debitDate: '2024-11-30'
      }
    ],
    documents: [
      {
        id: makeUUID('document', 'salary-slip-2024-11'),
        chargeId: makeUUID('charge', 'salary-payment-2024-11'),
        creditorId: makeUUID('business', 'employee-john-doe'),
        debtorId: '{{ADMIN_BUSINESS_ID}}',
        serialNumber: 'PAY-2024-11-001',
        type: 'RECEIPT',
        date: '2024-11-30',
        totalAmount: '15000',
        currencyCode: Currency.Ils
      }
    ]
  },
  metadata: {
    author: 'your-name',
    createdAt: '2024-11-30',
    updatedAt: '2024-11-30'
  },
  expectations: {
    ledgerRecordCount: 2, // Debit (salary expense) + Credit (bank account)
    totalDebitILS: '15000.00',
    totalCreditILS: '15000.00'
  }
}
```

### Step 3: Register Use-Case

Update the registry to include your new use-case:

```typescript
// packages/server/src/demo-fixtures/use-cases/index.ts

import { monthlyExpenseForeignCurrency } from './expenses/monthly-expense-foreign-currency.js'
import { shareholderDividend } from './equity/shareholder-dividend.js'
import { clientPaymentWithRefund } from './income/client-payment-with-refund.js'
import { monthlySalaryPayment } from './payroll/monthly-salary-payment.js' // Add import
import type { UseCaseSpec } from '../types.js'

export const USE_CASE_REGISTRY: Record<string, UseCaseSpec[]> = {
  expenses: [monthlyExpenseForeignCurrency],
  equity: [shareholderDividend],
  income: [clientPaymentWithRefund],
  payroll: [monthlySalaryPayment] // Add to registry
}

export function getAllUseCases(): UseCaseSpec[] {
  return Object.values(USE_CASE_REGISTRY).flat()
}
```

### Step 4: Validate Locally

Test your new use-case before deploying:

```bash
# Run TypeScript compiler
yarn workspace @accounter/server tsc --noEmit

# Seed with your new use-case
ALLOW_DEMO_SEED=1 yarn seed:staging-demo

# Validate integrity
yarn validate:demo
```

### Step 5: Commit & Deploy

```bash
git add packages/server/src/demo-fixtures/use-cases/
git commit -m "feat(demo): add monthly salary payment use-case"
git push
```

The next staging deploy will automatically include your use-case.

---

## Deterministic UUID Best Practices

### Naming Conventions

**Format**: Always use `kebab-case` for semantic names:

```typescript
// ✅ Good
makeUUID('business', 'acme-consulting-llc')
makeUUID('charge', 'consulting-invoice-2024-11')
makeUUID('transaction', 'bank-transfer-usd-500')

// ❌ Bad
makeUUID('business', 'Acme Consulting LLC')
makeUUID('charge', 'consulting_invoice_2024_11')
makeUUID('transaction', 'BankTransfer500')
```

### Namespace Guidelines

**Entity Type as Namespace**: Use the entity type as the namespace to prevent collisions:

```typescript
// ✅ Good - Different entities, different namespaces
const businessId = makeUUID('business', 'acme-corp')
const chargeId = makeUUID('charge', 'acme-corp')
// These produce different UUIDs even with same name

// ❌ Bad - Risk of collision
const businessId = makeUUID('entities', 'acme-corp-business')
const chargeId = makeUUID('entities', 'acme-corp-charge')
```

### Stability Rules

**Never change a semantic name once deployed**:

```typescript
// ❌ BREAKING: Changing the name breaks external references
// Old version (deployed):
makeUUID('business', 'supplier-acme-llc')

// New version (breaks UUIDs):
makeUUID('business', 'supplier-acme-inc') // Different UUID!

// ✅ If entity changes, create a new version:
makeUUID('business', 'supplier-acme-llc-v2')
```

### Uniqueness Verification

Combine entity type + descriptive name to ensure no collisions:

```typescript
// ✅ Good - Unique combinations
makeUUID('business', 'us-supplier-acme-llc')
makeUUID('business', 'uk-supplier-acme-ltd')
makeUUID('charge', 'november-expense-2024')
makeUUID('charge', 'december-expense-2024')

// ⚠️ Be specific to avoid accidental duplicates
makeUUID('business', 'supplier-1') // Too generic
makeUUID('business', 'supplier-2') // Better: 'supplier-acme-llc'
```

### Placeholder Usage

Use `{{ADMIN_BUSINESS_ID}}` for admin context references (resolved at seed time):

```typescript
// ✅ Good - Placeholder for runtime resolution
charges: [
  {
    id: makeUUID('charge', 'my-charge'),
    ownerId: '{{ADMIN_BUSINESS_ID}}', // Replaced during seed
    userDescription: 'Test charge',
  },
],

// ❌ Bad - Hardcoded UUID breaks determinism
ownerId: 'e153a289-b7e7-5735-8379-e62e859c88ab', // Don't hardcode
```

---

## Troubleshooting

### Seed Script Issues

#### Error: "Refusing to seed demo data in production environment"

**Cause**: `NODE_ENV=production` is set.

**Solution**: This is intentional protection. Never run seed script in production.

```bash
# For local/staging only
NODE_ENV=development ALLOW_DEMO_SEED=1 yarn seed:staging-demo
```

---

#### Error: "ALLOW_DEMO_SEED=1 required to run demo seed"

**Cause**: Safety flag not set.

**Solution**: Explicitly enable seeding:

```bash
ALLOW_DEMO_SEED=1 yarn seed:staging-demo
```

---

#### Error: "Foreign key violation on business_id"

**Cause**: Use-case references a business that doesn't exist in fixtures.

**Solution**: Ensure all referenced entities are defined in the use-case:

```typescript
// ❌ Bad - Transaction references undefined business
transactions: [
  {
    businessId: makeUUID('business', 'some-vendor'), // Not in fixtures.businesses!
    // ...
  },
],

// ✅ Good - Business defined in fixtures
fixtures: {
  businesses: [
    {
      id: makeUUID('business', 'some-vendor'),
      name: 'Some Vendor LLC',
      country: CountryCode.Usa,
    },
  ],
  transactions: [
    {
      businessId: makeUUID('business', 'some-vendor'), // Reference exists
      // ...
    },
  ],
},
```

---

#### Error: "Fixture insertion failed"

**Cause**: Validation failed or database constraint violation.

**Solution**: Check detailed error in stack trace. Common issues:

1. **Missing required fields**: Ensure all NOT NULL columns have values
2. **Type mismatch**: Use `Currency.Ils` not `'ILS'` (enums required)
3. **Invalid dates**: Use ISO format `'2024-11-30'` not `'30/11/2024'`
4. **Amount format**: Use strings for numeric amounts: `'-500'` not `-500`

---

### Validation Script Issues

#### Error: "Accounter Admin Business entity missing"

**Cause**: Admin business context not created during seed.

**Solution**: Check `createAdminBusinessContext()` succeeded:

```bash
# Re-run seed with verbose logging
ALLOW_DEMO_SEED=1 yarn seed:staging-demo 2>&1 | grep -i "admin"

# Should see:
# ✅ Creating admin business context...
# ✅ Admin Business ID: e153a289-...
```

---

#### Error: "Charge count mismatch: expected X, got Y"

**Cause**: Seed script didn't insert all use-case charges.

**Solution**:

1. Check for seed errors (scroll up in terminal output)
2. Verify all use-cases registered in `use-cases/index.ts`
3. Re-run seed with clean DB:

```bash
# Reset DB (if needed)
yarn workspace @accounter/migrations db:reset
yarn workspace @accounter/migrations migration:run

# Re-seed
ALLOW_DEMO_SEED=1 yarn seed:staging-demo
```

---

#### Error: "Ledger unbalanced for charge X"

**Cause**: Ledger generation produced unbalanced entries (debits ≠ credits).

**Solution**: This indicates a bug in ledger generation logic, not the demo data. File an issue
with:

- Use-case ID
- Expected vs actual debit/credit totals
- Ledger records JSON (query DB directly)

---

### Import/TypeScript Issues

#### Error: "Cannot find module '@shared/enums'"

**Cause**: Missing or incorrect import path.

**Solution**: Ensure enums are imported correctly:

```typescript
// ✅ Good
import { Currency, CountryCode } from '@shared/enums'

// ❌ Bad
import { Currency } from '../../../shared/enums' // Relative path breaks
```

---

#### Error: "Type 'string' is not assignable to type 'Currency'"

**Cause**: Using string literals instead of enum values.

**Solution**: Use enum values:

```typescript
// ✅ Good
currency: Currency.Ils,
currencyCode: Currency.Usd,

// ❌ Bad
currency: 'ILS', // Type error
currencyCode: 'USD',
```

---

### Database Connection Issues

#### Error: "ECONNREFUSED 127.0.0.1:5432"

**Cause**: Postgres not running or wrong connection settings.

**Solution**:

```bash
# Check Postgres running
docker ps | grep postgres

# Start if not running
docker-compose -f docker/docker-compose.dev.yml up -d

# Verify env vars
cat .env | grep POSTGRES
```

---

## Render Build Command Example

### Staging Environment Configuration

**Build Command** (set in Render dashboard):

```bash
yarn install \
  && yarn build \
  && yarn workspace @accounter/migrations migration:run \
  && ALLOW_DEMO_SEED=1 yarn seed:staging-demo \
  && yarn validate:demo
```

**Breakdown**:

1. `yarn install` - Install dependencies
2. `yarn build` - Compile TypeScript
3. `yarn workspace @accounter/migrations migration:run` - Apply schema migrations
4. `ALLOW_DEMO_SEED=1 yarn seed:staging-demo` - Seed demo data (with safety flag)
5. `yarn validate:demo` - Verify data integrity (fails deploy if validation errors)

### Environment Variables

Set these in Render dashboard for staging environment:

```bash
# Database
POSTGRES_HOST=<render-internal-postgres-host>
POSTGRES_PORT=5432
POSTGRES_DB=accounter_staging
POSTGRES_USER=accounter_user
POSTGRES_PASSWORD=<secret-from-render>
POSTGRES_SSL=1

# Environment
NODE_ENV=staging
ALLOW_DEMO_SEED=1

# Auth (set manually in dashboard)
AUTHORIZED_USERS=demo@accounter.local,admin@accounter.local
```

### Deployment Workflow

```
Git Push → Render Webhook → Build Command Execution:
                               1. Install
                               2. Build
                               3. Migrate
                               4. Seed ✅
                               5. Validate ✅
                               6. Deploy
```

If validation fails (exit code 1), Render will **not deploy** the build, preventing broken data from
reaching staging.

### Post-Deploy Verification

After successful deployment, verify via UI:

1. Navigate to staging URL: `https://accounter-staging.onrender.com`
2. Login with `AUTHORIZED_USERS` credentials
3. Check dashboard for:
   - 3+ charges visible (one per use-case)
   - Transactions in multiple currencies (ILS, USD)
   - Ledger entries balanced
4. Spot-check foreign currency conversion (e.g., 500 USD → 1750 ILS @ 3.5 rate)

---

## Additional Resources

- **Specification**: `docs/demo-staging-dataset-spec.md` - Complete technical spec
- **Implementation Plan**: `docs/demo-staging-dataset-prompt-plan.md` - Step-by-step prompts
- **TODO Checklist**: `docs/demo-staging-dataset-todo.md` - Progress tracking
- **Fixture Loader**: `packages/server/src/__tests__/helpers/fixture-loader.ts` - DB insertion logic
- **Validators**: `packages/server/src/demo-fixtures/validators/` - Ledger validation rules

---

## Support

For questions or issues:

1. Check this guide's Troubleshooting section
2. Review seed script logs for detailed error messages
3. Inspect validation output for specific failures
4. File an issue with reproducible steps if bug suspected

---

**Last Updated**: 2024-11-30  
**Maintained By**: Accounter Fullstack Team
