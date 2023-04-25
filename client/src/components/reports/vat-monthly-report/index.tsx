import { useState } from 'react';
import { format, lastDayOfMonth } from 'date-fns';
import { useQuery } from 'urql';
import { FragmentType } from '../../../gql';
import {
  ChargeFilterType,
  EditChargeFieldsFragmentDoc,
  VatMonthlyReportDocument,
  VatReportFilter,
} from '../../../gql/graphql';
import { dedupeFragments, DEFAULT_FINANCIAL_ENTITY_ID, TimelessDateString } from '../../../helpers';
import { useUrlQuery } from '../../../hooks/use-url-query';
import {
  AccounterLoader,
  EditChargeModal,
  InsertDocumentModal,
  MatchDocumentModal,
  NavBar,
  UploadDocumentModal,
} from '../../common';
import { ExpensesTable } from './expenses-table';
import { IncomeTable } from './income-table';
import { MiscTable } from './misc-table';
import { MissingInfoTable } from './missing-info-table';
import { PCNGenerator } from './pcn-generator';
import { VatMonthlyReportFilter } from './vat-monthly-report-filters';

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
  const [matchDocuments, setMatchDocuments] = useState<string | undefined>(undefined);
  const [uploadDocument, setUploadDocument] = useState<string | undefined>(undefined);
  const [editCharge, setEditCharge] = useState<
    FragmentType<typeof EditChargeFieldsFragmentDoc> | undefined
  >(undefined);

  // fetch data
  const [{ data, fetching }] = useQuery({
    query: dedupeFragments(VatMonthlyReportDocument),
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
              <PCNGenerator filter={filter} isLoading={fetching} />
              <VatMonthlyReportFilter filter={{ ...filter }} setFilter={setFilter} />
            </div>
          }
        />
        {fetching ? (
          <AccounterLoader />
        ) : (
          <div className="flex flex-col gap-4">
            {filter.chargesType !== ChargeFilterType.Expense && (
              <IncomeTable data={data?.vatReport} />
            )}

            {filter.chargesType !== ChargeFilterType.Income && (
              <ExpensesTable data={data?.vatReport} />
            )}

            <MissingInfoTable
              data={data?.vatReport}
              setEditCharge={setEditCharge}
              setInsertDocument={setInsertDocument}
              setUploadDocument={setUploadDocument}
              setMatchDocuments={setMatchDocuments}
            />

            <MiscTable
              data={data?.vatReport}
              setEditCharge={setEditCharge}
              setInsertDocument={setInsertDocument}
              setUploadDocument={setUploadDocument}
              setMatchDocuments={setMatchDocuments}
            />

            {/* modification modals */}
            {editCharge && (
              <EditChargeModal editCharge={editCharge} setEditCharge={setEditCharge} />
            )}
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
                matchDocuments={matchDocuments}
                setMatchDocuments={setMatchDocuments}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
};
