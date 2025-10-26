import { describe, it, expect } from 'vitest';
import {
  createMockTransaction,
  createMockDocument,
  createMockAggregatedTransaction,
  createMockAggregatedDocument,
  createMockConfidenceScores,
  calculateExpectedConfidence,
  roundConfidence,
  isValidConfidenceScore,
  daysDifference,
  isWithinDays,
} from './test-helpers.js';

describe('Charges Matcher - Test Infrastructure', () => {
  describe('Mock Factories', () => {
    it('should create a valid mock transaction with defaults', () => {
      const transaction = createMockTransaction();

      expect(transaction.id).toBeDefined();
      expect(transaction.charge_id).toBeDefined();
      expect(transaction.amount).toBe('100.00');
      expect(transaction.currency).toBe('ILS');
      expect(transaction.is_fee).toBe(false);
    });

    it('should create a mock transaction with overrides', () => {
      const transaction = createMockTransaction({
        amount: '250.00',
        currency: 'USD',
        is_fee: true,
      });

      expect(transaction.amount).toBe('250.00');
      expect(transaction.currency).toBe('USD');
      expect(transaction.is_fee).toBe(true);
    });

    it('should create a valid mock document with defaults', () => {
      const document = createMockDocument();

      expect(document.id).toBeDefined();
      expect(document.charge_id).toBeDefined();
      expect(document.total_amount).toBe(100.0);
      expect(document.currency_code).toBe('ILS');
      expect(document.type).toBe('INVOICE');
    });

    it('should create a mock document with overrides', () => {
      const document = createMockDocument({
        total_amount: 500.0,
        type: 'RECEIPT',
        serial_number: 'REC-123',
      });

      expect(document.total_amount).toBe(500.0);
      expect(document.type).toBe('RECEIPT');
      expect(document.serial_number).toBe('REC-123');
    });

    it('should create aggregated transaction data', () => {
      const aggregated = createMockAggregatedTransaction({
        amount: 150.0,
        description: 'Payment for services',
      });

      expect(aggregated.amount).toBe(150.0);
      expect(aggregated.description).toBe('Payment for services');
    });

    it('should create aggregated document data', () => {
      const aggregated = createMockAggregatedDocument({
        amount: 200.0,
        businessIsCreditor: true,
      });

      expect(aggregated.amount).toBe(200.0);
      expect(aggregated.businessIsCreditor).toBe(true);
    });
  });

  describe('Confidence Calculation Helpers', () => {
    it('should calculate expected confidence with perfect scores', () => {
      const scores = createMockConfidenceScores({
        amount: 1.0,
        currency: 1.0,
        business: 1.0,
        date: 1.0,
      });

      const confidence = calculateExpectedConfidence(scores);
      expect(confidence).toBeCloseTo(1.0, 10);
    });

    it('should calculate expected confidence with mixed scores', () => {
      const scores = createMockConfidenceScores({
        amount: 0.9, // 40% weight
        currency: 1.0, // 20% weight
        business: 0.5, // 30% weight
        date: 0.8, // 10% weight
      });

      // (0.9 * 0.4) + (1.0 * 0.2) + (0.5 * 0.3) + (0.8 * 0.1)
      // = 0.36 + 0.2 + 0.15 + 0.08 = 0.79
      const confidence = calculateExpectedConfidence(scores);
      expect(confidence).toBe(0.79);
    });

    it('should calculate expected confidence with zero scores', () => {
      const scores = createMockConfidenceScores({
        amount: 0.0,
        currency: 0.0,
        business: 0.0,
        date: 0.0,
      });

      const confidence = calculateExpectedConfidence(scores);
      expect(confidence).toBe(0.0);
    });

    it('should round confidence to 2 decimal places', () => {
      expect(roundConfidence(0.956789)).toBe(0.96);
      expect(roundConfidence(0.951)).toBe(0.95);
      expect(roundConfidence(0.9)).toBe(0.9);
      expect(roundConfidence(1.0)).toBe(1.0);
    });

    it('should validate confidence scores', () => {
      expect(isValidConfidenceScore(0.0)).toBe(true);
      expect(isValidConfidenceScore(0.5)).toBe(true);
      expect(isValidConfidenceScore(1.0)).toBe(true);
      expect(isValidConfidenceScore(-0.1)).toBe(false);
      expect(isValidConfidenceScore(1.1)).toBe(false);
    });
  });

  describe('Date Helpers', () => {
    it('should calculate days difference correctly', () => {
      const date1 = new Date('2024-01-15');
      const date2 = new Date('2024-01-20');

      expect(daysDifference(date1, date2)).toBe(5);
    });

    it('should handle same dates', () => {
      const date = new Date('2024-01-15');

      expect(daysDifference(date, date)).toBe(0);
    });

    it('should calculate difference regardless of order', () => {
      const date1 = new Date('2024-01-15');
      const date2 = new Date('2024-01-10');

      expect(daysDifference(date1, date2)).toBe(5);
      expect(daysDifference(date2, date1)).toBe(5);
    });

    it('should check if dates are within N days', () => {
      const date1 = new Date('2024-01-15');
      const date2 = new Date('2024-01-20');

      expect(isWithinDays(date1, date2, 5)).toBe(true);
      expect(isWithinDays(date1, date2, 4)).toBe(false);
      expect(isWithinDays(date1, date2, 10)).toBe(true);
    });

    it('should handle 12-month window check', () => {
      const date1 = new Date('2024-01-15');
      const date2 = new Date('2024-12-15');
      const date3 = new Date('2025-02-15');

      expect(isWithinDays(date1, date2, 365)).toBe(true);
      expect(isWithinDays(date1, date3, 365)).toBe(false);
    });
  });
});
