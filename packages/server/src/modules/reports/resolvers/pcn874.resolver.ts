import { addMonths, endOfMonth, startOfMonth } from 'date-fns';
import { GraphQLError } from 'graphql';
import { Repeater } from 'graphql-yoga';
import { ResolversTypes } from '@shared/gql-types';
import { dateToTimelessDateString } from '@shared/helpers';
import { TimelessDateString } from '@shared/types';
import { getPcn874String } from '../helpers/pcn.helper.js';
import { VatReportProvider } from '../providers/vat-report.provider.js';
import type { ReportsModule } from '../types.js';

export const pcn874Resolvers: ReportsModule.Resolvers = {
  Query: {
    pcnFile: async (_, { monthDate: rawMonthDate, financialEntityId }, context) => {
      const { reportContent, monthDate, reportMonth, financialEntity } = await getPcn874String(
        context,
        financialEntityId,
        rawMonthDate,
      );

      // if not exists, insert the report
      try {
        const existingContent = await context.injector
          .get(VatReportProvider)
          .getReportByBusinessIdAndMonthDateLoader.load([financialEntityId, monthDate]);
        if (!existingContent) {
          await context.injector.get(VatReportProvider).insertReport({
            businessId: financialEntityId,
            monthDate,
            content: reportContent,
          });
        }
      } catch (error) {
        console.error('Error inserting report:', error);
      }

      const fileName = `pcn874_${financialEntity.vat_number}_${reportMonth}.txt`;

      return { reportContent, fileName };
    },
    pcnByDate: async (_, { businessId, fromMonthDate, toMonthDate }, context, __) => {
      const financialEntityId = businessId || context.adminContext.defaultAdminBusinessId;
      const months: TimelessDateString[] = [];
      let startTimestamp = startOfMonth(new Date(fromMonthDate)).getTime();
      const endTimestamp = endOfMonth(new Date(toMonthDate)).getTime();
      while (startTimestamp <= endTimestamp) {
        const currMonth = startOfMonth(new Date(startTimestamp));
        months.push(dateToTimelessDateString(currMonth));
        const nextMonth = addMonths(currMonth, 1);
        startTimestamp = nextMonth.getTime();
      }

      return new Repeater<ResolversTypes['Pcn874Records']>(async (push, stop) => {
        await Promise.all(
          months.map(async monthDate => {
            try {
              const [savedReport, { reportContent: generatedReport, financialEntity }] =
                await Promise.all([
                  context.injector
                    .get(VatReportProvider)
                    .getReportByBusinessIdAndMonthDateLoader.load([financialEntityId, monthDate]),
                  getPcn874String(context, financialEntityId, monthDate),
                ]);

              if (savedReport) {
                push({
                  id: `${monthDate}-${financialEntityId}`,
                  date: monthDate,
                  business: financialEntity,
                  content: generatedReport,
                  diffContent: savedReport === generatedReport ? undefined : savedReport,
                });
              } else {
                push({
                  id: `${monthDate}-${financialEntityId}`,
                  date: monthDate,
                  business: financialEntity,
                  content: generatedReport,
                });
              }
            } catch (error) {
              const message = `Error fetching report for month ${monthDate}`;
              console.error(message, error);
              throw new Error(message);
            }
          }),
        );
        stop();
      }) as unknown as Promise<readonly ResolversTypes['Pcn874Records'][]>;
    },
  },
  Mutation: {
    updatePcn874: async (_, { monthDate, businessId, content }, context, __) => {
      try {
        const normalizedMonthDate = dateToTimelessDateString(startOfMonth(new Date(monthDate)));
        await context.injector.get(VatReportProvider).updateReport({
          businessId,
          monthDate: normalizedMonthDate,
          content,
        });
        return true;
      } catch (error) {
        const message = `Error updating report for month ${monthDate}`;
        console.error(message, error);
        throw new GraphQLError(message);
      }
    },
  },
};
