import { format } from 'date-fns';
import { EntryType, pcnGenerator } from '@accounter/pcn874-generator';
import { idValidator, yearMonthValidator } from '@shared/helpers';
import type { RawVatReportRecord } from './vat-report.helper';

type GeneratorParameters = Parameters<typeof pcnGenerator>;
type Header = GeneratorParameters[0];
type Transaction = GeneratorParameters[1][number];

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
      case EntryType.SALE_UNIDENTIFIED_ZERO_OR_EXEMPT: {
        salesRecordCount += 1;
        zeroValOrExemptSalesCount += t.invoiceSum;
        break;
      }
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

const transformTransactions = (vatRecords: RawVatReportRecord[]): ExtendedPCNTransaction[] => {
  const transactions: ExtendedPCNTransaction[] = [];
  for (const t of vatRecords) {
    if (!t.documentDate) {
      console.debug(`Document ${t.documentId} has no tax_invoice_date. Skipping it.`);
      continue;
    }
    let entryType = EntryType.INPUT_REGULAR;
    if (!t.isExpense) {
      if (Number(t.foreignVatAfterDeduction) > 0) {
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
      totalVat: Math.round(Math.abs(Number(t.foreignVatAfterDeduction ?? 0))),
      invoiceSum: Math.round(Number(t.localAmountBeforeVAT)),
      isProperty: t.isProperty,
    });
  }
  return transactions.sort((a, b) => a.invoiceDate.localeCompare(b.invoiceDate));
};

export const generatePcnFromCharges = (
  vatRecords: RawVatReportRecord[],
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
