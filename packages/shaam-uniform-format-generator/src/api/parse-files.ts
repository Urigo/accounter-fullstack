/**
 * API for parsing SHAAM uniform format files
 */

import { z } from 'zod';
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
} from '../generator/records/index.js';
import type {
  Account,
  Document,
  InventoryItem,
  JournalEntry,
  ReportInput,
} from '../types/index.js';
import {
  AccountSchema,
  BusinessMetadataSchema,
  DocumentSchema,
  InventoryItemSchema,
  JournalEntrySchema,
} from '../types/index.js';

// Validation mode enum
export type ValidationMode = 'strict' | 'lenient' | 'none';

// Validation error type
export interface ValidationError {
  recordType: string;
  recordIndex: number;
  field: string;
  message: string;
  severity: 'error' | 'warning';
}

// Parse options
export interface ParseOptions {
  validationMode?: ValidationMode;
  skipUnknownRecords?: boolean;
  allowPartialData?: boolean;
}

// Parse result with validation summary
export interface ParseResult {
  data: ReportInput;
  summary: {
    totalRecords: number;
    perType: Record<string, number>;
    errors: ValidationError[];
    crossValidationPassed: boolean;
  };
}

// Internal parsed data structure for validation
interface ParsedFileData {
  iniData: {
    a000: ReturnType<typeof parseA000> | null;
    a000Sum: ReturnType<typeof parseA000Sum>[];
  };
  dataRecords: {
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

/**
 * Parses SHAAM uniform format files (INI.TXT and BKMVDATA.TXT)
 * back into structured JSON objects with comprehensive validation.
 *
 * @param iniContent - Content of the INI.TXT file
 * @param dataContent - Content of the BKMVDATA.TXT file
 * @param options - Parse options for validation and error handling
 * @returns Parsed report input data with validation summary
 */
export function parseUniformFormatFiles(
  iniContent: string,
  dataContent: string,
  options: ParseOptions = {},
): ParseResult {
  const {
    validationMode = 'lenient',
    skipUnknownRecords = true,
    allowPartialData = true,
  } = options;

  const errors: ValidationError[] = [];
  const recordCounts: Record<string, number> = {};

  // Parse files independently
  const parsedData = parseFilesSeparately(iniContent, dataContent, errors, recordCounts, {
    validationMode,
    skipUnknownRecords,
  });

  // Convert parsed records to structured data
  const structuredData = convertToStructuredData(parsedData, errors, validationMode);

  // Perform individual validation
  performIndividualValidation(structuredData, errors, validationMode);

  // Perform cross-validation
  const crossValidationPassed = performCrossValidation(
    parsedData,
    structuredData,
    errors,
    validationMode,
  );

  // Handle validation errors based on mode
  if (
    validationMode === 'strict' &&
    errors.some(e => e.severity === 'error') &&
    !allowPartialData
  ) {
    throw new Error(`Validation failed: ${errors.map(e => e.message).join(', ')}`);
  }

  const totalRecords = Object.values(recordCounts).reduce((sum, count) => sum + count, 0);

  return {
    data: structuredData,
    summary: {
      totalRecords,
      perType: recordCounts,
      errors,
      crossValidationPassed,
    },
  };
}

/**
 * Parse INI and data files separately and extract all records
 */
function parseFilesSeparately(
  iniContent: string,
  dataContent: string,
  errors: ValidationError[],
  recordCounts: Record<string, number>,
  options: { validationMode: ValidationMode; skipUnknownRecords: boolean },
): ParsedFileData {
  const parsedData: ParsedFileData = {
    iniData: {
      a000: null,
      a000Sum: [],
    },
    dataRecords: {
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

  // Parse INI file
  const iniLines = iniContent.split('\n').filter(line => line.trim().length > 0);
  for (let i = 0; i < iniLines.length; i++) {
    const line = iniLines[i];
    if (line.length < 4) continue;

    const recordType = line.substring(0, 4);
    const cleanLine = line.replace(/\r?\n?$/, '').replace(/\r$/, '');

    try {
      if (recordType === 'A000') {
        parsedData.iniData.a000 = parseA000(cleanLine);
        recordCounts['A000'] = (recordCounts['A000'] || 0) + 1;
      } else if (cleanLine.length === 19) {
        // A000Sum records
        const summaryRecord = parseA000Sum(cleanLine);
        parsedData.iniData.a000Sum.push(summaryRecord);
        recordCounts['A000Sum'] = (recordCounts['A000Sum'] || 0) + 1;
      } else if (!options.skipUnknownRecords) {
        errors.push({
          recordType: 'UNKNOWN_INI',
          recordIndex: i,
          field: 'recordType',
          message: `Unknown INI record type: ${recordType}`,
          severity: options.validationMode === 'strict' ? 'error' : 'warning',
        });
      }
    } catch (error) {
      errors.push({
        recordType,
        recordIndex: i,
        field: 'parsing',
        message: `Failed to parse ${recordType} record: ${error instanceof Error ? error.message : 'Unknown error'}`,
        severity: 'error',
      });
    }
  }

  // Parse data file
  const dataLines = dataContent.split('\n').filter(line => line.trim().length > 0);
  for (let i = 0; i < dataLines.length; i++) {
    const line = dataLines[i];
    if (line.length < 4) continue;

    const recordType = line.substring(0, 4);
    const cleanLine = line.replace(/\r?\n?$/, '').replace(/\r$/, '');

    try {
      switch (recordType) {
        case 'A100':
          parsedData.dataRecords.a100 = parseA100(cleanLine);
          recordCounts['A100'] = (recordCounts['A100'] || 0) + 1;
          break;
        case 'B100':
          parsedData.dataRecords.b100.push(parseB100(cleanLine));
          recordCounts['B100'] = (recordCounts['B100'] || 0) + 1;
          break;
        case 'B110':
          parsedData.dataRecords.b110.push(parseB110(cleanLine));
          recordCounts['B110'] = (recordCounts['B110'] || 0) + 1;
          break;
        case 'C100':
          parsedData.dataRecords.c100.push(parseC100(cleanLine));
          recordCounts['C100'] = (recordCounts['C100'] || 0) + 1;
          break;
        case 'D110':
          parsedData.dataRecords.d110.push(parseD110(cleanLine));
          recordCounts['D110'] = (recordCounts['D110'] || 0) + 1;
          break;
        case 'D120':
          parsedData.dataRecords.d120.push(parseD120(cleanLine));
          recordCounts['D120'] = (recordCounts['D120'] || 0) + 1;
          break;
        case 'M100':
          parsedData.dataRecords.m100.push(parseM100(cleanLine));
          recordCounts['M100'] = (recordCounts['M100'] || 0) + 1;
          break;
        case 'Z900':
          parsedData.dataRecords.z900 = parseZ900(cleanLine);
          recordCounts['Z900'] = (recordCounts['Z900'] || 0) + 1;
          break;
        default:
          if (!options.skipUnknownRecords) {
            errors.push({
              recordType: 'UNKNOWN_DATA',
              recordIndex: i,
              field: 'recordType',
              message: `Unknown data record type: ${recordType}`,
              severity: options.validationMode === 'strict' ? 'error' : 'warning',
            });
          }
          break;
      }
    } catch (error) {
      errors.push({
        recordType,
        recordIndex: i,
        field: 'parsing',
        message: `Failed to parse ${recordType} record: ${error instanceof Error ? error.message : 'Unknown error'}`,
        severity: 'error',
      });
    }
  }

  return parsedData;
}

/**
 * Convert parsed records to structured ReportInput format
 */
function convertToStructuredData(
  parsedData: ParsedFileData,
  errors: ValidationError[],
  validationMode: ValidationMode,
): ReportInput {
  const result: ReportInput = {
    business: {
      businessId: 'unknown',
      name: 'Unknown Business',
      taxId: '000000000',
      reportingPeriod: {
        startDate: '2024-01-01',
        endDate: '2024-12-31',
      },
    },
    documents: [],
    journalEntries: [],
    accounts: [],
    inventory: [],
  };

  // Extract business metadata from A000 or A100
  if (parsedData.iniData.a000) {
    const a000 = parsedData.iniData.a000;
    result.business = {
      businessId: a000.primaryIdentifier,
      name: a000.businessName || 'Unknown Business',
      taxId: a000.vatId,
      reportingPeriod: {
        startDate: a000.startDate ? formatDateFromShaam(a000.startDate) : '2024-01-01',
        endDate: a000.endDate ? formatDateFromShaam(a000.endDate) : '2024-12-31',
      },
    };
  } else if (parsedData.dataRecords.a100) {
    const a100 = parsedData.dataRecords.a100;
    result.business = {
      ...result.business,
      businessId: a100.primaryIdentifier.toString(),
      taxId: a100.vatId,
    };
  }

  // Convert journal entries
  for (const b100 of parsedData.dataRecords.b100) {
    try {
      const journalEntry: JournalEntry = {
        id: `JE_${b100.transactionNumber.toString()}`,
        date: formatDateFromShaam(b100.date),
        amount: b100.transactionAmount * (b100.debitCreditIndicator === '1' ? 1 : -1),
        accountId: b100.accountKey,
        description: b100.details || 'Journal Entry',
      };
      result.journalEntries.push(journalEntry);
    } catch (error) {
      errors.push({
        recordType: 'B100',
        recordIndex: result.journalEntries.length,
        field: 'conversion',
        message: `Failed to convert B100 to JournalEntry: ${error instanceof Error ? error.message : 'Unknown error'}`,
        severity: validationMode === 'strict' ? 'error' : 'warning',
      });
    }
  }

  // Convert accounts
  for (const b110 of parsedData.dataRecords.b110) {
    try {
      const account: Account = {
        id: b110.accountKey,
        name: b110.accountName?.trim() || `Account ${b110.accountKey}`,
        sortCode: {
          key: b110.trialBalanceCode || 'Other',
          name: b110.trialBalanceCodeDescription || 'Other',
        },
        accountOpeningBalance: b110.accountOpeningBalance,
        // Include extended fields if available
        countryCode: b110.countryCode,
        parentAccountKey: b110.parentAccountKey,
        vatId: b110.supplierCustomerTaxId,
        totalDebits: b110.totalDebits,
        totalCredits: b110.totalCredits,
        accountingClassificationCode: b110.accountingClassificationCode?.toString(),
        branchId: b110.branchId,
        openingBalanceForeignCurrency: b110.openingBalanceForeignCurrency,
        foreignCurrencyCode: b110.foreignCurrencyCode,
      };

      // Add address if available
      if (
        b110.customerSupplierAddressStreet ||
        b110.customerSupplierAddressCity ||
        b110.customerSupplierAddressZip ||
        b110.customerSupplierAddressCountry
      ) {
        account.address = {
          street: b110.customerSupplierAddressStreet,
          houseNumber: b110.customerSupplierAddressHouseNumber,
          city: b110.customerSupplierAddressCity,
          zip: b110.customerSupplierAddressZip,
          country: b110.customerSupplierAddressCountry,
        };
      }

      result.accounts.push(account);
    } catch (error) {
      errors.push({
        recordType: 'B110',
        recordIndex: result.accounts.length,
        field: 'conversion',
        message: `Failed to convert B110 to Account: ${error instanceof Error ? error.message : 'Unknown error'}`,
        severity: validationMode === 'strict' ? 'error' : 'warning',
      });
    }
  }

  // Convert documents
  for (const c100 of parsedData.dataRecords.c100) {
    try {
      const document: Document = {
        id: c100.documentId,
        type: c100.documentType,
        date: formatDateFromShaam(c100.documentIssueDate),
        amount: parseFloat(c100.amountIncludingVat || '0'),
        description: c100.customerName || 'Document',
      };
      result.documents.push(document);
    } catch (error) {
      errors.push({
        recordType: 'C100',
        recordIndex: result.documents.length,
        field: 'conversion',
        message: `Failed to convert C100 to Document: ${error instanceof Error ? error.message : 'Unknown error'}`,
        severity: validationMode === 'strict' ? 'error' : 'warning',
      });
    }
  }

  // Convert inventory
  for (const m100 of parsedData.dataRecords.m100) {
    try {
      const inventoryItem: InventoryItem = {
        id: m100.internalItemCode,
        name: m100.itemName,
        quantity: parseInt(m100.totalStockOut || '0', 10),
        unitPrice: 0, // M100 doesn't have unit price directly, defaulting to 0
      };
      result.inventory.push(inventoryItem);
    } catch (error) {
      errors.push({
        recordType: 'M100',
        recordIndex: result.inventory.length,
        field: 'conversion',
        message: `Failed to convert M100 to InventoryItem: ${error instanceof Error ? error.message : 'Unknown error'}`,
        severity: validationMode === 'strict' ? 'error' : 'warning',
      });
    }
  }

  return result;
}

/**
 * Perform individual validation using Zod schemas
 */
function performIndividualValidation(
  data: ReportInput,
  errors: ValidationError[],
  validationMode: ValidationMode,
): void {
  if (validationMode === 'none') return;

  // Validate business metadata
  try {
    BusinessMetadataSchema.parse(data.business);
  } catch (error) {
    if (error instanceof z.ZodError) {
      for (const issue of error.issues) {
        errors.push({
          recordType: 'BusinessMetadata',
          recordIndex: 0,
          field: issue.path.join('.'),
          message: issue.message,
          severity: validationMode === 'strict' ? 'error' : 'warning',
        });
      }
    }
  }

  // Validate documents
  for (let i = 0; i < data.documents.length; i++) {
    try {
      DocumentSchema.parse(data.documents[i]);
    } catch (error) {
      if (error instanceof z.ZodError) {
        for (const issue of error.issues) {
          errors.push({
            recordType: 'Document',
            recordIndex: i,
            field: issue.path.join('.'),
            message: issue.message,
            severity: validationMode === 'strict' ? 'error' : 'warning',
          });
        }
      }
    }
  }

  // Validate journal entries
  for (let i = 0; i < data.journalEntries.length; i++) {
    try {
      JournalEntrySchema.parse(data.journalEntries[i]);
    } catch (error) {
      if (error instanceof z.ZodError) {
        for (const issue of error.issues) {
          errors.push({
            recordType: 'JournalEntry',
            recordIndex: i,
            field: issue.path.join('.'),
            message: issue.message,
            severity: validationMode === 'strict' ? 'error' : 'warning',
          });
        }
      }
    }
  }

  // Validate accounts
  for (let i = 0; i < data.accounts.length; i++) {
    try {
      AccountSchema.parse(data.accounts[i]);
    } catch (error) {
      if (error instanceof z.ZodError) {
        for (const issue of error.issues) {
          errors.push({
            recordType: 'Account',
            recordIndex: i,
            field: issue.path.join('.'),
            message: issue.message,
            severity: validationMode === 'strict' ? 'error' : 'warning',
          });
        }
      }
    }
  }

  // Validate inventory
  for (let i = 0; i < data.inventory.length; i++) {
    try {
      InventoryItemSchema.parse(data.inventory[i]);
    } catch (error) {
      if (error instanceof z.ZodError) {
        for (const issue of error.issues) {
          errors.push({
            recordType: 'InventoryItem',
            recordIndex: i,
            field: issue.path.join('.'),
            message: issue.message,
            severity: validationMode === 'strict' ? 'error' : 'warning',
          });
        }
      }
    }
  }
}

/**
 * Perform cross-validation between INI and data files
 */
function performCrossValidation(
  parsedData: ParsedFileData,
  structuredData: ReportInput,
  errors: ValidationError[],
  validationMode: ValidationMode,
): boolean {
  if (validationMode === 'none') return true;

  let crossValidationPassed = true;

  // Validate record counts from A000Sum against actual data
  for (const summaryRecord of parsedData.iniData.a000Sum) {
    const expectedCount = parseInt(summaryRecord.recordCount);
    let actualCount = 0;

    switch (summaryRecord.code) {
      case 'A100':
        actualCount = parsedData.dataRecords.a100 ? 1 : 0;
        break;
      case 'B100':
        actualCount = parsedData.dataRecords.b100.length;
        break;
      case 'B110':
        actualCount = parsedData.dataRecords.b110.length;
        break;
      case 'C100':
        actualCount = parsedData.dataRecords.c100.length;
        break;
      case 'D110':
        actualCount = parsedData.dataRecords.d110.length;
        break;
      case 'D120':
        actualCount = parsedData.dataRecords.d120.length;
        break;
      case 'M100':
        actualCount = parsedData.dataRecords.m100.length;
        break;
      case 'Z900':
        actualCount = parsedData.dataRecords.z900 ? 1 : 0;
        break;
      default:
        // Unknown record type in summary
        errors.push({
          recordType: 'A000Sum',
          recordIndex: 0,
          field: 'code',
          message: `Unknown record type in summary: ${summaryRecord.code}`,
          severity: validationMode === 'strict' ? 'error' : 'warning',
        });
        crossValidationPassed = false;
        continue;
    }

    if (expectedCount !== actualCount) {
      errors.push({
        recordType: 'CrossValidation',
        recordIndex: 0,
        field: `${summaryRecord.code}_count`,
        message: `Record count mismatch for ${summaryRecord.code}: expected ${expectedCount}, found ${actualCount}`,
        severity: validationMode === 'strict' ? 'error' : 'warning',
      });
      crossValidationPassed = false;
    }
  }

  // Validate Z900 total records count
  if (parsedData.dataRecords.z900) {
    const z900TotalRecords = parsedData.dataRecords.z900.totalRecords;
    const actualDataRecords =
      (parsedData.dataRecords.a100 ? 1 : 0) +
      parsedData.dataRecords.b100.length +
      parsedData.dataRecords.b110.length +
      parsedData.dataRecords.c100.length +
      parsedData.dataRecords.d110.length +
      parsedData.dataRecords.d120.length +
      parsedData.dataRecords.m100.length;
    // Z900 doesn't count itself

    if (z900TotalRecords !== actualDataRecords) {
      errors.push({
        recordType: 'CrossValidation',
        recordIndex: 0,
        field: 'z900_total_records',
        message: `Z900 total records mismatch: expected ${z900TotalRecords}, found ${actualDataRecords}`,
        severity: validationMode === 'strict' ? 'error' : 'warning',
      });
      crossValidationPassed = false;
    }
  }

  // Validate business data consistency between A000 and A100
  if (parsedData.iniData.a000 && parsedData.dataRecords.a100) {
    const a000 = parsedData.iniData.a000;
    const a100 = parsedData.dataRecords.a100;

    if (a000.vatId !== a100.vatId) {
      errors.push({
        recordType: 'CrossValidation',
        recordIndex: 0,
        field: 'vat_id_consistency',
        message: `VAT ID mismatch between A000 (${a000.vatId}) and A100 (${a100.vatId})`,
        severity: validationMode === 'strict' ? 'error' : 'warning',
      });
      crossValidationPassed = false;
    }
  }

  return crossValidationPassed;
}

/**
 * Formats a SHAAM date string (YYYYMMDD) to ISO format (YYYY-MM-DD)
 */
function formatDateFromShaam(shaamDate: string): string {
  if (!shaamDate || shaamDate.length !== 8) {
    return '2024-01-01'; // Default fallback
  }

  const year = shaamDate.substring(0, 4);
  const month = shaamDate.substring(4, 6);
  const day = shaamDate.substring(6, 8);

  return `${year}-${month}-${day}`;
}
