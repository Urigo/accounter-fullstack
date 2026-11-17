import { describe, expect, it } from 'vitest';
import type { Invoice } from '../../../app-providers/deel/schemas.js';
import { matchInvoicesWithPayments, type DecoratedPaymentBreakdown } from '../deel.helper.js';

const invoice = { id: 'invoice-1', currency: 'GBP', amount: '120.00' } as Invoice;

function breakdown(fields: Partial<DecoratedPaymentBreakdown>) {
  return {
    invoice_id: 'invoice-1',
    receipt_id: 'receipt-1',
    payment_currency: 'USD',
    total_payment_currency: '150.00',
    ...fields,
  } as DecoratedPaymentBreakdown;
}

describe('matchInvoicesWithPayments', () => {
  it("keeps the breakdown's payment currency and amount", async () => {
    const { matches } = await matchInvoicesWithPayments([invoice], [breakdown({})]);
    expect(matches[0]).toMatchObject({
      breakdown_payment_currency: 'USD',
      breakdown_total_payment_currency: '150.00',
    });
  });

  it("falls back to the invoice's currency and amount when the breakdown has no payment currency", async () => {
    const { matches } = await matchInvoicesWithPayments(
      [invoice],
      [breakdown({ payment_currency: '', total_payment_currency: '' })],
    );
    expect(matches[0]).toMatchObject({
      breakdown_payment_currency: 'GBP',
      breakdown_total_payment_currency: '120.00',
    });
  });
});
