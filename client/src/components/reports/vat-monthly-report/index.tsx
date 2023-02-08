import { useState } from 'react';
import { format, lastDayOfMonth } from 'date-fns';
import { useQuery } from 'urql';
import { FragmentType } from '../../../gql';
import {
  EditChargeFieldsFragmentDoc,
  VatMonthlyReportDocument,
  VatReportFilter,
} from '../../../gql/graphql';
import { dedupeFragments, TimelessDateString } from '../../../helpers';
import { useUrlQuery } from '../../../hooks/use-url-query';
import {
  AccounterLoader,
  EditChargeModal,
  InsertDocumentModal,
  InsertLedgerRecordModal,
  MatchDocumentModal,
  NavBar,
  UploadDocumentModal,
} from '../../common';
import { ExpensesTable } from './expenses-table';
import { IncomeTable } from './income-table';
import { MiscTable } from './misc-table';
import { MissingInfoTable } from './missing-info-table';
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
          financialEntityId: '6a20aa69-57ff-446e-8d6a-1e96d095e988',
          fromDate: format(new Date(), 'yyyy-MM-01') as TimelessDateString,
          toDate: format(lastDayOfMonth(new Date()), 'yyyy-MM-dd') as TimelessDateString,
        },
  );

  // modals state
  const [insertLedger, setInsertLedger] = useState<string | undefined>(undefined);
  const [insertDocument, setInsertDocument] = useState<string | undefined>(undefined);
  const [matchDocuments, setMatchDocuments] = useState<string | undefined>(undefined);
  const [uploadDocument, setUploadDocument] = useState<string | undefined>(undefined);
  const [editCharge, setEditCharge] = useState<
    FragmentType<typeof EditChargeFieldsFragmentDoc> | undefined
  >(undefined);

  // fetch date
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

            <MissingInfoTable
              data={data?.vatReport}
              setEditCharge={setEditCharge}
              setInsertLedger={setInsertLedger}
              setInsertDocument={setInsertDocument}
              setUploadDocument={setUploadDocument}
              setMatchDocuments={setMatchDocuments}
            />

            <MiscTable
              data={data?.vatReport}
              setEditCharge={setEditCharge}
              setInsertLedger={setInsertLedger}
              setInsertDocument={setInsertDocument}
              setUploadDocument={setUploadDocument}
              setMatchDocuments={setMatchDocuments}
            />

            {/* modification modals */}
            {editCharge && (
              <EditChargeModal editCharge={editCharge} setEditCharge={setEditCharge} />
            )}
            {insertLedger && (
              <InsertLedgerRecordModal
                insertLedger={insertLedger}
                setInsertLedger={setInsertLedger}
              />
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
