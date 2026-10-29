import { describe, expect, it } from 'vitest';
import type { Invoice, PaymentReceipts } from '../../../app-providers/deel/schemas.js';
import {
  buildDeelSyncPlan,
  getInvoicesToWrite,
  groupBreakdownsByInvoice,
  splitPendingInvoices,
  type DecoratedPaymentBreakdown,
  type DeelSyncPlanInput,
  type ReceiptSyncUnit,
  type StandaloneSyncUnit,
} from '../deel-sync-plan.helper.js';

function invoice(id: string, overrides: Partial<Invoice> = {}): Invoice {
  return {
    id,
    label: `L-${id}`,
    contract_id: 'c1',
    status: 'paid',
    total: '100.00',
    amount: '100.00',
    currency: 'USD',
    issued_at: 'Mon, 05 Jan 2026 10:00:00 GMT',
    ...overrides,
  } as Invoice;
}

function breakdown(
  invoiceId: string,
  receiptId: string,
  overrides: Partial<DecoratedPaymentBreakdown> = {},
): DecoratedPaymentBreakdown {
  return {
    invoice_id: invoiceId,
    receipt_id: receiptId,
    contract_country: 'IL',
    contract_start_date: '2025-01-01',
    contract_type: 'pay_as_you_go_time_based',
    contractor_email: 'jane@example.com',
    contractor_employee_name: 'Jane Doe',
    contractor_unique_identifier: '11111111-1111-1111-1111-111111111111',
    total_payment_currency: '100.00',
    payment_currency: 'USD',
    ...overrides,
  } as DecoratedPaymentBreakdown;
}

function receipt(id: string, invoiceIds: string[]): PaymentReceipts {
  return { id, invoices: invoiceIds.map(invoiceId => ({ id: invoiceId })) } as PaymentReceipts;
}

function input(overrides: Partial<DeelSyncPlanInput> = {}): DeelSyncPlanInput {
  return {
    pending: { newInvoices: [], unmatchedExistingInvoices: [] },
    knownContractIds: new Set(['c1', 'c2']),
    unknownContracts: new Map(),
    receipts: [],
    breakdowns: [],
    receiptChargeMap: new Map(),
    ...overrides,
  };
}

describe('splitPendingInvoices', () => {
  it('keeps new invoices and stored ones with no payment, skipping matched ones', () => {
    const stored = new Map([
      ['matched', { id: 'matched', payment_id: 'r1', document_id: 'd1' }],
      ['unmatched', { id: 'unmatched', payment_id: '', document_id: 'd2' }],
    ]);
    const result = splitPendingInvoices(
      [invoice('new'), invoice('matched'), invoice('unmatched')],
      stored,
    );
    expect(result.newInvoices.map(i => i.id)).toEqual(['new']);
    expect(result.unmatchedExistingInvoices.map(i => i.id)).toEqual(['unmatched']);
  });
});

