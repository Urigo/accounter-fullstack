import { useCallback, useEffect, useMemo, useState, type ReactElement } from 'react';
import {
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnFiltersState,
  type ExpandedState,
  type OnChangeFn,
  type RowSelectionState,
  type SortingState,
} from '@tanstack/react-table';
import {
  AccountantStatus,
  ChargeForChargesTableFieldsFragmentDoc,
  ChargesTableSuggestionsFieldsFragmentDoc,
  MissingChargeInfo,
  type ChargeForChargesTableFieldsFragment,
} from '../../gql/graphql.js';
import { getFragmentData, type FragmentType } from '../../gql/index.js';
import type { ChargeType } from '../../helpers/index.js';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table.js';
import type { AmountProps } from './cells/amount.js';
import type { BusinessTripProps } from './cells/business-trip.js';
import type { CounterpartyProps } from './cells/counterparty.js';
import { getDateProps, type DateProps } from './cells/date.js';
import type { DescriptionProps } from './cells/description.js';
import type { MoreInfoProps } from './cells/more-info.js';
import type { TagsProps } from './cells/tags.js';
import type { TaxCategoryProps } from './cells/tax-category.js';
import type { VatProps } from './cells/vat.js';
import { BatchChargesExtendedInfoProvider } from './charges-extended-info-loader.js';
import { ChargeRow } from './charges-row.js';
import { columns } from './columns.js';
import { DownloadChargesCsv } from './download-charges-csv.js';
import { shouldHaveCounterparty, shouldHaveTaxCategory, shouldHaveVat } from './utils.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment ChargesTableSuggestionsFields on Charge {
    id
    missingInfoSuggestions {
      description
      tags {
        id
        name
        namePath
      }
    }
  }
`;

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment ChargeForChargesTableFields on Charge {
    id
    __typename
    minEventDate
    minDebitDate
    minDocumentsDate
    maxDebitDate
    maxEventDate
    maxDocumentsDate
    totalAmount {
      raw
      currency
    }
    vat {
      raw
    }
    counterparty {
      name
      id
    }
    userDescription
    tags {
      id
      name
      namePath
    }
    taxCategory {
      id
      name
    }
    ... on BusinessTripCharge {
      businessTrip {
        id
        name
      }
    }
    metadata {
      transactionsCount
      documentsCount
      ledgerCount
      miscExpensesCount
      ... on ChargeMetadata @defer {
        invalidLedger
      }
    }
    accountantApproval
    ... on CreditcardBankCharge {
      validCreditCardAmount
    }
    ... on Charge {
      validationData {
        missingInfo
      }
    }
    ...ChargesTableSuggestionsFields @defer
  }
`;

export interface ChargeRow {
  id: string;
  onChange: () => void;
  type: ChargeType;
  date?: DateProps;
  amount?: AmountProps;
  vat?: Omit<VatProps, 'isError'>;
  counterparty?: CounterpartyProps;
  description: Omit<DescriptionProps, 'onChange'>;
  tags: Omit<TagsProps, 'onChange'>;
  taxCategory?: TaxCategoryProps;
  businessTrip?: BusinessTripProps;
  moreInfo: MoreInfoProps;
  accountantApproval: AccountantStatus;
}

