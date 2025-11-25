# Demo / Staging Dataset System Specification

**Owner**: Accounter Fullstack Team  
**Status**: Ready for Implementation  
**Created**: 2024-11-24  
**Related**: `docs/demo-test-data/demo-test-data-plan.md`

---

## 1. Overview

This specification defines a **use-case-driven demo dataset system** that enables deployment of
rich, deterministic financial data to staging environments. The system provides a registry of
self-contained financial scenarios (e.g., "monthly expense with foreign currency", "shareholder
dividend", "client payment + refund cycle") that can be seeded with a single command for client
demos and exploratory testing.

### Key Characteristics

- **Use-case modular**: Each scenario is an independent fixture bundle with metadata
- **Deterministic**: UUIDs generated via semantic names ensure stability across deploys
- **Destructive reset**: DB content cleared on each staging deploy; schema preserved via migrations
- **All-in by default**: All registered use-cases load automatically (no selective filtering in MVP)
- **Guardrailed**: Hard-refuses production environments; requires explicit flag

---

## 2. Goals

- Provide one-command staging data provisioning for sales demos and client onboarding
- Enable rapid iteration on new financial scenarios without modifying seed logic
- Maintain stable entity UUIDs for external documentation/screenshots with embedded links
- Reuse existing test infrastructure (factories, fixture loader, validation helpers)
- Support annual maintenance cycles for exchange rates and VAT rules without code changes

---

## 3. Non-Goals (MVP)

- Selective use-case filtering (--include flag deferred to post-MVP)
- User credential seeding (auth handled via `AUTHORIZED_USERS` env var)
- Automated use-case discovery via filesystem scanning (explicit registry required)
- Performance optimization for >100 use-cases (threshold TBD based on actual growth)
- Multi-tenant admin business scenarios (single admin business in MVP)

---

## 4. Architecture

### 4.1 Component Layers

```
┌─────────────────────────────────────────────────────┐
│  Use-Case Registry (TypeScript modules)             │
│  packages/server/src/demo-fixtures/use-cases/       │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│  Seed Orchestrator (scripts/seed-demo-data.ts)      │
│  - Env guards (ALLOW_DEMO_SEED, NODE_ENV)           │
│  - Destructive reset (TRUNCATE domain tables)       │
│  - Foundation seeding (countries, VAT, FX rates)    │
│  - Use-case fixture insertion (dependency-ordered)  │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│  Validation Layer (validate-demo-data.ts)           │
│  - Admin business existence check                   │
│  - Use-case count reconciliation                    │
│  - Comprehensive ledger validation suite            │
│    (per-record, aggregate, entity-level, integrity) │
└─────────────────────────────────────────────────────┘
```

### 4.2 Data Flow (Staging Deploy)

```
Render Build Command Sequence:
1. yarn install
2. yarn build
3. yarn workspace @accounter-helper/migrations migration:run
4. ALLOW_DEMO_SEED=1 yarn seed:demo  ──┐
5. yarn validate:demo                   │
                                        │
   ┌────────────────────────────────────┘
   │
   ▼
seed-demo-data.ts:
   1. Guard: Check ALLOW_DEMO_SEED=1 && NODE_ENV≠production
   2. TRUNCATE domain tables (charges, transactions, documents, ...)
   3. Seed countries (via seedCountries util)
   4. Seed VAT row (17% default in vat_value table)
   5. Seed FIAT exchange rates (USD→ILS 3.5, EUR→ILS 4.0, ...)
   6. Call existing createAdminBusinessContext()
   7. For each use-case in registry:
      - Load fixture spec
      - Insert entities via insertFixture() helper
      - Generate deterministic UUIDs via makeUUID(namespace, name)
   8. Write AUTHORIZED_USERS, DEFAULT_FINANCIAL_ENTITY_ID to .env
   9. Exit 0 on success
```

---

## 5. Use-Case Registry Design

### 5.1 Directory Structure

```
packages/server/src/demo-fixtures/
├── use-cases/
│   ├── expenses/
│   │   ├── monthly-expense-foreign-currency.ts
│   │   ├── office-supplies-recurring.ts
│   │   └── travel-expense-multi-receipt.ts
│   ├── income/
│   │   ├── client-payment-with-refund.ts
│   │   ├── subscription-revenue-monthly.ts
│   │   └── consulting-invoice-partial-payment.ts
│   ├── equity/
│   │   ├── shareholder-dividend.ts
│   │   └── stock-option-grant.ts
│   └── index.ts  # Registry export
├── helpers/
│   ├── deterministic-uuid.ts
│   ├── seed-exchange-rates.ts
│   └── seed-vat.ts
└── validate-demo-data.ts
```

### 5.2 Use-Case Specification Type

```typescript
export interface UseCaseSpec {
  id: string; // Unique slug: 'monthly-expense-foreign-currency'
  name: string; // Display name: 'Monthly Expense (Foreign Currency)'
  description: string; // Long-form explanation for docs
  category: 'expenses' | 'income' | 'equity' | 'payroll' | 'other';
  fixtures: {
    businesses: BusinessFixture[];
    taxCategories: TaxCategoryFixture[];
    financialAccounts: FinancialAccountFixture[];
    charges: ChargeFixture[];
    transactions: TransactionFixture[];
    documents: DocumentFixture[];
    tags?: TagFixture[];
  };
  metadata: {
    author: string; // Developer who created it
    createdAt: string; // ISO date
    updatedAt: string;
    volumeMultiplier?: number; // Optional: Create N instances (default 1)
  };
  expectations?: {
    ledgerRecordCount: number;
    totalDebitILS: string; // For smoke test validation
    totalCreditILS: string;
  };
}
```

### 5.3 Example Use-Case File

```typescript
// packages/server/src/demo-fixtures/use-cases/expenses/monthly-expense-foreign-currency.ts

import { Currency, CountryCode } from '@shared/enums';
import { makeUUID } from '../../helpers/deterministic-uuid.js';
import type { UseCaseSpec } from '../../types.js';

export const monthlyExpenseForeignCurrency: UseCaseSpec = {
  id: 'monthly-expense-foreign-currency',
  name: 'Monthly Expense (Foreign Currency)',
  description: 'US-based supplier invoice paid via bank transfer with exchange rate conversion',
  category: 'expenses',
  fixtures: {
    businesses: [
      {
        id: makeUUID('business', 'us-supplier-acme-llc'),
        name: 'Acme Consulting LLC',
        country: CountryCode['United States of America (the)'],
        canSettleWithReceipt: false,
      },
    ],
    taxCategories: [
      {
        id: makeUUID('tax-category', 'consulting-expenses'),
        name: 'Consulting Expenses',
      },
    ],
    financialAccounts: [
      {
        id: makeUUID('financial-account', 'bank-usd-account'),
        accountNumber: '123-456-7890',
        type: 'BANK_ACCOUNT',
        currency: Currency.Usd,
        taxCategoryMappings: [
          {
            taxCategoryId: makeUUID('tax-category', 'bank-usd-expenses'),
            currency: Currency.Usd,
          },
        ],
      },
    ],
    charges: [
      {
        id: makeUUID('charge', 'consulting-invoice-2024-11'),
        ownerId: '{{ADMIN_BUSINESS_ID}}', // Replaced at runtime
        userDescription: 'November consulting services',
      },
    ],
    transactions: [
      {
        id: makeUUID('transaction', 'consulting-payment-usd'),
        chargeId: makeUUID('charge', 'consulting-invoice-2024-11'),
        businessId: makeUUID('business', 'us-supplier-acme-llc'),
        amount: '-500.00',
        currency: Currency.Usd,
        eventDate: '2024-11-15',
        debitDate: '2024-11-15',
        accountNumber: '123-456-7890',
      },
    ],
    documents: [
      {
        id: makeUUID('document', 'consulting-invoice-inv-2024-1115'),
        chargeId: makeUUID('charge', 'consulting-invoice-2024-11'),
        creditorId: makeUUID('business', 'us-supplier-acme-llc'),
        debtorId: '{{ADMIN_BUSINESS_ID}}',
        serialNumber: 'INV-2024-1115',
        type: 'INVOICE',
        date: '2024-11-01',
        totalAmount: '500.00',
        currencyCode: Currency.Usd,
      },
    ],
  },
  metadata: {
    author: 'demo-team',
    createdAt: '2024-11-24',
    updatedAt: '2024-11-24',
  },
  expectations: {
    ledgerRecordCount: 2,
    totalDebitILS: '1750.00', // 500 USD * 3.5 rate
    totalCreditILS: '1750.00',
  },
};
```

### 5.4 Registry Index

```typescript
// packages/server/src/demo-fixtures/use-cases/index.ts

import { monthlyExpenseForeignCurrency } from './expenses/monthly-expense-foreign-currency.js';
import { shareholderDividend } from './equity/shareholder-dividend.js';
import { clientPaymentWithRefund } from './income/client-payment-with-refund.js';
import type { UseCaseSpec } from '../types.js';

export const USE_CASE_REGISTRY: Record<string, UseCaseSpec[]> = {
  expenses: [monthlyExpenseForeignCurrency],
  equity: [shareholderDividend],
  income: [clientPaymentWithRefund],
};

export function getAllUseCases(): UseCaseSpec[] {
  return Object.values(USE_CASE_REGISTRY).flat();
}
```

---

## 6. Deterministic UUID Strategy

### 6.1 Implementation

```typescript
// packages/server/src/demo-fixtures/helpers/deterministic-uuid.ts

import { v5 as uuidv5 } from 'uuid';

// Fixed namespace for all demo data (regenerate on schema-breaking changes if needed)
const DEMO_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8'; // Standard DNS namespace

/**
 * Generate deterministic UUID v5 from semantic name.
 *
 * Examples:
 *   makeUUID('business', 'acme-consulting-llc') → always same UUID
 *   makeUUID('charge', 'consulting-invoice-2024-11') → stable across deploys
 *
 * @param namespace - Entity type: 'business', 'charge', 'transaction', etc.
 * @param name - Semantic identifier (kebab-case recommended)
 */
export function makeUUID(namespace: string, name: string): string {
  const composite = `${namespace}:${name}`;
  return uuidv5(composite, DEMO_NAMESPACE);
}
```

### 6.2 Naming Conventions

- **Format**: `kebab-case` for all semantic names
- **Uniqueness**: Combine entity type + descriptive name ensures no collisions
- **Stability**: Never change a semantic name once deployed (breaks external links)
- **Versioning**: If same logical entity needs update, append version: `acme-consulting-llc-v2`

### 6.3 Runtime Placeholder Replacement

Fixtures use `{{ADMIN_BUSINESS_ID}}` placeholder for admin context references. Seed script replaces
at insertion time:

```typescript
function resolveAdminPlaceholders(fixture: any, adminBusinessId: string): any {
  const json = JSON.stringify(fixture);
  const resolved = json.replace(/\{\{ADMIN_BUSINESS_ID\}\}/g, adminBusinessId);
  return JSON.parse(resolved);
}
```

---

## 7. Seed Script Implementation

### 7.1 File: `scripts/seed-demo-data.ts`

```typescript
import pg from 'pg';
import { config } from 'dotenv';
import { seedCountries } from '../packages/server/src/modules/countries/helpers/seed-countries.helper.js';
import { getAllUseCases } from '../packages/server/src/demo-fixtures/use-cases/index.js';
import { insertFixture } from '../packages/server/src/__tests__/helpers/fixture-loader.js';

config();

async function seedDemoData() {
  // 1. Guard checks
  if (process.env.NODE_ENV === 'production') {
    console.error('❌ Refusing to seed demo data in production environment');
    process.exit(1);
  }

  if (process.env.ALLOW_DEMO_SEED !== '1') {
    console.error('❌ ALLOW_DEMO_SEED=1 required to run demo seed');
    process.exit(1);
  }

  const client = new pg.Client({
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    host: process.env.POSTGRES_HOST,
    port: parseInt(process.env.POSTGRES_PORT || '5432'),
    database: process.env.POSTGRES_DB,
    ssl: process.env.POSTGRES_SSL === '1',
  });

  try {
    await client.connect();
    console.log('🔗 Connected to database');

    // 2. Destructive reset (domain tables only; preserve schema/migrations/countries)
    console.log('🧹 Clearing existing demo data...');
    await client.query(`
      TRUNCATE TABLE accounter_schema.ledger_records,
                     accounter_schema.documents,
                     accounter_schema.transactions,
                     accounter_schema.charges,
                     accounter_schema.financial_accounts_tax_categories,
                     accounter_schema.financial_accounts,
                     accounter_schema.tags,
                     accounter_schema.tax_categories,
                     accounter_schema.businesses,
                     accounter_schema.user_context,
                     accounter_schema.financial_entities
      RESTART IDENTITY CASCADE;
    `);
    console.log('✅ Domain tables cleared');

    // 3. Seed foundation data
    console.log('🌍 Seeding countries...');
    await seedCountries(client);

    console.log('💱 Seeding FIAT exchange rates...');
    await seedExchangeRates(client);

    console.log('📊 Seeding VAT default...');
    await seedVATDefault(client);

    // 4. Create admin business context (reuse existing seed.ts logic)
    console.log('🏢 Creating admin business context...');
    const adminBusinessId = await createAdminBusinessContext(client);
    console.log(`✅ Admin Business ID: ${adminBusinessId}`);

    // 5. Load all use-cases
    const useCases = getAllUseCases();
    console.log(`📦 Loading ${useCases.length} use-cases...`);

    for (const useCase of useCases) {
      console.log(`  ➡️  ${useCase.name} (${useCase.id})`);
      const resolvedFixtures = resolveAdminPlaceholders(useCase.fixtures, adminBusinessId);
      await insertFixture(client, resolvedFixtures);
    }

    console.log('✅ All use-cases seeded successfully');

    // 6. Write env vars (if not already set)
    await updateEnvFile('DEFAULT_FINANCIAL_ENTITY_ID', adminBusinessId);
    // AUTHORIZED_USERS typically set manually in Render dashboard

    console.log('🎉 Demo data seed complete');
  } catch (error) {
    console.error('❌ Seed failed:', error);
    throw error;
  } finally {
    await client.end();
  }
}

async function seedExchangeRates(client: pg.Client) {
  const rates = [
    { from: 'USD', to: 'ILS', rate: 3.5 },
    { from: 'EUR', to: 'ILS', rate: 4.0 },
    { from: 'GBP', to: 'ILS', rate: 4.5 },
  ];

  for (const { from, to, rate } of rates) {
    await client.query(
      `INSERT INTO accounter_schema.exchange_rates (from_currency, to_currency, rate, date)
       VALUES ($1, $2, $3, CURRENT_DATE)
       ON CONFLICT (from_currency, to_currency, date) DO UPDATE SET rate = EXCLUDED.rate`,
      [from, to, rate],
    );
  }
  console.log(`✅ Seeded ${rates.length} FIAT exchange rates`);
}

async function seedVATDefault(client: pg.Client) {
  await client.query(
    `INSERT INTO accounter_schema.vat_value (percentage, effective_date)
     VALUES (17, '2024-01-01')
     ON CONFLICT (effective_date) DO NOTHING`,
  );
  console.log('✅ VAT default (17%) seeded');
}

// Import existing createAdminBusinessContext from seed.ts or extract into shared module
async function createAdminBusinessContext(client: pg.Client): Promise<string> {
  // ... (reuse existing implementation from scripts/seed.ts)
  // Returns admin business entity ID
}

function resolveAdminPlaceholders(fixture: any, adminBusinessId: string): any {
  const json = JSON.stringify(fixture);
  const resolved = json.replace(/\{\{ADMIN_BUSINESS_ID\}\}/g, adminBusinessId);
  return JSON.parse(resolved);
}

async function updateEnvFile(key: string, value: string) {
  // ... (reuse from existing seed.ts)
}

seedDemoData().catch(error => {
  console.error('Fatal seed error:', error);
  process.exit(1);
});
```

---

## 8. Validation Layer

### 8.1 File: `packages/server/src/demo-fixtures/validate-demo-data.ts`

The validation step now performs comprehensive double-entry bookkeeping checks across all use-cases
with ledger expectations. It connects to the database, runs base checks (admin business, charge
count), then iterates each relevant use-case to validate ledger records.

```typescript
import pg from 'pg';
import { config } from 'dotenv';
import { getAllUseCases } from './use-cases/index.js';

config();

async function validateDemoData() {
  const client = new pg.Client({
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    host: process.env.POSTGRES_HOST,
    port: parseInt(process.env.POSTGRES_PORT || '5432'),
    database: process.env.POSTGRES_DB,
    ssl: process.env.POSTGRES_SSL === '1',
  });

  const errors: string[] = [];

  try {
    await client.connect();

    // 1. Admin business exists
    const adminCheck = await client.query(
      `SELECT id FROM accounter_schema.financial_entities WHERE type = 'business' AND name = 'Admin Business'`,
    );
    if (adminCheck.rows.length === 0) {
      errors.push('Admin business entity missing');
    }

    // 2. Use-case charge count reconciliation
    const useCases = getAllUseCases();
    const expectedChargeCount = useCases.reduce((sum, uc) => sum + uc.fixtures.charges.length, 0);
    const actualChargeCount = await client.query(`SELECT COUNT(*) FROM accounter_schema.charges`);
    if (parseInt(actualChargeCount.rows[0].count) !== expectedChargeCount) {
      errors.push(
        `Charge count mismatch: expected ${expectedChargeCount}, got ${actualChargeCount.rows[0].count}`,
      );
    }

    // 3. Ledger validation (for all use-cases with expectations)
    for (const useCase of useCases.filter(uc => uc.expectations)) {
      const chargeId = useCase.fixtures.charges[0].id;
      const { rows: ledgerRecords } = await client.query(
        `SELECT * FROM accounter_schema.ledger_records WHERE charge_id = $1`,
        [chargeId],
      );

      // Aggregate balance check (debits == credits within tolerance)
      const totalDebit = ledgerRecords.reduce(
        (sum, rec) =>
          sum +
          parseFloat(rec.debit_local_amount1 || '0') +
          parseFloat(rec.debit_local_amount2 || '0'),
        0,
      );
      const totalCredit = ledgerRecords.reduce(
        (sum, rec) =>
          sum +
          parseFloat(rec.credit_local_amount1 || '0') +
          parseFloat(rec.credit_local_amount2 || '0'),
        0,
      );
      if (Math.abs(totalDebit - totalCredit) > 0.01) {
        errors.push(
          `${useCase.id}: aggregate ledger not balanced (debit ${totalDebit.toFixed(2)}, credit ${totalCredit.toFixed(2)})`,
        );
      }

      // Record count check
      if (ledgerRecords.length !== useCase.expectations!.ledgerRecordCount) {
        errors.push(
          `${useCase.id}: ledger record count mismatch (expected ${useCase.expectations!.ledgerRecordCount}, got ${ledgerRecords.length})`,
        );
      }

      // Per-record internal balance (debit1+debit2 == credit1+credit2)
      ledgerRecords.forEach((rec: any, idx: number) => {
        const recDebit =
          parseFloat(rec.debit_local_amount1 || '0') + parseFloat(rec.debit_local_amount2 || '0');
        const recCredit =
          parseFloat(rec.credit_local_amount1 || '0') + parseFloat(rec.credit_local_amount2 || '0');
        if (Math.abs(recDebit - recCredit) > 0.01) {
          errors.push(
            `${useCase.id} - Record ${idx}: internal imbalance (debit=${recDebit.toFixed(
              2,
            )}, credit=${recCredit.toFixed(2)})`,
          );
        }
      });
    }

    // 4. VAT row present
    const vatCheck = await client.query(
      `SELECT * FROM accounter_schema.vat_value WHERE percentage = 17`,
    );
    if (vatCheck.rows.length === 0) {
      errors.push('VAT default (17%) missing');
    }

    if (errors.length > 0) {
      console.error('❌ Validation failed:');
      errors.forEach(err => console.error(`  - ${err}`));
      process.exit(1);
    }

    console.log('✅ Demo data validation passed');
  } catch (error) {
    console.error('❌ Validation error:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

validateDemoData();
```

### 8.2 Ledger Validation Enhancements

The ledger validation has been enhanced to production-level rigor:

- Per-record internal balance:
  `debit_local_amount1 + debit_local_amount2 == credit_local_amount1 + credit_local_amount2` (±0.01
  tolerance)
- Aggregate balance per charge across all records (±0.01 tolerance)
- Entity-level balance validation: each entity’s net position (Σ debits − Σ credits) balances to
  zero within tolerance
- Orphaned amount detection: no amounts without corresponding entity references (primary/secondary
  rules)
- Positive amount validation: all local/foreign amounts are ≥ 0
- Foreign currency handling: foreign amounts required when `currency != 'ILS'`; consistent implied
  exchange rates
- Date validation: required invoice/value dates, valid and within 2020–2030
- Record count validation: support exact count expectations (future: min count)

New directory structure for validators:

```
packages/server/src/demo-fixtures/validators/
  ├── ledger-validators.ts   # Core ledger validation functions
  └── types.ts               # Validation types and interfaces
```

Validation pipeline:

1. Connect to DB
2. Validate admin business exists
3. Validate charge count reconciliation
4. For each use-case with expectations, fetch ledger records and run validator suite
5. Validate VAT configuration
6. Report all aggregated errors or success; exit non-zero on failures

---

## 9. Render Integration

### 9.1 Build Command Configuration

In Render dashboard for staging environment:

**Build Command**:

```bash
yarn install && yarn build && yarn workspace @accounter-helper/migrations migration:run && ALLOW_DEMO_SEED=1 yarn seed:demo && yarn validate:demo
```

**Environment Variables** (set in Render dashboard):

```
NODE_ENV=staging
ALLOW_DEMO_SEED=1
POSTGRES_HOST=<render-internal-postgres-host>
POSTGRES_PORT=5432
POSTGRES_DB=accounter_staging
POSTGRES_USER=accounter_user
POSTGRES_PASSWORD=<secret>
POSTGRES_SSL=1
AUTHORIZED_USERS=demo@accounter.local,admin@accounter.local
DEFAULT_FINANCIAL_ENTITY_ID=<set-after-first-seed-or-use-deterministic-uuid>
```

### 9.2 Package.json Scripts

Add to root `package.json`:

```json
{
  "scripts": {
    "seed:demo": "tsx scripts/seed-demo-data.ts",
    "validate:demo": "tsx packages/server/src/demo-fixtures/validate-demo-data.ts"
  }
}
```

---

## 10. Error Handling Strategy

### 10.1 Seed Script Errors

| Error Scenario           | Handling                                     | Exit Code |
| ------------------------ | -------------------------------------------- | --------- |
| `NODE_ENV=production`    | Refuse with error message                    | 1         |
| `ALLOW_DEMO_SEED≠1`      | Refuse with error message                    | 1         |
| DB connection failure    | Retry 3x with backoff, then fail             | 1         |
| TRUNCATE failure         | Log table name, abort transaction            | 1         |
| Use-case fixture invalid | Log use-case ID, skip or fail (configurable) | 1         |
| Foreign key violation    | Rollback transaction, log details            | 1         |

### 10.2 Validation Errors

| Check Failure          | Action                            |
| ---------------------- | --------------------------------- |
| Admin business missing | Log error, exit 1 (blocks deploy) |
| Charge count mismatch  | Log delta, exit 1                 |
| Ledger unbalanced      | Log charge ID + amounts, exit 1   |
| VAT row missing        | Log error, exit 1                 |

### 10.3 Logging Standards

```typescript
// Success: ✅ prefix
console.log('✅ All use-cases seeded successfully');

// Info: ℹ️ or plain
console.log('📦 Loading 12 use-cases...');

// Warning: ⚠️
console.warn('⚠️ Use-case X has no ledger expectations; skipping balance check');

// Error: ❌
console.error('❌ Seed failed: Foreign key violation on business_id');
```

---

## 11. Testing Plan

### 11.1 Unit Tests

**File**: `packages/server/src/demo-fixtures/__tests__/deterministic-uuid.test.ts`

```typescript
describe('makeUUID', () => {
  it('generates same UUID for same inputs', () => {
    const uuid1 = makeUUID('business', 'acme-llc');
    const uuid2 = makeUUID('business', 'acme-llc');
    expect(uuid1).toBe(uuid2);
  });

  it('generates different UUIDs for different names', () => {
    const uuid1 = makeUUID('business', 'acme-llc');
    const uuid2 = makeUUID('business', 'acme-corp');
    expect(uuid1).not.toBe(uuid2);
  });

  it('includes namespace in composite key', () => {
    const bizUUID = makeUUID('business', 'acme');
    const chargeUUID = makeUUID('charge', 'acme');
    expect(bizUUID).not.toBe(chargeUUID);
  });
});
```

**File**: `packages/server/src/demo-fixtures/__tests__/use-case-registry.test.ts`

```typescript
describe('Use-Case Registry', () => {
  it('has no duplicate IDs across all categories', () => {
    const allUseCases = getAllUseCases();
    const ids = allUseCases.map(uc => uc.id);
    const uniqueIds = new Set(ids);
    expect(ids.length).toBe(uniqueIds.size);
  });

  it('all use-cases have required fields', () => {
    getAllUseCases().forEach(uc => {
      expect(uc.id).toBeTruthy();
      expect(uc.name).toBeTruthy();
      expect(uc.category).toBeTruthy();
      expect(uc.fixtures).toBeDefined();
    });
  });
});
```

### 11.2 Integration Tests (Local)

**Command**: `ALLOW_DEMO_SEED=1 yarn seed:demo && yarn validate:demo`

**Pre-conditions**:

- Docker Compose Postgres running
- Migrations applied
- Clean DB (or accept destructive reset)

**Assertions**:

- Validation script exits 0
- No errors in seed output
- Charges, transactions, documents counts match registry

### 11.3 Smoke Tests (Staging Post-Deploy)

**Manual verification**:

1. Navigate to staging UI: `https://accounter-staging.onrender.com`
2. Log in with `AUTHORIZED_USERS` credentials
3. Verify dashboard shows:
   - Charges from multiple use-cases
   - Transactions in USD, EUR, ILS
   - Ledger entries balanced
4. Spot-check foreign currency conversion (500 USD → 1750 ILS @ 3.5 rate)

**Automated health check** (optional future enhancement):

- Render deploy webhook triggers Playwright test suite
- Asserts critical UI elements render with demo data

---

## 12. Maintenance & Evolution

### 12.1 Adding a New Use-Case

1. Create fixture file: `packages/server/src/demo-fixtures/use-cases/{category}/{id}.ts`
2. Define `UseCaseSpec` with deterministic UUIDs
3. Register in `use-cases/index.ts` registry
4. Run local validation: `ALLOW_DEMO_SEED=1 yarn seed:demo && yarn validate:demo`
5. Commit and deploy to staging (auto-seeds on next deploy)

### 12.2 Updating Exchange Rates (Annual)

**Option A**: Manual script update

- Edit `seedExchangeRates()` in `seed-demo-data.ts`
- Commit new rates
- Next deploy applies updated rates

**Option B**: External rate source (future)

- Query live API during seed (falls back to hardcoded if unavailable)
- Store timestamp for audit

### 12.3 VAT Rule Changes

- Add new row to `vat_value` table with `effective_date`
- Seed script uses `ON CONFLICT DO NOTHING` to preserve history
- Use-cases referencing VAT auto-pick latest rate based on document date

### 12.4 Schema Migrations Impact

**Breaking changes** (e.g., rename `charges.owner_id` → `charges.business_id`):

- Update fixture types in `demo-fixtures/types.ts`
- Regenerate deterministic UUIDs if composite keys change (version bump)
- Update `insertFixture()` helper if insertion order changes

**Non-breaking additions** (e.g., new `charges.external_reference` column):

- Add field to relevant use-case fixtures (optional)
- No action required for existing use-cases (NULL defaults acceptable)

---

## 13. Security Considerations

### 13.1 Production Safeguards

- **Hard refusal**: Seed script exits immediately if `NODE_ENV=production`
- **Explicit flag**: Requires `ALLOW_DEMO_SEED=1` to prevent accidental runs
- **Render env isolation**: Staging and production use separate DB credentials

### 13.2 Credential Management

- `AUTHORIZED_USERS`: Managed via Render dashboard secrets (not committed)
- `DEFAULT_FINANCIAL_ENTITY_ID`: Written to `.env` by seed script; safe for staging
- No password hashing in MVP (auth via env whitelist only)

### 13.3 Data Sanitization

- All use-case fixtures use synthetic names (no real client data)
- UUIDs deterministic but not reversible to real entities
- No PII (email addresses use `@example.com` or `@accounter.local`)

---

## 14. Performance Considerations

### 14.1 Seed Execution Time

**Target**: < 30 seconds for MVP (15 use-cases)

**Optimization strategies** (if needed):

- Batch inserts within single transaction per use-case
- Parallel use-case insertion (if no cross-dependencies)
- Index creation deferred until after bulk insert

### 14.2 Validation Execution Time

**Target**: < 5 seconds (typical dataset)

**Checks prioritized**:

- Admin business existence (1 query)
- Charge count (1 query)
- Ledger validation suite (N queries, N = use-cases with expectations)
- Skip full ledger audit in validation (covered by integration tests)

---

## 15. Documentation Deliverables

### 15.1 Developer Guide

**File**: `packages/server/docs/demo-staging-guide.md`

**Contents**:

- Quick start: Local demo seed setup
- Adding new use-case (step-by-step with example)
- Deterministic UUID best practices
- Troubleshooting common errors
- Registry structure reference

### 15.2 Operations Runbook

**File**: `docs/runbooks/staging-demo-seed.md`

**Contents**:

- Render build command configuration
- Environment variable checklist
- Rollback procedure (restore DB snapshot or re-run migrations + seed)
- Monitoring validation logs
- Emergency contact for seed failures blocking deploys

---

## 16. Acceptance Criteria

- [ ] Use-case registry supports at least 3 categories (expenses, income, equity)
- [ ] Initial MVP includes 5+ use-cases covering common scenarios
- [ ] Deterministic UUID utility generates stable IDs across multiple seed runs
- [ ] Seed script refuses to run in `NODE_ENV=production`
- [ ] Seed script completes successfully on clean staging DB in < 60 seconds
- [ ] Validation script implements comprehensive ledger validation (per-record, aggregate,
      entity-level, integrity checks) and detects missing admin business, charge count mismatch,
      unbalanced ledger
- [ ] Render staging deploy integrates seed + validation in build command
- [ ] Developer guide published with "Add New Use-Case" tutorial
- [ ] At least one use-case includes ledger expectations and passes smoke test
- [ ] Exchange rates seeded for USD, EUR, GBP → ILS
- [ ] VAT default (17%) seeded in `vat_value` table
- [ ] All use-case fixtures use `Currency` and `CountryCode` enums (no string literals)

---

## 17. Future Enhancements (Post-MVP)

### 17.1 Selective Use-Case Loading

```bash
yarn seed:demo --include=expenses,income
yarn seed:demo --exclude=payroll
```

### 17.2 Volume Multipliers

```typescript
metadata: {
  volumeMultiplier: 6; // Generate 6 months of this use-case
}
```

### 17.3 Live Exchange Rate Integration

Query external API (e.g., ECB, CoinGecko for crypto) during seed with fallback to hardcoded rates.

### 17.4 Use-Case Dependency Graph

```typescript
dependencies: ['admin-context-basic', 'bank-account-ils'];
```

Auto-resolve insertion order based on topological sort.

### 17.5 HTML Use-Case Catalog

Generate static HTML page listing all use-cases with descriptions, metadata, and expected outcomes
for non-technical stakeholders.

### 17.6 Snapshot Testing

Export ledger records as JSON snapshots; regression tests compare new seeds to baseline.

---

## 18. Glossary

| Term                   | Definition                                                                 |
| ---------------------- | -------------------------------------------------------------------------- |
| **Use-case**           | Self-contained financial scenario fixture bundle (e.g., "monthly expense") |
| **Deterministic UUID** | UUID v5 generated from semantic name; stable across deploys                |
| **Fixture**            | Data object representing DB entity (business, charge, transaction, etc.)   |
| **Registry**           | Central TypeScript module exporting all use-cases by category              |
| **Semantic name**      | Human-readable identifier used to generate deterministic UUIDs             |
| **Destructive reset**  | `TRUNCATE` operation clearing domain table data while preserving schema    |
| **Smoke test**         | Quick validation ensuring critical data seeded correctly                   |
| **Admin business**     | Primary financial entity owning all demo use-case data                     |
| **Foundation data**    | Countries, VAT, exchange rates seeded before use-cases                     |

---

## 19. References

- **Related Spec**: `docs/demo-test-data/demo-test-data-plan.md` (original test data architecture)
- **Fixture Loader**: `packages/server/src/__tests__/helpers/fixture-loader.ts`
- **Seed Utility**: `packages/server/src/modules/countries/helpers/seed-countries.helper.ts`
- **Existing Seed**: `scripts/seed.ts` (admin context creation logic to reuse)
- **Environment Config**: `packages/server/src/environment.ts`
- **UUID v5 Docs**: https://datatracker.ietf.org/doc/html/rfc4122#section-4.3

---

**End of Specification**

**Next Steps**: Assign developer, create tracking issue, estimate effort (recommend 2-3 sprint
capacity for MVP implementation + docs).
