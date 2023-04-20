// import { format } from 'date-fns';
// import { GraphQLError } from 'graphql';
// import { Injector } from 'graphql-modules';
// import { validateCharge } from '@modules/charges/helpers/validate.helper.js';
// import { ChargesProvider } from '@modules/charges/providers/charges.provider.js';
// import { DocumentsProvider } from '@modules/documents/providers/documents.provider.js';
// import { IGetDocumentsByFiltersResult } from '@modules/documents/types.js';
// import { FinancialEntitiesProvider } from '@modules/financial-entities/providers/financial-entities.provider.js';
// import { HashavshevetProvider } from '@modules/hashavshevet/providers/hashavshevet.provider.js';
// import { ExchangeProvider } from '@modules/ledger/providers/exchange.provider.js';
// import { Currency } from '@shared/enums';
// import type { ResolversTypes } from '@shared/gql-types';
// import { formatFinancialAmount, formatFinancialIntAmount } from '@shared/helpers';
// import type { TimelessDateString } from '@shared/types';
// import { generatePcnFromCharges } from '../helpers/pcn.helper.js';
// import {
//   adjustTaxRecords,
//   DecoratedVatReportRecord,
//   mergeChargeDoc,
//   RawVatReportRecord,
// } from '../helpers/vat-report.helper.js';
// import { TaxTransactionsProvider } from '../providers/tax-transactions.provider.js';
import type {
  // IGetTaxTransactionsByIDsResult,
  ReportsModule,
} from '../types.js';

// async function getVatRecords(
//   injector: Injector,
//   fromDate?: TimelessDateString,
//   toDate?: TimelessDateString,
//   financialEntityId?: string,
//   getVatNumbers = false,
// ) {
//   const response = {
//     includedChargeIDs: new Set<string>(),
//     income: [] as DecoratedVatReportRecord[],
//     expenses: [] as DecoratedVatReportRecord[],
//     notIncludedChargeIDs: new Set<string>(),
//   };

//   // get all documents by date filters
//   const documents = await injector
//     .get(DocumentsProvider)
//     .getDocumentsByFilters({ fromDate, toDate });

//   // filter invoice/receipt documents with linked charge
//   const relevantDocuments: IGetDocumentsByFiltersResult[] = [];
//   documents.map(doc => {
//     if (doc.charge_id) {
//       if (['INVOICE', 'INVOICE_RECEIPT', 'RECEIPT'].includes(doc.type)) {
//         relevantDocuments.push(doc);
//       } else {
//         response.notIncludedChargeIDs.add(doc.charge_id);
//       }
//     }
//   });

//   if (relevantDocuments.length === 0) {
//     console.log('No documents found for VAT report');
//   } else {
//     // get all charges by IDs from documents
//     const chargesIDs = relevantDocuments.map(doc => doc.charge_id).filter(Boolean) as string[];
//     const EXCLUDED_BUSINESS_NAMES = [
//       '6d4b01dd-5a5e-4a43-8e40-e9dadfcc10fa', // Social Security Deductions
//       '9d3a8a88-6958-4119-b509-d50a7cdc0744', // Tax
//       'c7fdf6f6-e075-44ee-b251-cbefea366826', // Vat
//       '3176e27a-3f54-43ec-9f5a-9c1d4d7876da', // Dotan Simha Dividend
//     ];
//     const charges = await injector.get(ChargesProvider).getChargesByFilters({
//       IDs: chargesIDs,
//       financialEntityIds: [financialEntityId],
//       notBusinessesIDs: EXCLUDED_BUSINESS_NAMES,
//     });

//     if (charges.length === 0) {
//       console.log('No charges found for VAT report');
//     } else {
//       // Get transactions that are batched into one invoice
//       const taxTransactions = await Promise.all(
//         chargesIDs.map(id =>
//           injector
//             .get(TaxTransactionsProvider)
//             .getTaxTransactionsLoader.load(id)
//             .then(res => ({ id, ref: res })),
//         ),
//       ).then(res =>
//         res.reduce(
//           (a: { [id: string]: IGetTaxTransactionsByIDsResult }, v) =>
//             v.ref ? { ...a, [v.id]: v.ref } : a,
//           {},
//         ),
//       );

