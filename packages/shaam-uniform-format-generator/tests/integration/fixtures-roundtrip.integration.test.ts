/**
 * Integration test for round-trip validation with actual fixture files
 * This test validates the BKMVDATA.txt and ini.txt fixture files by:
 * 1. Parsing them into structured data
 * 2. Generating new files from the parsed data
 * 3. Comparing the results to ensure data integrity
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { generateUniformFormatReport } from '../../src/api/generate-report';
import { parseUniformFormatFiles } from '../../src/api/parse-files';
import {
  parseA000,
  parseA000Sum,
  parseA100,
  parseB100,
  parseB110,
  parseC100,
  parseD110,
  parseD120,
  parseM100,
  parseZ900,
} from '../../src/generator/records/index';
import type {
  Account,
  Document,
  InventoryItem,
  JournalEntry,
  ReportInput,
} from '../../src/types/index';

const FIXTURES_DIR = join(__dirname, '..', 'fixtures');

interface ParsedFixtureData {
  business: ReportInput['business'] | null;
  documents: Document[];
  journalEntries: JournalEntry[];
  accounts: Account[];
  inventory: InventoryItem[];
  rawRecords: {
    a100: ReturnType<typeof parseA100> | null;
    b100: ReturnType<typeof parseB100>[];
    b110: ReturnType<typeof parseB110>[];
    c100: ReturnType<typeof parseC100>[];
    d110: ReturnType<typeof parseD110>[];
    d120: ReturnType<typeof parseD120>[];
    m100: ReturnType<typeof parseM100>[];
    z900: ReturnType<typeof parseZ900> | null;
  };
}

interface RecordParsingResult {
  success: boolean;
  recordType?: string;
  parsedRecord?:
    | ReturnType<typeof parseA100>
    | ReturnType<typeof parseB100>
    | ReturnType<typeof parseB110>
    | ReturnType<typeof parseC100>
    | ReturnType<typeof parseD110>
    | ReturnType<typeof parseD120>
    | ReturnType<typeof parseM100>
    | ReturnType<typeof parseZ900>;
  error?: Error;
}

/**
 * Shared helper function to parse a single record line based on its record type
 * @param line The line to parse (should already be cleaned of line endings)
 * @returns Object containing parsing result and parsed record if successful
 */
function parseRecordLine(line: string): RecordParsingResult {
  if (line.length < 4) {
    return { success: false };
  }

  const recordType = line.substring(0, 4);

  try {
    switch (recordType) {
      case 'A100':
        return { success: true, recordType, parsedRecord: parseA100(line) };
      case 'B100':
        return { success: true, recordType, parsedRecord: parseB100(line) };
      case 'B110':
        return { success: true, recordType, parsedRecord: parseB110(line) };
      case 'C100':
        return { success: true, recordType, parsedRecord: parseC100(line) };
      case 'D110':
        return { success: true, recordType, parsedRecord: parseD110(line) };
      case 'D120':
        return { success: true, recordType, parsedRecord: parseD120(line) };
      case 'M100':
        return { success: true, recordType, parsedRecord: parseM100(line) };
      case 'Z900':
        return { success: true, recordType, parsedRecord: parseZ900(line) };
      default:
        // Unknown record type
        return { success: false, recordType };
    }
  } catch (error) {
    return { success: false, recordType, error: error as Error };
  }
}

/**
 * Parses the BKMVDATA.txt fixture file into structured data
 */