export function convertChargeFragmentToTableRow(
  fragmentData: ChargeForChargesTableFieldsFragment,
): ChargeRow {
  // The suggestions fragment is deferred — its fields are absent from the
  // payload until the patch arrives, so unwrap defensively.
  const missingInfoSuggestions = getFragmentData(
    ChargesTableSuggestionsFieldsFragmentDoc,
    // each charge subtype carries its own variant ref, which the overloads
    // can't distribute over — the runtime is an identity unwrap either way
    fragmentData as FragmentType<typeof ChargesTableSuggestionsFieldsFragmentDoc>,
  )?.missingInfoSuggestions;
  return {
    id: fragmentData.id,
    onChange: () => {},
    type: fragmentData.__typename as ChargeType,
    date: getDateProps({
      minDebitDate: fragmentData.minDebitDate,
      minEventDate: fragmentData.minEventDate,
      minDocumentsDate: fragmentData.minDocumentsDate,
      maxDebitDate: fragmentData.maxDebitDate,
      maxEventDate: fragmentData.maxEventDate,
      maxDocumentsDate: fragmentData.maxDocumentsDate,
    }),
    amount: fragmentData.totalAmount
      ? {
          value: fragmentData.totalAmount.raw,
          currency: fragmentData.totalAmount.currency,
          shouldValidate: fragmentData.__typename === 'CreditcardBankCharge',
          isValid:
            fragmentData.__typename === 'CreditcardBankCharge'
              ? fragmentData.validCreditCardAmount
              : undefined,
        }
      : undefined,
    vat: shouldHaveVat(fragmentData.__typename)
      ? {
          value: fragmentData.vat?.raw,
          currency: fragmentData.totalAmount?.currency,
          missingInfo: fragmentData.validationData?.missingInfo.includes(MissingChargeInfo.Vat),
          amountValue: fragmentData.totalAmount?.raw,
        }
      : undefined,
    counterparty: shouldHaveCounterparty(fragmentData.__typename)
      ? {
          counterparty: fragmentData.counterparty
            ? {
                name: fragmentData.counterparty.name,
                id: fragmentData.counterparty.id,
              }
            : undefined,
          type: fragmentData.__typename as ChargeType,
          isMissing: fragmentData.validationData?.missingInfo.includes(
            MissingChargeInfo.Counterparty,
          ),
        }
      : undefined,
    description: {
      chargeId: fragmentData.id,
      value: fragmentData.userDescription?.trim() ?? undefined,
      isMissing: fragmentData.validationData?.missingInfo.includes(MissingChargeInfo.Description),
      suggestedDescription: missingInfoSuggestions?.description?.trim() ?? undefined,
    },
    tags: {
      chargeId: fragmentData.id,
      tags: fragmentData.tags.map(tag => ({
        id: tag.id,
        name: tag.name,
        namePath: tag.namePath ?? undefined,
      })),
      suggestedTags:
        missingInfoSuggestions?.tags.map(tag => ({
          id: tag.id,
          name: tag.name,
          namePath: tag.namePath ?? undefined,
        })) ?? [],
      isMissing: fragmentData.validationData?.missingInfo.includes(MissingChargeInfo.Tags),
    },
    taxCategory: shouldHaveTaxCategory(fragmentData.__typename)
      ? {
          taxCategory: fragmentData.taxCategory
            ? {
                id: fragmentData.taxCategory.id,
                name: fragmentData.taxCategory.name,
              }
            : undefined,
          isMissing: fragmentData.validationData?.missingInfo.includes(
            MissingChargeInfo.TaxCategory,
          ),
        }
      : undefined,
    businessTrip:
      'businessTrip' in fragmentData && fragmentData.businessTrip
        ? {
            id: fragmentData.businessTrip.id,
            name: fragmentData.businessTrip.name,
          }
        : undefined,
    moreInfo: {
      chargeId: fragmentData.id,
      type: fragmentData.__typename as ChargeType,
      isTransactionsMissing: fragmentData.validationData?.missingInfo.includes(
        MissingChargeInfo.Transactions,
      ),
      isDocumentsMissing: fragmentData.validationData?.missingInfo.includes(
        MissingChargeInfo.Documents,
      ),
      info: fragmentData.metadata
        ? {
            transactionsCount: fragmentData.metadata.transactionsCount,
            documentsCount: fragmentData.metadata.documentsCount,
            ledgerCount: fragmentData.metadata.ledgerCount,
            miscExpensesCount: fragmentData.metadata.miscExpensesCount,
            invalidLedger: fragmentData.metadata.invalidLedger,
          }
        : undefined,
    },
    accountantApproval: fragmentData.accountantApproval,
  };
}

interface Props {
  data?: FragmentType<typeof ChargeForChargesTableFieldsFragmentDoc>[];
  /**
   * Optional controlled row-selection state, keyed by charge id. Providing this lifts selection
   * out of the table (e.g. to link several tables in a report and drive cross-table actions).
   * Pair it with `onRowSelectionChange` for an editable selection; omit the handler for a
   * read-only selection. When this is omitted entirely, the table manages its own selection.
   */
  rowSelection?: RowSelectionState;
  /** Selection change handler for controlled selection. Receives a charge-id keyed map. */
  onRowSelectionChange?: OnChangeFn<RowSelectionState>;
  /**
   * When true, every charge in the table is expanded (batch-open / expand-all). Toggling it also
   * activates a single batched loader so the expanded rows are hydrated by one `chargesByIDs`
   * query instead of one `FetchCharge` query per row.
   */
  isAllOpened?: boolean;
  /**
   * When true, render a CSV export button above the table. The parent decides whether to expose it
   * (e.g. the All Charges screen, mainly for reviewing charges with validation/missing-info issues).
   * Defaults to hidden. Exports the selected rows when a selection is active, otherwise all rows.
   */
  showExport?: boolean;
}

