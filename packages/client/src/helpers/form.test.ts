import { describe, expect, it } from 'vitest';
import { relevantDataPicker } from './form';

describe('relevantDataPicker', () => {
  describe('basic cases', () => {
    it('should return undefined when dirtyFields is falsy', () => {
      const values = { name: 'John', age: 30 };
      const result = relevantDataPicker(values, false as any);
      expect(result).toBeUndefined();
    });

    it('should return the entire primitive value when dirtyFields is true and value is not an object', () => {
      const value = 'test string';
      const result = relevantDataPicker(value, true);
      expect(result).toBe('test string');
    });

    it('should return undefined when dirtyFields is an object with all false values', () => {
      const values = { name: 'John', age: 30 };
      const dirtyFields = { name: false, age: false };
      const result = relevantDataPicker(values, dirtyFields);
      expect(result).toBeUndefined();
    });

    it('should return only dirty fields', () => {
      const values = { name: 'John', age: 30, city: 'New York' };
      const dirtyFields = { name: true, age: false, city: true };
      const result = relevantDataPicker(values, dirtyFields);
      expect(result).toEqual({ name: 'John', city: 'New York' });
    });
  });

  describe('nested objects', () => {
    it('should handle nested objects with dirty fields', () => {
      const values = {
        user: {
          name: 'John',
          age: 30,
          address: {
            street: '123 Main St',
            city: 'New York',
          },
        },
        status: 'active',
      };
      const dirtyFields = {
        user: {
          name: true,
          age: false,
          address: {
            street: false,
            city: true,
          },
        },
        status: true,
      };
      const result = relevantDataPicker(values, dirtyFields);
      expect(result).toEqual({
        user: {
          name: 'John',
          address: {
            city: 'New York',
          },
        },
        status: 'active',
      });
    });

    it('should handle deeply nested objects', () => {
      const values = {
        level1: {
          level2: {
            level3: {
              level4: {
                value: 'deep value',
              },
            },
          },
        },
      };
      const dirtyFields = {
        level1: {
          level2: {
            level3: {
              level4: {
                value: true,
              },
            },
          },
        },
      };
      const result = relevantDataPicker(values, dirtyFields);
      expect(result).toEqual({
        level1: {
          level2: {
            level3: {
              level4: {
                value: 'deep value',
              },
            },
          },
        },
      });
    });

    it('should return undefined when nested objects have all false dirty fields', () => {
      const values = {
        user: {
          name: 'John',
          age: 30,
        },
      };
      const dirtyFields = {
        user: {
          name: false,
          age: false,
        },
      };
      const result = relevantDataPicker(values, dirtyFields);
      expect(result).toBeUndefined();
    });
  });

  describe('arrays', () => {
    it('should return the entire array when dirtyFields marks array as dirty', () => {
      const values = { items: ['item1', 'item2', 'item3'] };
      const dirtyFields = { items: true };
      const result = relevantDataPicker(values, dirtyFields);
      expect(result).toEqual({ items: ['item1', 'item2', 'item3'] });
    });

    it('should handle empty arrays when marked as not dirty', () => {
      const values = { items: [] as string[] };
      const dirtyFields = { items: false };
      const result = relevantDataPicker(values, dirtyFields);
      expect(result).toBeUndefined();
    });

    it('should return array when marked as dirty', () => {
      const values = { tags: ['tag1', 'tag2', 'tag3'] };
      const dirtyFields = { tags: true };
      const result = relevantDataPicker(values, dirtyFields);
      expect(result).toEqual({ tags: ['tag1', 'tag2', 'tag3'] });
    });

    it('should handle arrays of objects', () => {
      const values = {
        users: [
          { name: 'John', age: 30 },
          { name: 'Jane', age: 25 },
        ],
      };
      const dirtyFields = { users: true };
      const result = relevantDataPicker(values, dirtyFields);
      expect(result).toEqual({
        users: [
          { name: 'John', age: 30 },
          { name: 'Jane', age: 25 },
        ],
      });
    });
  });

  describe('empty strings', () => {
    it('should handle empty string values', () => {
      const values = { name: '', description: 'test' };
      const dirtyFields = { name: true, description: true };
      const result = relevantDataPicker(values, dirtyFields);
      expect(result).toEqual({ name: '', description: 'test' });
    });

    it('should exclude empty string when not dirty', () => {
      const values = { name: '', description: 'test' };
      const dirtyFields = { name: false, description: true };
      const result = relevantDataPicker(values, dirtyFields);
      expect(result).toEqual({ description: 'test' });
    });
  });

  describe('special fields handling', () => {
    it('should keep entire localCurrencyAmount object and remove formatted field', () => {
      const values = {
        localCurrencyAmount: {
          value: 100,
          currency: 'USD',
          formatted: '$100.00',
        },
      };
      const dirtyFields = {
        localCurrencyAmount: {
          value: true,
          currency: false,
          formatted: false,
        },
      };
      const result = relevantDataPicker(values, dirtyFields);
      expect(result).toEqual({
        localCurrencyAmount: {
          value: 100,
          currency: 'USD',
        },
      });
    });

    it('should keep entire originalAmount object and remove formatted field', () => {
      const values = {
        originalAmount: {
          value: 50,
          currency: 'EUR',
          formatted: '€50.00',
        },
      };
      const dirtyFields = {
        originalAmount: {
          value: true,
          currency: false,
          formatted: true,
        },
      };
      const result = relevantDataPicker(values, dirtyFields);
      expect(result).toEqual({
        originalAmount: {
          value: 50,
          currency: 'EUR',
        },
      });
    });

    it('should handle withholdingTax field specially', () => {
      const values = {
        withholdingTax: {
          percentage: 15,
          amount: 150,
          formatted: '15%',
        },
      };
      const dirtyFields = {
        withholdingTax: {
          percentage: true,
          amount: false,
          formatted: false,
        },
      };
      const result = relevantDataPicker(values, dirtyFields);
      expect(result).toEqual({
        withholdingTax: {
          percentage: 15,
          amount: 150,
        },
      });
    });

    it('should handle vat field specially', () => {
      const values = {
        vat: {
          rate: 20,
          amount: 200,
          formatted: '20%',
        },
      };
      const dirtyFields = {
        vat: {
          rate: false,
          amount: true,
          formatted: false,
        },
      };
      const result = relevantDataPicker(values, dirtyFields);
      expect(result).toEqual({
        vat: {
          rate: 20,
          amount: 200,
        },
      });
    });

    it('should handle tags field specially', () => {
      const values = {
        tags: [
          { id: 1, name: 'tag1', formatted: 'Tag 1' },
          { id: 2, name: 'tag2', formatted: 'Tag 2' },
        ],
      };
      const dirtyFields = {
        tags: true,
      };
      const result = relevantDataPicker(values, dirtyFields);
      expect(result).toEqual({
        tags: [
          { id: 1, name: 'tag1', formatted: 'Tag 1' },
          { id: 2, name: 'tag2', formatted: 'Tag 2' },
        ],
      });
    });

    it('should handle amount field specially', () => {
      const values = {
        amount: {
          value: 100,
          formatted: '$100.00',
        },
      };
      const dirtyFields = {
        amount: {
          value: true,
          formatted: false,
        },
      };
      const result = relevantDataPicker(values, dirtyFields);
      expect(result).toEqual({
        amount: {
          value: 100,
        },
      });
    });

    it('should handle defaultIrsCode and irsCode fields specially', () => {
      const values = {
        defaultIrsCode: {
          code: '123',
          description: 'Test',
          formatted: 'Code: 123',
        },
        irsCode: {
          code: '456',
          formatted: 'Code: 456',
        },
      };
      const dirtyFields = {
        defaultIrsCode: {
          code: true,
          description: false,
          formatted: false,
        },
        irsCode: {
          code: false,
          formatted: true,
        },
      };
      const result = relevantDataPicker(values, dirtyFields);
      expect(result).toEqual({
        defaultIrsCode: {
          code: '123',
          description: 'Test',
        },
        irsCode: {
          code: '456',
        },
      });
    });
  });

  describe('null and undefined values', () => {
    it('should handle null values by treating them as objects', () => {
      const values = { name: null, age: 30 };
      const dirtyFields = { name: true, age: true };
      const result = relevantDataPicker(values, dirtyFields);
      // null is treated as an object, so it becomes {}
      expect(result).toEqual({ name: {}, age: 30 });
    });

    it('should handle undefined values', () => {
      const values = { name: undefined, age: 30 };
      const dirtyFields = { name: true, age: true };
      const result = relevantDataPicker(values, dirtyFields);
      expect(result).toEqual({ name: undefined, age: 30 });
    });

    it('should handle objects with undefined nested values', () => {
      const values = {
        user: {
          name: 'John',
          email: undefined,
        },
      };
      const dirtyFields = {
        user: {
          name: true,
          email: true,
        },
      };
      const result = relevantDataPicker(values, dirtyFields);
      expect(result).toEqual({
        user: {
          name: 'John',
          email: undefined,
        },
      });
    });
  });

  describe('boolean and number values', () => {
    it('should handle boolean values', () => {
      const values = { isActive: true, isVerified: false };
      const dirtyFields = { isActive: true, isVerified: true };
      const result = relevantDataPicker(values, dirtyFields);
      expect(result).toEqual({ isActive: true, isVerified: false });
    });

    it('should handle zero values', () => {
      const values = { count: 0, total: 100 };
      const dirtyFields = { count: true, total: true };
      const result = relevantDataPicker(values, dirtyFields);
      expect(result).toEqual({ count: 0, total: 100 });
    });

    it('should handle negative numbers', () => {
      const values = { balance: -50, debt: -100 };
      const dirtyFields = { balance: true, debt: false };
      const result = relevantDataPicker(values, dirtyFields);
      expect(result).toEqual({ balance: -50 });
    });
  });

  describe('complex mixed scenarios', () => {
    it('should handle complex object with mixed dirty fields', () => {
      const values = {
        id: 1,
        name: 'Product',
        price: {
          amount: 100,
          currency: 'USD',
          formatted: '$100.00',
        },
        tags: ['electronics', 'new'],
        metadata: {
          createdAt: '2024-01-01',
          updatedAt: '2024-01-02',
        },
        inStock: true,
      };
      const dirtyFields = {
        id: false,
        name: true,
        price: {
          amount: true,
          currency: false,
          formatted: false,
        },
        tags: true,
        metadata: {
          createdAt: false,
          updatedAt: true,
        },
        inStock: true,
      };
      const result = relevantDataPicker(values, dirtyFields);
      expect(result).toEqual({
        name: 'Product',
        // price special handling returns the entire object minus 'formatted'
        // but since currency is not dirty, it's excluded from the recursive pick
        price: {
          amount: 100,
        },
        tags: ['electronics', 'new'],
        metadata: {
          updatedAt: '2024-01-02',
        },
        inStock: true,
      });
    });

    it('should handle empty objects', () => {
      const values = {};
      const dirtyFields = {};
      const result = relevantDataPicker(values, dirtyFields);
      expect(result).toBeUndefined();
    });

    it('should handle objects with non-existent keys in dirtyFields', () => {
      const values = { name: 'John' };
      const dirtyFields = { name: true, age: true };
      const result = relevantDataPicker(values, dirtyFields);
      expect(result).toEqual({ name: 'John' });
    });

    it('should handle mixed nesting with arrays and objects', () => {
      const values = {
        users: [
          {
            name: 'John',
            contacts: {
              email: 'john@test.com',
              phone: '123456',
            },
          },
          {
            name: 'Jane',
            contacts: {
              email: 'jane@test.com',
              phone: '789012',
            },
          },
        ],
      };
      const dirtyFields = {
        users: true,
      };
      const result = relevantDataPicker(values, dirtyFields);
      expect(result).toEqual({
        users: [
          {
            name: 'John',
            contacts: {
              email: 'john@test.com',
              phone: '123456',
            },
          },
          {
            name: 'Jane',
            contacts: {
              email: 'jane@test.com',
              phone: '789012',
            },
          },
        ],
      });
    });
  });

  describe('edge cases with special field names', () => {
    it('should handle multiple special fields in one object', () => {
      const values = {
        amount: {
          value: 100,
          formatted: '$100.00',
        },
        vat: {
          rate: 20,
          formatted: '20%',
        },
        withholdingTax: {
          percentage: 15,
          formatted: '15%',
        },
      };
      const dirtyFields = {
        amount: {
          value: true,
          formatted: false,
        },
        vat: {
          rate: true,
          formatted: false,
        },
        withholdingTax: {
          percentage: false,
          formatted: true,
        },
      };
      const result = relevantDataPicker(values, dirtyFields);
      expect(result).toEqual({
        amount: {
          value: 100,
        },
        vat: {
          rate: 20,
        },
        withholdingTax: {
          percentage: 15,
        },
      });
    });
  });

  describe('additional edge cases', () => {
    it('should handle objects with only formatted field dirty', () => {
      const values = {
        amount: {
          value: 100,
          formatted: '$100.00',
        },
      };
      const dirtyFields = {
        amount: {
          value: false,
          formatted: true,
        },
      };
      const result = relevantDataPicker(values, dirtyFields);
      // formatted is removed, but since value is dirty, entire object is returned minus formatted
      expect(result).toEqual({
        amount: {
          value: 100,
        },
      });
    });

    it('should handle special field names that are not dirty', () => {
      const values = {
        localCurrencyAmount: {
          value: 100,
          currency: 'USD',
        },
        normalField: 'test',
      };
      const dirtyFields = {
        localCurrencyAmount: {
          value: false,
          currency: false,
        },
        normalField: true,
      };
      const result = relevantDataPicker(values, dirtyFields);
      expect(result).toEqual({
        normalField: 'test',
      });
    });

    it('should handle dirtyFields as plain true for non-object values', () => {
      const value = 'test string';
      const result = relevantDataPicker(value, true);
      expect(result).toBe('test string');
    });

    it('should handle dirtyFields as plain true for object values', () => {
      const values = {
        name: 'test',
        nested: {
          value: 123,
        },
      };
      // When dirtyFields is true and values is an object, it falls through to object processing
      // Since dirtyFields is boolean true, Object.entries(dirtyFields) will be empty
      const result = relevantDataPicker(values, true);
      expect(result).toEqual({});
    });

    it('should handle very deeply nested structures', () => {
      const values = {
        a: { b: { c: { d: { e: { f: { g: 'deep' } } } } } },
      };
      const dirtyFields = {
        a: { b: { c: { d: { e: { f: { g: true } } } } } },
      };
      const result = relevantDataPicker(values, dirtyFields);
      expect(result).toEqual({
        a: { b: { c: { d: { e: { f: { g: 'deep' } } } } } },
      });
    });

    it('should handle mixed types in a single object', () => {
      const values = {
        string: 'text',
        number: 42,
        boolean: true,
        array: [1, 2, 3],
        object: { nested: 'value' },
        nullValue: null,
        undefinedValue: undefined,
      };
      const dirtyFields = {
        string: true,
        number: true,
        boolean: true,
        array: true,
        object: { nested: true },
        nullValue: true,
        undefinedValue: true,
      };
      const result = relevantDataPicker(values, dirtyFields);
      expect(result).toEqual({
        string: 'text',
        number: 42,
        boolean: true,
        array: [1, 2, 3],
        object: { nested: 'value' },
        nullValue: {},
        undefinedValue: undefined,
      });
    });

    it('should return undefined when all nested fields are false in complex structure', () => {
      const values = {
        user: {
          profile: {
            name: 'John',
            age: 30,
          },
          settings: {
            theme: 'dark',
            notifications: true,
          },
        },
      };
      const dirtyFields = {
        user: {
          profile: {
            name: false,
            age: false,
          },
          settings: {
            theme: false,
            notifications: false,
          },
        },
      };
      const result = relevantDataPicker(values, dirtyFields);
      expect(result).toBeUndefined();
    });

    it('should handle empty nested objects', () => {
      const values = {
        outer: {},
        withData: { inner: 'value' },
      };
      const dirtyFields = {
        outer: true,
        withData: { inner: true },
      };
      const result = relevantDataPicker(values, dirtyFields);
      expect(result).toEqual({
        outer: {},
        withData: { inner: 'value' },
      });
    });

    it('should handle special field with empty object value', () => {
      const values = {
        localCurrencyAmount: {},
      };
      const dirtyFields = {
        localCurrencyAmount: true,
      };
      const result = relevantDataPicker(values, dirtyFields);
      expect(result).toEqual({
        localCurrencyAmount: {},
      });
    });

    it('should handle arrays with mixed dirty elements at nested level', () => {
      const values = {
        items: [
          { id: 1, name: 'Item 1' },
          { id: 2, name: 'Item 2' },
        ],
        other: 'value',
      };
      const dirtyFields = {
        items: true,
        other: false,
      };
      const result = relevantDataPicker(values, dirtyFields);
      expect(result).toEqual({
        items: [
          { id: 1, name: 'Item 1' },
          { id: 2, name: 'Item 2' },
        ],
      });
    });
  });
});
