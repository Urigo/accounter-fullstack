import { GraphQLError } from 'graphql';
import { format } from 'date-fns';
import { IGetTaxTransactionsByIDsResult } from '../../__generated__/tax-transactions.types.mjs';
import { Currency, Resolvers, ResolversTypes } from '../../__generated__/types.mjs';
import { formatFinancialAmount, formatFinancialIntAmount } from '../../helpers/amount.mjs';
import { validateCharge } from '../../helpers/charges.mjs';
import { generatePcnFromCharges } from '../../helpers/pcn/index.mjs';
import {
  adjustTaxRecords,
  DecoratedVatReportRecord,
  mergeChargeDoc,
  RawVatReportRecord,
} from '../../helpers/vat-report.mjs';
import { getChargesByFilters, validateCharges } from '../../providers/charges.mjs';
import { pool } from '../../providers/db.mjs';
import { getDocumentsByFilters } from '../../providers/documents.mjs';
import { getExchangeRatesByDates } from '../../providers/exchange.mjs';
import {
  getFinancialEntityByIdLoader,
  getFinancialEntityByNameLoader,
} from '../../providers/financial-entities.mjs';
import { getHashavshevetBusinessIndexesLoader } from '../../providers/hash-business-indexes.mjs';
import { getTaxTransactionsLoader } from '../../providers/tax-transactions.mjs';
import { TimelessDateString } from '../../scalars/timeless-date.mjs';

async function getVatRecords(
  fromDate?: TimelessDateString,
  toDate?: TimelessDateString,
  financialEntityId?: string,
  getVatNumbers = false,
) {
  const response = {
    includedChargeIDs: new Set<string>(),
    income: [] as DecoratedVatReportRecord[],
    expenses: [] as DecoratedVatReportRecord[],
  };

  const documents = await getDocumentsByFilters.run({ fromDate, toDate }, pool);

  if (documents.length === 0) {
    console.log('No documents found for VAT report');
  } else {
    const chargesIDs = documents.map(doc => doc.charge_id).filter(Boolean) as string[];
    const EXCLUDED_BUSINESS_NAMES = [
      'Social Security Deductions',
      'Tax',
      'VAT',
      'Dotan Simha Dividend',
    ];
    const charges = await getChargesByFilters.run(
      {
        IDs: chargesIDs,
        financialEntityIds: [financialEntityId],
        notBusinesses: EXCLUDED_BUSINESS_NAMES,
      },
      pool,
    );

    if (charges.length === 0) {
      console.log('No charges found for VAT report');
    } else {
      // Get transactions that are batched into one invoice
      const taxTransactions = await Promise.all(
        chargesIDs.map(id => getTaxTransactionsLoader.load(id).then(res => ({ id, ref: res }))),
      ).then(res =>
        res.reduce(
          (a: { [id: string]: IGetTaxTransactionsByIDsResult }, v) =>
            v.ref ? { ...a, [v.id]: v.ref } : a,
          {},
        ),
      );

      const incomeRecords: Array<RawVatReportRecord> = [];
      const expenseRecords: Array<RawVatReportRecord> = [];

      // update tax category according to Hashavshevet
      await Promise.all(
        charges.map(async charge => {
          if (financialEntityId && charge.financial_entity) {
            const hashIndex = await getHashavshevetBusinessIndexesLoader.load({
              financialEntityId,
              businessName: charge.financial_entity,
            });
            charge.tax_category = hashIndex?.auto_tax_category ?? charge.tax_category;
          }
        }),
      );

      charges.forEach(async charge => {
        const matchDoc = documents.find(doc => doc.charge_id === charge.id);
        const matchBusiness =
          charge.financial_entity && getVatNumbers
            ? await getFinancialEntityByNameLoader.load(charge.financial_entity)
            : undefined;
        if (matchDoc) {
          if (charge.vat != null && charge.vat < 0) {
            response.includedChargeIDs.add(charge.id);
            expenseRecords.push(mergeChargeDoc(charge, matchDoc, matchBusiness));
          }
          if (charge.vat != null && charge.vat >= 0 && Number(charge.event_amount) > 0) {
            response.includedChargeIDs.add(charge.id);
            incomeRecords.push(mergeChargeDoc(charge, matchDoc, matchBusiness));
          }
        } else {
          console.log(
            `For VAT report, for some weird reason no document found for charge ID=${charge.id}`,
          );
        }
      });

      const dates: Array<number> = [...incomeRecords, ...expenseRecords]
        .filter(record => record.tax_invoice_date)
        .map(record => record.tax_invoice_date!.getTime());
      if (dates.length === 0) {
        console.log("No dates found for VAT report's exchange rates");
      } else {
        const fromDate = format(new Date(Math.min(...dates)), 'yyyy-MM-dd');
        const toDate = format(new Date(Math.max(...dates)), 'yyyy-MM-dd');
        const exchangeRates = await getExchangeRatesByDates.run({ fromDate, toDate }, pool);

        response.income.push(...adjustTaxRecords(incomeRecords, taxTransactions, exchangeRates));
        response.expenses.push(...adjustTaxRecords(expenseRecords, taxTransactions, exchangeRates));
      }
    }
  }

  return response;
}