export const ChargesTable = ({
  data,
  rowSelection: controlledRowSelection,
  onRowSelectionChange,
  isAllOpened = false,
  showExport = false,
}: Props): ReactElement => {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [internalRowSelection, setInternalRowSelection] = useState<RowSelectionState>({});
  const [expanded, setExpanded] = useState<ExpandedState>({});

  // Drive the whole-table expansion from the `isAllOpened` flag. `expanded === true` is
  // tanstack-table's "all rows expanded" sentinel; `{}` collapses everything. Setting it here
  // (rather than only in `initialState`) keeps toggling the button responsive after mount.
  useEffect(() => {
    setExpanded(isAllOpened ? true : {});
  }, [isAllOpened]);

  // Controlled whenever a parent supplies the state; otherwise self-managed. When controlled
  // without a change handler (e.g. a read-only selection), fall back to a no-op setter so the
  // passed state is still respected instead of being silently ignored.
  const isSelectionControlled = controlledRowSelection !== undefined;
  const rowSelection = isSelectionControlled ? controlledRowSelection : internalRowSelection;
  const setRowSelection = isSelectionControlled
    ? (onRowSelectionChange ?? (() => {}))
    : setInternalRowSelection;

  const [charges, setCharges] = useState<ChargeRow[]>([]);

  // Update a charge by its stable id (carried on the updated row). Matching on id (rather than row
  // index) keeps the update correct when the table is sorted, filtered, or paginated. Memoized so
  // the reference stays stable — `ChargeRow` lists it in a `useEffect` dependency array.
  const updateCharge = useCallback((updatedCharge: ChargeRow) => {
    setCharges(old => old.map(row => (row.id === updatedCharge.id ? updatedCharge : row)));
  }, []);

  // Update charges when data changes
  useEffect(() => {
    setCharges(
      data?.map(rawCharge =>
        convertChargeFragmentToTableRow(
          getFragmentData(ChargeForChargesTableFieldsFragmentDoc, rawCharge),
        ),
      ) ?? [],
    );
  }, [data]);

  const table = useReactTable({
    data: charges,
    columns,
    // Key row selection by charge id (not row index) so the selection map is stable across
    // sorting/filtering and shareable between tables when selection is controlled.
    getRowId: row => row.id,
    getCoreRowModel: getCoreRowModel(),
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    onColumnFiltersChange: setColumnFilters,
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onExpandedChange: setExpanded,
    getExpandedRowModel: getExpandedRowModel(),
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    state: {
      sorting,
      columnFilters,
      rowSelection,
      expanded,
    },
    initialState: {
      pagination: {
        pageIndex: 0,
        pageSize: 100,
      },
    },
  });

  // Ids of every charge in the table, fed to the batch loader so expand-all hydrates them all in a
  // single query.
  const chargeIds = useMemo(() => charges.map(charge => charge.id), [charges]);

  // Export the active selection when one exists, otherwise every charge currently in the table.
  const selectedIds = Object.keys(rowSelection).filter(id => rowSelection[id]);
  const exportIds = selectedIds.length > 0 ? selectedIds : chargeIds;

  return (
    <BatchChargesExtendedInfoProvider chargeIds={chargeIds} active={isAllOpened}>
      <div className="flex flex-col gap-2 w-auto max-w-fit">
        {showExport && (
          <div className="flex justify-end">
            <DownloadChargesCsv chargeIds={exportIds} />
          </div>
        )}
        <div className="overflow-hidden rounded-md border w-auto max-w-fit [&>div]:w-auto [&>div]:max-w-fit">
          <Table className="w-auto max-w-fit">
            <TableHeader>
              {table.getHeaderGroups().map(headerGroup => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map(header => (
                    <TableHead key={header.id} colSpan={header.colSpan}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  ))}
                  <TableHead />
                </TableRow>
              ))}
            </TableHeader>
            <TableBody className="w-auto max-w-fit">
              {table.getRowModel().rows?.length ? (
                table
                  .getRowModel()
                  .rows.map(row => <ChargeRow key={row.id} row={row} updateCharge={updateCharge} />)
              ) : (
                <TableRow>
                  <TableCell colSpan={columns.length} className="h-24 text-center">
                    No results.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </BatchChargesExtendedInfoProvider>
  );
};
