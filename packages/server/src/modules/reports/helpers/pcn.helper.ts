import { format, startOfMonth } from 'date-fns';
import { EntryType, pcnGenerator } from '@accounter/pcn874-generator';
import type { Pcn874RecordType } from '../../../__generated__/types.js';
import {
  dateToTimelessDateString,
  idValidator,
  yearMonthValidator,
} from '../../../shared/helpers/index.js';
import { TimelessDateString } from '../../../shared/types/index.js';
import { BusinessesProvider } from '../../financial-entities/providers/businesses.provider.js';
import { getVatRecords } from '../resolvers/get-vat-records.resolver.js';
import type { RawVatReportRecord } from './vat-report.helper.js';

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
    const invoiceSumFactor = t.invoiceSum >= 0 ? 1 : -1;
    switch (t.entryType) {
      case EntryType.SALE_REGULAR: {
        taxableSalesVat += t.totalVat * invoiceSumFactor;
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
          equipmentInputsVat += t.totalVat * invoiceSumFactor;
        } else {
          otherInputsVat += t.totalVat * invoiceSumFactor;
        }
        inputsCount += 1;
        break;
      }
      case EntryType.INPUT_PETTY_CASH: {
        if (t.isProperty) {
          equipmentInputsVat += t.totalVat * invoiceSumFactor;
        } else {
          otherInputsVat += t.totalVat * invoiceSumFactor;
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

const safeParseEntryType = (entryType: Pcn874RecordType | undefined): EntryType | undefined => {
  if (!entryType) {
    return undefined;
  }
  switch (entryType) {
    case EntryType.SALE_REGULAR:
      return EntryType.SALE_REGULAR;
    case EntryType.SALE_UNIDENTIFIED_ZERO_OR_EXEMPT:
      return EntryType.SALE_UNIDENTIFIED_ZERO_OR_EXEMPT;
    case EntryType.INPUT_REGULAR:
      return EntryType.INPUT_REGULAR;
    case EntryType.INPUT_PETTY_CASH:
      return EntryType.INPUT_PETTY_CASH;
    case EntryType.SALE_SELF_INVOICE:
      return EntryType.SALE_SELF_INVOICE;
    case EntryType.SALE_EXPORT:
      return EntryType.SALE_EXPORT;
    case EntryType.SALE_PALESTINIAN_CUSTOMER:
      return EntryType.SALE_PALESTINIAN_CUSTOMER;
    case EntryType.SALE_ZERO_OR_EXEMPT:
      return EntryType.SALE_ZERO_OR_EXEMPT;
    case EntryType.SALE_UNIDENTIFIED_CUSTOMER:
      return EntryType.SALE_UNIDENTIFIED_CUSTOMER;
    case EntryType.INPUT_IMPORT:
      return EntryType.INPUT_IMPORT;
    case EntryType.INPUT_PALESTINIAN_SUPPLIER:
      return EntryType.INPUT_PALESTINIAN_SUPPLIER;
    case EntryType.INPUT_SINGLE_DOC_BY_LAW:
      return EntryType.INPUT_SINGLE_DOC_BY_LAW;
    case EntryType.INPUT_SELF_INVOICE:
      return EntryType.INPUT_SELF_INVOICE;
    default:
      console.debug(`Entry type ${entryType} is not implemented yet`);
      return undefined;
  }
};

const NO_VAT_ID_ENTRIES: string[] = [
  EntryType.SALE_UNIDENTIFIED_CUSTOMER,
  EntryType.SALE_UNIDENTIFIED_ZERO_OR_EXEMPT,
  EntryType.INPUT_PETTY_CASH,
] as const;

// TODO: migrate helper functions to PCN874 generator
function getVatId(t: RawVatReportRecord): string {
  if (t.pcn874RecordType && NO_VAT_ID_ENTRIES.includes(t.pcn874RecordType)) {
    return '0';
  }

  if (!t.vatNumber && t.pcn874RecordType === EntryType.INPUT_REGULAR) {
    return '999999999';
  }

  return t.vatNumber ?? '0';
}

function getRefNumber(t: RawVatReportRecord): string {
  if (t.pcn874RecordType === EntryType.INPUT_IMPORT) {
    return '0';
  }
  if (t.pcn874RecordType === EntryType.INPUT_PETTY_CASH) {
    return '1';
  }
  if (t.documentSerial) {
    return t.documentSerial;
  }
  if (
    t.pcn874RecordType === EntryType.SALE_UNIDENTIFIED_CUSTOMER ||
    t.pcn874RecordType === EntryType.SALE_UNIDENTIFIED_ZERO_OR_EXEMPT
  ) {
    return '1';
  }
  return '0';
}

function getTotalVat(t: RawVatReportRecord): number {
  if (
    t.pcn874RecordType === EntryType.SALE_ZERO_OR_EXEMPT ||
    t.pcn874RecordType === EntryType.SALE_UNIDENTIFIED_ZERO_OR_EXEMPT ||
    t.pcn874RecordType === EntryType.SALE_EXPORT
  ) {
    return 0;
  }
  return Math.round(Math.abs(Number(t.roundedVATToAdd ?? 0)));
}

const transformTransactions = (vatRecords: RawVatReportRecord[]): ExtendedPCNTransaction[] => {
  const transactions: ExtendedPCNTransaction[] = [];
  for (const t of vatRecords) {
    if (!t.documentDate) {
      console.debug(`Document ${t.documentId} has no tax_invoice_date. Skipping it.`);
      continue;
    }
    let entryType = safeParseEntryType(t.pcn874RecordType);
    if (!entryType) {
      entryType = EntryType.INPUT_REGULAR;
      if (!t.isExpense) {
        if (Number(t.foreignVatAfterDeduction) > 0) {
          entryType = EntryType.SALE_REGULAR;
        } else {
          entryType = EntryType.SALE_UNIDENTIFIED_ZERO_OR_EXEMPT;
        }
      }
    }

    const transaction: ExtendedPCNTransaction = {
      entryType,
      vatId: getVatId(t),
      invoiceDate: format(new Date(t.documentDate!), 'yyyyMMdd'),
      refGroup: '0000',
      refNumber: getRefNumber(t),
      totalVat: getTotalVat(t),
      invoiceSum: Math.round(Number(t.localAmountBeforeVAT)),
      isProperty: t.isProperty,
      allocationNumber: t.allocationNumber ?? undefined,
    };
    transactions.push(transaction);
  }
  return transactions.sort((a, b) => a.invoiceDate.localeCompare(b.invoiceDate));
};

export async function getPcn874String(
  context: GraphQLModules.Context,
  businessId: string,
  rawMonthDate: TimelessDateString,
) {
  const monthDate = dateToTimelessDateString(startOfMonth(new Date(rawMonthDate)));
  const financialEntity = await context.injector
    .get(BusinessesProvider)
    .getBusinessByIdLoader.load(businessId);
  if (!financialEntity?.vat_number) {
    throw new Error(`Business entity ${businessId} has no VAT number`);
  }
  const vatRecords = await getVatRecords(
    { filters: { monthDate, financialEntityId: businessId } },
    context,
  );
  const reportMonth = format(new Date(monthDate), 'yyyyMM');
  const reportContent = generatePcnFromCharges(
    [
      ...(vatRecords.income as RawVatReportRecord[]),
      ...(vatRecords.expenses as RawVatReportRecord[]),
    ],
    financialEntity.vat_number,
    reportMonth,
  );

  return { reportContent, monthDate, reportMonth, financialEntity };
}

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

  return reportContent;
};
