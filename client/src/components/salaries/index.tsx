import { ReactElement, useCallback, useContext, useEffect, useState } from 'react';
import { LayoutNavbarCollapse, LayoutNavbarExpand } from 'tabler-icons-react';
import { useQuery } from 'urql';
import { ActionIcon, Tooltip } from '@mantine/core';
import { FiltersContext } from '../../filters-context';
import {
  AllChargesDocument,
  ChargeFilter,
  ChargeSortByField,
  GetSalaryRecordsDocument,
} from '../../gql/graphql.js';
import { DEFAULT_FINANCIAL_ENTITY_ID } from '../../helpers';
import { useUrlQuery } from '../../hooks/use-url-query';
import {
  AccounterLoader,
  EditChargeModal,
  InsertDocumentModal,
  MatchDocumentModal,
  MergeChargesButton,
  UploadDocumentModal,
} from '../common';
import { SalariesScreen } from './salaries-screen';

// import { SalariesFilters } from './salaries-filters';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query GetSalaryRecords($fromDate: TimelessDate!, $toDate: TimelessDate!) {
    salaryRecordsByDates(fromDate: $fromDate, toDate: $toDate) {
        month
        employee {
            id
            name
        }
        directAmount {
            formatted
        }
    }
  }
`;

export const Salaries = (): ReactElement => {
  const { setFiltersContext } = useContext(FiltersContext);
  //   const [editChargeId, setEditChargeId] = useState<string | undefined>(undefined);
  //   const [insertDocument, setInsertDocument] = useState<string | undefined>(undefined);
  const [isAllOpened, setIsAllOpened] = useState<boolean>(false);
  //   const { get } = useUrlQuery();
  //   const [activePage, setActivePage] = useState(get('page') ? Number(get('page')) : 1);
  //   const [filter, setFilter] = useState<ChargeFilter>(
  //     get('chargesFilters')
  //       ? (JSON.parse(decodeURIComponent(get('chargesFilters') as string)) as ChargeFilter)
  //       : {
  //           byOwners: [DEFAULT_FINANCIAL_ENTITY_ID],
  //           sortBy: {
  //             field: ChargeSortByField.Date,
  //             asc: false,
  //           },
  //         },
  //   );

  const [{ data, fetching }] = useQuery({
    query: GetSalaryRecordsDocument,
    variables: {
      fromDate: '2022-01-01',
      toDate: '2022-12-31',
    },
  });

  //   useEffect(() => {
  //     setFiltersContext(
  //       <div className="flex flex-row gap-x-5">
  //         <SalariesFilters
  //           filter={filter}
  //           setFilter={setFilter}
  //         />
  //         <Tooltip label="Expand all accounts">
  //           <ActionIcon variant="default" onClick={(): void => setIsAllOpened(i => !i)} size={30}>
  //             {isAllOpened ? <LayoutNavbarCollapse size={20} /> : <LayoutNavbarExpand size={20} />}
  //           </ActionIcon>
  //         </Tooltip>
  //         <MergeChargesButton chargeIDs={mergeSelectedCharges} resetMerge={onResetMerge} />
  //       </div>,
  //     );
  //   }, [
  //     data,
  //     fetching,
  //     filter,
  //     activePage,
  //     isAllOpened,
  //     setFiltersContext,
  //     setActivePage,
  //     setFilter,
  //     setIsAllOpened,
  //     mergeSelectedCharges,
  //   ]);

  return (
    <>
      {fetching ? (
        <AccounterLoader />
      ) : (
        <SalariesScreen
          setEditChargeId={setEditChargeId}
          setInsertDocument={setInsertDocument}
          setMatchDocuments={setMatchDocuments}
          setUploadDocument={setUploadDocument}
          toggleMergeCharge={toggleMergeCharge}
          mergeSelectedCharges={mergeSelectedCharges}
          data={data?.allCharges?.nodes}
          isAllOpened={isAllOpened}
        />
      )}
      {/* <EditSalaryRecordModal chargeId={editChargeId} onDone={(): void => setEditChargeId(undefined)} />
      {insertSalaryRecord && (
        <InsertSalaryRecordModal
          insertSalaryRecord={insertSalaryRecord}
          setInsertSalaryRecord={setInsertSalaryRecord}
        />
      )} */}
    </>
  );
};
