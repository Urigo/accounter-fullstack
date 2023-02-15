import { format } from 'date-fns';
import { GraphQLError } from 'graphql';
import { Injector } from 'graphql-modules';
import { ChargesProvider } from 'modules/charges/providers/charges.provider.js';
import { DocumentsProvider } from 'modules/documents/providers/documents.provider.js';
import { IGetTaxTransactionsByIDsResult } from '../../../__generated__/tax-transactions.types.js';
import { ResolversTypes } from '../../../__generated__/types.js';
import { formatFinancialAmount, formatFinancialIntAmount } from '../../../helpers/amount.js';
import { validateCharge } from '../../../helpers/charges.js';
import { generatePcnFromCharges } from '../../../helpers/pcn/index.js';
import {
  adjustTaxRecords,
  DecoratedVatReportRecord,
  mergeChargeDoc,
  RawVatReportRecord,
} from '../../../helpers/vat-report.js';
import { Currency } from '../../../models/enums.js';
import { TimelessDateString } from '../../../models/index.js';
import { pool } from '../../../providers/db.js';
import { getExchangeRatesByDates } from '../../../providers/exchange.js';
import {
  getFinancialEntityByIdLoader,
  getFinancialEntityByNameLoader,
} from '../../../providers/financial-entities.js';
import { getHashavshevetBusinessIndexesLoader } from '../../../providers/hash-business-indexes.js';
import { getTaxTransactionsLoader } from '../../../providers/tax-transactions.js';
import { ReportsModule } from '../__generated__/types.js';

async function getVatRecords(
  injector: Injector,
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

  const documents = await injector
    .get(DocumentsProvider)
    .getDocumentsByFilters({ fromDate, toDate });

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
    const charges = await injector.get(ChargesProvider).getChargesByFilters({
      IDs: chargesIDs,
      financialEntityIds: [financialEntityId],
      notBusinesses: EXCLUDED_BUSINESS_NAMES,
    });

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

export const reportsResolvers: ReportsModule.Resolvers = {
  Query: {
    vatReport: async (_, { filters }, { injector }) => {
      try {
        const response = {
          income: [] as Array<ResolversTypes['VatReportRecord']>,
          expenses: [] as Array<ResolversTypes['VatReportRecord']>,
          missingInfo: [] as Array<ResolversTypes['Charge']>,
          differentMonthDoc: [] as Array<ResolversTypes['Charge']>,
        };

        const includedChargeIDs = new Set<string>();

        const vatRecords = await getVatRecords(
          injector,
          filters?.fromDate,
          filters?.toDate,
          filters?.financialEntityId,
        );

        response.income.push(...vatRecords.income);
        response.expenses.push(...vatRecords.expenses);
        const chargeIDs = Array.from(vatRecords.includedChargeIDs);
        chargeIDs.forEach(id => includedChargeIDs.add(id));

        const validationCharges = await injector.get(ChargesProvider).validateCharges({
          fromDate: filters?.fromDate,
          toDate: filters?.toDate,
          financialEntityIds: filters?.financialEntityId ? [filters?.financialEntityId] : undefined,
        });

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
    pcnFile: async (_, { fromDate, toDate, financialEntityId }, { injector }) => {
      const financialEntity = await getFinancialEntityByIdLoader.load(financialEntityId);
      if (!financialEntity?.vat_number) {
        throw new Error(`Financial entity ${financialEntityId} has no VAT number`);
      }
      const vatRecords = await getVatRecords(injector, fromDate, toDate, financialEntityId);
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
