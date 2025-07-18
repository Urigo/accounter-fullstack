/**
 * API for parsing SHAAM uniform format files
 */

import {
  parseA000,
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

/**
 * Parses SHAAM uniform format files (INI.TXT and BKMVDATA.TXT)
 * back into structured JSON objects.
 *
 * @param iniContent - Content of the INI.TXT file
 * @param dataContent - Content of the BKMVDATA.TXT file
 * @returns Parsed report input data
 */
export function parseUniformFormatFiles(iniContent: string, dataContent: string): ReportInput {
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

  // Parse INI file for business metadata
  const iniLines = iniContent.split('\n').filter(line => line.trim().length > 0);
  for (const line of iniLines) {
    if (line.length < 4) continue;

    const recordType = line.substring(0, 4);
    const cleanLine = line.replace(/\r?\n?$/, '').replace(/\r$/, '');

    try {
      if (recordType === 'A000') {
        const a000 = parseA000(cleanLine);
        result.business = {
          businessId: a000.primaryIdentifier,
          name: a000.businessName || 'Unknown Business',
          taxId: a000.vatId,
          reportingPeriod: {
            startDate: a000.startDate ? formatDateFromShaam(a000.startDate) : '2024-01-01',
            endDate: a000.endDate ? formatDateFromShaam(a000.endDate) : '2024-12-31',
          },
        };
      }
    } catch {
      // Skip parsing errors for invalid lines
      // Error is intentionally ignored as we continue processing other lines
    }
  }

  // Parse data file for records
  const dataLines = dataContent.split('\n').filter(line => line.trim().length > 0);
  for (const line of dataLines) {
    if (line.length < 4) continue;

    const recordType = line.substring(0, 4);
    const cleanLine = line.replace(/\r?\n?$/, '').replace(/\r$/, '');

    try {
      switch (recordType) {
        case 'A100': {
          const a100 = parseA100(cleanLine);
          // Update business info if not already set from A000
          if (result.business.businessId === 'unknown') {
            result.business = {
              ...result.business,
              businessId: a100.primaryIdentifier,
              taxId: a100.vatId,
            };
          }
          break;
        }

        case 'B100': {
          const b100 = parseB100(cleanLine);
          const journalEntry: JournalEntry = {
            id: `JE_${b100.transactionNumber}`,
            date: formatDateFromShaam(b100.date),
            amount:
              parseFloat(b100.transactionAmount) * (b100.debitCreditIndicator === '1' ? 1 : -1),
            accountId: b100.accountKey,
            description: b100.details || 'Journal Entry',
          };
          result.journalEntries.push(journalEntry);
          break;
        }

        case 'B110': {
          const b110 = parseB110(cleanLine);
          const account: Account = {
            id: b110.accountKey,
            name: b110.accountName?.trim() || `Account ${b110.accountKey}`,
            sortCode: {
              key: b110.trialBalanceCode || 'Other',
              name: b110.trialBalanceCodeDescription || 'Other',
            },
            balance: b110.accountOpeningBalance ?? 0,
            // Include extended fields if available
            countryCode: b110.countryCode,
            parentAccountKey: b110.parentAccountKey,
            vatId: b110.supplierCustomerTaxId,
            accountOpeningBalance: b110.accountOpeningBalance,
            totalDebits: b110.totalDebits,
            totalCredits: b110.totalCredits,
            accountingClassificationCode: b110.accountingClassificationCode,
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
          break;
        }

        case 'C100': {
          const c100 = parseC100(cleanLine);
          const document: Document = {
            id: c100.documentId,
            type: c100.documentType,
            date: formatDateFromShaam(c100.documentIssueDate),
            amount: parseFloat(c100.amountIncludingVat || '0'),
            description: c100.customerName || 'Document',
          };
          result.documents.push(document);
          break;
        }

        case 'D110': {
          // D110 records contain detailed transaction data but don't directly map to our ReportInput structure
          // They provide additional details for existing journal entries
          parseD110(cleanLine); // Parse for validation but don't store
          break;
        }

        case 'D120': {
          // D120 records contain transaction line details but don't directly map to our ReportInput structure
          parseD120(cleanLine); // Parse for validation but don't store
          break;
        }

        case 'M100': {
          const m100 = parseM100(cleanLine);
          const inventoryItem: InventoryItem = {
            id: m100.internalItemCode,
            name: m100.itemName,
            quantity: parseInt(m100.totalStockOut || '0', 10),
            unitPrice: 0, // M100 doesn't have unit price directly, defaulting to 0
          };
          result.inventory.push(inventoryItem);
          break;
        }

        case 'Z900': {
          // Z900 is the end record, parse for validation but don't store
          parseZ900(cleanLine);
          break;
        }

        default:
          // Skip unknown record types
          break;
      }
    } catch {
      // Log parsing errors but continue processing
      // Error is intentionally ignored as we continue processing other lines
    }
  }

  return result;
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
