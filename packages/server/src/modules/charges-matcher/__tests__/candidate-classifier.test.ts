import { describe, expect, it } from 'vitest';
import type { document_type } from '../../documents/types.js';
import { classifyCandidateCharge } from '../helpers/candidate-classifier.helper.js';
import type { DocumentCharge, TransactionCharge } from '../types.js';
import { createMockDocument, createMockTransaction } from './test-helpers.js';

const invoice = () => createMockDocument({ type: 'INVOICE' as document_type });
const receipt = () => createMockDocument({ type: 'RECEIPT' as document_type });

describe('classifyCandidateCharge', () => {
  it('classifies a transaction-only charge as a transaction candidate', () => {
    const transactions = [createMockTransaction()];

    const result = classifyCandidateCharge('charge-1', transactions, []);

    expect(result).toEqual<TransactionCharge>({ chargeId: 'charge-1', transactions });
  });

  it('classifies a charge with transactions and invoice-only docs as a transaction candidate', () => {
    const transactions = [createMockTransaction()];

    const result = classifyCandidateCharge('charge-1', transactions, [invoice()]);

    expect(result).toEqual<TransactionCharge>({ chargeId: 'charge-1', transactions });
  });

  it('classifies an invoice-only charge as a document candidate carrying the invoices', () => {
    const invoiceDoc = invoice();

    const result = classifyCandidateCharge('charge-1', [], [invoiceDoc]);

    expect(result).toEqual<DocumentCharge>({ chargeId: 'charge-1', documents: [invoiceDoc] });
  });

  it('classifies a receipt-only charge as a document candidate carrying the receipts', () => {
    const receiptDoc = receipt();

    const result = classifyCandidateCharge('charge-1', [], [receiptDoc]);

    expect(result).toEqual<DocumentCharge>({ chargeId: 'charge-1', documents: [receiptDoc] });
  });

  it('returns null for a matched charge (transactions + receipt documents)', () => {
    const result = classifyCandidateCharge('charge-1', [createMockTransaction()], [receipt()]);

    expect(result).toBeNull();
  });

  it('returns null for an empty charge (no transactions, no documents)', () => {
    const result = classifyCandidateCharge('charge-1', [], []);

    expect(result).toBeNull();
  });
});