//       const incomeRecords: Array<RawVatReportRecord> = [];
//       const expenseRecords: Array<RawVatReportRecord> = [];

//       // update tax category according to Hashavshevet
//       await Promise.all(
//         charges.map(async charge => {
//           if (financialEntityId && charge.owner_id) {
//             const hashIndex = await injector
//               .get(HashavshevetProvider)
//               .getHashavshevetBusinessIndexesByOwnerAndBusinessIDLoader.load({
//                 financialEntityId,
//                 businessID: charge.owner_id,
//               });
//             charge.tax_category = hashIndex?.auto_tax_category ?? charge.tax_category;
//           }
//         }),
//       );

//       await Promise.all(
//         charges.map(async charge => {
//           const matchDoc = relevantDocuments.find(doc => doc.charge_id === charge.id);
//           const matchBusiness = await (charge.owner_id && getVatNumbers
//             ? injector
//                 .get(FinancialEntitiesProvider)
//                 .getFinancialEntityByIdLoader.load(charge.owner_id)
//             : undefined);
//           if (matchDoc) {
//             if (charge.documents_vat_amount != null && charge.documents_vat_amount < 0) {
//               response.includedChargeIDs.add(charge.id);
//               expenseRecords.push(mergeChargeDoc(charge, matchDoc, matchBusiness));
//             } else if (
//               charge.documents_vat_amount != null &&
//               charge.documents_vat_amount >= 0 &&
//               Number(charge.event_amount) > 0
//             ) {
//               response.includedChargeIDs.add(charge.id);
//               incomeRecords.push(mergeChargeDoc(charge, matchDoc, matchBusiness));
//             } else {
//               response.notIncludedChargeIDs.add(charge.id);
//             }
//           } else {
//             console.log(
//               `For VAT report, for some weird reason no document found for charge ID=${charge.id}`,
//             );
//           }
//         }),
//       );

//       const dates: Array<number> = [...incomeRecords, ...expenseRecords]
//         .filter(record => record.tax_invoice_date)
//         .map(record => record.tax_invoice_date!.getTime());
//       if (dates.length === 0) {
//         console.log("No dates found for VAT report's exchange rates");
//       } else {
//         const fromDate = format(new Date(Math.min(...dates)), 'yyyy-MM-dd');
//         const toDate = format(new Date(Math.max(...dates)), 'yyyy-MM-dd');
//         const exchangeRates = await injector
//           .get(ExchangeProvider)
//           .getExchangeRatesByDates({ fromDate, toDate });

//         response.income.push(...adjustTaxRecords(incomeRecords, taxTransactions, exchangeRates));
//         response.expenses.push(...adjustTaxRecords(expenseRecords, taxTransactions, exchangeRates));
//       }
//     }
//   }

//   return response;
// }

