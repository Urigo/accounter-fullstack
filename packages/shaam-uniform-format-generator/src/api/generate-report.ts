/**
 * Main API for generating SHAAM uniform format reports
 */

import { assembleFile } from '../generator/format/encoder.js';
import {
  encodeA000,
  encodeA000Sum,
  encodeA100,
  encodeB100,
  encodeB110,
  encodeC100,
  encodeD110,
  encodeD120,
  encodeM100,
  encodeZ900,
  type A000Input,
  type A000Sum as A000SumInput,
  type A100Input,
  type Z900Input,
} from '../generator/records/index.js';
import type {
  CountryCode,
  CurrencyCode,
  GenerationOptions,
  ReportInput,
  ReportOutput,
} from '../types/index.js';
import { ShaamFormatError } from '../validation/errors.js';
import { validateInput } from '../validation/validate-input.js';

/**
 * Generates SHAAM uniform format report files (INI.TXT and BKMVDATA.TXT)
 * from a high-level JSON input object.
 *
 * @param input - The report input data
 * @param options - Generation options
 * @returns Generated SHAAM format files and metadata
 */
export function generateUniformFormatReport(
  input: ReportInput,
  options: GenerationOptions = {},
): ReportOutput {
  // Validate input data first
  const validationMode = options.validationMode || 'fail-fast';
  const validationErrors = validateInput(input, validationMode);

  if (validationErrors.length > 0) {
    if (validationMode === 'fail-fast') {
      // This should have already thrown, but just in case
      throw new ShaamFormatError('Validation failed', validationErrors);
    }
    // For collect-all mode, we still throw if there are errors
    // The user can catch and inspect the errors if needed
    throw new ShaamFormatError('Input validation failed', validationErrors);
  }

  const records: string[] = [];
  const iniRecords: string[] = [];
  const recordCounts: Record<string, number> = {};
  let recordNumber = 1;

  // Helper function to count and add data record
  const addRecord = (recordType: string, recordContent: string) => {
    records.push(recordContent);
    recordCounts[recordType] = (recordCounts[recordType] || 0) + 1;
    recordNumber++;
  };

  // Helper function to add INI record
  const addIniRecord = (recordType: string, recordContent: string) => {
    iniRecords.push(recordContent);
    recordCounts[recordType] = (recordCounts[recordType] || 0) + 1;
  };

  // Calculate expected BKMVDATA record counts based on input data
  const expectedDataRecordCount =
    1 + // A100 record
    input.documents.length * 3 + // C100, D110, D120 for each document
    input.journalEntries.length + // B100 for each journal entry
    input.accounts.length + // B110 for each account
    input.inventory.length + // M100 for each inventory item
    1; // Z900 record

  // Generate A000 record for INI.TXT
  const fileHeaderRecord: A000Input = {
    totalRecords: expectedDataRecordCount.toString(), // Actual count of BKMVDATA records
    vatId: input.business.taxId,
    softwareRegNumber: '12345678', // TODO: Use actual software registration number
    softwareName: 'SHAAM Generator',
    softwareVersion: '1.0.0',
    vendorVatId: '123456782', // TODO: Use actual vendor VAT ID
    vendorName: 'Accounter',
    softwareType: '2', // Multi-year software
    fileOutputPath: options.fileNameBase || `C:\\OPENFRMT\\${input.business.taxId}.`,
    accountingType: '2', // Double-entry accounting
    balanceRequired: '2',
    companyRegId: '',
    withholdingFileNum: '',
    businessName: input.business.name,
    businessStreet: input.business.address?.street ?? '',
    businessHouseNum: input.business.address?.houseNumber ?? '',
    businessCity: input.business.address?.city ?? '',
    businessZip: input.business.address?.zip ?? '',
    taxYear: '    ', // YYYY format. not required for now
    startDate: input.business.reportingPeriod.startDate.replace(/-/g, ''),
    endDate: input.business.reportingPeriod.endDate.replace(/-/g, ''),
    processStartDate: new Date().toISOString().slice(0, 10).replace(/-/g, ''),
    processStartTime: new Date().toTimeString().slice(0, 5).replace(':', ''),
    languageCode: '0', // Hebrew
    characterEncoding: '1', // ISO-8859-8-i
    compressionSoftware: 'zip', // TODO:replace with a real compression software
    baseCurrency: 'ILS',
    branchInfoFlag: '0', // No branches for now
  };
  addIniRecord('A000', encodeA000(fileHeaderRecord));

  // Add A000Sum records for each record type to INI.TXT
  // Calculate expected counts based on input data
  const expectedCounts = {
    A100: 1,
    C100: input.documents.length,
    D110: input.documents.length,
    D120: input.documents.length,
    B100: input.journalEntries.length,
    B110: input.accounts.length,
    M100: input.inventory.length,
    Z900: 1,
  };

  // Add summary records for each record type
  for (const [recordType, count] of Object.entries(expectedCounts)) {
    if (count > 0) {
      const summaryRecord: A000SumInput = {
        code: recordType,
        recordCount: count.toString(),
      };
      addIniRecord('A000Sum', encodeA000Sum(summaryRecord));
    }
  }

  // 1. Business metadata - A100 record
  const businessMetadata: A100Input = {
    recordNumber,
    vatId: input.business.taxId,
    reserved: '',
  };
  addRecord('A100', encodeA100(businessMetadata));

  // TODO: 2. Summaries... (not implemented yet)

  // 3. For each document in input.documents
  for (const document of input.documents) {
    // Document header - C100 record
    const documentRecord = {
      code: 'C100' as const,
      recordNumber: recordNumber.toString(),
      vatId: input.business.taxId,
      documentType: document.type,
      documentId: document.id,
      documentIssueDate: document.date.replace(/-/g, ''), // Convert YYYY-MM-DD to YYYYMMDD
      documentIssueTime: '',
      customerName: '',
      customerStreet: '',
      customerHouseNumber: '',
      customerCity: '',
      customerPostCode: '',
      customerCountry: '',
      customerCountryCode: '',
      customerPhone: '',
      customerVatId: '',
      documentValueDate: '',
      foreignCurrencyAmount: '',
      currencyCode: '',
      amountBeforeDiscount: '',
      documentDiscount: '',
      amountAfterDiscountExcludingVat: '',
      vatAmount: '',
      amountIncludingVat: document.amount.toFixed(2), // Format as decimal with 2 places
      withholdingTaxAmount: '',
      customerKey: '',
      matchingField: '',
      cancelledAttribute1: '',
      cancelledDocument: '',
      cancelledAttribute2: '',
      documentDate: '',
      branchKey: '',
      cancelledAttribute3: '',
      actionExecutor: '',
      lineConnectingField: '',
      reserved: '',
    };
    addRecord('C100', encodeC100(documentRecord));

    // Document line - D110 record
    const documentLineRecord = {
      code: 'D110' as const,
      recordNumber: recordNumber.toString(),
      vatId: input.business.taxId,
      documentType: document.type,
      documentNumber: document.id,
      lineNumber: '1',
      baseDocumentType: '' as const,
      baseDocumentNumber: '',
      transactionType: '',
      internalCatalogCode: '',
      goodsServiceDescription: document.description || 'Item',
      manufacturerName: '',
      serialNumber: '',
      unitOfMeasureDescription: '',
      quantity: '1',
      unitPriceExcludingVat: '',
      lineDiscount: '',
      lineTotal: '',
      vatRatePercent: '',
      reserved1: '',
      branchId: '1',
      reserved2: '',
      documentDate: document.date.replace(/-/g, ''),
      headerLinkField: '',
      baseDocumentBranchId: '',
      reserved3: '',
    };
    addRecord('D110', encodeD110(documentLineRecord));

    // Payment record - D120 record (if applicable)
    const paymentRecord = {
      code: 'D120' as const,
      recordNumber: recordNumber.toString(),
      vatId: input.business.taxId,
      documentType: document.type,
      documentNumber: document.id,
      lineNumber: '1',
      paymentMethod: '1', // Default payment method
      bankNumber: '',
      branchNumber: '',
      accountNumber: '',
      checkNumber: '',
      paymentDueDate: '',
      lineAmount: document.amount.toFixed(2), // Format as decimal with 2 places
      acquirerCode: '',
      cardBrand: '',
      creditTransactionType: '',
      firstPaymentAmount: '',
      installmentsCount: '',
      additionalPaymentAmount: '',
      reserved1: '',
      branchId: '1',
      reserved2: '',
      documentDate: document.date.replace(/-/g, ''),
      headerLinkField: '',
      reserved: '',
    };
    addRecord('D120', encodeD120(paymentRecord));
  }

  // 4. Journal lines: for each entry and its lines
  for (const entry of input.journalEntries) {
    const journalRecord = {
      code: 'B100' as const,
      recordNumber,
      vatId: input.business.taxId,
      transactionNumber:
        entry.transactionNumber ?? parseInt(entry.id.replace(/\D/g, '') || '1', 10), // Use preserved value or extract from ID
      transactionLineNumber: entry.transactionLineNumber ?? 1,
      batchNumber: entry.batchNumber, // Use preserved batch number
      transactionType: entry.transactionType ?? '',
      referenceDocument: entry.referenceDocument ?? '',
      referenceDocumentType: entry.referenceDocumentType,
      referenceDocument2: entry.referenceDocument2 ?? '',
      referenceDocumentType2: entry.referenceDocumentType2,
      details: entry.description || '',
      date: entry.date.replace(/-/g, ''),
      valueDate: entry.valueDate ? entry.valueDate.replace(/-/g, '') : entry.date.replace(/-/g, ''), // Use preserved or fallback to date
      accountKey: entry.accountId,
      counterAccountKey: entry.counterAccountKey ?? '',
      debitCreditIndicator:
        entry.debitCreditIndicator ?? ((entry.amount >= 0 ? '1' : '2') as '1' | '2'),
      currencyCode: entry.currencyCode,
      transactionAmount: entry.transactionAmount ?? entry.amount, // Use signed value (reverted to preserve fixture behavior)
      foreignCurrencyAmount: entry.foreignCurrencyAmount, // Use preserved value as-is
      quantityField: entry.quantityField, // Use preserved value
      matchingField1: entry.matchingField1 ?? '',
      matchingField2: entry.matchingField2 ?? '',
      branchId: entry.branchId ?? '',
      entryDate: entry.entryDate ? entry.entryDate.replace(/-/g, '') : entry.date.replace(/-/g, ''), // Use preserved or fallback to date
      operatorUsername: entry.operatorUsername ?? '',
      reserved: entry.reserved ?? '',
    };
    addRecord('B100', encodeB100(journalRecord));
  }

  // 5. Accounts: B110 records
  for (const account of input.accounts) {
    const accountRecord = {
      code: 'B110' as const,
      recordNumber,
      vatId: input.business.taxId,
      accountKey: account.id,
      accountName: account.name,
      trialBalanceCode: account.sortCode.key,
      trialBalanceCodeDescription: account.sortCode.name,
      customerSupplierAddressStreet: account.address?.street,
      customerSupplierAddressHouseNumber: account.address?.houseNumber,
      customerSupplierAddressCity: account.address?.city,
      customerSupplierAddressZip: account.address?.zip,
      customerSupplierAddressCountry: account.address?.country,
      countryCode: account.countryCode as CountryCode, // Cast to CountryCodeEnum type
      parentAccountKey: account.parentAccountKey,
      accountOpeningBalance: account.accountOpeningBalance,
      totalDebits: account.totalDebits,
      totalCredits: account.totalCredits,
      accountingClassificationCode: account.accountingClassificationCode
        ? (() => {
            // Extract numeric part from alphanumeric code (e.g., 'A1100' -> 1100)
            const numericPart = account.accountingClassificationCode.replace(/\D/g, '');
            const parsed = parseInt(numericPart, 10);
            return Number.isNaN(parsed) ? undefined : Math.min(parsed, 9999); // Cap at max value
          })()
        : undefined,
      supplierCustomerTaxId: account.vatId
        ? (() => {
            // Remove all spaces and validate that only digits remain
            const digitsOnly = account.vatId.replace(/\s/g, '');
            if (digitsOnly && !/^\d+$/.test(digitsOnly)) {
              throw new Error(
                `Invalid vatId for account ${account.id}: "${account.vatId}" contains non-digit characters. Only digits and spaces are allowed.`,
              );
            }
            if (digitsOnly && digitsOnly.length > 0) {
              return digitsOnly.length > 9 ? digitsOnly.substring(0, 9) : digitsOnly;
            }
            return undefined;
          })()
        : undefined,
      branchId: account.branchId,
      openingBalanceForeignCurrency: account.openingBalanceForeignCurrency,
      foreignCurrencyCode: account.foreignCurrencyCode as CurrencyCode,
      reserved: undefined,
    };
    addRecord('B110', encodeB110(accountRecord));
  }

  // 6. Inventory: M100 records
  for (const item of input.inventory) {
    const inventoryRecord = {
      code: 'M100' as const,
      recordNumber: recordNumber.toString(),
      vatId: input.business.taxId,
      universalItemCode: '',
      supplierItemCode: '',
      internalItemCode: item.id,
      itemName: item.name,
      classificationCode: '',
      classificationDescription: '',
      unitOfMeasure: '',
      openingStock: '0',
      totalStockIn: '0',
      totalStockOut: item.quantity.toString(),
      endPeriodCostNonBonded: '',
      endPeriodCostBonded: '',
      reserved: '',
    };
    addRecord('M100', encodeM100(inventoryRecord));
  }

  // 7. Closing record: Z900
  const closingRecord: Z900Input = {
    recordNumber,
    vatId: input.business.taxId,
    totalRecords: records.length + 1, // Count of records before Z900 is added
    reserved: '',
  };
  addRecord('Z900', encodeZ900(closingRecord));

  // Build iniText and dataText using the assembler
  const iniText = assembleFile(iniRecords);
  const dataText = assembleFile(records);

  // Create virtual File objects
  const iniFile = new File([iniText], `${options.fileNameBase || 'report'}.INI.TXT`, {
    type: 'text/plain',
  });

  const dataFile = new File([dataText], `${options.fileNameBase || 'report'}.BKMVDATA.TXT`, {
    type: 'text/plain',
  });

  return {
    iniText,
    dataText,
    iniFile,
    dataFile,
    summary: {
      totalRecords: records.length + iniRecords.length,
      perType: recordCounts,
    },
  };
}
