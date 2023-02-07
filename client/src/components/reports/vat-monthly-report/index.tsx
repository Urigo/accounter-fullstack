import { useState } from 'react';
import { format, lastDayOfMonth } from 'date-fns';
import { useQuery } from 'urql';
import { VatMonthlyReportDocument, VatReportFilter } from '../../../gql/graphql';
import { TimelessDateString } from '../../../helpers';
import { useUrlQuery } from '../../../hooks/use-url-query';
import { AccounterLoader, NavBar } from '../../common';
import { ExpensesTable } from './expenses-table';
import { IncomeTable } from './income-table';
import { MissingInfoTable } from './missing-info-table';
import { VatMonthlyReportFilter } from './vat-monthly-report-filters';

/* GraphQL */ `
  query VatMonthlyReport($filters: VatReportFilter) {
    vatReport(filters: $filters) {
      ...VarReportIncomeFields
      ...VarReportExpensesFields
      ...VarReportMissingInfoFields
    }
  }
`;

export const VatMonthlyReport = () => {
  const { get } = useUrlQuery();
  const [filter, setFilter] = useState<VatReportFilter>(
    get('vatMonthlyReportFilters')
      ? (JSON.parse(
          decodeURIComponent(get('vatMonthlyReportFilters') as string),
        ) as VatReportFilter)
      : {
          financialEntityId: '6a20aa69-57ff-446e-8d6a-1e96d095e988',
          fromDate: format(new Date(), 'yyyy-MM-01') as TimelessDateString,
          toDate: format(lastDayOfMonth(new Date()), 'yyyy-MM-dd') as TimelessDateString,
        },
  );
  const [{ data, fetching }] = useQuery({
    query: VatMonthlyReportDocument,
    variables: {
      filters: filter,
    },
  });

  return (
    <div className="text-gray-600 body-font">
      <div className="container md:px-5 px-2 md:py-12 py-2 mx-auto">
        <NavBar
          header="Vat Monthly Report"
          filters={
            <div className="flex flex-row gap-2">
              <VatMonthlyReportFilter filter={{ ...filter }} setFilter={setFilter} />
            </div>
          }
        />
        {fetching ? (
          <AccounterLoader />
        ) : (
          <div className="flex flex-col gap-4">
            <IncomeTable data={data?.vatReport} />

            <ExpensesTable data={data?.vatReport} />

            <MissingInfoTable data={data?.vatReport} />
          </div>
        )}
      </div>
    </div>
  );
};
