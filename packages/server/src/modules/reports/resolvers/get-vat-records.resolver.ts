import { endOfDay, lastDayOfMonth, startOfDay, startOfMonth } from 'date-fns';
import { GraphQLError } from 'graphql';
import type { QueryVatReportArgs, ResolversTypes } from '../../../__generated__/types.js';
import { DocumentType } from '../../../shared/enums.js';
import { dateToTimelessDateString } from '../../../shared/helpers/index.js';
import { BusinessTripsProvider } from '../../business-trips/providers/business-trips.provider.js';
import { getChargeBusinesses } from '../../charges/helpers/common.helper.js';
import { validateCharge } from '../../charges/helpers/validate.helper.js';
import { ChargesProvider } from '../../charges/providers/charges.provider.js';
import { IGetChargesByIdsResult } from '../../charges/types.js';
import { DocumentsProvider } from '../../documents/providers/documents.provider.js';
import { BusinessesProvider } from '../../financial-entities/providers/businesses.provider.js';
import { isRefundCharge } from '../../ledger/helpers/common-charge-ledger.helper.js';
import {
  adjustTaxRecord,
  type RawVatReportRecord,
  type VatReportRecordSources,
} from '../helpers/vat-report.helper.js';

export const getVatRecords = async (
  { filters }: Partial<QueryVatReportArgs>,
  context: GraphQLModules.Context,
): Promise<ResolversTypes['VatReportResult']> => {
  const {
    injector,
    adminContext: {
      authorities: { vatReportExcludedBusinessNames },
    },
  } = context;
  try {
    const response = {
      income: [] as Array<RawVatReportRecord>,
      expenses: [] as Array<RawVatReportRecord>,
      missingInfo: [] as Array<ResolversTypes['Charge']>,
      differentMonthDoc: [] as Array<ResolversTypes['Charge']>,
      businessTrips: [] as Array<ResolversTypes['Charge']>,
    };

    const docsChargesIDs = new Set<string>();
    const reportIssuerId = filters?.financialEntityId;

    const fromDate = filters?.monthDate
      ? dateToTimelessDateString(startOfMonth(new Date(filters.monthDate)))
      : undefined;
    const toDate = filters?.monthDate
      ? dateToTimelessDateString(lastDayOfMonth(new Date(filters.monthDate)))
      : undefined;

    // get all documents by date filters
    const relevantDocumentsPromise = injector
      .get(DocumentsProvider)
      .getDocumentsByFilters({
        fromVatDate: fromDate,
        toVatDate: toDate,
      })
      .then(documents =>
        documents.filter(doc => {
          if (doc.charge_id) {
            docsChargesIDs.add(doc.charge_id);
          }

          // filter documents with vat_report_date_override outside of the date range
          if (doc.vat_report_date_override) {
            const isBeforeFromDate =
              fromDate && doc.vat_report_date_override < startOfDay(fromDate);
            const isAfterToDate = toDate && doc.vat_report_date_override > endOfDay(toDate);
            if (isBeforeFromDate || isAfterToDate) {
              return false;
            }
          }

          if (!doc.charge_id || !doc.creditor_id || !doc.debtor_id) {
            // filter invoice documents with linked charge
            return false;
          }
          const isRelevantDoc = ['INVOICE', 'INVOICE_RECEIPT', 'CREDIT_INVOICE'].includes(doc.type);
          return isRelevantDoc;
        }),
      );

    // get all businesses
    const businessesPromise = injector.get(BusinessesProvider).getAllBusinesses();

    const chargesPromise = injector.get(ChargesProvider).getChargesByFilters({
      fromDate,
      toDate,
      ownerIds: reportIssuerId ? [reportIssuerId] : undefined,
      chargeType: filters?.chargesType,
    });

    const [relevantDocuments, businesses, charges] = await Promise.all([
      relevantDocumentsPromise,
      businessesPromise,
      chargesPromise,
    ]);

    let docsCharges = charges.filter(charge => docsChargesIDs.has(charge.id));
    if (docsCharges.length < docsChargesIDs.size) {
      const moreDocsCharges = await injector.get(ChargesProvider).getChargesByFilters({
        IDs: Array.from(docsChargesIDs).filter(id => !docsCharges.find(charge => charge.id === id)),
        ownerIds: [reportIssuerId],
      });

      charges.push(...moreDocsCharges);
      docsCharges.push(...moreDocsCharges);
    }

    const extendedCharges = await Promise.all(
      charges.map(async charge => {
        const { allBusinessIds } = await getChargeBusinesses(charge.id, injector);
        return {
          ...charge,
          allBusinessIds,
        };
      }),
    );

    docsCharges = extendedCharges.filter(charge => {
      for (const businessId of charge.allBusinessIds) {
        if (vatReportExcludedBusinessNames.includes(businessId)) {
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
      const charge = docsCharges.find(charge => charge.id === doc.charge_id);
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

      const isReimbursement = isRefundCharge(charge.user_description);

      // add charge to income/expense records
      if (
        doc.vat_amount &&
        (doc.type === DocumentType.CreditInvoice ? doc.creditor_id : doc.debtor_id) ===
          reportIssuerId
      ) {
        includedChargeIDs.add(charge.id);
        if (filters?.chargesType !== 'EXPENSE') {
          expenseRecords.push({ charge, doc, business });
        }
      } else if (
        doc.vat_amount != null &&
        (doc.type === DocumentType.CreditInvoice
          ? doc.debtor_id === reportIssuerId
          : doc.creditor_id === reportIssuerId) &&
        Number(doc.total_amount) > 0 &&
        !isReimbursement
      ) {
        includedChargeIDs.add(charge.id);
        if (filters?.chargesType !== 'INCOME') {
          incomeRecords.push({ charge, doc, business });
        }
      }
    });

    if (incomeRecords.length + expenseRecords.length > 0) {
      // TODO: what if no exchange dates found?
      await Promise.all([
        ...incomeRecords.map(async rawRecord =>
          adjustTaxRecord(rawRecord, context).then(res => {
            response.income.push(res);
          }),
        ),
        ...expenseRecords.map(async rawRecord =>
          adjustTaxRecord(rawRecord, context).then(res => {
            response.expenses.push(res);
          }),
        ),
      ]);
    }

    // validate charges for missing info
    const validatedCharges = await Promise.all<{
      charge: IGetChargesByIdsResult;
      isValid: boolean;
      businessTripId: string | null;
    }>(
      charges.map(async charge => {
        const [validation, businessTrip] = await Promise.all([
          validateCharge(charge, context),
          injector.get(BusinessTripsProvider).getBusinessTripsByChargeIdLoader.load(charge.id),
        ]);
        if (!('isValid' in validation)) {
          throw new Error('Error validating charge');
        }
        return {
          charge,
          isValid: validation.isValid,
          businessTripId: businessTrip?.id ?? null,
        };
      }),
    );

    for (const { charge, isValid, businessTripId } of validatedCharges) {
      if (businessTripId) {
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