export const reportsResolvers: ReportsModule.Resolvers = {
  // Query: {
  //   vatReport: async (_, { filters }, { injector }) => {
  //     try {
  //       const response = {
  //         income: [] as Array<ResolversTypes['VatReportRecord']>,
  //         expenses: [] as Array<ResolversTypes['VatReportRecord']>,
  //         missingInfo: [] as Array<ResolversTypes['Charge']>,
  //         differentMonthDoc: [] as Array<ResolversTypes['Charge']>,
  //       };
  //       const includedChargeIDs = new Set<string>();
  //       const vatRecords = await getVatRecords(
  //         injector,
  //         filters?.fromDate,
  //         filters?.toDate,
  //         filters?.financialEntityId,
  //       );
  //       response.income.push(...(filters?.chargesType === 'EXPENSE' ? [] : vatRecords.income));
  //       response.expenses.push(...(filters?.chargesType === 'INCOME' ? [] : vatRecords.expenses));
  //       const chargeIDs = Array.from(vatRecords.includedChargeIDs);
  //       chargeIDs.forEach(id => includedChargeIDs.add(id));
  //       const validationCharges = await injector.get(ChargesProvider).validateCharges({
  //         fromDate: filters?.fromDate,
  //         toDate: filters?.toDate,
  //         financialEntityIds: filters?.financialEntityId ? [filters?.financialEntityId] : undefined,
  //         chargeType: filters?.chargesType,
  //       });
  //       validationCharges.map(c => {
  //         vatRecords.notIncludedChargeIDs.delete(c.id);
  //       });
  //       if (vatRecords.notIncludedChargeIDs.size > 0) {
  //         const moreValidationCharges = await injector.get(ChargesProvider).validateCharges({
  //           IDs: Array.from(vatRecords.notIncludedChargeIDs),
  //           financialEntityIds: filters?.financialEntityId
  //             ? [filters?.financialEntityId]
  //             : undefined,
  //           chargeType: filters?.chargesType,
  //         });
  //         validationCharges.push(...moreValidationCharges);
  //       }
  //       // filter charges with missing info
  //       response.missingInfo.push(
  //         ...validationCharges.filter(t => {
  //           const { isValid } = validateCharge(t);
  //           if (!isValid) {
  //             includedChargeIDs.add(t.id);
  //           }
  //           return !isValid;
  //         }),
  //       );
  //       // filter charges not included
  //       response.differentMonthDoc.push(
  //         ...validationCharges.filter(t => !includedChargeIDs.has(t.id)),
  //       );
  //       return response;
  //     } catch (e) {
  //       console.error('Error fetching vat report records:', e);
  //       throw new GraphQLError((e as Error)?.message ?? 'Error fetching vat report records');
  //     }
  //   },
  //   pcnFile: async (_, { fromDate, toDate, financialEntityId }, { injector }) => {
  //     const financialEntity = await injector
  //       .get(FinancialEntitiesProvider)
  //       .getFinancialEntityByIdLoader.load(financialEntityId);
  //     if (!financialEntity?.vat_number) {
  //       throw new Error(`Financial entity ${financialEntityId} has no VAT number`);
  //     }
  //     const vatRecords = await getVatRecords(injector, fromDate, toDate, financialEntityId, true);
  //     const reportMonth = format(new Date(fromDate), 'yyyyMM');
  //     return generatePcnFromCharges(
  //       [...vatRecords.income, ...vatRecords.expenses],
  //       financialEntity.vat_number,
  //       reportMonth,
  //     );
  //   },
  // },
  // VatReportRecord: {
  //   documentId: raw => raw.document_id,
  //   chargeId: raw => raw.id,
  //   amount: raw => formatFinancialAmount(raw.event_amount, raw.currency_code),
  //   business: raw => raw.financial_entity_id,
  //   chargeDate: raw => format(raw.event_date, 'yyyy-MM-dd') as TimelessDateString,
  //   documentDate: raw =>
  //     raw.tax_invoice_date
  //       ? (format(raw.tax_invoice_date, 'yyyy-MM-dd') as TimelessDateString)
  //       : null,
  //   documentSerial: raw => raw.tax_invoice_number,
  //   image: raw => raw.document_image_url,
  //   localAmount: raw =>
  //     raw.eventAmountILS ? formatFinancialAmount(raw.eventAmountILS, Currency.Ils) : null,
  //   localVatAfterDeduction: raw =>
  //     raw.vatAfterDeductionILS
  //       ? formatFinancialAmount(raw.vatAfterDeductionILS, Currency.Ils)
  //       : null,
  //   roundedLocalVatAfterDeduction: raw =>
  //     raw.roundedVATToAdd ? formatFinancialIntAmount(raw.roundedVATToAdd, Currency.Ils) : null,
  //   taxReducedLocalAmount: raw =>
  //     raw.amountBeforeVAT ? formatFinancialIntAmount(raw.amountBeforeVAT, Currency.Ils) : null,
  //   vat: raw => (raw.vat ? formatFinancialAmount(raw.vat, Currency.Ils) : null),
  //   vatAfterDeduction: raw =>
  //     raw.vatAfterDeduction ? formatFinancialAmount(raw.vatAfterDeduction, Currency.Ils) : null,
  //   vatNumber: (raw, _, { injector }) =>
  //     raw.financial_entity_id
  //       ? injector
  //           .get(FinancialEntitiesProvider)
  //           .getFinancialEntityByIdLoader.load(raw.financial_entity_id)
  //           .then(entity => entity?.vat_number ?? null)
  //       : null,
  // },
};
