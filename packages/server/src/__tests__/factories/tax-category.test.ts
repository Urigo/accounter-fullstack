import { describe, expect, it } from 'vitest';
import { UUID_REGEX } from '../../shared/constants.js';
import { makeUUID } from '../../demo-fixtures/helpers/deterministic-uuid.js';
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
      const customId = makeUUID('tax-category', 'tax-cat-expense');
      const category = createTaxCategory({
        id: customId,
        name: 'משרדיות',
        taxExcluded: true,
      });

      expect(category.id).toBe(customId);
      expect(category.name).toBe('משרדיות');
      expect(category.taxExcluded).toBe(true);
    });

    it('should allow partial overrides', () => {
      const category = createTaxCategory({
        name: 'שכר',
      });

      expect(category.name).toBe('שכר');
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
        name: 'הוצאות משרד',
      });

      expect(category.name).toBe('הוצאות משרד');
    });

    it('should allow explicit null overrides', () => {
      const category = createTaxCategory({
        hashavshevetName: null,
      });

      expect(category.hashavshevetName).toBeNull();
    });

    it('should create deterministic categories with seed', () => {
      const category1 = createTaxCategory({ id: makeUUID('tax-category', 'default-category') });
      const category2 = createTaxCategory({ id: makeUUID('tax-category', 'default-category') });

      expect(category1.id).toBe(category2.id);
    });
  });
});
