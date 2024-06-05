import { ReactElement, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { format, lastDayOfMonth } from 'date-fns';
import { useQuery } from 'urql';
import { graphql, VariablesOf } from '../../../graphql.js';
import { dedupeFragments, TimelessDateString } from '../../../helpers';
import { useUrlQuery } from '../../../hooks/use-url-query';
import { FiltersContext } from '../../../providers/filters-context';
import { UserContext } from '../../../providers/user-provider.js';
import {
  AccounterLoader,
  EditChargeModal,
  InsertDocumentModal,
  MatchDocumentModal,
  MergeChargesButton,
  UploadDocumentModal,
} from '../../common';
import {
  BusinessTripsTable,
  VatReportBusinessTripsFieldsFragmentDoc,
} from './business-trips-table';
import {
  ExpensesTable,
  VatReportExpensesFieldsFragmentDoc,
} from './expenses-section/expenses-table';
import { IncomeTable, VatReportIncomeFieldsFragmentDoc } from './income-section/income-table';
import { MiscTable, VatReportMiscTableFieldsFragmentDoc } from './misc-table';
import { MissingInfoTable, VatReportMissingInfoFieldsFragmentDoc } from './missing-info-table';
import { PCNGenerator } from './pcn-generator';
import { VatMonthlyReportFilter } from './vat-monthly-report-filters';

export const VatMonthlyReportDocument = graphql(
  `
    query VatMonthlyReport($filters: VatReportFilter) {
      vatReport(filters: $filters) {
        ...VatReportIncomeFields
        ...VatReportExpensesFields
        ...VatReportMissingInfoFields
        ...VatReportMiscTableFields
        ...VatReportBusinessTripsFields
      }
    }
  `,
  [
    VatReportIncomeFieldsFragmentDoc,
    VatReportExpensesFieldsFragmentDoc,
    VatReportMissingInfoFieldsFragmentDoc,
    VatReportMiscTableFieldsFragmentDoc,
    VatReportBusinessTripsFieldsFragmentDoc,
  ],
);

export type VatReportFilter = NonNullable<VariablesOf<typeof VatMonthlyReportDocument>['filters']>;

export const VatMonthlyReport = (): ReactElement => {
  const { get } = useUrlQuery();
  const { setFiltersContext } = useContext(FiltersContext);
  const { userContext } = useContext(UserContext);
  const [filter, setFilter] = useState<VatReportFilter>(
    get('vatMonthlyReportFilters')
      ? (JSON.parse(
          decodeURIComponent(get('vatMonthlyReportFilters') as string),
        ) as VatReportFilter)
      : {
          financialEntityId: userContext?.ownerId ?? '',
          fromDate: format(new Date(), 'yyyy-MM-01') as TimelessDateString,
          toDate: format(lastDayOfMonth(new Date()), 'yyyy-MM-dd') as TimelessDateString,
        },
  );
  const [mergeSelectedCharges, setMergeSelectedCharges] = useState<Array<string>>([]);

  // modals state
  const [insertDocument, setInsertDocument] = useState<
    { id: string; onChange: () => void } | undefined
  >(undefined);
  const [matchDocuments, setMatchDocuments] = useState<{ id: string; ownerId: string } | undefined>(
    undefined,
  );
  const [uploadDocument, setUploadDocument] = useState<
    { id: string; onChange: () => void } | undefined
  >(undefined);
  const [editCharge, setEditCharge] = useState<{ id: string; onChange: () => void } | undefined>(
    undefined,
  );

  // fetch data
  const [{ data, fetching }] = useQuery({
    query: dedupeFragments(VatMonthlyReportDocument),
    variables: {
      filters: filter,
    },
  });

  const toggleMergeCharge = useCallback(
    (chargeId: string) => {
      if (mergeSelectedCharges.includes(chargeId)) {
        setMergeSelectedCharges(mergeSelectedCharges.filter(id => id !== chargeId));
      } else {
        setMergeSelectedCharges([...mergeSelectedCharges, chargeId]);
      }
    },
    [mergeSelectedCharges],
  );

  function onResetMerge(): void {
    setMergeSelectedCharges([]);
  }

  useEffect(() => {
    setFiltersContext(
      <div className="flex flex-row gap-2">
        <PCNGenerator filter={filter} isLoading={fetching} />
        <VatMonthlyReportFilter filter={{ ...filter }} setFilter={setFilter} />
        <MergeChargesButton
          selected={mergeSelectedCharges.map(id => ({
            id,
            onChange: (): void => {
              return;
            },
          }))}
          resetMerge={onResetMerge}
        />
      </div>,
    );
  }, [data, filter, fetching, setFiltersContext, mergeSelectedCharges]);

  const mergeSelectedChargesSet = useMemo(
    () => new Set(mergeSelectedCharges),
    [mergeSelectedCharges],
  );
  return fetching ? (
    <AccounterLoader />
  ) : (
    <div className="flex flex-col gap-4">
      {filter?.chargesType !== 'EXPENSE' && (
        <IncomeTable
          data={data?.vatReport}
          toggleMergeCharge={toggleMergeCharge}
          mergeSelectedCharges={mergeSelectedCharges}
        />
      )}

      {filter?.chargesType !== 'INCOME' && (
        <ExpensesTable
          data={data?.vatReport}
          toggleMergeCharge={toggleMergeCharge}
          mergeSelectedCharges={mergeSelectedCharges}
        />
      )}

      <MissingInfoTable
        data={data?.vatReport}
        setEditCharge={setEditCharge}
        setInsertDocument={setInsertDocument}
        setUploadDocument={setUploadDocument}
        setMatchDocuments={setMatchDocuments}
        toggleMergeCharge={toggleMergeCharge}
        mergeSelectedCharges={mergeSelectedChargesSet}
      />

      <BusinessTripsTable
        data={data?.vatReport}
        setEditCharge={setEditCharge}
        setInsertDocument={setInsertDocument}
        setUploadDocument={setUploadDocument}
        setMatchDocuments={setMatchDocuments}
        toggleMergeCharge={toggleMergeCharge}
        mergeSelectedCharges={mergeSelectedChargesSet}
      />

      <MiscTable
        data={data?.vatReport}
        setEditCharge={setEditCharge}
        setInsertDocument={setInsertDocument}
        setUploadDocument={setUploadDocument}
        setMatchDocuments={setMatchDocuments}
        toggleMergeCharge={toggleMergeCharge}
        mergeSelectedCharges={mergeSelectedChargesSet}
      />

      {/* modification modals */}
      {editCharge && (
        <EditChargeModal chargeId={editCharge.id} close={(): void => setEditCharge(undefined)} />
      )}
      {insertDocument && (
        <InsertDocumentModal
          chargeId={insertDocument.id}
          close={() => setInsertDocument(undefined)}
        />
      )}
      {uploadDocument && (
        <UploadDocumentModal
          chargeId={uploadDocument?.id}
          close={() => setUploadDocument(undefined)}
        />
      )}
      {matchDocuments && (
        <MatchDocumentModal
          chargeId={matchDocuments.id}
          ownerId={matchDocuments.ownerId}
          setMatchDocuments={(): void => setMatchDocuments(undefined)}
        />
      )}
    </div>
  );
};
