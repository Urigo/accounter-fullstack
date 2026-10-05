import type {
  QueryVatReportArgs,
  ResolverFn,
  ResolversParentTypes,
  ResolversTypes,
  VatReportResultResolvers,
} from '../../../../__generated__/types.js';
import { formatFinancialAmount } from '../../../../shared/helpers/index.js';
import { AdminContextProvider } from '../../../admin-context/providers/admin-context.provider.js';
import {
  getPcn874Totals,
  getVatReportSummaryRecords,
  transactionsFromVatReportRecords,
} from '../../helpers/pcn.helper.js';
import { getVatRecords } from '../get-vat-records.resolver.js';

export const vatReport: ResolverFn<
  ResolversTypes['VatReportResult'],
  ResolversParentTypes['Query'],
  GraphQLModules.Context,
  Partial<QueryVatReportArgs>
> = async (_, args, { injector }) => ({
  ...(await getVatRecords(args, injector)),
  // Kept on the parent so `summary` can tell whether the records cover the whole month.
  filters: args.filters,
});

export const vatReportResultMapper: VatReportResultResolvers = {
  // Same records and same totals as the header of the PCN874 file for the month.
  summary: async (report, _, { injector }) => {
    const [records, { defaultLocalCurrency }] = await Promise.all([
      getVatReportSummaryRecords(report, injector),
      injector.get(AdminContextProvider).getVerifiedAdminContext(),
    ]);
    const totals = getPcn874Totals(transactionsFromVatReportRecords(records));
    return {
      taxableSalesAmount: formatFinancialAmount(totals.taxableSalesAmount, defaultLocalCurrency),
      taxableSalesVat: formatFinancialAmount(totals.taxableSalesVat, defaultLocalCurrency),
      salesRecordCount: totals.salesRecordCount,
      zeroValOrExemptSalesAmount: formatFinancialAmount(
        totals.zeroValOrExemptSalesCount,
        defaultLocalCurrency,
      ),
      otherInputsVat: formatFinancialAmount(totals.otherInputsVat, defaultLocalCurrency),
      equipmentInputsVat: formatFinancialAmount(totals.equipmentInputsVat, defaultLocalCurrency),
      inputsCount: totals.inputsCount,
      totalVat: formatFinancialAmount(totals.totalVat, defaultLocalCurrency),
    };
  },
};
