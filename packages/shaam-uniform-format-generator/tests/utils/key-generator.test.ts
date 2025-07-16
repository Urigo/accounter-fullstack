/**
 * Tests for key generator utility
 */

import { beforeEach, describe, expect, it } from 'vitest';
import {
  defaultKeyGenerator,
  generatePrimaryIdentifier,
  generateRandomKey,
  KeyGeneratorContext,
} from '../../src/utils/key-generator';

describe('Key Generator', () => {
  describe('generateRandomKey', () => {
    it('should generate a random key of specified length', () => {
      const key = generateRandomKey(10);
      expect(key).toHaveLength(10);
      expect(/^\d+$/.test(key)).toBe(true);
    });

    it('should generate a 15-digit key by default', () => {
      const key = generateRandomKey();
      expect(key).toHaveLength(15);
      expect(/^\d+$/.test(key)).toBe(true);
    });

    it('should generate different keys on subsequent calls', () => {
      const key1 = generateRandomKey();
      const key2 = generateRandomKey();
      expect(key1).not.toBe(key2);
    });

    it('should throw an error for invalid lengths', () => {
      expect(() => generateRandomKey(0)).toThrow('Key length must be between 1 and 15 digits');
      expect(() => generateRandomKey(16)).toThrow('Key length must be between 1 and 15 digits');
      expect(() => generateRandomKey(-1)).toThrow('Key length must be between 1 and 15 digits');
    });

    it('should pad shorter keys with leading zeros', () => {
      const key = generateRandomKey(5);
      expect(key).toHaveLength(5);
      expect(/^\d{5}$/.test(key)).toBe(true);
    });
  });

  describe('generatePrimaryIdentifier', () => {
    it('should generate a 15-digit primary identifier', () => {
      const id = generatePrimaryIdentifier();
      expect(id).toHaveLength(15);
      expect(/^\d{15}$/.test(id)).toBe(true);
    });

    it('should generate different identifiers on subsequent calls', () => {
      const id1 = generatePrimaryIdentifier();
      const id2 = generatePrimaryIdentifier();
      expect(id1).not.toBe(id2);
    });
  });

  describe('KeyGeneratorContext', () => {
    let context: KeyGeneratorContext;

    beforeEach(() => {
      context = new KeyGeneratorContext();
    });

    it('should return the same primary identifier on multiple calls', () => {
      const id1 = context.getPrimaryIdentifier();
      const id2 = context.getPrimaryIdentifier();
      expect(id1).toBe(id2);
      expect(id1).toHaveLength(15);
      expect(/^\d{15}$/.test(id1)).toBe(true);
    });

    it('should return different identifiers after reset', () => {
      const id1 = context.getPrimaryIdentifier();
      context.reset();
      const id2 = context.getPrimaryIdentifier();
      expect(id1).not.toBe(id2);
    });

    it('should allow setting a specific primary identifier', () => {
      const customId = '123456789012345';
      context.setPrimaryIdentifier(customId);
      expect(context.getPrimaryIdentifier()).toBe(customId);
    });

    it('should pad shorter custom identifiers with leading zeros', () => {
      context.setPrimaryIdentifier('12345');
      expect(context.getPrimaryIdentifier()).toBe('000000000012345');
    });

    it('should throw an error for invalid custom identifiers', () => {
      expect(() => context.setPrimaryIdentifier('abc')).toThrow(
        'Primary identifier must be a numeric string with 1-15 digits',
      );
      expect(() => context.setPrimaryIdentifier('1234567890123456')).toThrow(
        'Primary identifier must be a numeric string with 1-15 digits',
      );
    });
  });

  describe('defaultKeyGenerator', () => {
    beforeEach(() => {
      defaultKeyGenerator.reset();
    });

    it('should maintain consistency across multiple calls', () => {
      const id1 = defaultKeyGenerator.getPrimaryIdentifier();
      const id2 = defaultKeyGenerator.getPrimaryIdentifier();
      expect(id1).toBe(id2);
    });

    it('should be different from a new context', () => {
      const defaultId = defaultKeyGenerator.getPrimaryIdentifier();
      const newContext = new KeyGeneratorContext();
      const newId = newContext.getPrimaryIdentifier();
      expect(defaultId).not.toBe(newId);
    });
  });
});