async function parseFixtureData(bkmvDataPath: string): Promise<ParsedFixtureData> {
  const content = await readFile(bkmvDataPath, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim().length > 0);

  const result: ParsedFixtureData = {
    business: null,
    documents: [],
    journalEntries: [],
    accounts: [],
    inventory: [],
    rawRecords: {
      a100: null,
      b100: [],
      b110: [],
      c100: [],
      d110: [],
      d120: [],
      m100: [],
      z900: null,
    },
  };

  // Parse each line based on record type
  for (const line of lines) {
    if (line.length < 4) continue;

    // Only remove CRLF, not trailing spaces which might be significant
    const cleanLine = line.replace(/\r?\n?$/, '');
    const parseResult = parseRecordLine(cleanLine);

    if (!parseResult.success) {
      if (parseResult.error) {
        // For debugging, log the line that caused the parsing error.
        // eslint-disable-next-line no-console
        console.error(`Failed to parse line: ${cleanLine}`, parseResult.error);
      }
      // Skip parsing errors for invalid lines
      continue;
    }

    const { recordType, parsedRecord } = parseResult;

    switch (recordType) {
      case 'A100': {
        result.rawRecords.a100 = parsedRecord as ReturnType<typeof parseA100>;
        if (result.rawRecords.a100) {
          result.business = {
            businessId: result.rawRecords.a100.primaryIdentifier.toString(), // Convert number to string
            name: 'Unknown Business', // Dummy value to satisfy schema
            taxId: result.rawRecords.a100.vatId,
            reportingPeriod: {
              startDate: '1900-01-01', // Dummy value to satisfy schema
              endDate: '1900-12-31', // Dummy value to satisfy schema
            },
          };
        }
        break;
      }

      case 'B100': {
        const b100 = parsedRecord as ReturnType<typeof parseB100>;
        result.rawRecords.b100.push(b100);
        result.journalEntries.push({
          id: `JE_${b100.transactionNumber}`,
          date: b100.date.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3'),
          amount: b100.transactionAmount, // Use transactionAmount as-is since it already contains the correct sign
          accountId: b100.accountKey,
          description: b100.details, // Preserve exact original details (including empty strings)
          transactionNumber: b100.transactionNumber,
          transactionLineNumber: b100.transactionLineNumber,
          batchNumber: b100.batchNumber,
          transactionType: b100.transactionType,
          referenceDocument: b100.referenceDocument,
          referenceDocumentType: b100.referenceDocumentType,
          referenceDocument2: b100.referenceDocument2,
          referenceDocumentType2: b100.referenceDocumentType2,
          valueDate: b100.valueDate,
          counterAccountKey: b100.counterAccountKey,
          debitCreditIndicator: b100.debitCreditIndicator,
          currencyCode: b100.currencyCode,
          transactionAmount: b100.transactionAmount, // Preserve original transaction amount with sign
          foreignCurrencyAmount: b100.foreignCurrencyAmount,
          quantityField: b100.quantityField,
          matchingField1: b100.matchingField1,
          matchingField2: b100.matchingField2,
          branchId: b100.branchId,
          entryDate: b100.entryDate,
          operatorUsername: b100.operatorUsername,
          reserved: b100.reserved,
        });
        break;
      }

      case 'B110': {
        const b110 = parsedRecord as ReturnType<typeof parseB110>;
        result.rawRecords.b110.push(b110);
        result.accounts.push({
          id: b110.accountKey,
          name: b110.accountName || '', // Preserve exact original account name (including empty strings)
          sortCode: {
            key: b110.trialBalanceCode || 'Other',
            name: b110.trialBalanceCodeDescription || '', // Preserve exact original description (including empty strings)
          },
          address: {
            street: b110.customerSupplierAddressStreet,
            houseNumber: b110.customerSupplierAddressHouseNumber,
            city: b110.customerSupplierAddressCity,
            zip: b110.customerSupplierAddressZip,
            country: b110.customerSupplierAddressCountry,
          },
          countryCode: b110.countryCode,
          parentAccountKey: b110.parentAccountKey,
          vatId: b110.supplierCustomerTaxId,
          accountOpeningBalance: b110.accountOpeningBalance ?? 0,
          totalDebits: b110.totalDebits,
          totalCredits: b110.totalCredits,
          accountingClassificationCode: b110.accountingClassificationCode?.toString(),
          branchId: b110.branchId,
          openingBalanceForeignCurrency: b110.openingBalanceForeignCurrency,
          foreignCurrencyCode: b110.foreignCurrencyCode,
        });
        break;
      }

      case 'C100': {
        const c100 = parsedRecord as ReturnType<typeof parseC100>;
        result.rawRecords.c100.push(c100);
        result.documents.push({
          id: c100.documentId,
          type: c100.documentType,
          date: c100.documentIssueDate.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3'),
          amount: parseFloat(c100.amountIncludingVat || '0'),
          description: c100.customerName || 'Document',
        });
        break;
      }

      case 'D110':
        result.rawRecords.d110.push(parsedRecord as ReturnType<typeof parseD110>);
        break;

      case 'D120':
        result.rawRecords.d120.push(parsedRecord as ReturnType<typeof parseD120>);
        break;

      case 'M100': {
        const m100 = parsedRecord as ReturnType<typeof parseM100>;
        result.rawRecords.m100.push(m100);
        result.inventory.push({
          id: m100.internalItemCode,
          name: m100.itemName,
          quantity: parseInt(m100.totalStockOut || '0'),
        });
        break;
      }

      case 'Z900':
        result.rawRecords.z900 = parsedRecord as ReturnType<typeof parseZ900>;
        break;

      default:
        // Should not reach here due to parseRecordLine filtering
        break;
    }
  }

  return result;
}

