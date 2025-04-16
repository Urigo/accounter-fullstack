import { format, startOfMonth } from 'date-fns';
import { BusinessesProvider } from '@modules/financial-entities/providers/businesses.provider.js';
import { TimelessDateString } from '@shared/types';
import { generatePcnFromCharges, getPcn874String } from '../helpers/pcn.helper.js';
import type { RawVatReportRecord } from '../helpers/vat-report.helper.js';
import { VatReportProvider } from '../providers/vat-report.provider.js';
import type { ReportsModule } from '../types.js';
import { getVatRecords } from './get-vat-records.resolver.js';

export const pcn874Resolvers: ReportsModule.Resolvers = {
  Query: {
    pcnFile: async (_, { monthDate: rawMonthDate, financialEntityId }, context) => {
      const { reportContent, monthDate, reportMonth, vatNumber } = await getPcn874String(
        context,
        financialEntityId,
        rawMonthDate,
      );

      const fileName = `pcn874_${vatNumber}_${reportMonth}.txt`;

      // if not exists, insert the report
      try {
        const existingContent = await context.injector
          .get(VatReportProvider)
          .getReportByBusinessIdAndMonthDateLoader.load([financialEntityId, monthDate]);
        if (!existingContent) {
          await context.injector.get(VatReportProvider).insertReport({
            businessId: financialEntityId,
            monthDate: monthDate,
            content: reportContent,
          });
        }
      } catch (error) {
        console.error('Error inserting report:', error);
      }

      return { reportContent, fileName };
    },
    pcnByDate: async (_, { businessId, fromMonthDate, toMonthDate }, context, __) => {
      const financialEntityId = businessId || context.adminContext.defaultAdminBusinessId;
      const financialEntity = await context.injector
        .get(BusinessesProvider)
        .getBusinessByIdLoader.load(financialEntityId);
      if (!financialEntity?.vat_number) {
        throw new Error(`Financial entity ${financialEntity?.name} has no VAT number`);
      }

      const months: string[] = [];
      const startTimestamp = new Date(fromMonthDate).getTime();

      await getPcn874String(context, financialEntityId, rawMonthDate);
      // TODO
      return [];
    },
  },
  Mutation: {
    updatePcn874: async (_, {}, context, __) => {
      return true;
    },
  },
};