describe('buildDeelSyncPlan', () => {
  it('groups matched invoices into one unit per receipt, splitting inserts from updates', () => {
    const plan = buildDeelSyncPlan(
      input({
        pending: {
          newInvoices: [invoice('i1'), invoice('i2')],
          unmatchedExistingInvoices: [invoice('i3')],
        },
        receipts: [receipt('r1', ['i1', 'i2', 'i3'])],
        breakdowns: [breakdown('i1', 'r1'), breakdown('i2', 'r1'), breakdown('i3', 'r1')],
      }),
    );

    expect(plan.issues).toEqual([]);
    expect(plan.units).toHaveLength(1);
    const unit = plan.units[0] as ReceiptSyncUnit;
    expect(unit.kind).toBe('receipt');
    expect(unit.receiptId).toBe('r1');
    expect(unit.existingChargeId).toBeNull();
    expect(unit.inserts.map(m => m.id)).toEqual(['i1', 'i2']);
    expect(unit.updates.map(m => m.id)).toEqual(['i3']);
    expect(unit.inserts[0].breakdown_receipt_id).toBe('r1');
  });

  it("reuses the receipt's existing charge", () => {
    const plan = buildDeelSyncPlan(
      input({
        pending: { newInvoices: [invoice('i1')], unmatchedExistingInvoices: [] },
        receipts: [receipt('r1', ['i0', 'i1'])],
        breakdowns: [breakdown('i1', 'r1')],
        receiptChargeMap: new Map([['r1', 'charge-1']]),
      }),
    );
    expect((plan.units[0] as ReceiptSyncUnit).existingChargeId).toBe('charge-1');
  });

  it('saves new unmatched invoices on their own, and leaves stored unmatched ones alone', () => {
    const plan = buildDeelSyncPlan(
      input({
        pending: {
          newInvoices: [
            invoice('late', { issued_at: 'Tue, 10 Feb 2026 10:00:00 GMT' }),
            invoice('early', { issued_at: 'Mon, 05 Jan 2026 10:00:00 GMT' }),
          ],
          unmatchedExistingInvoices: [invoice('stored')],
        },
        receipts: [receipt('r1', ['early'])],
        receiptChargeMap: new Map([['r1', 'charge-1']]),
      }),
    );

    expect(plan.units.map(u => u.kind)).toEqual(['standalone', 'standalone']);
    const [first, second] = plan.units as StandaloneSyncUnit[];
    expect(first.invoice.id).toBe('early');
    // covered by a receipt that already has a charge, though no breakdown matches it
    expect(first.existingChargeId).toBe('charge-1');
    expect(first.invoice.breakdown_receipt_id).toBe('');
    expect(second.invoice.id).toBe('late');
    expect(second.existingChargeId).toBeNull();
  });

  it('treats several breakdowns of a processed, refunded or zero invoice as unmatched', () => {
    const plan = buildDeelSyncPlan(
      input({
        pending: {
          newInvoices: [
            invoice('processed', { status: 'processed' }),
            invoice('refunded', { status: 'refunded' }),
            invoice('zero', { total: '0.00' }),
          ],
          unmatchedExistingInvoices: [],
        },
        breakdowns: ['processed', 'refunded', 'zero'].flatMap(id => [
          breakdown(id, 'r1'),
          breakdown(id, 'r2'),
        ]),
      }),
    );
    expect(plan.issues).toEqual([]);
    expect(plan.units.every(u => u.kind === 'standalone')).toBe(true);
    expect(plan.units).toHaveLength(3);
  });

  it('reports an ambiguous match and skips every receipt the invoice appears in', () => {
    const plan = buildDeelSyncPlan(
      input({
        pending: { newInvoices: [invoice('amb'), invoice('ok')], unmatchedExistingInvoices: [] },
        receipts: [receipt('r1', ['amb', 'ok']), receipt('r2', ['amb'])],
        breakdowns: [breakdown('amb', 'r1'), breakdown('amb', 'r2'), breakdown('ok', 'r1')],
      }),
    );

    expect(plan.units).toEqual([]);
    expect(plan.issues.map(i => i.code)).toEqual([
      'AMBIGUOUS_PAYMENT_MATCH',
      'AMBIGUOUS_PAYMENT_MATCH',
    ]);
    expect(plan.issues[0].invoiceIds).toEqual(['amb']);
    expect(plan.issues[0].message).toContain('matches 2 payment breakdowns');
    // the innocent invoice of the same receipt is reported as skipped with it
    expect(plan.issues[1]).toMatchObject({ invoiceIds: ['ok'], receiptId: 'r1' });
  });

  it('reports every unknown contract with its Deel details, in one run', () => {
    const plan = buildDeelSyncPlan(
      input({
        pending: {
          newInvoices: [
            invoice('i1', { contract_id: 'x1' }),
            invoice('i2', { contract_id: 'x2' }),
            invoice('i3', { contract_id: 'x1' }),
          ],
          unmatchedExistingInvoices: [],
        },
        unknownContracts: new Map([
          ['x1', { workerName: 'Jane Doe', workerId: 'w1', startDate: '2025-01-01' }],
          ['x2', { error: 'Deel API GET /contracts/x2 responded 404 Not Found' }],
        ]),
      }),
    );

    expect(plan.units).toEqual([]);
    expect(plan.issues).toHaveLength(2);
    expect(plan.issues[0]).toMatchObject({
      code: 'UNKNOWN_CONTRACT',
      contractId: 'x1',
      invoiceIds: ['i1', 'i3'],
    });
    expect(plan.issues[0].message).toContain('worker Jane Doe, worker id w1, start date 2025-01-01');
    expect(plan.issues[0].message).toContain('addDeelContract');
    expect(plan.issues[1].message).toContain('responded 404');
  });

  it('leaves a stored invoice that stays unmatched alone — no contract check, no issue', () => {
    const plan = buildDeelSyncPlan(
      input({
        pending: {
          newInvoices: [],
          unmatchedExistingInvoices: [invoice('stored', { contract_id: 'unknown' })],
        },
      }),
    );
    expect(plan).toEqual({ units: [], issues: [] });
  });

  it('only asks for the contracts of invoices it will write', () => {
    const pending = {
      newInvoices: [invoice('new', { contract_id: 'x1' })],
      unmatchedExistingInvoices: [
        invoice('stays', { contract_id: 'x2' }),
        invoice('matched-now', { contract_id: 'x3' }),
      ],
    };
    const written = getInvoicesToWrite(
      pending,
      groupBreakdownsByInvoice([breakdown('matched-now', 'r1')]),
    );
    expect(written.map(i => i.id)).toEqual(['new', 'matched-now']);
  });

  it('reports breakdowns that disagree on a contract, blocking its receipt', () => {
    const plan = buildDeelSyncPlan(
      input({
        pending: { newInvoices: [invoice('i1'), invoice('i2')], unmatchedExistingInvoices: [] },
        receipts: [receipt('r1', ['i1', 'i2'])],
        breakdowns: [
          breakdown('i1', 'r1'),
          breakdown('i2', 'r1', { contractor_email: 'other@example.com' }),
        ],
      }),
    );
    expect(plan.units).toEqual([]);
    expect(plan.issues).toEqual([
      expect.objectContaining({
        code: 'INCONSISTENT_CONTRACT_INFO',
        contractId: 'c1',
        invoiceIds: ['i1', 'i2'],
      }),
    ]);
  });

  it('ignores the alternative contractor info of fee breakdowns', () => {
    const plan = buildDeelSyncPlan(
      input({
        pending: { newInvoices: [invoice('i1'), invoice('fee')], unmatchedExistingInvoices: [] },
        receipts: [receipt('r1', ['i1', 'fee'])],
        breakdowns: [
          breakdown('i1', 'r1'),
          breakdown('fee', 'r1', {
            contractor_unique_identifier: '',
            contractor_email: '',
            contract_type: 'payment_processing_fee',
          }),
        ],
      }),
    );
    expect(plan.issues).toEqual([]);
    expect(plan.units).toHaveLength(1);
  });

  it("orders receipt units as Deel lists the receipts", () => {
    const plan = buildDeelSyncPlan(
      input({
        pending: { newInvoices: [invoice('a'), invoice('b')], unmatchedExistingInvoices: [] },
        receipts: [receipt('r2', ['b']), receipt('r1', ['a'])],
        breakdowns: [breakdown('a', 'r1'), breakdown('b', 'r2')],
      }),
    );
    expect(plan.units.map(u => (u as ReceiptSyncUnit).receiptId)).toEqual(['r2', 'r1']);
  });
});
