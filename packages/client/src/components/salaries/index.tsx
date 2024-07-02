import { ReactElement, useContext, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useQuery } from 'urql';
import { SalaryScreenRecordsDocument } from '../../gql/graphql.js';
import { useUrlQuery } from '../../hooks/use-url-query.js';
import { FiltersContext } from '../../providers/filters-context.js';
import {
  EditSalaryRecordModal,
  InsertMiniButton,
  InsertSalaryRecordModal,
} from '../common/index.js';
import { PageLayout } from '../layout/page-layout.js';
import { getDefaultFilterDates, SalariesFilter, SalariesFilters } from './salaries-filters.js';
import { SalariesTable } from './salaries-table.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query SalaryScreenRecords(
    $fromDate: TimelessDate!
    $toDate: TimelessDate!
    $employeeIDs: [UUID!]
  ) {
    salaryRecordsByDates(fromDate: $fromDate, toDate: $toDate, employeeIDs: $employeeIDs) {
      month
      employee {
        id
      }
      ...SalariesTableFields
    }
  }
`;

export const Salaries = (): ReactElement => {
  const { setFiltersContext } = useContext(FiltersContext);
  const [editSalaryRecord, setEditSalaryRecord] = useState<
    { month: string; employeeId: string } | undefined
  >(undefined);
  const [insertSalaryRecord, setInsertSalaryRecord] = useState<{ month?: string } | undefined>(
    undefined,
  );
  const { get } = useUrlQuery();
  const [filter, setFilter] = useState<SalariesFilter>(
    get('salariesFilters')
      ? (JSON.parse(decodeURIComponent(get('salariesFilters') as string)) as SalariesFilter)
      : {
          ...getDefaultFilterDates(),
        },
  );

  const [{ data, fetching }] = useQuery({
    query: SalaryScreenRecordsDocument,
    variables: {
      ...filter,
    },
  });

  useEffect(() => {
    setFiltersContext(
      <div className="flex flex-row gap-x-5">
        <SalariesFilters filter={filter} setFilter={setFilter} />
        <InsertMiniButton variant="default" onClick={() => setInsertSalaryRecord({})} />
      </div>,
    );
  }, [data, fetching, filter, setFiltersContext, setFilter]);

  return (
    <PageLayout title="Salaries" description="View and manage salaries of employees.">
      {fetching ? (
        <Loader2 className="h-10 w-10 animate-spin mr-2 self-center" />
      ) : (
        <SalariesTable
          setEditSalaryRecord={setEditSalaryRecord}
          setInsertSalaryRecord={setInsertSalaryRecord}
          data={data?.salaryRecordsByDates}
        />
      )}
      <EditSalaryRecordModal
        recordVariables={editSalaryRecord}
        onDone={(): void => setEditSalaryRecord(undefined)}
      />
      {insertSalaryRecord && (
        <InsertSalaryRecordModal
          insertSalaryRecordParams={insertSalaryRecord}
          setInsertSalaryRecord={setInsertSalaryRecord}
        />
      )}
    </PageLayout>
  );
};
