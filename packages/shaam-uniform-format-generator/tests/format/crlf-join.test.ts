/**
 * Tests for CRLF join logic in encoder
 */

import { describe, expect, it } from 'vitest';
import { CRLF } from '../../src/format/newline';
import {
  assembleFile,
  joinFields,
  joinLinesWithCRLF,
  joinRecords,
} from '../../src/generator/format/encoder';

describe('CRLF Join Logic', () => {
  describe('joinFields', () => {
    it('should join field values and add CRLF', () => {
      const fields = ['ABC', '123', 'XYZ'];
      const result = joinFields(fields);

      expect(result).toBe('ABC123XYZ' + CRLF);
      expect(result.endsWith(CRLF)).toBe(true);
    });

    it('should handle empty fields array', () => {
      const result = joinFields([]);
      expect(result).toBe(CRLF);
    });

    it('should handle single field', () => {
      const result = joinFields(['SINGLE']);
      expect(result).toBe('SINGLE' + CRLF);
    });
  });

  describe('joinRecords', () => {
    it('should join records without adding extra CRLF', () => {
      const records = ['A100' + CRLF, 'B100' + CRLF, 'Z900' + CRLF];
      const result = joinRecords(records);

      expect(result).toBe('A100' + CRLF + 'B100' + CRLF + 'Z900' + CRLF);
      expect(result.split(CRLF)).toHaveLength(4); // 3 records + 1 empty string at end
    });

    it('should handle empty records array', () => {
      const result = joinRecords([]);
      expect(result).toBe('');
    });
  });

  describe('joinLinesWithCRLF', () => {
    it('should add CRLF to each line and join them', () => {
      const lines = ['LINE1', 'LINE2', 'LINE3'];
      const result = joinLinesWithCRLF(lines);

      expect(result).toBe('LINE1' + CRLF + 'LINE2' + CRLF + 'LINE3' + CRLF);
    });

    it('should handle empty lines array', () => {
      const result = joinLinesWithCRLF([]);
      expect(result).toBe('');
    });
  });

  describe('assembleFile', () => {
    it('should assemble complete SHAAM file from records', () => {
      const records = [
        'A000HEADER_RECORD' + CRLF,
        'A100BUSINESS_DATA' + CRLF,
        'C100DOCUMENT_HDR' + CRLF,
        'Z900CLOSING_REC' + CRLF,
      ];
      const result = assembleFile(records);

      expect(result).toBe(records.join(''));
      expect(result.startsWith('A000HEADER_RECORD')).toBe(true);
      expect(result.endsWith('Z900CLOSING_REC' + CRLF)).toBe(true);
    });

    it('should handle single record', () => {
      const records = ['A100SINGLE' + CRLF];
      const result = assembleFile(records);

      expect(result).toBe('A100SINGLE' + CRLF);
    });
  });

  describe('Integration with actual record encoding', () => {
    it('should work with actual field arrays like records use', () => {
      // Simulate how A100 record builds its fields array
      const fields = [
        'A100', // Record code (4)
        '000000001', // Record number (9)
        '123456789', // VAT ID (9)
        '12345678901234567890', // Primary ID (20 chars)
        '&OF1.31&', // System constant (8)
        ' '.repeat(50), // Reserved field (50)
      ];

      const recordLine = joinFields(fields);

      expect(recordLine).toContain('A100');
      expect(recordLine).toContain('123456789');
      expect(recordLine.endsWith(CRLF)).toBe(true);

      // Calculate actual field lengths: 4 + 9 + 9 + 20 + 8 + 50 = 100 chars + CRLF
      const expectedLength = 4 + 9 + 9 + 20 + 8 + 50 + CRLF.length;
      expect(recordLine.length).toBe(expectedLength);
    });

    it('should create valid multi-record file', () => {
      const record1 = joinFields(['A100', '000000001', '123456789']);
      const record2 = joinFields(['C100', '000000002', '123456789']);
      const record3 = joinFields(['Z900', '000000003', '123456789']);

      const fileContent = assembleFile([record1, record2, record3]);

      const lines = fileContent.split(CRLF).filter(line => line.length > 0);
      expect(lines).toHaveLength(3);
      expect(lines[0].startsWith('A100')).toBe(true);
      expect(lines[1].startsWith('C100')).toBe(true);
      expect(lines[2].startsWith('Z900')).toBe(true);
    });
  });
});
