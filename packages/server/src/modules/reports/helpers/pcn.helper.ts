import { format, startOfMonth } from 'date-fns';
import { EntryType, pcnGenerator } from '@accounter/pcn874-generator';
import { BusinessesProvider } from '@modules/financial-entities/providers/businesses.provider.js';
import { idValidator, yearMonthValidator } from '@shared/helpers';
import { TimelessDateString } from '@shared/types';
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
      totalVat: Math.round(Math.abs(Number(t.roundedVATToAdd ?? 0))),
      invoiceSum: Math.round(Number(t.localAmountBeforeVAT)),
      isProperty: t.isProperty,
      allocationNumber: t.allocationNumber ?? undefined,
    });
  }
  return transactions.sort((a, b) => a.invoiceDate.localeCompare(b.invoiceDate));
};

export async function getPcn874String(
  context: GraphQLModules.Context,
  businessId: string,
  rawMonthDate: TimelessDateString,
) {
  const monthDate = format(
    startOfMonth(new Date(rawMonthDate)),
    'yyyy-MM-dd',
  ) as TimelessDateString;
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

  return { reportContent, monthDate, reportMonth, vatNumber: financialEntity.vat_number };
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
