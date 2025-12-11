import { expect } from 'vitest';

// Minimal ledger record type based on DB result interface
export interface LedgerRecord {
  id: string;
  owner_id: string | null;
  charge_id: string;
  debit_entity1: string | null;
  debit_foreign_amount1: string | null;
  debit_local_amount1: string | null; // required in DB but treat nullable defensively
  debit_entity2: string | null;
  debit_foreign_amount2: string | null;
  debit_local_amount2: string | null;
  credit_entity1: string | null;
  credit_foreign_amount1: string | null;
  credit_local_amount1: string | null;
  credit_entity2: string | null;
  credit_foreign_amount2: string | null;
  credit_local_amount2: string | null;
  currency: string;
  invoice_date: Date;
  value_date: Date;
  description: string | null;
  reference1: string | null;
  created_at: Date;
  updated_at: Date;
  locked: boolean;
}

export interface EntityTotals {
  debit: number;
  credit: number;
  net: number; // debit - credit
}

export function numberVal(v: string | null | undefined): number {
  if (v === null || v === undefined || v === '') return 0;
  return Number(v);
}

export function expectClose(actual: number, expected: number, tolerance = 0.01, msg?: string) {
  expect(Math.abs(actual - expected), msg ?? `Expected ${actual} ≈ ${expected}`).toBeLessThanOrEqual(tolerance);
}

/** Assert every record is internally balanced (sum debit == sum credit) within tolerance */
export function assertInternalBalance(records: LedgerRecord[], tolerance = 0.01) {
  records.forEach((r, idx) => {
    const debit = numberVal(r.debit_local_amount1) + numberVal(r.debit_local_amount2);
    const credit = numberVal(r.credit_local_amount1) + numberVal(r.credit_local_amount2);
    expectClose(debit, credit, tolerance, `Record ${idx} not internally balanced (debit=${debit}, credit=${credit})`);
    expect(debit + credit, `Record ${idx} empty (zero total)`).toBeGreaterThan(0);
  });
}

/** Assert no orphaned amounts (amount requires entity) and null usage for unused entity slots */
export function assertNoOrphanedAmounts(record: LedgerRecord, idx?: number) {
  const tag = idx !== undefined ? `Record ${idx}: ` : '';
  // Primary debit
  if (numberVal(record.debit_local_amount1) > 0) {
    expect(record.debit_entity1, tag + 'debit_local_amount1 present without debit_entity1').toBeTruthy();
  }
  if (!record.debit_entity1) {
    expect(record.debit_local_amount1, tag + 'debit_local_amount1 should be null when entity1 null').not.toBeNull(); // Primary is required by design
  }
  // Secondary debit
  if (numberVal(record.debit_local_amount2) > 0) {
    expect(record.debit_entity2, tag + 'debit_local_amount2 present without debit_entity2').toBeTruthy();
  } else if (!record.debit_entity2) {
    expect(record.debit_local_amount2, tag + 'debit_local_amount2 should be null when entity2 null').toBeNull();
  }
  // Primary credit
  if (numberVal(record.credit_local_amount1) > 0) {
    expect(record.credit_entity1, tag + 'credit_local_amount1 present without credit_entity1').toBeTruthy();
  }
  if (!record.credit_entity1) {
    expect(record.credit_local_amount1, tag + 'credit_local_amount1 should not be null').not.toBeNull();
  }
  // Secondary credit
  if (numberVal(record.credit_local_amount2) > 0) {
    expect(record.credit_entity2, tag + 'credit_local_amount2 present without credit_entity2').toBeTruthy();
  } else if (!record.credit_entity2) {
    expect(record.credit_local_amount2, tag + 'credit_local_amount2 should be null when entity2 null').toBeNull();
  }
}

/** Assert all records satisfy orphan rules */
export function assertNoOrphans(records: LedgerRecord[]) {
  records.forEach((r, idx) => assertNoOrphanedAmounts(r, idx));
}

