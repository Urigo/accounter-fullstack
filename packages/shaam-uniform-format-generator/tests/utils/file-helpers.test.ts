import { describe, expect, it } from 'vitest';
import {
  createDataFile,
  createFile,
  createIniFile,
  createShaamFiles,
  FileNaming,
  getFileInfo,
  readFileAsText,
  validateShaamFile,
} from '../../src/utils/file-helpers';

describe('File Helpers', () => {
  describe('createFile', () => {
    it('should create a File object with correct content and name', () => {
      const content = 'Test content';
      const filename = 'test.txt';

      const file = createFile(content, filename);

      expect(file).toBeInstanceOf(File);
      expect(file.name).toBe(filename);
      expect(file.type).toBe('text/plain');
      expect(file.size).toBeGreaterThan(0);
    });

    it('should normalize line endings to CRLF', () => {
      const contentWithLF = 'Line 1\nLine 2\nLine 3';
      const contentWithCRLF = 'Line 1\r\nLine 2\r\nLine 3';

      const fileLF = createFile(contentWithLF, 'test1.txt');
      const fileCRLF = createFile(contentWithCRLF, 'test2.txt');

      expect(fileLF.size).toBe(fileCRLF.size);
    });

    it('should throw error for empty text', () => {
      expect(() => createFile('', 'test.txt')).toThrow('Text content must be a non-empty string');
      expect(() => createFile(null as unknown as string, 'test.txt')).toThrow(
        'Text content must be a non-empty string',
      );
    });

    it('should throw error for empty filename', () => {
      expect(() => createFile('content', '')).toThrow('Filename must be a non-empty string');
      expect(() => createFile('content', null as unknown as string)).toThrow(
        'Filename must be a non-empty string',
      );
    });

    it('should accept custom options', () => {
      const file = createFile('content', 'test.csv', { type: 'text/csv' });
      expect(file.type).toBe('text/csv');
    });
  });

  describe('createIniFile', () => {
    it('should create INI file with correct naming convention', () => {
      const iniText = 'A000...';
      const file = createIniFile(iniText, 'my-report');

      expect(file.name).toBe('my-report.INI.TXT');
      expect(file.type).toBe('text/plain');
    });

    it('should use default name when not provided', () => {
      const iniText = 'A000...';
      const file = createIniFile(iniText);

      expect(file.name).toBe('report.INI.TXT');
    });
  });

  describe('createDataFile', () => {
    it('should create data file with correct naming convention', () => {
      const dataText = 'A100...';
      const file = createDataFile(dataText, 'my-report');

      expect(file.name).toBe('my-report.BKMVDATA.TXT');
      expect(file.type).toBe('text/plain');
    });

    it('should use default name when not provided', () => {
      const dataText = 'A100...';
      const file = createDataFile(dataText);

      expect(file.name).toBe('report.BKMVDATA.TXT');
    });
  });

  describe('createShaamFiles', () => {
    it('should create both INI and data files', () => {
      const iniText = 'A000...';
      const dataText = 'A100...';

      const { iniFile, dataFile } = createShaamFiles(iniText, dataText, 'test-report');

      expect(iniFile.name).toBe('test-report.INI.TXT');
      expect(dataFile.name).toBe('test-report.BKMVDATA.TXT');
      expect(iniFile.type).toBe('text/plain');
      expect(dataFile.type).toBe('text/plain');
    });

    it('should use default base name when not provided', () => {
      const iniText = 'A000...';
      const dataText = 'A100...';

      const { iniFile, dataFile } = createShaamFiles(iniText, dataText);

      expect(iniFile.name).toBe('report.INI.TXT');
      expect(dataFile.name).toBe('report.BKMVDATA.TXT');
    });
  });

  describe('validateShaamFile', () => {
    it('should validate correct INI file', () => {
      const iniFile = createIniFile('A000...', 'test');
      expect(validateShaamFile(iniFile, 'ini')).toBe(true);
    });

    it('should validate correct data file', () => {
      const dataFile = createDataFile('A100...', 'test');
      expect(validateShaamFile(dataFile, 'data')).toBe(true);
    });

    it('should reject file with wrong extension for INI', () => {
      const wrongFile = createFile('content', 'test.BKMVDATA.TXT');
      expect(validateShaamFile(wrongFile, 'ini')).toBe(false);
    });

    it('should reject file with wrong extension for data', () => {
      const wrongFile = createFile('content', 'test.INI.TXT');
      expect(validateShaamFile(wrongFile, 'data')).toBe(false);
    });

    it('should reject non-File objects', () => {
      expect(validateShaamFile(null as unknown as File, 'ini')).toBe(false);
      expect(validateShaamFile({} as unknown as File, 'ini')).toBe(false);
      expect(validateShaamFile('string' as unknown as File, 'ini')).toBe(false);
    });

    it('should reject files with wrong MIME type', () => {
      const wrongMimeFile = createFile('content', 'test.INI.TXT', { type: 'application/json' });
      expect(validateShaamFile(wrongMimeFile, 'ini')).toBe(false);
    });

    it('should reject empty files', () => {
      // Create empty file by using empty string (though our createFile prevents this)
      const emptyFile = new File([''], 'test.INI.TXT', { type: 'text/plain' });
      expect(validateShaamFile(emptyFile, 'ini')).toBe(false);
    });
  });

  describe('readFileAsText', () => {
    it('should read file content as text', async () => {
      const content = 'Test file content';
      const file = createFile(content, 'test.txt');

      const result = await readFileAsText(file);
      expect(result).toContain('Test file content');
    });

    it('should throw error for non-File input', async () => {
      await expect(readFileAsText(null as unknown as File)).rejects.toThrow(
        'Input must be a valid File object',
      );
      await expect(readFileAsText({} as unknown as File)).rejects.toThrow(
        'Input must be a valid File object',
      );
    });
  });

  describe('getFileInfo', () => {
    it('should return correct file information', () => {
      const file = createFile('content', 'test.txt');
      const info = getFileInfo(file);

      expect(info).toEqual({
        name: 'test.txt',
        size: expect.any(Number),
        type: 'text/plain',
        lastModified: expect.any(Number),
      });
      expect(info.size).toBeGreaterThan(0);
    });

    it('should throw error for non-File input', () => {
      expect(() => getFileInfo(null as unknown as File)).toThrow(
        'Input must be a valid File object',
      );
      expect(() => getFileInfo({} as unknown as File)).toThrow('Input must be a valid File object');
    });
  });

  describe('FileNaming utilities', () => {
    describe('iniFileName', () => {
      it('should generate correct INI filename', () => {
        expect(FileNaming.iniFileName('test')).toBe('test.INI.TXT');
        expect(FileNaming.iniFileName()).toBe('report.INI.TXT');
      });
    });

    describe('dataFileName', () => {
      it('should generate correct data filename', () => {
        expect(FileNaming.dataFileName('test')).toBe('test.BKMVDATA.TXT');
        expect(FileNaming.dataFileName()).toBe('report.BKMVDATA.TXT');
      });
    });

    describe('extractBaseName', () => {
      it('should extract base name from INI filename', () => {
        expect(FileNaming.extractBaseName('test.INI.TXT')).toBe('test');
        expect(FileNaming.extractBaseName('my-report.INI.TXT')).toBe('my-report');
      });

      it('should extract base name from data filename', () => {
        expect(FileNaming.extractBaseName('test.BKMVDATA.TXT')).toBe('test');
        expect(FileNaming.extractBaseName('my-report.BKMVDATA.TXT')).toBe('my-report');
      });

      it('should handle case-insensitive extraction', () => {
        expect(FileNaming.extractBaseName('test.ini.txt')).toBe('test');
        expect(FileNaming.extractBaseName('test.bkmvdata.txt')).toBe('test');
      });

      it('should return default for invalid filenames', () => {
        expect(FileNaming.extractBaseName('invalid.txt')).toBe('report');
        expect(FileNaming.extractBaseName('')).toBe('report');
      });
    });

    describe('isValidShaamFileName', () => {
      it('should validate correct SHAAM filenames', () => {
        expect(FileNaming.isValidShaamFileName('test.INI.TXT')).toBe(true);
        expect(FileNaming.isValidShaamFileName('test.BKMVDATA.TXT')).toBe(true);
        expect(FileNaming.isValidShaamFileName('my-report.INI.TXT')).toBe(true);
        expect(FileNaming.isValidShaamFileName('my-report.BKMVDATA.TXT')).toBe(true);
      });

      it('should handle case-insensitive validation', () => {
        expect(FileNaming.isValidShaamFileName('test.ini.txt')).toBe(true);
        expect(FileNaming.isValidShaamFileName('test.bkmvdata.txt')).toBe(true);
      });

      it('should reject invalid filenames', () => {
        expect(FileNaming.isValidShaamFileName('test.txt')).toBe(false);
        expect(FileNaming.isValidShaamFileName('test.csv')).toBe(false);
        expect(FileNaming.isValidShaamFileName('test')).toBe(false);
        expect(FileNaming.isValidShaamFileName('')).toBe(false);
      });
    });
  });

  describe('Integration with SHAAM format', () => {
    it('should work with typical SHAAM file content', () => {
      const iniContent = 'A000     000000000000000123456789...\r\nA100000000000000001\r\n';
      const dataContent = 'A100000000001123456789...\r\nZ900000000008123456789...\r\n';

      const { iniFile, dataFile } = createShaamFiles(iniContent, dataContent, 'shaam-report');

      expect(validateShaamFile(iniFile, 'ini')).toBe(true);
      expect(validateShaamFile(dataFile, 'data')).toBe(true);
      expect(iniFile.name).toBe('shaam-report.INI.TXT');
      expect(dataFile.name).toBe('shaam-report.BKMVDATA.TXT');
    });

    it('should maintain CRLF line endings', async () => {
      const content = 'Line 1\nLine 2\nLine 3';
      const file = createFile(content, 'test.txt');

      const result = await readFileAsText(file);
      expect(result).toContain('\r\n');
      expect(result).not.toMatch(/(?<!\r)\n/); // Should not have LF without CR
    });
  });
});
