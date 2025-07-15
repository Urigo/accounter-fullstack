import { describe, expect, it } from 'vitest';
import { CRLF } from '../../src/format/newline';

describe('Newline constants', () => {
  describe('CRLF', () => {
    it('should be carriage return + line feed', () => {
      expect(CRLF).toBe('\r\n');
    });

    it('should have correct character codes', () => {
      expect(CRLF.charCodeAt(0)).toBe(13); // CR
      expect(CRLF.charCodeAt(1)).toBe(10); // LF
    });

    it('should have length of 2', () => {
      expect(CRLF.length).toBe(2);
    });
  });
});