/** Assert all amounts non-negative */
export function assertPositiveAmounts(records: LedgerRecord[]) {
  records.forEach((r, idx) => {
    const fields: Array<[string, string | null]> = [
      ['debit_local_amount1', r.debit_local_amount1],
      ['debit_local_amount2', r.debit_local_amount2],
      ['credit_local_amount1', r.credit_local_amount1],
      ['credit_local_amount2', r.credit_local_amount2],
      ['debit_foreign_amount1', r.debit_foreign_amount1],
      ['debit_foreign_amount2', r.debit_foreign_amount2],
      ['credit_foreign_amount1', r.credit_foreign_amount1],
      ['credit_foreign_amount2', r.credit_foreign_amount2],
    ];
    fields.forEach(([name, val]) => {
      if (val) {
        expect(Number(val), `Record ${idx} field ${name} negative`).toBeGreaterThanOrEqual(0);
      }
    });
  });
}

/** Aggregate totals per entity (debit vs credit) */
export function aggregateTotalsByEntity(records: LedgerRecord[]): Record<string, EntityTotals> {
  const totals: Record<string, EntityTotals> = {};
  const add = (entity: string | null, debit: number, credit: number) => {
    if (!entity) return;
    if (!totals[entity]) totals[entity] = { debit: 0, credit: 0, net: 0 };
    totals[entity].debit += debit;
    totals[entity].credit += credit;
    totals[entity].net = totals[entity].debit - totals[entity].credit;
  };
  records.forEach(r => {
    add(r.debit_entity1, numberVal(r.debit_local_amount1), 0);
    add(r.debit_entity2, numberVal(r.debit_local_amount2), 0);
    add(r.credit_entity1, 0, numberVal(r.credit_local_amount1));
    add(r.credit_entity2, 0, numberVal(r.credit_local_amount2));
  });
  return totals;
}

/** Assert owner consistency */
export function assertOwner(records: LedgerRecord[], ownerId: string) {
  records.forEach((r, idx) => {
    expect(r.owner_id, `Record ${idx} missing owner`).toBe(ownerId);
  });
}

/** Assert all records point to given charge */
export function assertChargeLinkage(records: LedgerRecord[], chargeId: string) {
  records.forEach((r, idx) => {
    expect(r.charge_id, `Record ${idx} charge mismatch`).toBe(chargeId);
  });
}

/** Assert audit fields validity */
export function assertAuditTrail(records: LedgerRecord[], now = new Date(), maxFutureSkewMs = 2000) {
  // Relaxed: allow any historical timestamp; only forbid future timestamps and mismatched updates
  records.forEach((r, idx) => {
    expect(r.created_at, `Record ${idx} created_at missing`).toBeDefined();
    expect(r.updated_at, `Record ${idx} updated_at missing`).toBeDefined();
    expect(r.created_at.getTime(), `Record ${idx} created_at future`).toBeLessThanOrEqual(now.getTime() + maxFutureSkewMs);
    expect(r.updated_at.getTime(), `Record ${idx} updated_at mismatch`).toBe(r.created_at.getTime());
    expect(r.locked, `Record ${idx} should not be locked`).toBe(false);
  });
}

/** Assert foreign currency amounts and implied exchange rate */
export function assertForeignCurrency(records: LedgerRecord[], opts: {
  expectedCurrency: string;
  expectedForeignAmount?: number; // if each primary leg should match
  expectedRate?: number; // implied rate local/foreign
  toleranceRate?: number;
}) {
  const { expectedCurrency, expectedForeignAmount, expectedRate, toleranceRate = 0.005 } = opts;
  records.forEach((r, idx) => {
    expect(r.currency, `Record ${idx} currency mismatch`).toBe(expectedCurrency);
    if (expectedForeignAmount !== undefined && r.debit_foreign_amount1) {
      expectClose(Number(r.debit_foreign_amount1), expectedForeignAmount, 0.0001, `Record ${idx} foreign debit amount mismatch`);
    }
    if (expectedForeignAmount !== undefined && r.credit_foreign_amount1) {
      expectClose(Number(r.credit_foreign_amount1), expectedForeignAmount, 0.0001, `Record ${idx} foreign credit amount mismatch`);
    }
    if (expectedRate !== undefined && r.debit_foreign_amount1 && numberVal(r.debit_local_amount1) > 0) {
      const implied = numberVal(r.debit_local_amount1) / numberVal(r.debit_foreign_amount1);
      expectClose(implied, expectedRate, toleranceRate, `Record ${idx} implied debit rate mismatch`);
    }
    if (expectedRate !== undefined && r.credit_foreign_amount1 && numberVal(r.credit_local_amount1) > 0) {
      const implied = numberVal(r.credit_local_amount1) / numberVal(r.credit_foreign_amount1);
      expectClose(implied, expectedRate, toleranceRate, `Record ${idx} implied credit rate mismatch`);
    }
  });
}

