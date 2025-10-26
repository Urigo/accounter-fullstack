import { describe, expect, it } from 'vitest';
import {
  extractDocumentBusiness,
  type DocumentBusinessInfo,
} from '../helpers/document-business.helper.js';

describe('extractDocumentBusiness', () => {
  const adminBusinessId = 'user-123';
  const businessId1 = 'business-456';
  const businessId2 = 'business-789';

  describe('valid scenarios - user is debtor', () => {
    it('should return creditor as business when user is debtor', () => {
      const result = extractDocumentBusiness(businessId1, adminBusinessId, adminBusinessId);

      expect(result).toEqual({
        businessId: businessId1,
        isBusinessCreditor: true,
      });
    });

    it('should handle null creditor when user is debtor', () => {
      const result = extractDocumentBusiness(null, adminBusinessId, adminBusinessId);

      expect(result).toEqual({
        businessId: null,
        isBusinessCreditor: true,
      });
    });

    it('should work with different business IDs when user is debtor', () => {
      const result = extractDocumentBusiness(businessId2, adminBusinessId, adminBusinessId);

      expect(result).toEqual({
        businessId: businessId2,
        isBusinessCreditor: true,
      });
    });
  });

  describe('valid scenarios - user is creditor', () => {
    it('should return debtor as business when user is creditor', () => {
      const result = extractDocumentBusiness(adminBusinessId, businessId1, adminBusinessId);

      expect(result).toEqual({
        businessId: businessId1,
        isBusinessCreditor: false,
      });
    });

    it('should handle null debtor when user is creditor', () => {
      const result = extractDocumentBusiness(adminBusinessId, null, adminBusinessId);

      expect(result).toEqual({
        businessId: null,
        isBusinessCreditor: false,
      });
    });

    it('should work with different business IDs when user is creditor', () => {
      const result = extractDocumentBusiness(adminBusinessId, businessId2, adminBusinessId);

      expect(result).toEqual({
        businessId: businessId2,
        isBusinessCreditor: false,
      });
    });
  });

  describe('error scenarios - both are user', () => {
    it('should throw error when both creditor and debtor are user', () => {
      expect(() => extractDocumentBusiness(adminBusinessId, adminBusinessId, adminBusinessId)).toThrow(
        'Document has both creditor_id and debtor_id equal to user ID - invalid document state',
      );
    });

    it('should include clear error message for both-user scenario', () => {
      try {
        extractDocumentBusiness(adminBusinessId, adminBusinessId, adminBusinessId);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain('both creditor_id and debtor_id equal to user');
      }
    });
  });

  describe('error scenarios - neither are user', () => {
    it('should throw error when neither creditor nor debtor are user', () => {
      expect(() => extractDocumentBusiness(businessId1, businessId2, adminBusinessId)).toThrow(
        'Document has neither creditor_id nor debtor_id equal to user ID - document does not belong to user',
      );
    });

    it('should throw error when creditor is business and debtor is null (neither is user)', () => {
      expect(() => extractDocumentBusiness(businessId1, null, adminBusinessId)).toThrow(
        'Document has neither creditor_id nor debtor_id equal to user ID - document does not belong to user',
      );
    });

    it('should throw error when debtor is business and creditor is null (neither is user)', () => {
      expect(() => extractDocumentBusiness(null, businessId1, adminBusinessId)).toThrow(
        'Document has neither creditor_id nor debtor_id equal to user ID - document does not belong to user',
      );
    });

    it('should include clear error message for neither-user scenario', () => {
      try {
        extractDocumentBusiness(businessId1, businessId2, adminBusinessId);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain('neither creditor_id nor debtor_id equal to user');
      }
    });
  });

  describe('error scenarios - both are null', () => {
    it('should throw error when both creditor and debtor are null', () => {
      expect(() => extractDocumentBusiness(null, null, adminBusinessId)).toThrow(
        'Document has both creditor_id and debtor_id as null - invalid document state',
      );
    });

    it('should include clear error message for both-null scenario', () => {
      try {
        extractDocumentBusiness(null, null, adminBusinessId);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain('both creditor_id and debtor_id as null');
      }
    });
  });

  describe('return value structure', () => {
    it('should return object with correct properties', () => {
      const result = extractDocumentBusiness(businessId1, adminBusinessId, adminBusinessId);

      expect(result).toHaveProperty('businessId');
      expect(result).toHaveProperty('isBusinessCreditor');
      expect(typeof result.isBusinessCreditor).toBe('boolean');
    });

    it('should return consistent structure for null business', () => {
      const result = extractDocumentBusiness(null, adminBusinessId, adminBusinessId);

      expect(result).toHaveProperty('businessId');
      expect(result).toHaveProperty('isBusinessCreditor');
      expect(result.businessId).toBe(null);
      expect(typeof result.isBusinessCreditor).toBe('boolean');
    });
  });

  describe('business creditor flag correctness', () => {
    it('should set isBusinessCreditor to true when user is debtor (business is creditor)', () => {
      const result = extractDocumentBusiness(businessId1, adminBusinessId, adminBusinessId);
      expect(result.isBusinessCreditor).toBe(true);
    });

    it('should set isBusinessCreditor to false when user is creditor (business is debtor)', () => {
      const result = extractDocumentBusiness(adminBusinessId, businessId1, adminBusinessId);
      expect(result.isBusinessCreditor).toBe(false);
    });

    it('should set isBusinessCreditor correctly even when business is null', () => {
      const resultDebtorUser = extractDocumentBusiness(null, adminBusinessId, adminBusinessId);
      expect(resultDebtorUser.isBusinessCreditor).toBe(true);

      const resultCreditorUser = extractDocumentBusiness(adminBusinessId, null, adminBusinessId);
      expect(resultCreditorUser.isBusinessCreditor).toBe(false);
    });
  });

  describe('edge cases with different user IDs', () => {
    it('should work correctly with different user ID format', () => {
      const differentUser = 'abc-def-ghi';
      const result = extractDocumentBusiness(businessId1, differentUser, differentUser);

      expect(result.businessId).toBe(businessId1);
      expect(result.isBusinessCreditor).toBe(true);
    });

    it('should correctly identify when user is creditor with UUID-like IDs', () => {
      const uuidUser = '550e8400-e29b-41d4-a716-446655440000';
      const uuidBusiness = '660e8400-e29b-41d4-a716-446655440000';
      const result = extractDocumentBusiness(uuidUser, uuidBusiness, uuidUser);

      expect(result.businessId).toBe(uuidBusiness);
      expect(result.isBusinessCreditor).toBe(false);
    });
  });
});
