import { describe, expect, it } from 'vitest';
import {
  normalizeDocumentAmount,
  type DocumentType,
} from '../helpers/document-amount.helper.js';

describe('Document Amount Normalization', () => {
  describe('INVOICE - Business is Debtor (User is Creditor)', () => {
    it('should return positive amount when business is debtor', () => {
      // Business owes user (user is creditor, business is debtor)
      const result = normalizeDocumentAmount(100, false, 'INVOICE');
      expect(result).toBe(100);
    });

    it('should handle decimal amounts', () => {
      const result = normalizeDocumentAmount(150.75, false, 'INVOICE');
      expect(result).toBe(150.75);
    });

    it('should handle large amounts', () => {
      const result = normalizeDocumentAmount(1000000, false, 'INVOICE');
      expect(result).toBe(1000000);
    });
  });

  describe('INVOICE - Business is Creditor (User is Debtor)', () => {
    it('should return negative amount when business is creditor', () => {
      // User owes business (user is debtor, business is creditor)
      const result = normalizeDocumentAmount(100, true, 'INVOICE');
      expect(result).toBe(-100);
    });

    it('should handle decimal amounts', () => {
      const result = normalizeDocumentAmount(250.50, true, 'INVOICE');
      expect(result).toBe(-250.50);
    });

    it('should handle large amounts', () => {
      const result = normalizeDocumentAmount(5000000, true, 'INVOICE');
      expect(result).toBe(-5000000);
    });
  });

  describe('CREDIT_INVOICE - Business is Debtor (User is Creditor)', () => {
    it('should return negative amount for credit invoice with business debtor', () => {
      // Credit invoice: user owes refund to business (opposite of regular invoice)
      const result = normalizeDocumentAmount(100, false, 'CREDIT_INVOICE');
      expect(result).toBe(-100);
    });

    it('should handle decimal amounts', () => {
      const result = normalizeDocumentAmount(75.25, false, 'CREDIT_INVOICE');
      expect(result).toBe(-75.25);
    });

    it('should handle large amounts', () => {
      const result = normalizeDocumentAmount(2000000, false, 'CREDIT_INVOICE');
      expect(result).toBe(-2000000);
    });
  });

  describe('CREDIT_INVOICE - Business is Creditor (User is Debtor)', () => {
    it('should return positive amount for credit invoice with business creditor (double negation)', () => {
      // Credit invoice: business owes refund to user (double negation: -1 * -1 = 1)
      const result = normalizeDocumentAmount(100, true, 'CREDIT_INVOICE');
      expect(result).toBe(100);
    });

    it('should handle decimal amounts', () => {
      const result = normalizeDocumentAmount(125.99, true, 'CREDIT_INVOICE');
      expect(result).toBe(125.99);
    });

    it('should handle large amounts', () => {
      const result = normalizeDocumentAmount(3000000, true, 'CREDIT_INVOICE');
      expect(result).toBe(3000000);
    });
  });

  describe('RECEIPT - Business is Debtor (User is Creditor)', () => {
    it('should return positive amount when business is debtor', () => {
      const result = normalizeDocumentAmount(100, false, 'RECEIPT');
      expect(result).toBe(100);
    });

    it('should handle typical receipt amounts', () => {
      const result = normalizeDocumentAmount(49.99, false, 'RECEIPT');
      expect(result).toBe(49.99);
    });
  });

  describe('RECEIPT - Business is Creditor (User is Debtor)', () => {
    it('should return negative amount when business is creditor', () => {
      const result = normalizeDocumentAmount(100, true, 'RECEIPT');
      expect(result).toBe(-100);
    });

    it('should handle typical receipt amounts', () => {
      const result = normalizeDocumentAmount(89.50, true, 'RECEIPT');
      expect(result).toBe(-89.50);
    });
  });

  describe('INVOICE_RECEIPT - Business is Debtor (User is Creditor)', () => {
    it('should return positive amount when business is debtor', () => {
      const result = normalizeDocumentAmount(100, false, 'INVOICE_RECEIPT');
      expect(result).toBe(100);
    });

    it('should handle combined invoice-receipt amounts', () => {
      const result = normalizeDocumentAmount(350.00, false, 'INVOICE_RECEIPT');
      expect(result).toBe(350.00);
    });
  });

  describe('INVOICE_RECEIPT - Business is Creditor (User is Debtor)', () => {
    it('should return negative amount when business is creditor', () => {
      const result = normalizeDocumentAmount(100, true, 'INVOICE_RECEIPT');
      expect(result).toBe(-100);
    });

    it('should handle combined invoice-receipt amounts', () => {
      const result = normalizeDocumentAmount(425.75, true, 'INVOICE_RECEIPT');
      expect(result).toBe(-425.75);
    });
  });

  describe('OTHER Document Type', () => {
    it('should handle OTHER type with business debtor', () => {
      const result = normalizeDocumentAmount(100, false, 'OTHER');
      expect(result).toBe(100);
    });

    it('should handle OTHER type with business creditor', () => {
      const result = normalizeDocumentAmount(100, true, 'OTHER');
      expect(result).toBe(-100);
    });
  });

  describe('PROFORMA Document Type', () => {
    it('should handle PROFORMA type with business debtor', () => {
      const result = normalizeDocumentAmount(100, false, 'PROFORMA');
      expect(result).toBe(100);
    });

    it('should handle PROFORMA type with business creditor', () => {
      const result = normalizeDocumentAmount(100, true, 'PROFORMA');
      expect(result).toBe(-100);
    });
  });

  describe('UNPROCESSED Document Type', () => {
    it('should handle UNPROCESSED type with business debtor', () => {
      const result = normalizeDocumentAmount(100, false, 'UNPROCESSED');
      expect(result).toBe(100);
    });

    it('should handle UNPROCESSED type with business creditor', () => {
      const result = normalizeDocumentAmount(100, true, 'UNPROCESSED');
      expect(result).toBe(-100);
    });
  });

  describe('Negative Input Amounts (Absolute Value First)', () => {
    it('should convert negative input to positive for INVOICE with business debtor', () => {
      // Input is -100, should become |−100| = 100
      const result = normalizeDocumentAmount(-100, false, 'INVOICE');
      expect(result).toBe(100);
    });

    it('should convert negative input to negative for INVOICE with business creditor', () => {
      // Input is -100, should become |−100| * -1 = -100
      const result = normalizeDocumentAmount(-100, true, 'INVOICE');
      expect(result).toBe(-100);
    });

    it('should convert negative input for CREDIT_INVOICE with business debtor', () => {
      // Input is -100, should become |−100| * -1 = -100
      const result = normalizeDocumentAmount(-100, false, 'CREDIT_INVOICE');
      expect(result).toBe(-100);
    });

    it('should convert negative input for CREDIT_INVOICE with business creditor', () => {
      // Input is -100, should become |−100| * -1 * -1 = 100
      const result = normalizeDocumentAmount(-100, true, 'CREDIT_INVOICE');
      expect(result).toBe(100);
    });

    it('should handle negative decimal amounts', () => {
      const result = normalizeDocumentAmount(-250.50, false, 'INVOICE');
      expect(result).toBe(250.50);
    });

    it('should handle large negative amounts', () => {
      const result = normalizeDocumentAmount(-1000000, true, 'RECEIPT');
      expect(result).toBe(-1000000);
    });
  });

  describe('Zero Amounts', () => {
    it('should handle zero amount with business debtor', () => {
      const result = normalizeDocumentAmount(0, false, 'INVOICE');
      expect(result).toBe(0);
    });

    it('should handle zero amount with business creditor', () => {
      const result = normalizeDocumentAmount(0, true, 'INVOICE');
      expect(result).toBe(-0); // JavaScript has -0, but 0 === -0 is true
    });

    it('should handle zero for CREDIT_INVOICE', () => {
      const result = normalizeDocumentAmount(0, false, 'CREDIT_INVOICE');
      expect(result).toBe(-0);
    });

    it('should verify zero equality regardless of sign', () => {
      const result1 = normalizeDocumentAmount(0, false, 'INVOICE');
      const result2 = normalizeDocumentAmount(0, true, 'INVOICE');
      expect(result1).toBe(0);
      // In JavaScript, -0 and 0 are loosely equal but Object.is distinguishes them
      // For our purposes, they are functionally equivalent
      expect(result2 == 0).toBe(true); // Using == instead of === for -0 case
    });
  });

  describe('Very Large Amounts', () => {
    it('should handle very large positive amounts', () => {
      const largeAmount = 999999999.99;
      const result = normalizeDocumentAmount(largeAmount, false, 'INVOICE');
      expect(result).toBe(largeAmount);
    });

    it('should handle very large amounts with creditor negation', () => {
      const largeAmount = 999999999.99;
      const result = normalizeDocumentAmount(largeAmount, true, 'INVOICE');
      expect(result).toBe(-largeAmount);
    });

    it('should handle very large amounts with CREDIT_INVOICE', () => {
      const largeAmount = 888888888.88;
      const result = normalizeDocumentAmount(largeAmount, true, 'CREDIT_INVOICE');
      expect(result).toBe(largeAmount);
    });

    it('should handle maximum safe integer', () => {
      const maxSafe = Number.MAX_SAFE_INTEGER;
      const result = normalizeDocumentAmount(maxSafe, false, 'INVOICE');
      expect(result).toBe(maxSafe);
    });
  });

  describe('Small Decimal Amounts', () => {
    it('should handle very small decimal amounts', () => {
      const result = normalizeDocumentAmount(0.01, false, 'INVOICE');
      expect(result).toBe(0.01);
    });

    it('should handle fractional cents', () => {
      const result = normalizeDocumentAmount(0.001, true, 'RECEIPT');
      expect(result).toBe(-0.001);
    });

    it('should preserve precision for small decimals', () => {
      const result = normalizeDocumentAmount(1.23456789, false, 'INVOICE');
      expect(result).toBe(1.23456789);
    });
  });

  describe('All Document Types Summary Table', () => {
    // This test documents the expected behavior for all combinations
    it('should correctly normalize all document type and business role combinations', () => {
      const testCases: Array<{
        type: DocumentType;
        isCreditor: boolean;
        input: number;
        expected: number;
        description: string;
      }> = [
        // INVOICE
        { type: 'INVOICE', isCreditor: false, input: 100, expected: 100, description: 'INVOICE, business debtor' },
        { type: 'INVOICE', isCreditor: true, input: 100, expected: -100, description: 'INVOICE, business creditor' },
        
        // CREDIT_INVOICE
        { type: 'CREDIT_INVOICE', isCreditor: false, input: 100, expected: -100, description: 'CREDIT_INVOICE, business debtor' },
        { type: 'CREDIT_INVOICE', isCreditor: true, input: 100, expected: 100, description: 'CREDIT_INVOICE, business creditor (double neg)' },
        
        // RECEIPT
        { type: 'RECEIPT', isCreditor: false, input: 100, expected: 100, description: 'RECEIPT, business debtor' },
        { type: 'RECEIPT', isCreditor: true, input: 100, expected: -100, description: 'RECEIPT, business creditor' },
        
        // INVOICE_RECEIPT
        { type: 'INVOICE_RECEIPT', isCreditor: false, input: 100, expected: 100, description: 'INVOICE_RECEIPT, business debtor' },
        { type: 'INVOICE_RECEIPT', isCreditor: true, input: 100, expected: -100, description: 'INVOICE_RECEIPT, business creditor' },
        
        // OTHER
        { type: 'OTHER', isCreditor: false, input: 100, expected: 100, description: 'OTHER, business debtor' },
        { type: 'OTHER', isCreditor: true, input: 100, expected: -100, description: 'OTHER, business creditor' },
        
        // PROFORMA
        { type: 'PROFORMA', isCreditor: false, input: 100, expected: 100, description: 'PROFORMA, business debtor' },
        { type: 'PROFORMA', isCreditor: true, input: 100, expected: -100, description: 'PROFORMA, business creditor' },
        
        // UNPROCESSED
        { type: 'UNPROCESSED', isCreditor: false, input: 100, expected: 100, description: 'UNPROCESSED, business debtor' },
        { type: 'UNPROCESSED', isCreditor: true, input: 100, expected: -100, description: 'UNPROCESSED, business creditor' },
      ];

      testCases.forEach(({ type, isCreditor, input, expected, description }) => {
        const result = normalizeDocumentAmount(input, isCreditor, type);
        expect(result).toBe(expected);
      });
    });
  });

  describe('Real-World Scenarios', () => {
    it('should normalize customer invoice (business sends invoice to customer)', () => {
      // Business is creditor (customer owes business)
      const result = normalizeDocumentAmount(1500, true, 'INVOICE');
      expect(result).toBe(-1500); // Negative because user owes
    });

    it('should normalize vendor invoice (vendor sends invoice to business)', () => {
      // Business is debtor (business owes vendor)
      const result = normalizeDocumentAmount(750, false, 'INVOICE');
      expect(result).toBe(750); // Positive because vendor owes user
    });

    it('should normalize customer refund (credit invoice to customer)', () => {
      // Business owes customer a refund
      const result = normalizeDocumentAmount(200, true, 'CREDIT_INVOICE');
      expect(result).toBe(200); // Positive because business owes refund
    });

    it('should normalize vendor credit note (credit invoice from vendor)', () => {
      // Vendor gives credit note to business
      const result = normalizeDocumentAmount(150, false, 'CREDIT_INVOICE');
      expect(result).toBe(-150); // Negative because business owes vendor less now
    });

    it('should normalize payment receipt from customer', () => {
      // Customer pays business
      const result = normalizeDocumentAmount(500, true, 'RECEIPT');
      expect(result).toBe(-500); // Negative because customer paid
    });

    it('should normalize payment receipt to vendor', () => {
      // Business pays vendor
      const result = normalizeDocumentAmount(300, false, 'RECEIPT');
      expect(result).toBe(300); // Positive because business paid
    });
  });
});
