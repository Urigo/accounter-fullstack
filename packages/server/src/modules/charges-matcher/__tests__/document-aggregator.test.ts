import { describe, expect, it } from 'vitest';
import {
  aggregateDocuments,
  type AggregatedDocument,
  type Document,
} from '../providers/document-aggregator.js';
import type { DocumentType } from '../helpers/document-amount.helper.js';

describe('Document Aggregator', () => {
  const USER_ID = 'user-123';

  // Helper to create test documents
  const createDocument = (overrides: Partial<Document> = {}): Document => ({
    id: 'doc-' + Math.random().toString(36).substr(2, 9),
    charge_id_new: 'charge-123',
    creditor_id: USER_ID, // Default: user is creditor
    debtor_id: 'business-1', // Default: business is debtor
    currency_code: 'USD',
    date: new Date('2024-01-15'),
    total_amount: 100,
    type: 'INVOICE',
    serial_number: null,
    image_url: null,
    file_url: null,
    ...overrides,
  });

  describe('Single Document', () => {
    it('should return single document with normalized amount', () => {
      const document = createDocument({
        total_amount: 150.5,
        currency_code: 'USD',
        creditor_id: USER_ID,
        debtor_id: 'business-1',
        type: 'INVOICE',
        date: new Date('2024-01-15'),
        serial_number: 'INV-001',
      });

      const result = aggregateDocuments([document], USER_ID);

      expect(result.amount).toBe(150.5); // Positive: business is debtor
      expect(result.currency).toBe('USD');
      expect(result.businessId).toBe('business-1');
      expect(result.date).toEqual(new Date('2024-01-15'));
      expect(result.documentType).toBe('INVOICE');
      expect(result.description).toBe('INV-001');
    });

    it('should normalize amount when business is creditor', () => {
      const document = createDocument({
        total_amount: 200,
        creditor_id: 'business-1', // Business is creditor
        debtor_id: USER_ID, // User is debtor
        type: 'INVOICE',
      });

      const result = aggregateDocuments([document], USER_ID);

      expect(result.amount).toBe(-200); // Negative: business is creditor
      expect(result.businessId).toBe('business-1');
    });

    it('should handle credit invoice normalization', () => {
      const document = createDocument({
        total_amount: 100,
        creditor_id: 'business-1', // Business is creditor
        debtor_id: USER_ID, // User is debtor
        type: 'CREDIT_INVOICE',
      });

      const result = aggregateDocuments([document], USER_ID);

      expect(result.amount).toBe(100); // Positive: double negation (-1 * -1)
      expect(result.documentType).toBe('CREDIT_INVOICE');
    });

    it('should use file_url as description when serial_number is null', () => {
      const document = createDocument({
        serial_number: null,
        file_url: 'https://example.com/files/invoice_2024.pdf',
      });

      const result = aggregateDocuments([document], USER_ID);

      expect(result.description).toBe('invoice_2024.pdf');
    });

    it('should use image_url as description when both serial_number and file_url are null', () => {
      const document = createDocument({
        serial_number: null,
        file_url: null,
        image_url: 'https://example.com/images/scan_001.jpg',
      });

      const result = aggregateDocuments([document], USER_ID);

      expect(result.description).toBe('scan_001.jpg');
    });

    it('should use document ID as fallback description', () => {
      const document = createDocument({
        id: 'doc-abc123def456',
        serial_number: null,
        file_url: null,
        image_url: null,
      });

      const result = aggregateDocuments([document], USER_ID);

      expect(result.description).toBe('Doc-doc-abc1');
    });
  });

  describe('Multiple Invoices', () => {
    it('should sum normalized amounts correctly', () => {
      const documents = [
        createDocument({ total_amount: 100, type: 'INVOICE' }), // +100
        createDocument({ total_amount: 200, type: 'INVOICE' }), // +200
        createDocument({ total_amount: 50, type: 'INVOICE' }), // +50
      ];

      const result = aggregateDocuments(documents, USER_ID);

      expect(result.amount).toBe(350);
      expect(result.documentType).toBe('INVOICE');
    });

    it('should handle mixed regular and credit invoices', () => {
      const documents = [
        createDocument({
          total_amount: 500,
          type: 'INVOICE',
          creditor_id: USER_ID,
          debtor_id: 'business-1',
        }), // +500
        createDocument({
          total_amount: 100,
          type: 'CREDIT_INVOICE',
          creditor_id: USER_ID,
          debtor_id: 'business-1',
        }), // -100
      ];

      const result = aggregateDocuments(documents, USER_ID);

      expect(result.amount).toBe(400); // 500 - 100
    });

    it('should handle invoices where business is creditor', () => {
      const documents = [
        createDocument({
          total_amount: 200,
          creditor_id: 'business-1',
          debtor_id: USER_ID,
        }), // -200
        createDocument({
          total_amount: 100,
          creditor_id: 'business-1',
          debtor_id: USER_ID,
        }), // -100
      ];

      const result = aggregateDocuments(documents, USER_ID);

      expect(result.amount).toBe(-300);
    });
  });

  describe('Multiple Receipts', () => {
    it('should sum receipt amounts correctly', () => {
      const documents = [
        createDocument({ total_amount: 50, type: 'RECEIPT' }),
        createDocument({ total_amount: 75, type: 'RECEIPT' }),
      ];

      const result = aggregateDocuments(documents, USER_ID);

      expect(result.amount).toBe(125);
      expect(result.documentType).toBe('RECEIPT');
    });

    it('should handle invoice-receipts', () => {
      const documents = [
        createDocument({ total_amount: 100, type: 'INVOICE_RECEIPT' }),
        createDocument({ total_amount: 150, type: 'INVOICE_RECEIPT' }),
      ];

      const result = aggregateDocuments(documents, USER_ID);

      expect(result.amount).toBe(250);
      expect(result.documentType).toBe('INVOICE_RECEIPT');
    });
  });

  describe('Type Priority Filtering', () => {
    it('should use only invoices when both invoices and receipts exist', () => {
      const documents = [
        createDocument({ total_amount: 100, type: 'INVOICE', serial_number: 'INV-001' }),
        createDocument({ total_amount: 200, type: 'RECEIPT', serial_number: 'REC-001' }),
        createDocument({ total_amount: 50, type: 'INVOICE', serial_number: 'INV-002' }),
      ];

      const result = aggregateDocuments(documents, USER_ID);

      expect(result.amount).toBe(150); // Only invoices: 100 + 50
      expect(result.documentType).toBe('INVOICE');
      expect(result.description).toContain('INV-001');
      expect(result.description).toContain('INV-002');
      expect(result.description).not.toContain('REC-001'); // Receipt excluded
    });

    it('should use only credit invoices when both credit invoices and receipts exist', () => {
      const documents = [
        createDocument({ total_amount: 100, type: 'CREDIT_INVOICE' }),
        createDocument({ total_amount: 200, type: 'RECEIPT' }),
        createDocument({ total_amount: 50, type: 'CREDIT_INVOICE' }),
      ];

      const result = aggregateDocuments(documents, USER_ID);

      // Credit invoices with user as creditor (business debtor): negate
      expect(result.amount).toBe(-150); // -(100 + 50)
      expect(result.documentType).toBe('CREDIT_INVOICE');
    });

    it('should use only invoices/credit-invoices when mixed with invoice-receipts', () => {
      const documents = [
        createDocument({ total_amount: 100, type: 'INVOICE' }),
        createDocument({ total_amount: 200, type: 'INVOICE_RECEIPT' }), // Should be excluded
        createDocument({ total_amount: 50, type: 'CREDIT_INVOICE' }),
      ];

      const result = aggregateDocuments(documents, USER_ID);

      expect(result.amount).toBe(50); // 100 - 50 (credit invoice negates)
    });

    it('should use receipts when no invoices exist', () => {
      const documents = [
        createDocument({ total_amount: 100, type: 'RECEIPT' }),
        createDocument({ total_amount: 50, type: 'INVOICE_RECEIPT' }),
      ];

      const result = aggregateDocuments(documents, USER_ID);

      expect(result.amount).toBe(150);
      expect(result.documentType).toBe('RECEIPT');
    });
  });

  describe('Currency Validation', () => {
    it('should throw error with multiple currencies', () => {
      const documents = [
        createDocument({ currency_code: 'USD' }),
        createDocument({ currency_code: 'EUR' }),
      ];

      expect(() => aggregateDocuments(documents, USER_ID)).toThrow(
        'Cannot aggregate documents: multiple currencies found (USD, EUR)',
      );
    });

    it('should throw error with three different currencies', () => {
      const documents = [
        createDocument({ currency_code: 'USD' }),
        createDocument({ currency_code: 'EUR' }),
        createDocument({ currency_code: 'GBP' }),
      ];

      expect(() => aggregateDocuments(documents, USER_ID)).toThrow(/multiple currencies found/);
    });

    it('should not throw when all have same currency', () => {
      const documents = [
        createDocument({ currency_code: 'ILS' }),
        createDocument({ currency_code: 'ILS' }),
        createDocument({ currency_code: 'ILS' }),
      ];

      expect(() => aggregateDocuments(documents, USER_ID)).not.toThrow();
    });

    it('should throw error when all currencies are null', () => {
      const documents = [
        createDocument({ currency_code: null }),
        createDocument({ currency_code: null }),
      ];

      expect(() => aggregateDocuments(documents, USER_ID)).toThrow(
        'Cannot aggregate documents: all documents have null currency_code',
      );
    });

    it('should ignore currency of filtered-out receipts', () => {
      const documents = [
        createDocument({ currency_code: 'USD', type: 'INVOICE' }),
        createDocument({ currency_code: 'EUR', type: 'RECEIPT' }), // Different currency but will be filtered
        createDocument({ currency_code: 'USD', type: 'INVOICE' }),
      ];

      const result = aggregateDocuments(documents, USER_ID);

      expect(result.currency).toBe('USD');
    });
  });

  describe('Business ID Validation', () => {
    it('should throw error with multiple different business IDs', () => {
      const documents = [
        createDocument({ debtor_id: 'business-1', creditor_id: USER_ID }),
        createDocument({ debtor_id: 'business-2', creditor_id: USER_ID }),
      ];

      expect(() => aggregateDocuments(documents, USER_ID)).toThrow(
        'Cannot aggregate documents: multiple business IDs found (business-1, business-2)',
      );
    });

    it('should return null when all business IDs are null', () => {
      const documents = [
        createDocument({ debtor_id: null, creditor_id: USER_ID }),
        createDocument({ debtor_id: null, creditor_id: USER_ID }),
      ];

      const result = aggregateDocuments(documents, USER_ID);

      expect(result.businessId).toBeNull();
    });

    it('should return single non-null business ID', () => {
      const documents = [
        createDocument({ debtor_id: 'business-1', creditor_id: USER_ID }),
        createDocument({ debtor_id: null, creditor_id: USER_ID }),
        createDocument({ debtor_id: null, creditor_id: USER_ID }),
      ];

      const result = aggregateDocuments(documents, USER_ID);

      expect(result.businessId).toBe('business-1');
    });

    it('should not throw when all have same business ID', () => {
      const documents = [
        createDocument({ debtor_id: 'business-1', creditor_id: USER_ID }),
        createDocument({ debtor_id: 'business-1', creditor_id: USER_ID }),
      ];

      const result = aggregateDocuments(documents, USER_ID);

      expect(result.businessId).toBe('business-1');
    });
  });

  describe('Date Selection', () => {
    it('should select latest date', () => {
      const documents = [
        createDocument({ date: new Date('2024-01-10') }),
        createDocument({ date: new Date('2024-03-15') }), // Latest
        createDocument({ date: new Date('2024-02-20') }),
      ];

      const result = aggregateDocuments(documents, USER_ID);

      expect(result.date).toEqual(new Date('2024-03-15'));
    });

    it('should handle dates spanning years', () => {
      const documents = [
        createDocument({ date: new Date('2023-12-31') }),
        createDocument({ date: new Date('2024-02-01') }), // Latest
        createDocument({ date: new Date('2024-01-15') }),
      ];

      const result = aggregateDocuments(documents, USER_ID);

      expect(result.date).toEqual(new Date('2024-02-01'));
    });

    it('should handle same date for all documents', () => {
      const documents = [
        createDocument({ date: new Date('2024-01-15') }),
        createDocument({ date: new Date('2024-01-15') }),
      ];

      const result = aggregateDocuments(documents, USER_ID);

      expect(result.date).toEqual(new Date('2024-01-15'));
    });

    it('should throw error when all dates are null', () => {
      const documents = [
        createDocument({ date: null }),
        createDocument({ date: null }),
      ];

      expect(() => aggregateDocuments(documents, USER_ID)).toThrow(
        'Cannot aggregate documents: all documents have null date',
      );
    });

    it('should handle mix of null and valid dates', () => {
      const documents = [
        createDocument({ date: null }),
        createDocument({ date: new Date('2024-01-15') }),
        createDocument({ date: new Date('2024-02-20') }), // Latest
      ];

      const result = aggregateDocuments(documents, USER_ID);

      expect(result.date).toEqual(new Date('2024-02-20'));
    });
  });

  describe('Description Concatenation', () => {
    it('should concatenate serial numbers with line breaks', () => {
      const documents = [
        createDocument({ serial_number: 'INV-001' }),
        createDocument({ serial_number: 'INV-002' }),
        createDocument({ serial_number: 'INV-003' }),
      ];

      const result = aggregateDocuments(documents, USER_ID);

      expect(result.description).toBe('INV-001\nINV-002\nINV-003');
    });

    it('should prefer serial_number over file URLs', () => {
      const documents = [
        createDocument({ serial_number: 'INV-001', file_url: 'file1.pdf' }),
        createDocument({ serial_number: null, file_url: 'file2.pdf' }),
      ];

      const result = aggregateDocuments(documents, USER_ID);

      expect(result.description).toBe('INV-001\nfile2.pdf');
    });

    it('should use image URLs when no serial or file URL', () => {
      const documents = [
        createDocument({ serial_number: null, file_url: null, image_url: 'img1.jpg' }),
        createDocument({ serial_number: null, file_url: null, image_url: 'img2.jpg' }),
      ];

      const result = aggregateDocuments(documents, USER_ID);

      expect(result.description).toBe('img1.jpg\nimg2.jpg');
    });

    it('should fallback to document ID when no other identifiers', () => {
      const documents = [
        createDocument({
          id: 'doc-abc123',
          serial_number: null,
          file_url: null,
          image_url: null,
        }),
        createDocument({ id: 'doc-def456', serial_number: 'INV-001' }),
      ];

      const result = aggregateDocuments(documents, USER_ID);

      expect(result.description).toContain('Doc-doc-abc1');
      expect(result.description).toContain('INV-001');
    });

    it('should handle empty descriptions gracefully', () => {
      const documents = [
        createDocument({ serial_number: '  ', file_url: null, image_url: null, id: 'doc-123' }),
      ];

      const result = aggregateDocuments(documents, USER_ID);

      expect(result.description).toBe('Doc-doc-123');
    });
  });

  describe('Business Extraction Error Propagation', () => {
    it('should propagate error when both creditor and debtor are user', () => {
      const documents = [
        createDocument({
          creditor_id: USER_ID,
          debtor_id: USER_ID, // Invalid: both are user
        }),
      ];

      expect(() => aggregateDocuments(documents, USER_ID)).toThrow(
        /both creditor_id and debtor_id equal to user ID/,
      );
    });

    it('should propagate error when neither creditor nor debtor is user', () => {
      const documents = [
        createDocument({
          creditor_id: 'business-1',
          debtor_id: 'business-2', // Invalid: neither is user
        }),
      ];

      expect(() => aggregateDocuments(documents, USER_ID)).toThrow(
        /neither creditor_id nor debtor_id equal to user ID/,
      );
    });

    it('should propagate error when both IDs are null', () => {
      const documents = [
        createDocument({
          creditor_id: null,
          debtor_id: null, // Invalid: both null
        }),
      ];

      expect(() => aggregateDocuments(documents, USER_ID)).toThrow(
        /both creditor_id and debtor_id as null/,
      );
    });
  });

  describe('Input Validation', () => {
    it('should throw error for empty array', () => {
      expect(() => aggregateDocuments([], USER_ID)).toThrow(
        'Cannot aggregate documents: array is empty',
      );
    });

    it('should throw error for null input', () => {
      expect(() => aggregateDocuments(null as any, USER_ID)).toThrow(
        'Cannot aggregate documents: array is empty',
      );
    });

    it('should throw error for undefined input', () => {
      expect(() => aggregateDocuments(undefined as any, USER_ID)).toThrow(
        'Cannot aggregate documents: array is empty',
      );
    });
  });

  describe('Complex Scenarios', () => {
    it('should handle real-world mixed document scenario', () => {
      const documents = [
        createDocument({
          total_amount: 1000,
          type: 'INVOICE',
          creditor_id: USER_ID,
          debtor_id: 'business-abc',
          date: new Date('2024-01-15'),
          serial_number: 'INV-2024-001',
          currency_code: 'USD',
        }),
        createDocument({
          total_amount: 500,
          type: 'RECEIPT', // Will be filtered out
          creditor_id: USER_ID,
          debtor_id: 'business-abc',
          date: new Date('2024-01-20'),
          serial_number: 'REC-2024-001',
          currency_code: 'EUR', // Different currency but will be filtered
        }),
        createDocument({
          total_amount: 200,
          type: 'CREDIT_INVOICE',
          creditor_id: USER_ID,
          debtor_id: 'business-abc',
          date: new Date('2024-01-25'), // Latest
          serial_number: 'CRD-2024-001',
          currency_code: 'USD',
        }),
      ];

      const result = aggregateDocuments(documents, USER_ID);

      expect(result.amount).toBe(800); // 1000 - 200 (credit invoice)
      expect(result.currency).toBe('USD');
      expect(result.businessId).toBe('business-abc');
      expect(result.date).toEqual(new Date('2024-01-25')); // Latest among invoices
      expect(result.documentType).toBe('INVOICE'); // First invoice type
      expect(result.description).toContain('INV-2024-001');
      expect(result.description).toContain('CRD-2024-001');
      expect(result.description).not.toContain('REC-2024-001'); // Receipt excluded
    });

    it('should handle documents with null business IDs', () => {
      const documents = [
        createDocument({
          total_amount: 100,
          creditor_id: USER_ID,
          debtor_id: null, // No business
        }),
        createDocument({
          total_amount: 200,
          creditor_id: USER_ID,
          debtor_id: null, // No business
        }),
      ];

      const result = aggregateDocuments(documents, USER_ID);

      expect(result.amount).toBe(300);
      expect(result.businessId).toBeNull();
    });

    it('should handle cryptocurrency documents', () => {
      const documents = [
        createDocument({ total_amount: 0.5, currency_code: 'ETH' }),
        createDocument({ total_amount: 0.3, currency_code: 'ETH' }),
      ];

      const result = aggregateDocuments(documents, USER_ID);

      expect(result.amount).toBe(0.8);
      expect(result.currency).toBe('ETH');
    });
  });
});
