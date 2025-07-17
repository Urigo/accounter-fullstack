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
import type { GenerationOptions, ReportInput, ReportOutput } from '../types/index.js';
import { ShaamFormatError } from '../validation/errors.js';
import { validateInput } from '../validation/validate-input.js';

/**
 * Generates SHAAM uniform format report files (INI.TXT and BKMVDATA.TXT)
 * from a high-level JSON input object.
 *
 * @param input - The report input data
 * @param options - Generation options
 * @returns Report output with generated file content
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

  // Generate A000 record for INI.TXT
  const fileHeaderRecord: A000Input = {
    reservedFuture: '',
    totalRecords: '0', // Will be updated later with actual count
    vatId: input.business.taxId,
    softwareRegNumber: '12345678', // TODO: Use actual software registration number
    softwareName: 'SHAAM Generator',
    softwareVersion: '1.0.0',
    vendorVatId: '123456789', // TODO: Use actual vendor VAT ID
    vendorName: 'Accounter',
    softwareType: '2', // Multi-year software
    fileOutputPath: options.fileNameBase || 'report',
    accountingType: '2', // Double-entry accounting
    balanceRequired: '1',
    companyRegId: '',
    withholdingFileNum: '',
    reserved1017: '',
    businessName: input.business.name,
    businessStreet: '',
    businessHouseNum: '',
    businessCity: '',
    businessZip: '',
    taxYear: '',
    startDate: input.business.reportingPeriod.startDate.replace(/-/g, ''),
    endDate: input.business.reportingPeriod.endDate.replace(/-/g, ''),
    processStartDate: new Date().toISOString().slice(0, 10).replace(/-/g, ''),
    processStartTime: new Date().toTimeString().slice(0, 5).replace(':', ''),
    languageCode: '0', // Hebrew
    characterEncoding: '1', // ISO-8859-8-i
    compressionSoftware: '',
    reserved1031: '',
    baseCurrency: 'ILS',
    reserved1033: '',
    branchInfoFlag: '0', // No branches for now
    reserved1035: '',
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
    recordNumber: recordNumber.toString(),
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
      recordNumber: recordNumber.toString(),
      vatId: input.business.taxId,
      transactionNumber: entry.id.replace(/\D/g, '') || '1', // Extract only digits, default to '1'
      transactionLineNumber: '1',
      batchNumber: '',
      transactionType: '',
      referenceDocument: '',
      referenceDocumentType: '' as const,
      referenceDocument2: '',
      referenceDocumentType2: '' as const,
      details: entry.description || '',
      date: entry.date.replace(/-/g, ''),
      valueDate: entry.date.replace(/-/g, ''), // Same as date for simplicity
      accountKey: entry.accountId,
      counterAccountKey: '',
      debitCreditIndicator: (entry.amount >= 0 ? '1' : '2') as '1' | '2',
      currencyCode: '',
      transactionAmount: Math.abs(entry.amount).toFixed(2), // Format as decimal with 2 places
      foreignCurrencyAmount: '',
      quantityField: '',
      matchingField1: '',
      matchingField2: '',
      branchId: '',
      entryDate: entry.date.replace(/-/g, ''),
      operatorUsername: '',
      reserved: '',
    };
    addRecord('B100', encodeB100(journalRecord));
  }

  // 5. Accounts: B110 records
  for (const account of input.accounts) {
    const accountRecord = {
      code: 'B110' as const,
      recordNumber: recordNumber.toString(),
      vatId: input.business.taxId,
      accountKey: account.name,
      accountName: account.id ?? '',
      trialBalanceCode: account.sortCode.key,
      trialBalanceCodeDescription: account.sortCode.name,
      customerSupplierAddressStreet: account.address?.street,
      customerSupplierAddressHouseNumber: account.address?.houseNumber,
      customerSupplierAddressCity: account.address?.city,
      customerSupplierAddressZip: account.address?.zip,
      customerSupplierAddressCountry: account.address?.country,
      countryCode: account.countryCode,
      parentAccountKey: account.parentAccountKey,
      accountOpeningBalance: account.accountOpeningBalance,
      totalDebits: account.totalDebits,
      totalCredits: account.totalCredits,
      accountingClassificationCode: account.accountingClassificationCode,
      supplierCustomerTaxId: account.vatId,
      branchId: account.branchId,
      openingBalanceForeignCurrency: account.openingBalanceForeignCurrency,
      foreignCurrencyCode: account.foreignCurrencyCode,
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
    recordNumber: recordNumber.toString(),
    vatId: input.business.taxId,
    totalRecords: records.length.toString(), // Count of records before Z900 is added
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