export const reportsResolvers: Resolvers = {
  Query: {
    vatReport: async (_, { filters }) => {
      try {
        const response: ResolversTypes['VatReportResult'] = {
          income: [],
          expenses: [],
          missingInfo: [],
          differentMonthDoc: [],
        };

        const includedChargeIDs = new Set<string>();

        const vatRecords = await getVatRecords(
          filters?.fromDate,
          filters?.toDate,
          filters?.financialEntityId,
        );

        response.income.push(...vatRecords.income);
        response.expenses.push(...vatRecords.expenses);
        const chargeIDs = Array.from(vatRecords.includedChargeIDs);
        chargeIDs.forEach(id => includedChargeIDs.add(id));

        const validationCharges = await validateCharges.run(
          {
            fromDate: filters?.fromDate,
            toDate: filters?.toDate,
            financialEntityIds: filters?.financialEntityId
              ? [filters?.financialEntityId]
              : undefined,
          },
          pool,
        );

        // filter charges with missing info
        response.missingInfo.push(
          ...validationCharges.filter(t => {
            const { isValid } = validateCharge(t);
            if (!isValid) {
              includedChargeIDs.add(t.id);
            }
            return !isValid;
          }),
        );

        // filter charges not included
        response.differentMonthDoc.push(
          ...validationCharges.filter(t => !includedChargeIDs.has(t.id)),
        );

        return response;
      } catch (e) {
        console.error('Error fetching vat report records:', e);
        throw new GraphQLError((e as Error)?.message ?? 'Error fetching vat report records');
      }
    },
    pcnFile: async (_, { fromDate, toDate, financialEntityId }) => {
      const financialEntity = await getFinancialEntityByIdLoader.load(financialEntityId);
      if (!financialEntity?.vat_number) {
        throw new Error(`Financial entity ${financialEntityId} has no VAT number`);
      }
      const vatRecords = await getVatRecords(fromDate, toDate, financialEntityId);
      const reportMonth = format(new Date(fromDate), 'yyyyMM');

      return generatePcnFromCharges(
        [...vatRecords.income, ...vatRecords.expenses],
        financialEntity.vat_number,
        reportMonth,
      );
    },
  },
  VatReportRecord: {
    documentId: raw => raw.document_id,
    chargeId: raw => raw.id,
    amount: raw => formatFinancialAmount(raw.event_amount, raw.currency_code),
    businessName: raw => raw.financial_entity,
    chargeDate: raw => format(raw.event_date, 'yyyy-MM-dd') as TimelessDateString,
    documentDate: raw =>
      raw.tax_invoice_date
        ? (format(raw.tax_invoice_date, 'yyyy-MM-dd') as TimelessDateString)
        : null,
    documentSerial: raw => raw.tax_invoice_number,
    image: raw => raw.document_image_url,
    localAmount: raw =>
      raw.eventAmountILS ? formatFinancialAmount(raw.eventAmountILS, Currency.Ils) : null,
    localVatAfterDeduction: raw =>
      raw.vatAfterDeductionILS
        ? formatFinancialAmount(raw.vatAfterDeductionILS, Currency.Ils)
        : null,
    roundedLocalVatAfterDeduction: raw =>
      raw.roundedVATToAdd ? formatFinancialIntAmount(raw.roundedVATToAdd, Currency.Ils) : null,
    taxReducedLocalAmount: raw =>
      raw.amountBeforeVAT ? formatFinancialAmount(raw.amountBeforeVAT, Currency.Ils) : null,
    vat: raw => (raw.vat ? formatFinancialAmount(raw.vat, Currency.Ils) : null),
    vatAfterDeduction: raw =>
      raw.vatAfterDeduction ? formatFinancialAmount(raw.vatAfterDeduction, Currency.Ils) : null,
    vatNumber: raw =>
      raw.financial_entity
        ? getFinancialEntityByNameLoader
            .load(raw.financial_entity)
            .then(entity => entity?.vat_number ?? null)
        : null,
  },
};
