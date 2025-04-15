import { HeaderStrict, TransactionStrict } from '../schemas.js';

const HEADER_REPORT_TYPE = 1;
const HEADER_TAXABLE_DIFFERENT_RATE_SALES = '+00000000000';
const HEADER_TAXABLE_DIFFERENT_RATE_SALES_VAT = '+000000000';

export const headerBuilder = (header: HeaderStrict): string => {
  const {
    licensedDealerId,
    generationDate,
    reportMonth,
    taxableSalesAmount,
    taxableSalesVat,
    salesRecordCount,
    zeroValOrExemptSalesCount,
    otherInputsVat,
    equipmentInputsVat,
    inputsCount,
    totalVat,
  } = header;

  return `O${licensedDealerId}${reportMonth}${HEADER_REPORT_TYPE}${generationDate}${taxableSalesAmount}${taxableSalesVat}${HEADER_TAXABLE_DIFFERENT_RATE_SALES}${HEADER_TAXABLE_DIFFERENT_RATE_SALES_VAT}${salesRecordCount}${zeroValOrExemptSalesCount}${otherInputsVat}${equipmentInputsVat}${inputsCount}${totalVat}`;
};

export const transactionBuilder = (transaction: TransactionStrict): string => {
  const {
    entryType,
    vatId,
    invoiceDate,
    refGroup,
    refNumber,
    totalVat,
    invoiceSum,
    allocationNumber,
  } = transaction;

  return `\n${entryType}${vatId}${invoiceDate}${refGroup}${refNumber}${totalVat}${invoiceSum}${allocationNumber}`;
};

export const footerBuilder = (header: HeaderStrict): string => {
  return `\nX${header.licensedDealerId}`;
};
