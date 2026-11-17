import { describe, expect, it } from 'vitest';
import { retrievePaymentReceiptsSchema } from '../schemas.js';

const unusedFunds = { amount: '0.00', original_amount: null, original_currency: null };

function payload(row: Record<string, unknown> = {}) {
  return {
    data: {
      rows: [
        {
          id: 'payment-1',
          created_at: '2026-01-01T00:00:00.000Z',
          deel_granted_credits_used: unusedFunds,
          eor_early_invoicing_funds_used: unusedFunds,
          general_funds_used: unusedFunds,
          invoices: [{ id: 'invoice-1' }],
          label: 'Payment',
          paid_at: '2026-01-02T00:00:00.000Z',
          payment_currency: 'USD',
          payment_method: { type: 'bank_transfer' },
          prepaid_billing_credits_used: unusedFunds,
          total: '100.00',
          total_due: '100.00',
          status: 'paid',
          workers: [{ id: 'worker-1', contract_id: 'contract-1', picUrl: null }],
          timezone: null,
          deel_reference: null,
          ...row,
        },
      ],
      total: 1,
      next_cursor: null,
      has_more: false,
      total_count: 1,
    },
  };
}

describe('retrievePaymentReceiptsSchema', () => {
  it('parses a payment with known values', () => {
    expect(() => retrievePaymentReceiptsSchema.parse(payload())).not.toThrow();
  });

  it('accepts a payment method type Deel added after the enum was written', () => {
    const parsed = retrievePaymentReceiptsSchema.parse(
      payload({ payment_method: { type: 'some_new_method' } }),
    );
    expect(parsed.data.rows[0].payment_method?.type).toBe('some_new_method');
  });

  it('accepts a worker without an id', () => {
    const parsed = retrievePaymentReceiptsSchema.parse(
      payload({ workers: [{ id: null, contract_id: 'contract-1', picUrl: null }] }),
    );
    expect(parsed.data.rows[0].workers?.[0].id).toBeNull();
  });
});