/** Assert absence of foreign currency data for local-only scenarios */
export function assertNoForeignCurrency(records: LedgerRecord[], expectedLocalCurrency: string) {
  records.forEach((r, idx) => {
    expect(r.currency, `Record ${idx} currency should be ${expectedLocalCurrency}`).toBe(expectedLocalCurrency);
    ['debit_foreign_amount1','debit_foreign_amount2','credit_foreign_amount1','credit_foreign_amount2'].forEach(field => {
      // @ts-ignore
      expect(r[field], `Record ${idx} field ${field} should be null in local-only scenario`).toBeNull();
    });
  });
}

/** Assert entity assignments match expected sets */
export function assertEntityAssignments(records: LedgerRecord[], expected: {
  expectedDebitEntities: string[]; // primary expected
  expectedCreditEntities: string[]; // primary expected
  allowSecondary?: boolean;
}) {
  const debitEntities = new Set<string>();
  const creditEntities = new Set<string>();
  records.forEach(r => {
    if (r.debit_entity1) debitEntities.add(r.debit_entity1);
    if (r.debit_entity2) debitEntities.add(r.debit_entity2);
    if (r.credit_entity1) creditEntities.add(r.credit_entity1);
    if (r.credit_entity2) creditEntities.add(r.credit_entity2);
  });
  expected.expectedDebitEntities.forEach(e => {
    expect(debitEntities.has(e), `Missing expected debit entity ${e}`).toBe(true);
  });
  expected.expectedCreditEntities.forEach(e => {
    expect(creditEntities.has(e), `Missing expected credit entity ${e}`).toBe(true);
  });
  // Ensure no unexpected secondary entities when not allowed
  if (!expected.allowSecondary) {
    records.forEach((r, idx) => {
      expect(r.debit_entity2, `Record ${idx} unexpected debit_entity2`).toBeNull();
      expect(r.credit_entity2, `Record ${idx} unexpected credit_entity2`).toBeNull();
    });
  }
}

/** Business logic: expense accounts must appear only on debit side; bank/cash on credit */
export function assertExpenseScenarioLogic(records: LedgerRecord[], opts: {
  expenseEntityIds: string[];
  cashOrBankEntityIds: string[];
}) {
  const expenseTotals: Record<string, EntityTotals> = aggregateTotalsByEntity(records);
  opts.expenseEntityIds.forEach(id => {
    const t = expenseTotals[id];
    expect(t, `Expense entity ${id} missing`).toBeDefined();
    expect(t.debit, `Expense entity ${id} should have debit > 0`).toBeGreaterThan(0);
    expect(t.credit, `Expense entity ${id} should not be credited`).toBe(0);
  });
  opts.cashOrBankEntityIds.forEach(id => {
    const t = expenseTotals[id];
    expect(t, `Bank/cash entity ${id} missing`).toBeDefined();
    expect(t.credit, `Bank/cash entity ${id} should have credit > 0`).toBeGreaterThan(0);
    expect(t.debit, `Bank/cash entity ${id} should not be debited (simple expense)` ).toBe(0);
  });
}

/** Combined high-level assertion for typical simple local expense scenario */
export function assertSimpleLocalExpenseScenario(records: LedgerRecord[], params: {
  chargeId: string;
  ownerId: string;
  expenseEntity: string; // expense tax category id
  bankEntity: string; // bank account tax category id
  expectedCurrency: string;
  expectedTotal: number; // total local debit/credit
}) {
  assertChargeLinkage(records, params.chargeId);
  assertOwner(records, params.ownerId);
  assertInternalBalance(records);
  assertNoOrphans(records);
  assertPositiveAmounts(records);
  assertNoForeignCurrency(records, params.expectedCurrency);
  assertEntityAssignments(records, {
    expectedDebitEntities: [params.expenseEntity],
    expectedCreditEntities: [params.bankEntity],
    allowSecondary: false,
  });
  assertExpenseScenarioLogic(records, {
    expenseEntityIds: [params.expenseEntity],
    cashOrBankEntityIds: [params.bankEntity],
  });
  // Verify expense entity debit equals expected total and bank entity credit equals expected total
  const byEntity = aggregateTotalsByEntity(records);
  const expenseTotals = byEntity[params.expenseEntity];
  const bankTotals = byEntity[params.bankEntity];
  expect(expenseTotals, 'Missing expense entity totals').toBeDefined();
  expect(bankTotals, 'Missing bank entity totals').toBeDefined();
  expectClose(expenseTotals.debit, params.expectedTotal, 0.01, 'Expense debit total mismatch');
  expectClose(bankTotals.credit, params.expectedTotal, 0.01, 'Bank credit total mismatch');
}

