import { GraphQLError } from 'graphql';
import { validateCharge } from '@modules/charges/helpers/validate.helper.js';
import { ChargesProvider } from '@modules/charges/providers/charges.provider.js';
import { IGetChargesByFiltersResult } from '@modules/charges/types.js';
import { DocumentsProvider } from '@modules/documents/providers/documents.provider.js';
import { FiatExchangeProvider } from '@modules/exchange-rates/providers/fiat-exchange.provider.js';
import { FinancialEntitiesProvider } from '@modules/financial-entities/providers/financial-entities.provider.js';
import { VAT_REPORT_EXCLUDED_BUSINESS_NAMES } from '@shared/constants';
import {
  DocumentType,
  type QueryVatReportArgs,
  type ResolverFn,
  type ResolversParentTypes,
  type ResolversTypes,
} from '@shared/gql-types';
import {
  adjustTaxRecords,
  type RawVatReportRecord,
  type VatReportRecordSources,
} from '../helpers/vat-report.helper.js';

export const getVatRecords: ResolverFn<
  ResolversTypes['VatReportResult'],
  ResolversParentTypes['Query'],
  GraphQLModules.Context,
  Partial<QueryVatReportArgs>
> = async (_, { filters }, { injector }) => {
  try {
    const response = {
      income: [] as Array<RawVatReportRecord>,
      expenses: [] as Array<RawVatReportRecord>,
      missingInfo: [] as Array<ResolversTypes['Charge']>,
      differentMonthDoc: [] as Array<ResolversTypes['Charge']>,
      businessTrips: [] as Array<ResolversTypes['Charge']>,
    };

    const notIncludedChargeIDs = new Set<string>();
    const docsChargesIDs = new Set<string>();

    // get all documents by date filters
    const relevantDocumentsPromise = injector
      .get(DocumentsProvider)
      .getDocumentsByFilters({
        fromDate: filters?.fromDate,
        toDate: filters?.toDate,
        ownerIDs: [filters?.financialEntityId],
      })
      .then(documents =>
        documents
          .filter(doc => {
            if (doc.charge_id_new) {
              docsChargesIDs.add(doc.charge_id_new);
            }
            // filter invoice documents with linked charge
            if (!doc.charge_id_new || !doc.creditor_id || !doc.debtor_id) {
              return false;
            }
            const isRelevantDoc = ['INVOICE', 'INVOICE_RECEIPT', 'CREDIT_INVOICE'].includes(
              doc.type,
            );
            if (!isRelevantDoc) {
              notIncludedChargeIDs.add(doc.charge_id_new);
            }
            return isRelevantDoc;
          })
          .map(doc => {
            // For cases where charge has both invoice and receipt, remove from notIncludedChargeIDs list
            if (doc.charge_id_new) notIncludedChargeIDs.delete(doc.charge_id_new);
            return doc;
          }),
      );

    // get all businesses
    const businessesPromise = injector.get(FinancialEntitiesProvider).getAllFinancialEntities();

    const chargesPromise = injector.get(ChargesProvider).getChargesByFilters({
      fromDate: filters?.fromDate,
      toDate: filters?.toDate,
      ownerIds: filters?.financialEntityId ? [filters?.financialEntityId] : undefined,
      chargeType: filters?.chargesType,
    });

    const exchangeRatesPromises = injector
      .get(FiatExchangeProvider)
      .getExchangeRatesByDates({ fromDate: filters?.fromDate, toDate: filters?.toDate });

    const [relevantDocuments, businesses, charges, exchangeRates] = await Promise.all([
      relevantDocumentsPromise,
      businessesPromise,
      chargesPromise,
      exchangeRatesPromises,
    ]);

    let docsCharges = charges.filter(charge => docsChargesIDs.has(charge.id));
    if (docsCharges.length < docsChargesIDs.size) {
      const moreDocsCharges = await injector.get(ChargesProvider).getChargesByFilters({
        IDs: Array.from(docsChargesIDs).filter(id => !docsCharges.find(charge => charge.id === id)),
        ownerIds: [filters?.financialEntityId],
      });

      charges.push(...moreDocsCharges);
      docsCharges.push(...moreDocsCharges);
    }
    docsCharges = docsCharges.filter(charge => {
      for (const businessId of charge.business_array ?? []) {
        if (VAT_REPORT_EXCLUDED_BUSINESS_NAMES.includes(businessId)) {
          notIncludedChargeIDs.add(charge.id);
          return false;
        }
      }
      return true;
    });

    const incomeRecords: Array<VatReportRecordSources> = [];
    const expenseRecords: Array<VatReportRecordSources> = [];
    const includedChargeIDs = new Set<string>();

    relevantDocuments.map(doc => {
      // filter charge linked to document
      const charge = docsCharges.find(charge => charge.id === doc.charge_id_new);
      if (!charge) {
        throw new GraphQLError(`for some weird reason no charge found for document ID=${doc.id}`);
      }

      // filter business linked to document
      const counterpartyId =
        doc.creditor_id === charge.owner_id
          ? doc.debtor_id
          : doc.debtor_id === charge.owner_id
            ? doc.creditor_id
            : null;
      const business = businesses.find(business => business.id === counterpartyId);
      if (!business) {
        throw new GraphQLError(
          `for some weird reason no counterparty found for document ID=${doc.id}`,
        );
      }

      // add charge to income/expense records
      if (doc.vat_amount && doc.debtor_id === filters?.financialEntityId) {
        includedChargeIDs.add(charge.id);
        if (filters?.chargesType !== 'EXPENSE') {
          expenseRecords.push({ charge, doc, business });
        }
      } else if (
        doc.vat_amount != null &&
        (doc.type === DocumentType.CreditInvoice
          ? doc.debtor_id === filters?.financialEntityId
          : doc.creditor_id === filters?.financialEntityId) &&
        Number(doc.total_amount) > 0
      ) {
        includedChargeIDs.add(charge.id);
        if (filters?.chargesType !== 'INCOME') {
          incomeRecords.push({ charge, doc, business });
        }
      } else {
        notIncludedChargeIDs.add(charge.id);
      }
    });

    if (incomeRecords.length + expenseRecords.length > 0) {
      // TODO: what if no exchange dates found?
      response.income.push(...adjustTaxRecords(incomeRecords, exchangeRates));
      response.expenses.push(...adjustTaxRecords(expenseRecords, exchangeRates));
    }

    charges.map(c => {
      notIncludedChargeIDs.delete(c.id);
    });
    if (notIncludedChargeIDs.size > 0) {
      const moreCharges = await injector.get(ChargesProvider).getChargesByFilters({
        IDs: Array.from(notIncludedChargeIDs),
        ownerIds: filters?.financialEntityId ? [filters?.financialEntityId] : undefined,
        chargeType: filters?.chargesType,
      });
      charges.push(...moreCharges);
    }

    // validate charges for missing info
    const validatedCharges = await Promise.all<{
      charge: IGetChargesByFiltersResult;
      isValid: boolean;
    }>(
      charges.map(
        charge =>
          new Promise((resolve, reject) => {
            validateCharge(charge, injector)
              .then(res => {
                if ('isValid' in res) {
                  resolve({ charge, isValid: res.isValid });
                } else {
                  reject('Error validating charge');
                }
              })
              .catch(reject);
          }),
      ),
    );

    for (const { charge, isValid } of validatedCharges) {
      if (charge.business_trip_id) {
        // If valid and has business trip, add to business trips
        response.businessTrips.push(charge);
      } else if (isValid) {
        if (!includedChargeIDs.has(charge.id)) {
          // If valid but not yet included, add to charges with different month doc
          response.differentMonthDoc.push(charge);
        }
      } else {
        // add to charges with missing info
        response.missingInfo.push(charge);
      }
    }

    response.income = response.income.sort(
      (a, b) => (b.documentDate?.getDate() ?? 0) - (a.documentDate?.getDate() ?? 0),
    );
    response.expenses = response.expenses.sort(
      (a, b) => (b.documentDate?.getDate() ?? 0) - (a.documentDate?.getDate() ?? 0),
    );

    return response;
  } catch (e) {
    console.error('Error fetching vat report records:', e);
    throw new GraphQLError((e as Error)?.message ?? 'Error fetching vat report records');
  }
};
