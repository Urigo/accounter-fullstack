import { format } from 'date-fns';
import { pcnGenerator } from '@accounter-toolkit/pcn874-generator';
import {
  EntryType,
  Header,
  Transaction,
} from '@accounter-toolkit/pcn874-generator/typings/types.js';
import { idValidator, yearMonthValidator } from '@shared/helpers';
import type { RawVatReportRecord2 } from './vat-report.helper';

export type ExtendedPCNTransaction = Omit<Transaction, 'totalVat'> &
  Required<Pick<Transaction, 'totalVat'>> & { isProperty: boolean };

const headerPropsFromTransactions = (
  transactions: ExtendedPCNTransaction[],
  licensedDealerId: string,
  reportMonth = '',
  generationDate?: string,
) => {
  let derivedReportMonth: string = reportMonth;
  let taxableSalesAmount = 0;
  let taxableSalesVat = 0;
  let salesRecordCount = 0;
  let zeroValOrExemptSalesCount = 0;
  let otherInputsVat = 0;
  let equipmentInputsVat = 0;
  let inputsCount = 0;
  let totalVat = 0;

  for (const t of transactions) {
    switch (t.entryType) {
      case EntryType.SALE_REGULAR: {
        taxableSalesVat += t.totalVat;
        taxableSalesAmount += t.invoiceSum;
        salesRecordCount += 1;
        break;
      }
      // case EntryType.SALE_ZERO_OR_EXEMPT: {
      //   break;
      // }
      // case EntryType.SALE_UNIDENTIFIED_CUSTOMER: {
      //   break;
      // }
      case EntryType.SALE_UNIDENTIFIED_ZERO_OR_EXEMPT: {
        salesRecordCount += 1;
        zeroValOrExemptSalesCount += t.invoiceSum;
        break;
      }
      // case EntryType.SALE_SELF_INVOICE: {
      //   break;
      // }
      // case EntryType.SALE_EXPORT: {
      //   break;
      // }
      // case EntryType.SALE_PALESTINIAN_CUSTOMER: {
      //   break;
      // }
      case EntryType.INPUT_REGULAR: {
        if (t.isProperty) {
          equipmentInputsVat += t.totalVat;
        } else {
          otherInputsVat += t.totalVat;
        }
        inputsCount += 1;
        break;
      }
      case EntryType.INPUT_PETTY_CASH: {
        if (t.isProperty) {
          equipmentInputsVat += t.totalVat;
        } else {
          otherInputsVat += t.totalVat;
        }
        inputsCount += 1;
        break;
      }
      // case EntryType.INPUT_IMPORT: {
      //   break;
      // }
      // case EntryType.INPUT_PALESTINIAN_SUPPLIER: {
      //   break;
      // }
      // case EntryType.INPUT_SINGLE_DOC_BY_LAW: {
      //   break;
      // }
      // case EntryType.INPUT_SELF_INVOICE: {
      //   break;
      // }
      default: {
        console.debug(`Transaction EntryType  ${t.entryType} is not implemented yet`);
      }
    }

    if (t.invoiceDate.substring(0, 6) > derivedReportMonth) {
      derivedReportMonth = t.invoiceDate.substring(0, 6);
    }
  }

  totalVat = taxableSalesVat - otherInputsVat - equipmentInputsVat;

  const header: Header = {
    licensedDealerId,
    reportMonth: reportMonth || derivedReportMonth,
    generationDate,
    taxableSalesAmount,
    taxableSalesVat,
    salesRecordCount,
    zeroValOrExemptSalesCount,
    otherInputsVat,
    equipmentInputsVat,
    inputsCount,
    totalVat,
  };

  return header;
};

const transformTransactions = (dbTransactions: RawVatReportRecord2[]): ExtendedPCNTransaction[] => {
  const transactions: ExtendedPCNTransaction[] = [];
  for (const t of dbTransactions) {
    if (!t.documentDate) {
      console.debug(`Document ${t.documentId} has no tax_invoice_date. Skipping it.`);
      continue;
    }
    const amountToUse = (t.isExpense ? '-' : '') + t.documentAmount;
    let entryType = EntryType.INPUT_REGULAR;
    if (Number(amountToUse) > 0) {
      if (Number(t.vatAfterDeduction) > 0) {
        entryType = EntryType.SALE_REGULAR;
      } else {
        entryType = EntryType.SALE_UNIDENTIFIED_ZERO_OR_EXEMPT;
      }
    }

    transactions.push({
      entryType,
      vatId: t.vatNumber ?? '0',
      invoiceDate: format(new Date(t.documentDate!), 'yyyyMMdd'),
      refGroup: '0000',
      refNumber: t.documentSerial ?? undefined,
      totalVat: Math.round(Math.abs(Number(t.vatAfterDeduction ?? 0))),
      invoiceSum: Math.round(Math.abs(Number(t.amountBeforeVAT))),
      isProperty: t.isProperty,
    });
  }
  return transactions;
};

export const generatePcnFromCharges = (
  vatRecords: RawVatReportRecord2[],
  vatNumber: string,
  reportMonth: string,
) => {
  if (!yearMonthValidator(reportMonth)) {
    throw new Error(
      `Expected reportMonth to be legit date formed as YYYYMM, received "${reportMonth}"`,
    );
  }

  if (!idValidator(vatNumber, 9)) {
    throw new Error(`Expected vatNumber to be 9 digits, received "${vatNumber}"`);
  }

  const transactions = transformTransactions(vatRecords);

  const header = headerPropsFromTransactions(transactions, vatNumber, reportMonth);

  const reportContent = pcnGenerator(header, transactions, { strict: false });

  const fileName = `pcn874_${vatNumber}_${reportMonth}.txt`;

  return { reportContent, fileName };
};
