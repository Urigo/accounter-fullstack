import { describe, expect, it } from 'vitest';
import {
  validateChargeForMatching,
  validateChargeIsUnmatched,
  isChargeMatched,
  hasOnlyTransactions,
  hasOnlyDocuments,
} from '../helpers/charge-validator.helper.js';
import { createMockTransaction, createMockDocument } from './test-helpers.js';

describe('Charge Validator', () => {
  describe('validateChargeForMatching', () => {
    it('should pass for charge with transactions', () => {
      const charge = {
        id: 'charge-1',
        owner_id: 'user-1',
        transactions: [createMockTransaction({ charge_id: 'charge-1' })],
        documents: [],
      };

      expect(() => validateChargeForMatching(charge)).not.toThrow();
    });

    it('should pass for charge with documents', () => {
      const charge = {
        id: 'charge-1',
        owner_id: 'user-1',
        transactions: [],
        documents: [createMockDocument({ charge_id: 'charge-1', type: 'INVOICE' })],
      };

      expect(() => validateChargeForMatching(charge)).not.toThrow();
    });

    it('should pass for charge with both transactions and documents', () => {
      const charge = {
        id: 'charge-1',
        owner_id: 'user-1',
        transactions: [createMockTransaction({ charge_id: 'charge-1' })],
        documents: [createMockDocument({ charge_id: 'charge-1', type: 'INVOICE' })],
      };

      expect(() => validateChargeForMatching(charge)).not.toThrow();
    });

    it('should throw if charge is null', () => {
      expect(() => validateChargeForMatching(null as any)).toThrow('Charge is required');
    });

    it('should throw if charge is undefined', () => {
      expect(() => validateChargeForMatching(undefined as any)).toThrow('Charge is required');
    });

    it('should throw if charge has no ID', () => {
      const charge = {
        id: '',
        owner_id: 'user-1',
        transactions: [createMockTransaction()],
        documents: [],
      };

      expect(() => validateChargeForMatching(charge)).toThrow('Charge must have an ID');
    });

    it('should throw if charge has no owner_id', () => {
      const charge = {
        id: 'charge-1',
        owner_id: null,
        transactions: [createMockTransaction({ charge_id: 'charge-1' })],
        documents: [],
      };

      expect(() => validateChargeForMatching(charge)).toThrow('must have an owner_id');
    });

    it('should throw if charge has no transactions and no documents', () => {
      const charge = {
        id: 'charge-1',
        owner_id: 'user-1',
        transactions: [],
        documents: [],
      };

      expect(() => validateChargeForMatching(charge)).toThrow(
        'has no transactions or documents',
      );
    });

    it('should throw if charge has undefined transactions and documents', () => {
      const charge = {
        id: 'charge-1',
        owner_id: 'user-1',
        transactions: undefined,
        documents: undefined,
      };

      expect(() => validateChargeForMatching(charge)).toThrow(
        'has no transactions or documents',
      );
    });
  });

  describe('isChargeMatched', () => {
    it('should return true for charge with transactions and accounting documents', () => {
      const charge = {
        id: 'charge-1',
        owner_id: 'user-1',
        transactions: [createMockTransaction({ charge_id: 'charge-1' })],
        documents: [createMockDocument({ charge_id: 'charge-1', type: 'INVOICE' })],
      };

      expect(isChargeMatched(charge)).toBe(true);
    });

    it('should return true for charge with CREDIT_INVOICE', () => {
      const charge = {
        id: 'charge-1',
        owner_id: 'user-1',
        transactions: [createMockTransaction({ charge_id: 'charge-1' })],
        documents: [createMockDocument({ charge_id: 'charge-1', type: 'CREDIT_INVOICE' })],
      };

      expect(isChargeMatched(charge)).toBe(true);
    });

    it('should return true for charge with RECEIPT', () => {
      const charge = {
        id: 'charge-1',
        owner_id: 'user-1',
        transactions: [createMockTransaction({ charge_id: 'charge-1' })],
        documents: [createMockDocument({ charge_id: 'charge-1', type: 'RECEIPT' })],
      };

      expect(isChargeMatched(charge)).toBe(true);
    });

    it('should return true for charge with INVOICE_RECEIPT', () => {
      const charge = {
        id: 'charge-1',
        owner_id: 'user-1',
        transactions: [createMockTransaction({ charge_id: 'charge-1' })],
        documents: [createMockDocument({ charge_id: 'charge-1', type: 'INVOICE_RECEIPT' })],
      };

      expect(isChargeMatched(charge)).toBe(true);
    });

    it('should return false for charge with only transactions', () => {
      const charge = {
        id: 'charge-1',
        owner_id: 'user-1',
        transactions: [createMockTransaction({ charge_id: 'charge-1' })],
        documents: [],
      };

      expect(isChargeMatched(charge)).toBe(false);
    });

    it('should return false for charge with only documents', () => {
      const charge = {
        id: 'charge-1',
        owner_id: 'user-1',
        transactions: [],
        documents: [createMockDocument({ charge_id: 'charge-1', type: 'INVOICE' })],
      };

      expect(isChargeMatched(charge)).toBe(false);
    });

    it('should return false for charge with transactions and OTHER (non-accounting doc)', () => {
      const charge = {
        id: 'charge-1',
        owner_id: 'user-1',
        transactions: [createMockTransaction({ charge_id: 'charge-1' })],
        documents: [createMockDocument({ charge_id: 'charge-1', type: 'OTHER' })],
      };

      expect(isChargeMatched(charge)).toBe(false);
    });

    it('should return false for charge with transactions and UNPROCESSED (non-accounting doc)', () => {
      const charge = {
        id: 'charge-1',
        owner_id: 'user-1',
        transactions: [createMockTransaction({ charge_id: 'charge-1' })],
        documents: [createMockDocument({ charge_id: 'charge-1', type: 'UNPROCESSED' })],
      };

      expect(isChargeMatched(charge)).toBe(false);
    });
  });

  describe('hasOnlyTransactions', () => {
    it('should return true for charge with only transactions', () => {
      const charge = {
        id: 'charge-1',
        owner_id: 'user-1',
        transactions: [createMockTransaction({ charge_id: 'charge-1' })],
        documents: [],
      };

      expect(hasOnlyTransactions(charge)).toBe(true);
    });

    it('should return true for charge with transactions and non-accounting documents', () => {
      const charge = {
        id: 'charge-1',
        owner_id: 'user-1',
        transactions: [createMockTransaction({ charge_id: 'charge-1' })],
        documents: [createMockDocument({ charge_id: 'charge-1', type: 'OTHER' })],
      };

      expect(hasOnlyTransactions(charge)).toBe(true);
    });

    it('should return false for charge with transactions and accounting documents', () => {
      const charge = {
        id: 'charge-1',
        owner_id: 'user-1',
        transactions: [createMockTransaction({ charge_id: 'charge-1' })],
        documents: [createMockDocument({ charge_id: 'charge-1', type: 'INVOICE' })],
      };

      expect(hasOnlyTransactions(charge)).toBe(false);
    });

    it('should return false for charge with only documents', () => {
      const charge = {
        id: 'charge-1',
        owner_id: 'user-1',
        transactions: [],
        documents: [createMockDocument({ charge_id: 'charge-1', type: 'INVOICE' })],
      };

      expect(hasOnlyTransactions(charge)).toBe(false);
    });

    it('should return false for charge with no data', () => {
      const charge = {
        id: 'charge-1',
        owner_id: 'user-1',
        transactions: [],
        documents: [],
      };

      expect(hasOnlyTransactions(charge)).toBe(false);
    });
  });

  describe('hasOnlyDocuments', () => {
    it('should return true for charge with only accounting documents', () => {
      const charge = {
        id: 'charge-1',
        owner_id: 'user-1',
        transactions: [],
        documents: [createMockDocument({ charge_id: 'charge-1', type: 'INVOICE' })],
      };

      expect(hasOnlyDocuments(charge)).toBe(true);
    });

    it('should return true for charge with CREDIT_INVOICE', () => {
      const charge = {
        id: 'charge-1',
        owner_id: 'user-1',
        transactions: [],
        documents: [createMockDocument({ charge_id: 'charge-1', type: 'CREDIT_INVOICE' })],
      };

      expect(hasOnlyDocuments(charge)).toBe(true);
    });

    it('should return false for charge with only non-accounting documents', () => {
      const charge = {
        id: 'charge-1',
        owner_id: 'user-1',
        transactions: [],
        documents: [createMockDocument({ charge_id: 'charge-1', type: 'OTHER' })],
      };

      expect(hasOnlyDocuments(charge)).toBe(false);
    });

    it('should return false for charge with transactions and documents', () => {
      const charge = {
        id: 'charge-1',
        owner_id: 'user-1',
        transactions: [createMockTransaction({ charge_id: 'charge-1' })],
        documents: [createMockDocument({ charge_id: 'charge-1', type: 'INVOICE' })],
      };

      expect(hasOnlyDocuments(charge)).toBe(false);
    });

    it('should return false for charge with only transactions', () => {
      const charge = {
        id: 'charge-1',
        owner_id: 'user-1',
        transactions: [createMockTransaction({ charge_id: 'charge-1' })],
        documents: [],
      };

      expect(hasOnlyDocuments(charge)).toBe(false);
    });

    it('should return false for charge with no data', () => {
      const charge = {
        id: 'charge-1',
        owner_id: 'user-1',
        transactions: [],
        documents: [],
      };

      expect(hasOnlyDocuments(charge)).toBe(false);
    });
  });

  describe('validateChargeIsUnmatched', () => {
    it('should pass for charge with only transactions', () => {
      const charge = {
        id: 'charge-1',
        owner_id: 'user-1',
        transactions: [createMockTransaction({ charge_id: 'charge-1' })],
        documents: [],
      };

      expect(() => validateChargeIsUnmatched(charge)).not.toThrow();
    });

    it('should pass for charge with only documents', () => {
      const charge = {
        id: 'charge-1',
        owner_id: 'user-1',
        transactions: [],
        documents: [createMockDocument({ charge_id: 'charge-1', type: 'INVOICE' })],
      };

      expect(() => validateChargeIsUnmatched(charge)).not.toThrow();
    });

    it('should throw for charge with both transactions and accounting documents', () => {
      const charge = {
        id: 'charge-1',
        owner_id: 'user-1',
        transactions: [createMockTransaction({ charge_id: 'charge-1' })],
        documents: [createMockDocument({ charge_id: 'charge-1', type: 'INVOICE' })],
      };

      expect(() => validateChargeIsUnmatched(charge)).toThrow('is already matched');
    });

    it('should propagate validation errors', () => {
      const charge = {
        id: 'charge-1',
        owner_id: null,
        transactions: [createMockTransaction({ charge_id: 'charge-1' })],
        documents: [],
      };

      expect(() => validateChargeIsUnmatched(charge)).toThrow('must have an owner_id');
    });
  });
});