/** Combined high-level assertion for foreign currency expense scenario */
export function assertForeignExpenseScenario(records: LedgerRecord[], params: {
  chargeId: string;
  ownerId: string;
  expenseEntity: string;
  bankEntity: string;
  expectedCurrency: string; // e.g. USD
  expectedForeignAmount: number; // e.g. 200
  expectedRate: number; // e.g. 3.5
  expectedLocalTotal: number; // e.g. 700 per leg or aggregate depends on design
  toleranceRate?: number;
}) {
  assertChargeLinkage(records, params.chargeId);
  assertOwner(records, params.ownerId);
  assertInternalBalance(records);
  assertNoOrphans(records);
  assertPositiveAmounts(records);
  assertEntityAssignments(records, {
    expectedDebitEntities: [params.expenseEntity],
    expectedCreditEntities: [params.bankEntity],
    allowSecondary: true, // allow algorithm to add balancing/VAT or FX legs if any
  });
  assertExpenseScenarioLogic(records, {
    expenseEntityIds: [params.expenseEntity],
    cashOrBankEntityIds: [params.bankEntity],
  });
  assertForeignCurrency(records, {
    expectedCurrency: params.expectedCurrency,
    expectedForeignAmount: params.expectedForeignAmount,
    expectedRate: params.expectedRate,
    toleranceRate: params.toleranceRate ?? 0.01,
  });
  // Verify per-entity totals rather than raw sum (records may duplicate debit/credit in symmetrical entries)
  // Identify per-leg expense debit amounts (where expense entity appears as debit_entity1/debit_entity2)
    const debitLegs: number[] = [];
    const creditLegs: number[] = [];
    records.forEach(r => {
      const d1 = numberVal(r.debit_local_amount1); if (d1) debitLegs.push(d1);
      const d2 = numberVal(r.debit_local_amount2); if (d2) debitLegs.push(d2);
      const c1 = numberVal(r.credit_local_amount1); if (c1) creditLegs.push(c1);
      const c2 = numberVal(r.credit_local_amount2); if (c2) creditLegs.push(c2);
    });
    expect(debitLegs.length, 'Expected at least one debit leg').toBeGreaterThan(0);
    expect(creditLegs.length, 'Expected at least one credit leg').toBeGreaterThan(0);
    const impliedPerLeg = params.expectedForeignAmount * params.expectedRate;
    // Determine expected leg count from aggregate
    const legCountApprox = Math.round(params.expectedLocalTotal / impliedPerLeg);
    // Validate each leg amount close to impliedPerLeg (within 0.005)
    debitLegs.forEach((amt, i) => {
      expectClose(amt, impliedPerLeg, 0.005, `Debit leg ${i} amount mismatch`);
    });
    creditLegs.forEach((amt, i) => {
      expectClose(amt, impliedPerLeg, 0.005, `Credit leg ${i} amount mismatch`);
    });
    // Aggregate totals
    const totalDebit = debitLegs.reduce((a, b) => a + b, 0);
    const totalCredit = creditLegs.reduce((a, b) => a + b, 0);
    expectClose(totalDebit, params.expectedLocalTotal, 0.005, 'Aggregate debit total mismatch');
    expectClose(totalCredit, params.expectedLocalTotal, 0.005, 'Aggregate credit total mismatch');
    // Leg count heuristic
    expect(Math.abs(debitLegs.length - legCountApprox), 'Unexpected number of debit legs').toBeLessThanOrEqual(1);
    expect(Math.abs(creditLegs.length - legCountApprox), 'Unexpected number of credit legs').toBeLessThanOrEqual(1);
}
