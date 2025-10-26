import { describe, expect, it } from 'vitest';
import { calculateBusinessConfidence } from '../helpers/business-confidence.helper.js';

describe('calculateBusinessConfidence', () => {
  const businessId1 = 'business-123';
  const businessId2 = 'business-456';
  const businessId3 = 'business-789';

  describe('exact match - both non-null', () => {
    it('should return 1.0 when both IDs match', () => {
      const result = calculateBusinessConfidence(businessId1, businessId1);
      expect(result).toBe(1.0);
    });

    it('should return 1.0 for different business IDs that match', () => {
      const result = calculateBusinessConfidence(businessId2, businessId2);
      expect(result).toBe(1.0);
    });

    it('should return 1.0 for UUID-like IDs that match', () => {
      const uuidBusiness = '550e8400-e29b-41d4-a716-446655440000';
      const result = calculateBusinessConfidence(uuidBusiness, uuidBusiness);
      expect(result).toBe(1.0);
    });
  });

  describe('one ID is null', () => {
    it('should return 0.5 when transaction ID is null', () => {
      const result = calculateBusinessConfidence(null, businessId1);
      expect(result).toBe(0.5);
    });

    it('should return 0.5 when document ID is null', () => {
      const result = calculateBusinessConfidence(businessId1, null);
      expect(result).toBe(0.5);
    });

    it('should return 0.5 when transaction ID is null with different business ID', () => {
      const result = calculateBusinessConfidence(null, businessId2);
      expect(result).toBe(0.5);
    });

    it('should return 0.5 when document ID is null with different business ID', () => {
      const result = calculateBusinessConfidence(businessId3, null);
      expect(result).toBe(0.5);
    });
  });

  describe('both IDs are null', () => {
    it('should return 0.5 when both IDs are null', () => {
      const result = calculateBusinessConfidence(null, null);
      expect(result).toBe(0.5);
    });
  });

  describe('mismatch - both non-null but different', () => {
    it('should return 0.2 when IDs do not match', () => {
      const result = calculateBusinessConfidence(businessId1, businessId2);
      expect(result).toBe(0.2);
    });

    it('should return 0.2 for different business IDs', () => {
      const result = calculateBusinessConfidence(businessId2, businessId3);
      expect(result).toBe(0.2);
    });

    it('should return 0.2 for UUID-like IDs that do not match', () => {
      const uuid1 = '550e8400-e29b-41d4-a716-446655440000';
      const uuid2 = '660e8400-e29b-41d4-a716-446655440000';
      const result = calculateBusinessConfidence(uuid1, uuid2);
      expect(result).toBe(0.2);
    });

    it('should be case-sensitive for business IDs', () => {
      const result = calculateBusinessConfidence('business-ABC', 'business-abc');
      expect(result).toBe(0.2);
    });
  });

  describe('various business ID formats', () => {
    it('should work with numeric string IDs', () => {
      const result = calculateBusinessConfidence('12345', '12345');
      expect(result).toBe(1.0);
    });

    it('should work with alphanumeric IDs', () => {
      const result = calculateBusinessConfidence('bus-abc-123', 'bus-abc-123');
      expect(result).toBe(1.0);
    });

    it('should work with short IDs', () => {
      const result = calculateBusinessConfidence('a', 'a');
      expect(result).toBe(1.0);
    });

    it('should work with long UUIDs', () => {
      const longUuid = '123e4567-e89b-12d3-a456-426614174000';
      const result = calculateBusinessConfidence(longUuid, longUuid);
      expect(result).toBe(1.0);
    });

    it('should detect mismatch with similar but different IDs', () => {
      const result = calculateBusinessConfidence('business-123', 'business-124');
      expect(result).toBe(0.2);
    });
  });

  describe('return value validation', () => {
    it('should return exactly 1.0, 0.5, or 0.2 (no other values)', () => {
      const results = [
        calculateBusinessConfidence(businessId1, businessId1), // 1.0
        calculateBusinessConfidence(businessId1, businessId2), // 0.2
        calculateBusinessConfidence(null, businessId1), // 0.5
        calculateBusinessConfidence(businessId1, null), // 0.5
        calculateBusinessConfidence(null, null), // 0.5
      ];

      results.forEach(result => {
        expect([1.0, 0.5, 0.2]).toContain(result);
      });
    });

    it('should return exact values without rounding issues', () => {
      const exactMatch = calculateBusinessConfidence(businessId1, businessId1);
      const oneNull = calculateBusinessConfidence(null, businessId1);
      const mismatch = calculateBusinessConfidence(businessId1, businessId2);

      expect(exactMatch === 1.0).toBe(true);
      expect(oneNull === 0.5).toBe(true);
      expect(mismatch === 0.2).toBe(true);
    });
  });

  describe('symmetry', () => {
    it('should return same result regardless of parameter order for matching IDs', () => {
      expect(calculateBusinessConfidence(businessId1, businessId1)).toBe(
        calculateBusinessConfidence(businessId1, businessId1),
      );
    });

    it('should return same result regardless of parameter order for mismatching IDs', () => {
      expect(calculateBusinessConfidence(businessId1, businessId2)).toBe(
        calculateBusinessConfidence(businessId2, businessId1),
      );
    });

    it('should return same result regardless of parameter order for null cases', () => {
      expect(calculateBusinessConfidence(null, businessId1)).toBe(
        calculateBusinessConfidence(businessId1, null),
      );
    });
  });

  describe('edge cases', () => {
    it('should handle empty string as a valid business ID', () => {
      const result = calculateBusinessConfidence('', '');
      expect(result).toBe(1.0);
    });

    it('should treat empty string as different from null', () => {
      const result = calculateBusinessConfidence('', null);
      expect(result).toBe(0.5);
    });

    it('should handle IDs with special characters', () => {
      const specialId = 'business-id_with-special.chars@123';
      const result = calculateBusinessConfidence(specialId, specialId);
      expect(result).toBe(1.0);
    });

    it('should handle very long business IDs', () => {
      const longId = 'a'.repeat(1000);
      const result = calculateBusinessConfidence(longId, longId);
      expect(result).toBe(1.0);
    });
  });
});