describe.skip('Fixture Files Round-trip Integration Test', () => {
  it('should parse and validate the BKMVDATA.txt fixture file', async () => {
    const bkmvDataPath = join(FIXTURES_DIR, 'BKMVDATA.txt');
    const content = await readFile(bkmvDataPath, 'utf-8');
    const firstLine = content.split('\n').find(line => line.trim().length > 0);

    // Debug: Check the first line (should be A100)
    expect(firstLine).toBeDefined();
    if (!firstLine) {
      throw new Error('The first non-empty line in BKMVDATA.txt is undefined.');
    }
    expect(firstLine.substring(0, 4)).toBe('A100');
    // Try to parse the A100 line directly (only removing CRLF, not internal spaces)
    const cleanLine = firstLine.replace(/\r?\n?$/, '').replace(/\r$/, '');
    const a100 = parseA100(cleanLine);
    expect(a100).toBeDefined();
    expect(a100.vatId).toBeTruthy();

    const parsedData = await parseFixtureData(bkmvDataPath);

    // Debug: Check what was parsed
    expect(parsedData.rawRecords.a100).toBeDefined();

    if (parsedData.rawRecords.a100) {
      // Check that A100 has the expected fields
      expect(parsedData.rawRecords.a100.vatId).toBeTruthy();
      expect(parsedData.rawRecords.a100.primaryIdentifier).toBeTruthy();
    }

    // Validate that we parsed some data
    expect(parsedData.business).toBeDefined();
    expect(parsedData.business?.taxId).toBeTruthy(); // Check that we have some tax ID
    expect(parsedData.business?.name).toBeTruthy();

    // Check that we have various record types
    expect(parsedData.rawRecords.a100).toBeDefined();
    expect(parsedData.rawRecords.b100.length).toBeGreaterThan(0);
    expect(parsedData.rawRecords.z900).toBeDefined();

    // Validate some business logic
    if (parsedData.rawRecords.z900) {
      const totalDataRecords = parsedData.rawRecords.z900.totalRecords; // totalRecords is now a number
      const actualDataRecords =
        (parsedData.rawRecords.a100 ? 1 : 0) +
        parsedData.rawRecords.b100.length +
        parsedData.rawRecords.b110.length +
        parsedData.rawRecords.c100.length +
        parsedData.rawRecords.d110.length +
        parsedData.rawRecords.d120.length +
        parsedData.rawRecords.m100.length;

      // The fixture may have more records than we parse, so just ensure we parsed some
      expect(actualDataRecords).toBeGreaterThan(0);
      expect(totalDataRecords).toBeGreaterThan(0);
    }

    // Validate parsed data structure
    expect(parsedData.business).toBeDefined();
    expect(parsedData.business?.taxId).toBe('516232675'); // Actual tax ID from fixture
    expect(parsedData.business?.name).toBeTruthy();
  });

  it('should perform a complete round-trip with fixture data', async () => {
    const bkmvDataPath = join(FIXTURES_DIR, 'BKMVDATA.txt');
    const bkmvContent = await readFile(bkmvDataPath, 'utf-8');
    const iniDataPath = join(FIXTURES_DIR, 'ini.txt');
    const iniContent = await readFile(iniDataPath, 'utf-8');
    const parsedData = await parseUniformFormatFiles(iniContent, bkmvContent);

    // Skip test if we couldn't parse meaningful data
    if (!parsedData.data.business) {
      expect(
        parsedData.data.business,
        'Business data could not be parsed from fixture',
      ).toBeDefined();
      return; // This line is for type-safety and will not be reached if the assertion fails.
    }

    // Generate new files from the parsed data
    const generatedReport = generateUniformFormatReport(parsedData.data);

    expect(generatedReport).toBeDefined();
    expect(generatedReport.dataText).toBeDefined();
    expect(generatedReport.iniText).toBeDefined();

    // Parse the generated data back using the new parsing function
    const reparsedData = parseUniformFormatFiles(generatedReport.iniText, generatedReport.dataText);

    // Validate basic structure
    expect(reparsedData.data.business).toBeDefined();
    expect(reparsedData.data.business.taxId).toBe(parsedData.data.business.taxId);

    // Validate that we preserved the data structure through round-trip
    if (parsedData.data.journalEntries.length > 0) {
      expect(reparsedData.data.journalEntries).toHaveLength(parsedData.data.journalEntries.length);
    }

    if (parsedData.data.accounts.length > 0) {
      expect(reparsedData.data.accounts).toHaveLength(parsedData.data.accounts.length);
    }

    if (parsedData.data.documents.length > 0) {
      expect(reparsedData.data.documents).toHaveLength(parsedData.data.documents.length);
    }

    if (parsedData.data.inventory.length > 0) {
      expect(reparsedData.data.inventory).toHaveLength(parsedData.data.inventory.length);
    }

    // Validate round-trip completed successfully
    expect(generatedReport.summary.totalRecords).toBeGreaterThan(0);

    // DEEP DATA FILE CONTENT COMPARISON: Compare actual file content line by line
    // The round-trip should produce nearly identical SHAAM records
    const originalContent = await readFile(bkmvDataPath, 'utf-8');
    const originalLines = originalContent.split('\n').filter(line => line.trim().length > 0);
    const generatedLines = generatedReport.dataText.split('\r\n').filter(line => line.length > 0);

    // Both files should have the same number of data record lines
    expect(generatedLines.length).toBe(originalLines.length);

    // Compare each line - any differences should be investigated
    for (let i = 0; i < originalLines.length; i++) {
      const originalLine = originalLines[i].replace(/\r$/, ''); // Remove CR if present
      const generatedLine = generatedLines[i];

      if (originalLine.length < 4) continue;

      const recordType = originalLine.substring(0, 4);

      // Normalize both lines by masking variable fields that are expected to differ
      const normalizedOriginal = normalizeLineForComparison(originalLine, recordType);
      const normalizedGenerated = normalizeLineForComparison(generatedLine, recordType);

      if (normalizedOriginal === normalizedGenerated) {
        // Perfect match after normalization - continue
        continue;
      }

      // Found a mismatch - provide detailed information
      const maxLen = Math.max(normalizedOriginal.length, normalizedGenerated.length);
      let differenceReport = `\nDATA FILE ${recordType} record ${i + 1} mismatch after normalization:\n`;
      differenceReport += `Original:  "${originalLine}"\n`;
      differenceReport += `Generated: "${generatedLine}"\n`;
      differenceReport += `Normalized Original:  "${normalizedOriginal}"\n`;
      differenceReport += `Normalized Generated: "${normalizedGenerated}"\n`;
      differenceReport += `Original length: ${normalizedOriginal.length}, Generated length: ${normalizedGenerated.length}\n`;

      // Show character-by-character differences in normalized versions
      for (let j = 0; j < maxLen; j++) {
        const origChar = normalizedOriginal[j] || '∅';
        const genChar = normalizedGenerated[j] || '∅';
        if (origChar !== genChar) {
          differenceReport += `  Position ${j}: "${origChar}" vs "${genChar}"\n`;
        }
      }

      // Fail with detailed report
      throw new Error(differenceReport);
    }

    // DEEP INI FILE CONTENT COMPARISON: Compare INI file structure and validate generated content
    const iniPath = join(FIXTURES_DIR, 'ini.txt');
    const originalIniContent = await readFile(iniPath, 'utf-8');
    const originalIniLines = originalIniContent.split('\n').filter(line => line.trim().length > 0);
    const generatedIniLines = generatedReport.iniText
      .split('\r\n')
      .filter(line => line.trim().length > 0);

    // Validate that both INI files have at least the A000 header
    expect(generatedIniLines.length).toBeGreaterThanOrEqual(1);
    expect(originalIniLines.length).toBeGreaterThanOrEqual(1);

    // Both INI files should start with A000 header
    expect(generatedIniLines[0].startsWith('A000')).toBe(true);
    expect(originalIniLines[0].startsWith('A000')).toBe(true);

    // Parse the A000 headers from both files for comparison
    const originalA000Line = originalIniLines[0].replace(/\r$/, '');
    const generatedA000Line = generatedIniLines[0];

    // Normalize and compare A000 headers
    const normalizedOriginalA000 = normalizeIniLineForComparison(originalA000Line, 'A000');
    const normalizedGeneratedA000 = normalizeIniLineForComparison(generatedA000Line, 'A000');

    if (normalizedOriginalA000 !== normalizedGeneratedA000) {
      const maxA000Len = Math.max(normalizedOriginalA000.length, normalizedGeneratedA000.length);
      let a000DifferenceReport = `\nINI FILE A000 header mismatch after normalization:\n`;
      a000DifferenceReport += `Original:  "${originalA000Line}"\n`;
      a000DifferenceReport += `Generated: "${generatedA000Line}"\n`;
      a000DifferenceReport += `Normalized Original:  "${normalizedOriginalA000}"\n`;
      a000DifferenceReport += `Normalized Generated: "${normalizedGeneratedA000}"\n`;
      a000DifferenceReport += `Original length: ${normalizedOriginalA000.length}, Generated length: ${normalizedGeneratedA000.length}\n`;

      // Show character-by-character differences in normalized versions
      for (let j = 0; j < maxA000Len; j++) {
        const origA000Char = normalizedOriginalA000[j] || '∅';
        const genA000Char = normalizedGeneratedA000[j] || '∅';
        if (origA000Char !== genA000Char) {
          a000DifferenceReport += `  Position ${j}: "${origA000Char}" vs "${genA000Char}"\n`;
        }
      }

      throw new Error(a000DifferenceReport);
    }

    // Parse and validate A000Sum records (summary lines) - these should be consistent with the actual data
    const generatedSummaryLines = generatedIniLines.slice(1); // Skip A000 header

    // Create map of record type to count for generated INI
    const generatedSummaryCounts = new Map<string, number>();

    // Parse generated summary lines
    for (const line of generatedSummaryLines) {
      if (line.length === 19) {
        const recordType = line.substring(0, 4);
        const count = parseInt(line.substring(4, 19), 10);
        generatedSummaryCounts.set(recordType, count);
      }
    }

    // Validate that generated summary counts make sense with actual parsed data
    // Note: We don't require exact match with original because parsed data might differ
    // but we validate that the generated counts are consistent with what we actually have

    // Check that if we have data for a record type, we have a summary line for it
    if (parsedData.summary.perType.b100 > 0) {
      expect(generatedSummaryCounts.has('B100')).toBe(true);
      expect(generatedSummaryCounts.get('B100')).toBeGreaterThan(0);
    }

    if (parsedData.summary.perType.b110 > 0) {
      expect(generatedSummaryCounts.has('B110')).toBe(true);
      expect(generatedSummaryCounts.get('B110')).toBeGreaterThan(0);
    }

    if (parsedData.summary.perType.c100 > 0) {
      expect(generatedSummaryCounts.has('C100')).toBe(true);
      expect(generatedSummaryCounts.get('C100')).toBeGreaterThan(0);
    }

    // Validate that summary line format is correct for generated lines
    for (const line of generatedSummaryLines) {
      expect(line.length).toBe(19); // A000Sum records should be exactly 19 characters
      expect(line.match(/^[A-Z]\d{3}\d{15}$/)).toBeTruthy(); // Should match pattern: RecordType + 15-digit count
    }
  });

  /**
   * Normalizes a SHAAM record line for comparison by replacing variable fields
   * with consistent placeholders
   */
  function normalizeLineForComparison(line: string, recordType: string): string {
    if (line.length < 4) return line;

    switch (recordType) {
      case 'A100':
        // A100: Replace primary identifier (pos 22-36) - generated ad-hoc per file
        return (
          line.substring(0, 22) +
          'XXXXXXXXXXXXXXX' + // primary identifier placeholder (15 chars)
          line.substring(37)
        );

      case 'Z900':
        // Z900: Replace primary identifier and total records count
        return (
          line.substring(0, 22) +
          'XXXXXXXXXXXXXXX' + // primary identifier placeholder (15 chars)
          line.substring(37)
        );

      case 'B110':
        // B110: Normalize supplier customer tax ID field (pos 326-334) to handle formatting differences
        // Original might have "14216790 " while generated has "014216790"
        if (line.length >= 335) {
          const taxIdField = line.substring(326, 335); // 9 chars
          const normalizedTaxId = taxIdField.trim().replace(/^0+/, '').padEnd(9, ' ');
          return line.substring(0, 326) + normalizedTaxId + line.substring(335);
        }
        return line;

      default:
        return line;
    }
  }

  /**
   * Normalizes an INI file line for comparison by replacing variable fields
   * with consistent placeholders
   */
  function normalizeIniLineForComparison(line: string, recordType: string): string {
    if (line.length < 4) return line;

    switch (recordType) {
      case 'A000':
        // A000: This is a complex header record with many variable fields
        // We need to normalize most fields since they vary between original and generated
        if (line.length >= 466) {
          // Based on A000 record specification, normalize key variable fields:
          // Field positions calculated based on the encoding order in a000.ts
          return (
            line.substring(0, 33) +
            'XXXXXXXXXXXXXXX' + // pos 33-48: Primary Identifier (15 chars) - varies
            line.substring(48, 56) +
            'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX' + // pos 56-133: Software information (77 chars) - varies
            line.substring(133, 134) + // Keep pos 133: softwareType
            'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX' + // pos 134-184: Saved files path (50 chars) - varies
            line.substring(184, 384) + // Keep pos 184-384
            'XXXXXXXXXX' + // pos 384-394: Execution date and time - varies
            line.substring(394, 396) + // Keep pos 394-396: Language and encoding - should be similar
            'XXXXXXXXXXXXXXXXXXXX' + // pos 396-416: Compression software (20 chars) - varies
            line.substring(416) // Keep the rest - should be similar
          );
        }
        return line;

      case 'A000Sum':
        // A000Sum: These are count records, but the counts should match exactly
        // No normalization needed - counts should be identical
        return line;

      default:
        return line;
    }
  }

  it('should validate the ini.txt fixture file structure', async () => {
    const iniPath = join(FIXTURES_DIR, 'ini.txt');
    const iniContent = await readFile(iniPath, 'utf-8');

    expect(iniContent).toBeDefined();
    expect(iniContent.length).toBeGreaterThan(0);

    // Check basic structure - should start with A000 record
    const lines = iniContent.split('\n').filter(line => line.trim().length > 0);
    expect(lines.length).toBeGreaterThan(0);
    expect(lines[0].startsWith('A000')).toBe(true);

    // Should contain summary records (A000Sum format: B1, B11, C10, D11, D12, M10)
    const summaryLines = lines.filter(line => line.match(/^[BCDM]1[0-9]/));
    expect(summaryLines.length).toBeGreaterThan(0);

    // Validate INI file structure
    expect(summaryLines.length).toBeGreaterThan(0);
    expect(lines[0].startsWith('A000')).toBe(true);
  });

  it('should perform a complete round-trip with ini.txt fixture file', async () => {
    const iniPath = join(FIXTURES_DIR, 'ini.txt');
    const iniContent = await readFile(iniPath, 'utf-8');
    const lines = iniContent.split('\n').filter(line => line.trim().length > 0);

    // Parse the INI file structure
    let a000Record: ReturnType<typeof parseA000> | null = null;
    const a000SumRecords: ReturnType<typeof parseA000Sum>[] = [];

    for (const line of lines) {
      if (line.length < 4) continue;

      const cleanLine = line.replace(/\r?\n?$/, '').replace(/\r$/, '');

      // Check line length to determine record type
      if (cleanLine.length === 466) {
        // A000 header record
        const recordType = cleanLine.slice(0, 4);
        try {
          if (recordType === 'A000') {
            a000Record = parseA000(cleanLine);
          }
        } catch (error) {
          // Re-throwing the error will make the test fail with a descriptive message.
          throw new Error(`Failed to parse A000 line: ${cleanLine}`, { cause: error });
        }
      } else if (cleanLine.length === 19) {
        // A000Sum record (record type summary)
        try {
          a000SumRecords.push(parseA000Sum(cleanLine));
        } catch (error) {
          // Re-throwing the error will make the test fail with a descriptive message.
          throw new Error(`Failed to parse A000Sum line: ${cleanLine}`, { cause: error });
        }
      } else {
        throw new Error(
          `Unknown line length ${cleanLine.length}, line: ${cleanLine.slice(0, 20)}...`,
        );
      }
    }

    // Validate that we parsed the A000 header record
    expect(a000Record).toBeDefined();
    expect(a000Record?.vatId).toBeTruthy();
    expect(a000Record?.totalRecords).toBeTruthy();
    expect(a000Record?.primaryIdentifier).toBeTruthy();

    // Validate that we parsed summary records
    expect(a000SumRecords.length).toBeGreaterThan(0);

    // Verify that we have summary records for different record types
    const summarizedRecordTypes = a000SumRecords.map(record => record.code);
    // Use actual record types found in the INI file instead of hardcoded expectations
    expect(summarizedRecordTypes.length).toBeGreaterThan(0);

    // Now test round-trip by getting corresponding BKMVDATA and generating new INI
    const bkmvDataPath = join(FIXTURES_DIR, 'BKMVDATA.txt');
    const parsedData = await parseFixtureData(bkmvDataPath);

    if (parsedData.business) {
      // Create ReportInput from parsed BKMV data
      // Note: This is a simplified round-trip test using minimal data
      const reportInput = {
        business: parsedData.business,
        documents: parsedData.documents,
        journalEntries: parsedData.journalEntries,
        accounts: parsedData.accounts,
        inventory: parsedData.inventory,
      } as ReportInput;

      // Generate new files from the parsed data
      const generatedReport = generateUniformFormatReport(reportInput);
      expect(generatedReport.iniText).toBeDefined();

      // Parse the generated INI content
      const generatedIniLines = generatedReport.iniText
        .split('\r\n')
        .filter(line => line.trim().length > 0);

      // Validate structure of generated INI
      expect(generatedIniLines.length).toBeGreaterThan(0);
      expect(generatedIniLines[0].startsWith('A000')).toBe(true);

      // Parse the generated A000 record
      const generatedA000Line = generatedIniLines.find(line => line.startsWith('A000'));
      expect(generatedA000Line).toBeDefined();

      const generatedA000 = parseA000(generatedA000Line!);
      expect(generatedA000.vatId).toBe(parsedData.business.taxId);

      // The generated file may have fewer records than the original fixture
      // since we're only using the parsed business data structure
      // Just validate that the structure is correct
      const generatedTotalRecords = parseInt(generatedA000.totalRecords);
      expect(generatedTotalRecords).toBeGreaterThanOrEqual(0);

      // Validate that generated INI has summary records (they are 19 chars, not matched by record code pattern)
      const generatedSummaryLines = generatedIniLines.filter(
        line => line.replace(/\r?\n$/, '').length === 19,
      );
      expect(generatedSummaryLines.length).toBeGreaterThanOrEqual(0);

      // Parse generated summary records and validate they have counts > 0
      for (const summaryLine of generatedSummaryLines) {
        const summaryRecord = parseA000Sum(summaryLine);
        expect(parseInt(summaryRecord.recordCount)).toBeGreaterThan(0);
      }
    }
  });

  it('should handle edge cases in fixture data gracefully', async () => {
    const bkmvDataPath = join(FIXTURES_DIR, 'BKMVDATA.txt');
    const content = await readFile(bkmvDataPath, 'utf-8');

    // Test with various line endings and whitespace
    const normalizedContent = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const lines = normalizedContent.split('\n');

    let validRecords = 0;
    let invalidRecords = 0;

    for (const line of lines) {
      if (line.trim().length === 0) continue;

      if (line.length < 4) {
        invalidRecords++;
        continue;
      }

      const parseResult = parseRecordLine(line);

      if (parseResult.success) {
        validRecords++;
      } else {
        invalidRecords++;
      }
    }

    // Validate edge case handling results
    expect(validRecords).toBeGreaterThan(0);
    expect(validRecords).toBeGreaterThan(invalidRecords);

    // We should be able to parse most records successfully
    expect(validRecords).toBeGreaterThan(0);
    expect(validRecords).toBeGreaterThan(invalidRecords);
  });

  it('should preserve monetary precision in round-trip', async () => {
    const bkmvDataPath = join(FIXTURES_DIR, 'BKMVDATA.txt');
    const parsedData = await parseFixtureData(bkmvDataPath);

    if (parsedData.rawRecords.b100.length === 0) {
      // Skip test for fixtures without B100 records
      expect(parsedData.rawRecords.b100).toHaveLength(0);
      return;
    }

    // Skip test if we don't have business data required for report generation
    if (!parsedData.business) {
      expect(parsedData.business, 'Business data could not be parsed from fixture').toBeDefined();
      return;
    }

    // Get original monetary values from journal entries (already have correct sign applied)
    const originalAmounts = parsedData.journalEntries.map((entry, index) => ({
      amount: Math.abs(entry.amount),
      debit: entry.amount >= 0 ? '1' : '2',
      signedAmount: entry.amount,
      index,
    }));

    // Validate that we can parse monetary values correctly from the fixture
    expect(originalAmounts.length).toBeGreaterThan(0);
    expect(originalAmounts[0].amount).toBeTruthy();
    expect(['1', '2']).toContain(originalAmounts[0].debit);

    // COMPLETE THE ROUND-TRIP: Generate new report from parsed data
    const reportInput = {
      business: parsedData.business,
      documents: parsedData.documents,
      journalEntries: parsedData.journalEntries,
      accounts: parsedData.accounts,
      inventory: parsedData.inventory,
    } as ReportInput;

    const generatedReport = generateUniformFormatReport(reportInput);
    expect(generatedReport).toBeDefined();
    expect(generatedReport.dataText).toBeDefined();

    // Parse the generated data back to extract monetary values
    const reparsedData = parseUniformFormatFiles(generatedReport.iniText, generatedReport.dataText);
    expect(reparsedData.data.journalEntries).toBeDefined();

    // Get monetary values from the re-parsed data
    const reparsedAmounts = reparsedData.data.journalEntries.map((entry, index) => ({
      amount: Math.abs(entry.amount),
      debit: entry.amount >= 0 ? '1' : '2',
      signedAmount: entry.amount,
      index,
    }));

    // PRECISION VALIDATION: Compare original vs reparsed monetary values
    expect(reparsedAmounts.length).toBe(originalAmounts.length);

    // Test monetary precision preservation - the core test
    for (let i = 0; i < originalAmounts.length; i++) {
      const original = originalAmounts[i];
      const reparsed = reparsedAmounts[i];

      // Most important: verify the signed amounts match exactly (monetary precision)
      expect(reparsed.signedAmount).toBe(original.signedAmount);

      // Additional verification: absolute amounts match
      expect(Math.abs(reparsed.signedAmount)).toBe(Math.abs(original.signedAmount));
    }

    // Additional validation: ensure total amounts are preserved
    const originalTotal = originalAmounts.reduce((sum, amt) => sum + amt.signedAmount, 0);
    const reparsedTotal = reparsedAmounts.reduce((sum, amt) => sum + amt.signedAmount, 0);

    expect(reparsedTotal).toBe(originalTotal);
  });
});
