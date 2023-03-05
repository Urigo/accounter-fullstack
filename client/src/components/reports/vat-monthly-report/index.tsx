import { useContext, useEffect, useState } from 'react';
import { format, lastDayOfMonth } from 'date-fns';
import { useQuery } from 'urql';
import { FiltersContext } from '../../../filters-context';
import { ChargeFilterType, VatMonthlyReportDocument, VatReportFilter } from '../../../gql/graphql';
import { dedupeFragments, DEFAULT_FINANCIAL_ENTITY_ID, TimelessDateString } from '../../../helpers';
import { useUrlQuery } from '../../../hooks/use-url-query';
import {
  AccounterLoader,
  EditChargeModal,
  InsertDocumentModal,
  MatchDocumentModal,
  UploadDocumentModal,
} from '../../common';
import { ExpensesTable } from './expenses-table';
import { IncomeTable } from './income-table';
import { MiscTable } from './misc-table';
import { MissingInfoTable } from './missing-info-table';
import { PCNGenerator } from './pcn-generator';
import { VatMonthlyReportFilter } from './vat-monthly-report-filters';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query VatMonthlyReport($filters: VatReportFilter) {
    vatReport(filters: $filters) {
      ...VarReportIncomeFields
      ...VarReportExpensesFields
      ...VarReportMissingInfoFields
      ...VarReportMiscTableFields
    }
  }
`;

export const VatMonthlyReport = () => {
  const { get } = useUrlQuery();
  const { setFiltersContext } = useContext(FiltersContext);
  const [filter, setFilter] = useState<VatReportFilter>(
    get('vatMonthlyReportFilters')
      ? (JSON.parse(
          decodeURIComponent(get('vatMonthlyReportFilters') as string),
        ) as VatReportFilter)
      : {
          financialEntityId: DEFAULT_FINANCIAL_ENTITY_ID,
          fromDate: format(new Date(), 'yyyy-MM-01') as TimelessDateString,
          toDate: format(lastDayOfMonth(new Date()), 'yyyy-MM-dd') as TimelessDateString,
        },
  );

  // modals state
  const [insertDocument, setInsertDocument] = useState<string | undefined>(undefined);
  const [matchDocuments, setMatchDocuments] = useState<{ id: string; ownerId: string } | undefined>(
    undefined,
  );
  const [uploadDocument, setUploadDocument] = useState<string | undefined>(undefined);
  const [editChargeId, setEditChargeId] = useState<string | undefined>(undefined);

  // fetch data
  const [{ data, fetching }] = useQuery({
    query: dedupeFragments(VatMonthlyReportDocument),
    variables: {
      filters: filter,
    },
  });
  useEffect(() => {
    setFiltersContext(
      <div className="flex flex-row gap-2">
        <PCNGenerator filter={filter} isLoading={fetching} />
        <VatMonthlyReportFilter filter={{ ...filter }} setFilter={setFilter} />
      </div>,
    );
  }, [data, filter, fetching, setFiltersContext]);

  return fetching ? (
    <AccounterLoader />
  ) : (
    <div className="flex flex-col gap-4">
      {filter.chargesType !== ChargeFilterType.Expense && <IncomeTable data={data?.vatReport} />}

      {filter.chargesType !== ChargeFilterType.Income && <ExpensesTable data={data?.vatReport} />}

      <MissingInfoTable
        data={data?.vatReport}
        setEditChargeId={setEditChargeId}
        setInsertDocument={setInsertDocument}
        setUploadDocument={setUploadDocument}
        setMatchDocuments={setMatchDocuments}
      />

      <MiscTable
        data={data?.vatReport}
        setEditChargeId={setEditChargeId}
        setInsertDocument={setInsertDocument}
        setUploadDocument={setUploadDocument}
        setMatchDocuments={setMatchDocuments}
      />

      {/* modification modals */}
      <EditChargeModal chargeId={editChargeId} onDone={() => setEditChargeId(undefined)} />
      {insertDocument && (
        <InsertDocumentModal
          insertDocument={insertDocument}
          setInsertDocument={setInsertDocument}
        />
      )}
      {uploadDocument && (
        <UploadDocumentModal
          uploadDocument={uploadDocument}
          setUploadDocument={setUploadDocument}
        />
      )}
      {matchDocuments && (
        <MatchDocumentModal
          chargeId={matchDocuments.id}
          ownerId={matchDocuments.ownerId}
          setMatchDocuments={() => setMatchDocuments(undefined)}
        />
      )}
    </div>
  );
};
