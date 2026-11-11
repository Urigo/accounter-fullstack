import { GraphQLError } from 'graphql';
import type { Injector } from 'graphql-modules';
import type { QueryVatReportArgs } from '../../../__generated__/types.js';
import { DocumentType } from '../../../shared/enums.js';
import {
  allSettledOrThrow,
  endOfTimelessMonth,
  getTimelessDateDay,
  startOfTimelessMonth,
} from '../../../shared/helpers/index.js';
import { AdminContextProvider } from '../../admin-context/providers/admin-context.provider.js';
import { BusinessTripsProvider } from '../../business-trips/providers/business-trips.provider.js';
import { getChargeBusinesses } from '../../charges/helpers/common.helper.js';
import { validateCharge } from '../../charges/helpers/validate.helper.js';
import { ChargesProvider } from '../../charges/providers/charges.provider.js';
import { DocumentsProvider } from '../../documents/providers/documents.provider.js';
import { BusinessesProvider } from '../../financial-entities/providers/businesses.provider.js';
import { isRefundCharge } from '../../ledger/helpers/common-charge-ledger.helper.js';
import {
  adjustTaxRecord,
  getVatReportDocumentMissingFields,
  isVatReportRelevantDocument,
  type RawVatReportRecord,
  type VatReportRecordSources,
} from '../helpers/vat-report.helper.js';
import type { VatReportRecords } from '../types.js';

export type GetVatRecordsOptions = {
  /**
   * Whether to compute the `missingInfo` / `differentMonthDoc` / `businessTrips`
   * charge buckets. Building them runs `validateCharge` plus a business-trip
   * load for every charge in the month — work that only the VAT report screen
   * consumes. The ledger-validation, description-suggestion and PCN874 callers
   * read only `income`/`expenses`, so they pass `false` to skip it entirely.
   */
  includeChargeBuckets?: boolean;
};

/**
 * Every fan-out below uses `allSettledOrThrow`, not `Promise.all`: one failing
 * branch must not let the request return while its siblings are still querying
 * the request's DB client, which the cleanup plugin disposes at that point
 * (#4871).
 */
export const getVatRecords = async (
  { filters }: Partial<QueryVatReportArgs>,
  injector: Injector,
  options: GetVatRecordsOptions = {},
): Promise<VatReportRecords> => {
  const { includeChargeBuckets = true } = options;
  const {
    authorities: { vatReportExcludedBusinessNames },
  } = await injector.get(AdminContextProvider).getVerifiedAdminContext();

  try {
    const response: VatReportRecords = {
      income: [],
      expenses: [],
      missingInfo: [],
      differentMonthDoc: [],
      businessTrips: [],
      incompleteDocuments: [],
    };

    const docsChargesIDs = new Set<string>();
    const reportIssuerId = filters?.financialEntityId;

    const fromDate = filters?.monthDate ? startOfTimelessMonth(filters.monthDate) : undefined;
    const toDate = filters?.monthDate ? endOfTimelessMonth(filters.monthDate) : undefined;

    // get all documents by date filters
    const relevantDocumentsPromise = injector
      .get(DocumentsProvider)
      .getDocumentsByFilters({
        fromVatDate: fromDate,
        toVatDate: toDate,
      })
      .then(documents =>
        documents.filter(doc => {
          // filter documents with vat_report_date_override outside of the date range
          if (doc.vat_report_date_override) {
            const isBeforeFromDate = fromDate && doc.vat_report_date_override < fromDate;
            const isAfterToDate = toDate && doc.vat_report_date_override > toDate;
            if (isBeforeFromDate || isAfterToDate) {
              return false;
            }
          }

          // Only financial (invoice) documents linked to a charge are considered by the VAT
          // report. Non-financial documents (e.g. "OTHER") may carry a date but must not be
          // included nor register their charge via `docsChargesIDs` (issue #3375).
          if (!isVatReportRelevantDocument(doc)) {
            return false;
          }

          docsChargesIDs.add(doc.charge_id);
          return true;
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

    const [relevantDocuments, businesses, charges] = await allSettledOrThrow([
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

    const extendedCharges = await allSettledOrThrow(
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
        doc.creditor_id === doc.owner_id
          ? doc.debtor_id
          : doc.debtor_id === doc.owner_id
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

    // A document without an amount, currency or date cannot be tax-adjusted. That is a data
    // problem with one document, not a report failure: set it aside and list its charge under
    // `missingInfo`, so the rest of the month still renders (#4946).
    const incompleteChargeIDs = new Set<string>();
    const isComplete = ({ doc, charge }: VatReportRecordSources) => {
      const missingFields = getVatReportDocumentMissingFields(doc);
      if (missingFields.length === 0) {
        return true;
      }
      response.incompleteDocuments.push({ documentId: doc.id, chargeId: charge.id, missingFields });
      incompleteChargeIDs.add(charge.id);
      return false;
    };
    const completeIncomeRecords = incomeRecords.filter(isComplete);
    const completeExpenseRecords = expenseRecords.filter(isComplete);

    if (completeIncomeRecords.length + completeExpenseRecords.length > 0) {
      // TODO: what if no exchange dates found?
      await allSettledOrThrow([
        ...completeIncomeRecords.map(async rawRecord =>
          adjustTaxRecord(rawRecord, injector).then(res => {
            response.income.push(res);
          }),
        ),
        ...completeExpenseRecords.map(async rawRecord =>
          adjustTaxRecord(rawRecord, injector).then(res => {
            response.expenses.push(res);
          }),
        ),
      ]);
    }

    // validate charges for missing info (only needed by the VAT report screen —
    // the income/expenses-only callers skip this expensive per-charge pass)
    if (includeChargeBuckets) {
      const validatedCharges = await allSettledOrThrow(
        charges.map(async charge => {
          const [validation, businessTrip] = await allSettledOrThrow([
            validateCharge(charge, injector),
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
        if (incompleteChargeIDs.has(charge.id)) {
          // One of its documents was left out of income/expenses above, so it needs fixing
          // whatever the charge-level validation says.
          response.missingInfo.push(charge);
        } else if (businessTripId) {
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
    }

    const documentDay = (record: RawVatReportRecord) =>
      record.documentDate ? getTimelessDateDay(record.documentDate) : 0;
    response.income = response.income.sort((a, b) => documentDay(b) - documentDay(a));
    response.expenses = response.expenses.sort((a, b) => documentDay(b) - documentDay(a));

    return response;
  } catch (e) {
    console.error('Error fetching vat report records:', e);
    throw new GraphQLError((e as Error)?.message ?? 'Error fetching vat report records');
  }
};
