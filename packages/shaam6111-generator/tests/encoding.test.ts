import { describe, expect, it } from 'vitest';
import { fromWindows1255, toWindows1255 } from '../src/utils/encoding';

describe('Windows-1255 Encoding Tests', () => {
  // Basic functionality tests
  describe('Basic encoding and decoding', () => {
    it('should correctly round-trip Hebrew text', () => {
      const hebrewText = 'שלום עולם';
      const encoded = toWindows1255(hebrewText);
      const decoded = fromWindows1255(encoded);

      expect(decoded).toBe(hebrewText);
    });

    it('should correctly round-trip English text', () => {
      const englishText = 'Hello World';
      const encoded = toWindows1255(englishText);
      const decoded = fromWindows1255(encoded);

      expect(decoded).toBe(englishText);
    });

    it('should correctly round-trip mixed Hebrew and English text', () => {
      const mixedText = 'שלום Hello עולם World';
      const encoded = toWindows1255(mixedText);
      const decoded = fromWindows1255(encoded);

      expect(decoded).toBe(mixedText);
    });
  });

  // Edge cases tests
  describe('Edge cases', () => {
    it('should handle empty strings', () => {
      const emptyString = '';
      const encoded = toWindows1255(emptyString);
      const decoded = fromWindows1255(encoded);

      expect(decoded).toBe(emptyString);
      expect(encoded.length).toBe(0);
    });

    it('should handle special characters', () => {
      const specialChars = '!@#$%^&*()_+-=[]{}|;:",.<>?/`~';
      const encoded = toWindows1255(specialChars);
      const decoded = fromWindows1255(encoded);

      expect(decoded).toBe(specialChars);
    });

    it('should handle Hebrew with vowel points (nikkud)', () => {
      // Text with nikkud (vowel points)
      const textWithNikkud = 'שָׁלוֹם';
      const encoded = toWindows1255(textWithNikkud);
      const decoded = fromWindows1255(encoded);

      expect(decoded).toBe(textWithNikkud);
    });

    it('should handle extremely long text', () => {
      // Generate a very long string (50KB)
      const longHebrewPrefix = 'שלום עולם '.repeat(1000);
      const longEnglishSuffix = 'Hello World '.repeat(1000);
      const longText = longHebrewPrefix + longEnglishSuffix;

      const encoded = toWindows1255(longText);
      const decoded = fromWindows1255(encoded);

      expect(decoded).toBe(longText);
      // The encoded length should be close to the original string length since Windows-1255 is a single-byte encoding
      expect(encoded.length).toBe(longText.length);
    });

    it('should handle Windows-1255 specific characters', () => {
      // Characters specific to Windows-1255 encoding
      const win1255SpecialChars = '₪'; // Hebrew Shekel sign
      const encoded = toWindows1255(win1255SpecialChars);
      const decoded = fromWindows1255(encoded);

      expect(decoded).toBe(win1255SpecialChars);
    });
  });

  // Handling of characters not in Windows-1255
  describe('Characters not in Windows-1255', () => {
    it('should handle characters not in Windows-1255 charset', () => {
      // Emoji and other Unicode characters not in Windows-1255
      const unicodeText = 'שלום 😊 עולם';

      // This should use the replacement character for the emoji
      const encoded = toWindows1255(unicodeText);
      const decoded = fromWindows1255(encoded);

      // The round-trip won't be perfect because Windows-1255 doesn't support emojis
      expect(decoded).not.toBe(unicodeText);

      // But the Hebrew text should be preserved
      expect(decoded).toContain('שלום');

      // Check that the emoji is replaced with a specific replacement character or pattern
      expect(decoded).not.toContain('😊');
      // Assuming Windows-1255 uses '?' as replacement character
      expect(decoded.indexOf('?')).toBeGreaterThan(-1);
    });
  });

  // Corrupted files tests
  describe('Handling corrupted files', () => {
    it('should handle invalid byte sequences', () => {
      // Create a buffer with invalid Windows-1255 byte sequences
      const invalidBuffer = Buffer.from([0xff, 0xfe, 0x91, 0x92, 0xff]);

      // This should not throw but might return replacement characters
      const decoded = fromWindows1255(invalidBuffer);

      // We expect a string (possibly with replacement characters) rather than an error
      expect(typeof decoded).toBe('string');
    });

    it('should handle truncated data', () => {
      // Create valid data then truncate it
      const hebrewText = 'שלום עולם';
      const fullBuffer = toWindows1255(hebrewText);

      // Truncate the buffer to simulate corrupted file
      const truncatedBuffer = fullBuffer.subarray(0, Math.floor(fullBuffer.length / 2));

      // This should still return something without throwing
      const decoded = fromWindows1255(truncatedBuffer);

      // Result will be partial but should be a string
      expect(typeof decoded).toBe('string');

      // The string should be shorter than the original
      expect(decoded.length).toBeLessThan(hebrewText.length);
    });

    it('should handle null buffers gracefully', () => {
      expect(() => fromWindows1255(null as unknown as Buffer)).toThrow();
    });

    it('should handle zero-length buffers', () => {
      const emptyBuffer = Buffer.alloc(0);
      const decoded = fromWindows1255(emptyBuffer);

      expect(decoded).toBe('');
    });
  });

  // Test for error cases in the encoding direction
  describe('Error handling in encoding', () => {
    it('should handle null input gracefully', () => {
      expect(() => toWindows1255(null as unknown as string)).toThrow();
    });

    it('should handle undefined input gracefully', () => {
      expect(() => toWindows1255(undefined as unknown as string)).toThrow();
    });

    it('should handle non-string input gracefully', () => {
      expect(() => toWindows1255(123 as unknown as string)).toThrow();
    });
  });

  // Real-world use case tests specific to SHAAM6111
  describe('SHAAM6111 specific tests', () => {
    it('should correctly encode and decode business names in Hebrew', () => {
      const businessName = 'חברה ישראלית בע"מ';
      const encoded = toWindows1255(businessName);
      const decoded = fromWindows1255(encoded);

      expect(decoded).toBe(businessName);
    });

    it('should handle fixed-width field padding correctly', () => {
      // Simulate a fixed-width field with padding as used in SHAAM6111
      const name = 'חברה בע"מ';
      const paddedName = name.padEnd(50, ' ');

      const encoded = toWindows1255(paddedName);
      const decoded = fromWindows1255(encoded);

      expect(decoded).toBe(paddedName);
      expect(decoded.length).toBe(50);
    });

    it('should handle mixed numeric and Hebrew content', () => {
      // Simulate a typical line from SHAAM6111 report
      const mixedContent =
        '123456789202598765432112345678998765432112341234חברה ישראלית בע"מ                               221121112002002002';

      const encoded = toWindows1255(mixedContent);
      const decoded = fromWindows1255(encoded);

      expect(decoded).toBe(mixedContent);
    });
  });
});
