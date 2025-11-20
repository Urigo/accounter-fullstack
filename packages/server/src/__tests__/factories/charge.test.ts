import { describe, expect, it } from 'vitest';
import { UUID_REGEX } from '../../shared/constants.js';
import { createCharge } from './charge.js';
import { makeUUID } from './ids.js';

describe('Factory: Charge', () => {
  describe('createCharge', () => {
    it('should create charge with required fields', () => {
      const ownerId = makeUUID('test-owner');
      const charge = createCharge({ owner_id: ownerId });

      // Required field
      expect(charge.owner_id).toBe(ownerId);

      // Auto-generated fields
      expect(charge.id).toBeDefined();
      expect(charge.id).toMatch(UUID_REGEX);
      expect(charge.tax_category_id).toBeDefined();
      expect(charge.tax_category_id).toMatch(UUID_REGEX);

      // Null defaults
      expect(charge.type).toBeNull();
      expect(charge.accountant_status).toBeNull();
      expect(charge.user_description).toBeNull();
      expect(charge.optional_vat).toBeNull();
      expect(charge.documents_optional_flag).toBeNull();
    });

    it('should generate unique IDs by default', () => {
      const ownerId = makeUUID('test-owner');
      const charge1 = createCharge({ owner_id: ownerId });
      const charge2 = createCharge({ owner_id: ownerId });

      expect(charge1.id).not.toBe(charge2.id);
    });

    it('should accept tax_category_id in params', () => {
      const ownerId = makeUUID('test-owner');
      const taxCategoryId = makeUUID('tax-cat-1');
      const charge = createCharge({
        owner_id: ownerId,
        tax_category_id: taxCategoryId,
      });

      expect(charge.tax_category_id).toBe(taxCategoryId);
    });

    it('should accept user_description in params', () => {
      const ownerId = makeUUID('test-owner');
      const charge = createCharge({
        owner_id: ownerId,
        user_description: 'Office supplies',
      });

      expect(charge.user_description).toBe('Office supplies');
    });

    it('should apply overrides correctly', () => {
      const ownerId = makeUUID('test-owner');
      const customId = makeUUID('custom-charge');
      const charge = createCharge(
        { owner_id: ownerId },
        {
          id: customId,
          type: 'PAYROLL',
          accountant_status: 'REVIEWED',
          optional_vat: true,
          documents_optional_flag: true,
        },
      );

      expect(charge.id).toBe(customId);
      expect(charge.type).toBe('PAYROLL');
      expect(charge.accountant_status).toBe('REVIEWED');
      expect(charge.optional_vat).toBe(true);
      expect(charge.documents_optional_flag).toBe(true);
    });

    it('should allow partial overrides', () => {
      const ownerId = makeUUID('test-owner');
      const charge = createCharge(
        {
          owner_id: ownerId,
          user_description: 'Consulting fee',
        },
        {
          type: 'INCOME',
        },
      );

      expect(charge.user_description).toBe('Consulting fee');
      expect(charge.type).toBe('INCOME');
      expect(charge.id).toBeDefined();
      expect(charge.accountant_status).toBeNull();
    });

    it('should preserve all required fields', () => {
      const ownerId = makeUUID('test-owner');
      const charge = createCharge({ owner_id: ownerId });

      // Verify structure matches expected interface
      expect(charge).toHaveProperty('id');
      expect(charge).toHaveProperty('owner_id');
      expect(charge).toHaveProperty('type');
      expect(charge).toHaveProperty('accountant_status');
      expect(charge).toHaveProperty('user_description');
      expect(charge).toHaveProperty('tax_category_id');
      expect(charge).toHaveProperty('optional_vat');
      expect(charge).toHaveProperty('documents_optional_flag');
    });

    it('should handle all params and overrides together', () => {
      const ownerId = makeUUID('test-owner');
      const taxCategoryId = makeUUID('tax-cat-2');
      const customId = makeUUID('custom-charge-2');

      const charge = createCharge(
        {
          owner_id: ownerId,
          tax_category_id: taxCategoryId,
          user_description: 'Travel expenses',
        },
        {
          id: customId,
          type: 'BUSINESS_TRIP',
          accountant_status: 'PENDING',
          optional_vat: false,
          documents_optional_flag: false,
        },
      );

      expect(charge.id).toBe(customId);
      expect(charge.owner_id).toBe(ownerId);
      expect(charge.tax_category_id).toBe(taxCategoryId);
      expect(charge.user_description).toBe('Travel expenses');
      expect(charge.type).toBe('BUSINESS_TRIP');
      expect(charge.accountant_status).toBe('PENDING');
      expect(charge.optional_vat).toBe(false);
      expect(charge.documents_optional_flag).toBe(false);
    });

    it('should allow explicit null overrides', () => {
      const ownerId = makeUUID('test-owner');
      const charge = createCharge(
        { owner_id: ownerId },
        {
          user_description: null,
          optional_vat: null,
        },
      );

      expect(charge.user_description).toBeNull();
      expect(charge.optional_vat).toBeNull();
    });
  });
});
