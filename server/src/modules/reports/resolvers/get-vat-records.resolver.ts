import { format } from 'date-fns';
import { GraphQLError } from 'graphql';
import { validateCharge } from '@modules/charges/helpers/validate.helper.js';
import { ChargesProvider } from '@modules/charges/providers/charges.provider.js';
import { IGetChargesByFiltersResult } from '@modules/charges/types.js';
import { DocumentsProvider } from '@modules/documents/providers/documents.provider.js';
import { FinancialEntitiesProvider } from '@modules/financial-entities/providers/financial-entities.provider.js';
import { ExchangeProvider } from '@modules/ledger/providers/exchange.provider.js';
import type {
  QueryVatReportArgs,
  ResolverFn,
  ResolversParentTypes,
  ResolversTypes,
} from '@shared/gql-types';
import { filterOutExcludedBusinesses } from '../helpers/get-vat-records.helper.js';
import { adjustTaxRecords, RawVatReportRecord } from '../helpers/vat-report.helper.js';

export const getVatRecords: ResolverFn<
  ResolversTypes['VatReportResult'],
  ResolversParentTypes['Query'],
  GraphQLModules.Context,
  Partial<QueryVatReportArgs>
> = async (_, { filters }, { injector }) => {
  try {
    const response = {
      income: [] as Array<ResolversTypes['VatReportRecord']>,
      expenses: [] as Array<ResolversTypes['VatReportRecord']>,
      missingInfo: [] as Array<ResolversTypes['Charge']>,
      differentMonthDoc: [] as Array<ResolversTypes['Charge']>,
    };

    // get all documents by date filters
    const documents = await injector.get(DocumentsProvider).getDocumentsByFilters({
      fromDate: filters?.fromDate,
      toDate: filters?.toDate,
      ownerIDs: [filters?.financialEntityId],
    });

    // get all businesses
    const businesses = await injector.get(FinancialEntitiesProvider).getAllFinancialEntities();

    const notIncludedChargeIDs = new Set<string>();

    // filter invoice documents with linked charge
    const relevantDocuments = documents.filter(doc => {
      if (!doc.charge_id_new) {
        return false;
      }
      const isRelevantDoc = ['INVOICE', 'INVOICE_RECEIPT'].includes(doc.type);
      if (!isRelevantDoc) {
        notIncludedChargeIDs.add(doc.charge_id_new);
      }
      return isRelevantDoc;
    });

    // TODO: what if no docs found?

    relevantDocuments.map(doc => {
      if (doc.charge_id_new) notIncludedChargeIDs.delete(doc.charge_id_new);
    });

    // get all charges by IDs from documents
    const docsChargesIDs = new Set(documents.map(doc => doc.charge_id_new as string));

    const docsCharges = await injector
      .get(ChargesProvider)
      .getChargesByFilters({
        IDs: Array.from(docsChargesIDs),
        ownerIds: [filters?.financialEntityId],
      })
      .then(res => filterOutExcludedBusinesses(res));

    const incomeRecords: Array<RawVatReportRecord> = [];
    const expenseRecords: Array<RawVatReportRecord> = [];
    const includedChargeIDs = new Set<string>();

    await Promise.all(
      relevantDocuments.map(async doc => {
        // filter charge linked to document
        const charge = docsCharges.find(charge => charge.id === doc.charge_id_new);
        if (!charge) {
          throw new GraphQLError(`for some weird reason no charge found for document ID=${doc.id}`);
        }

        // filter business linked to document
        const business = businesses.find(business => {
          const counterpartyId =
            doc.creditor_id === charge.owner_id
              ? doc.creditor_id
              : doc.debtor_id === charge.owner_id
              ? doc.debtor_id
              : null;
          return business.id === counterpartyId;
        });
        if (!business) {
          throw new GraphQLError(
            `for some weird reason no counterparty found for document ID=${doc.id}`,
          );
        }

        // // update tax category according to Hashavshevet
        // TODO(Gil): how to handle this on new architecture?
        // if (ownerId && charge.business_id) {
        //   const hashIndex = await injector
        //     .get(HashavshevetProvider)
        //     .getHashavshevetBusinessIndexesByOwnerAndBusinessIDLoader.load({
        //       financialEntityId: ownerId,
        //       businessID: charge.business_id,
        //     });
        //   charge.tax_category = hashIndex?.auto_tax_category ?? charge.tax_category;
        // }

        // add charge to income/expense records
        if (doc.vat_amount && doc.debtor_id === filters?.financialEntityId) {
          includedChargeIDs.add(charge.id);
          if (filters?.chargesType !== 'EXPENSE') {
            expenseRecords.push({ charge, doc, business });
          }
        } else if (
          doc.vat_amount != null &&
          doc.creditor_id === filters?.financialEntityId &&
          Number(doc.total_amount) > 0
        ) {
          includedChargeIDs.add(charge.id);
          if (filters?.chargesType !== 'INCOME') {
            incomeRecords.push({ charge, doc, business });
          }
        } else {
          notIncludedChargeIDs.add(charge.id);
        }
      }),
    );

    if (incomeRecords.length + expenseRecords.length > 0) {
      // get exchange rates for all docs dates
      const exchangeDates = new Set<number>();
      for (const record of [...incomeRecords, ...expenseRecords]) {
        if (record.doc.date) {
          exchangeDates.add(record.doc.date.getTime());
        }
      }
      // TODO: what if no exchange dates found?
      const fromDate = format(new Date(Math.min(...exchangeDates)), 'yyyy-MM-dd');
      const toDate = format(new Date(Math.max(...exchangeDates)), 'yyyy-MM-dd');
      const exchangeRates = await injector
        .get(ExchangeProvider)
        .getExchangeRatesByDates({ fromDate, toDate });

      response.income.push(...adjustTaxRecords(incomeRecords, exchangeRates));
      response.expenses.push(...adjustTaxRecords(expenseRecords, exchangeRates));
    }

    const charges = await injector.get(ChargesProvider).getChargesByFilters({
      fromDate: filters?.fromDate,
      toDate: filters?.toDate,
      ownerIds: filters?.financialEntityId ? [filters?.financialEntityId] : undefined,
      chargeType: filters?.chargesType,
    });
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
        c =>
          new Promise((resolve, reject) => {
            validateCharge(c, injector)
              .then(res => {
                if ('isValid' in res) {
                  resolve({ charge: c, isValid: res.isValid });
                } else {
                  reject('Error validating charge');
                }
              })
              .catch(reject);
          }),
      ),
    );

    for (const { charge, isValid } of validatedCharges) {
      if (isValid) {
        if (!includedChargeIDs.has(charge.id)) {
          // If valid but not yet included, add to charges with different month doc
          response.differentMonthDoc.push(charge);
        }
      } else {
        // add to charges with missing info
        response.missingInfo.push(charge);
      }
    }

    return response;
  } catch (e) {
    console.error('Error fetching vat report records:', e);
    throw new GraphQLError((e as Error)?.message ?? 'Error fetching vat report records');
  }
};
