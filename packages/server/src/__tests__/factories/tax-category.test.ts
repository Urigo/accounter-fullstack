import { describe, expect, it } from 'vitest';
import { UUID_REGEX } from '../../shared/constants.js';
import { makeUUID } from './ids.js';
import { createTaxCategory } from './tax-category.js';

describe('Factory: Tax Category', () => {
  describe('createTaxCategory', () => {
    it('should create tax category with default values', () => {
      const category = createTaxCategory();

      // Required field with default
      expect(category.id).toBeDefined();
      expect(category.id).toMatch(UUID_REGEX);

      // Boolean default
      expect(category.taxExcluded).toBe(false);

      // Null default
      expect(category.hashavshevetName).toBeNull();
    });

    it('should generate unique IDs by default', () => {
      const category1 = createTaxCategory();
      const category2 = createTaxCategory();

      expect(category1.id).not.toBe(category2.id);
    });

    it('should apply overrides correctly', () => {
      const customId = makeUUID('tax-cat-expense');
      const category = createTaxCategory({
        id: customId,
        hashavshevetName: 'משרדיות',
        taxExcluded: true,
      });

      expect(category.id).toBe(customId);
      expect(category.hashavshevetName).toBe('משרדיות');
      expect(category.taxExcluded).toBe(true);
    });

    it('should allow partial overrides', () => {
      const category = createTaxCategory({
        hashavshevetName: 'שכר',
      });

      expect(category.hashavshevetName).toBe('שכר');
      expect(category.id).toBeDefined();
      expect(category.taxExcluded).toBe(false);
    });

    it('should preserve all required fields', () => {
      const category = createTaxCategory();

      // Verify structure matches expected pgtyped interface
      expect(category).toHaveProperty('id');
      expect(category).toHaveProperty('hashavshevetName');
      expect(category).toHaveProperty('taxExcluded');
    });

    it('should handle tax-excluded categories', () => {
      const category = createTaxCategory({
        taxExcluded: true,
      });

      expect(category.taxExcluded).toBe(true);
      expect(category.hashavshevetName).toBeNull();
    });

    it('should handle Hashavshevet integration name', () => {
      const category = createTaxCategory({
        hashavshevetName: 'הוצאות משרד',
      });

      expect(category.hashavshevetName).toBe('הוצאות משרד');
    });

    it('should allow explicit null overrides', () => {
      const category = createTaxCategory({
        hashavshevetName: null,
      });

      expect(category.hashavshevetName).toBeNull();
    });

    it('should create deterministic categories with seed', () => {
      const category1 = createTaxCategory({ id: makeUUID('default-category') });
      const category2 = createTaxCategory({ id: makeUUID('default-category') });

      expect(category1.id).toBe(category2.id);
    });
  });
});
