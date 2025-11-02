import { describe, expect, it } from 'vitest';
import type { Document, Transaction } from '../types.js';
import {
  isValidDocumentForMatching,
  isValidTransactionForMatching,
  isWithinDateWindow,
} from '../helpers/candidate-filter.helper.js';

describe('Candidate Filter', () => {
  describe('isValidTransactionForMatching', () => {
    it('should include normal transactions', () => {
      const transaction: Partial<Transaction> = {
        id: 'tx-1',
        is_fee: false,
        amount: '100.00',
      };

      expect(isValidTransactionForMatching(transaction as Transaction)).toBe(true);
    });

    it('should exclude fee transactions', () => {
      const transaction: Partial<Transaction> = {
        id: 'tx-2',
        is_fee: true,
        amount: '5.00',
      };

      expect(isValidTransactionForMatching(transaction as Transaction)).toBe(false);
    });

    it('should handle transactions with various states', () => {
      const validTransaction: Partial<Transaction> = {
        id: 'tx-3',
        is_fee: false,
        amount: '250.50',
        currency: 'USD',
      };

      expect(isValidTransactionForMatching(validTransaction as Transaction)).toBe(true);
    });
  });

  describe('isValidDocumentForMatching', () => {
    it('should include valid documents', () => {
      const document: Partial<Document> = {
        id: 'doc-1',
        total_amount: 100,
        currency_code: 'USD',
        type: 'INVOICE',
      };

      expect(isValidDocumentForMatching(document as Document)).toBe(true);
    });

    it('should exclude documents with null total_amount', () => {
      const document: Partial<Document> = {
        id: 'doc-2',
        total_amount: null,
        currency_code: 'USD',
        type: 'INVOICE',
      };

      expect(isValidDocumentForMatching(document as Document)).toBe(false);
    });

    it('should exclude documents with undefined total_amount', () => {
      const document: Partial<Document> = {
        id: 'doc-3',
        total_amount: undefined,
        currency_code: 'USD',
        type: 'INVOICE',
      };

      expect(isValidDocumentForMatching(document as Document)).toBe(false);
    });

    it('should exclude documents with null currency_code', () => {
      const document: Partial<Document> = {
        id: 'doc-4',
        total_amount: 100,
        currency_code: null,
        type: 'INVOICE',
      };

      expect(isValidDocumentForMatching(document as Document)).toBe(false);
    });

    it('should exclude documents with empty currency_code', () => {
      const document: Partial<Document> = {
        id: 'doc-5',
        total_amount: 100,
        currency_code: null,
        type: 'INVOICE',
      };

      expect(isValidDocumentForMatching(document as Document)).toBe(false);
    });

    it('should include documents with zero amount (valid)', () => {
      const document: Partial<Document> = {
        id: 'doc-6',
        total_amount: 0,
        currency_code: 'EUR',
        type: 'CREDIT_INVOICE',
      };

      expect(isValidDocumentForMatching(document as Document)).toBe(true);
    });

    it('should include documents with negative amounts', () => {
      const document: Partial<Document> = {
        id: 'doc-7',
        total_amount: -50,
        currency_code: 'ILS',
        type: 'CREDIT_INVOICE',
      };

      expect(isValidDocumentForMatching(document as Document)).toBe(true);
    });
  });

  describe('isWithinDateWindow', () => {
    const referenceDate = new Date('2024-06-15');

    it('should include same date', () => {
      const candidateDate = new Date('2024-06-15');
      expect(isWithinDateWindow(candidateDate, referenceDate)).toBe(true);
    });

    it('should include date 11 months before', () => {
      const candidateDate = new Date('2023-07-15');
      expect(isWithinDateWindow(candidateDate, referenceDate)).toBe(true);
    });

    it('should include date 11 months after', () => {
      const candidateDate = new Date('2025-05-15');
      expect(isWithinDateWindow(candidateDate, referenceDate)).toBe(true);
    });

    it('should include date exactly 12 months before', () => {
      const candidateDate = new Date('2023-06-15');
      expect(isWithinDateWindow(candidateDate, referenceDate)).toBe(true);
    });

    it('should include date exactly 12 months after', () => {
      const candidateDate = new Date('2025-06-15');
      expect(isWithinDateWindow(candidateDate, referenceDate)).toBe(true);
    });

    it('should exclude date 12 months + 1 day before', () => {
      const candidateDate = new Date('2023-06-14');
      expect(isWithinDateWindow(candidateDate, referenceDate)).toBe(false);
    });

    it('should exclude date 12 months + 1 day after', () => {
      const candidateDate = new Date('2025-06-16');
      expect(isWithinDateWindow(candidateDate, referenceDate)).toBe(false);
    });

    it('should handle different years', () => {
      const candidateDate2023 = new Date('2023-09-01'); // 9+ months before
      const candidateDate2025 = new Date('2025-03-01'); // 8+ months after

      expect(isWithinDateWindow(candidateDate2023, referenceDate)).toBe(true);
      expect(isWithinDateWindow(candidateDate2025, referenceDate)).toBe(true);
    });

    it('should handle edge cases around month boundaries - end of month', () => {
      const refDate = new Date('2024-01-31');
      const candidate11MonthsLater = new Date('2024-12-31'); // Exactly 11 months

      expect(isWithinDateWindow(candidate11MonthsLater, refDate)).toBe(true);
    });

    it('should handle edge cases around month boundaries - February leap year', () => {
      const refDate = new Date('2024-02-29'); // Leap year
      const candidate = new Date('2023-03-01'); // Just over 12 months before

      expect(isWithinDateWindow(candidate, refDate)).toBe(true);
    });

    it('should work with custom window - 6 months', () => {
      const candidateDate3MonthsBefore = new Date('2024-03-15');
      const candidateDate7MonthsBefore = new Date('2023-11-15');

      expect(isWithinDateWindow(candidateDate3MonthsBefore, referenceDate, 6)).toBe(true);
      expect(isWithinDateWindow(candidateDate7MonthsBefore, referenceDate, 6)).toBe(false);
    });

    it('should work with custom window - 3 months', () => {
      const candidateDate2MonthsAfter = new Date('2024-08-15');
      const candidateDate4MonthsAfter = new Date('2024-10-15');

      expect(isWithinDateWindow(candidateDate2MonthsAfter, referenceDate, 3)).toBe(true);
      expect(isWithinDateWindow(candidateDate4MonthsAfter, referenceDate, 3)).toBe(false);
    });

    it('should handle month boundary edge case - 12 months exactly', () => {
      const refDate = new Date('2024-01-15');
      const candidate12MonthsAfter = new Date('2025-01-15');
      const candidateJustOver12Months = new Date('2025-01-16');

      expect(isWithinDateWindow(candidate12MonthsAfter, refDate)).toBe(true);
      expect(isWithinDateWindow(candidateJustOver12Months, refDate)).toBe(false);
    });

    it('should handle year transitions', () => {
      const refDate = new Date('2024-01-01');
      const candidateDate = new Date('2023-01-01'); // Exactly 12 months before

      expect(isWithinDateWindow(candidateDate, refDate)).toBe(true);
    });

    it('should be inclusive on boundary dates', () => {
      const refDate = new Date('2024-06-15');
      const minBoundary = new Date('2023-06-15'); // -12 months
      const maxBoundary = new Date('2025-06-15'); // +12 months

      expect(isWithinDateWindow(minBoundary, refDate)).toBe(true);
      expect(isWithinDateWindow(maxBoundary, refDate)).toBe(true);
    });

    it('should handle dates with time components', () => {
      const refDate = new Date('2024-06-15T10:30:00');
      const candidateDate = new Date('2024-06-15T23:59:59');

      expect(isWithinDateWindow(candidateDate, refDate)).toBe(true);
    });

    it('should work with very small window - 1 month', () => {
      const candidateDate1MonthBefore = new Date('2024-05-15');
      const candidateDate2MonthsBefore = new Date('2024-04-15');

      expect(isWithinDateWindow(candidateDate1MonthBefore, referenceDate, 1)).toBe(true);
      expect(isWithinDateWindow(candidateDate2MonthsBefore, referenceDate, 1)).toBe(false);
    });
  });
});
