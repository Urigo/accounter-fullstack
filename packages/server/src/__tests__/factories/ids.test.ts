import { describe, expect, it } from 'vitest';
import { UUID_REGEX } from '../../shared/constants.js';
import { makeUUID } from './ids.js';

describe('Factory Helpers: IDs', () => {
  describe('makeUUID', () => {
    it('should generate a valid UUID format', () => {
      const id = makeUUID();
      expect(id).toMatch(UUID_REGEX);
    });

    it('should generate different UUIDs without seed', () => {
      const id1 = makeUUID();
      const id2 = makeUUID();
      expect(id1).not.toBe(id2);
    });

    it('should generate deterministic UUID with seed', () => {
      const seed = 'admin-business';
      const id1 = makeUUID(seed);
      const id2 = makeUUID(seed);
      expect(id1).toBe(id2);
    });

    it('should generate different UUIDs for different seeds', () => {
      const id1 = makeUUID('seed-one');
      const id2 = makeUUID('seed-two');
      expect(id1).not.toBe(id2);
    });

    it('should generate valid UUID v4 format with seed', () => {
      const id = makeUUID('test-seed');
      expect(id).toMatch(UUID_REGEX);
      // Version bits should be 4
      expect(id.charAt(14)).toBe('4');
    });

    it('should handle empty string seed', () => {
      const id1 = makeUUID('');
      const id2 = makeUUID('');
      // Empty string seed should produce same deterministic UUID
      expect(id1).toBe(id2);
      expect(id1).toMatch(UUID_REGEX);
      // Empty string produces specific deterministic UUID (hash of '' = 0)
      expect(id1).toBe('00000000-0000-4000-8000-000000000000');
    });

    it('should handle complex seed strings', () => {
      const seeds = [
        'admin-business-123',
        'supplier_with_underscores',
        'UPPERCASE-SEED',
        'seed with spaces',
        'seed-with-special-chars-!@#$%',
      ];

      seeds.forEach(seed => {
        const id = makeUUID(seed);
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        expect(id).toMatch(uuidRegex);
      });
    });

    it('should be consistent across multiple calls with same seed', () => {
      const seed = 'consistent-seed';
      const ids = Array.from({ length: 10 }, () => makeUUID(seed));
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(1);
    });

    it('should generate different IDs for similar but different seeds', () => {
      const id1 = makeUUID('test');
      const id2 = makeUUID('test1');
      const id3 = makeUUID('test-');
      expect(id1).not.toBe(id2);
      expect(id1).not.toBe(id3);
      expect(id2).not.toBe(id3);
    });
  });
});
