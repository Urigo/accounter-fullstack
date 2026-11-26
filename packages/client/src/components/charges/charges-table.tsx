import { useCallback, useEffect, useMemo, useState, type ReactElement } from 'react';
import type { DocumentTypeDecoration } from '@graphql-typed-document-node/core';
import {
  flexRender,
  useTable,
  type ColumnFiltersState,
  type ExpandedState,
  type OnChangeFn,
  type RowSelectionState,
  type SortingState,
} from '@tanstack/react-table';
import { paginatedTableFeaturesConfig } from '@/lib/table-features.js';
import {
  AccountantStatus,
  ChargeForChargesTableFieldsFragmentDoc,
  ChargesTableAmountFieldsFragmentDoc,
  ChargesTableApprovalFieldsFragmentDoc,
  ChargesTableBusinessTripFieldsFragmentDoc,
  ChargesTableCounterpartyFieldsFragmentDoc,
  ChargesTableDateFieldsFragmentDoc,
  ChargesTableDescriptionFieldsFragmentDoc,
  ChargesTableMoreInfoFieldsFragmentDoc,
  ChargesTableRowFieldsFragmentDoc,
  ChargesTableSuggestionsFieldsFragmentDoc,
  ChargesTableTagsFieldsFragmentDoc,
  ChargesTableTaxCategoryFieldsFragmentDoc,
  ChargesTableTypeFieldsFragmentDoc,
  ChargesTableVatFieldsFragmentDoc,
  MissingChargeInfo,
  type ChargeForChargesTableFieldsFragment,
} from '../../gql/graphql.js';
import { getFragmentData, type FragmentType } from '../../gql/index.js';
import type { ChargeType } from '../../helpers/index.js';
import { useStableValue } from '../../hooks/use-stable-value.js';
import { ChargeRefreshProvider } from '../../providers/charge-refresh.js';
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

// The fields the accountant-status control in the select column shows. The other columns' fields
// are in a fragment next to each cell (`cells/`).
// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment ChargesTableApprovalFields on Charge {
    id
    accountantApproval
  }
`;

// What a row shows as soon as the charge loads: one fragment per cell. A charge mutation returns
// exactly this (`ChargeMutationResultFields`, hooks/charge-mutation-result.graphql.ts), which is
// how the client cache updates a row from the mutation's result, with no refetch.
// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment ChargesTableRowFields on Charge {
    id
    ...ChargesTableApprovalFields
    ...ChargesTableTypeFields
    ...ChargesTableDateFields
    ...ChargesTableAmountFields
    ...ChargesTableVatFields
    ...ChargesTableCounterpartyFields
    ...ChargesTableDescriptionFields
    ...ChargesTableTagsFields
    ...ChargesTableTaxCategoryFields
    ...ChargesTableBusinessTripFields
    ...ChargesTableMoreInfoFields
  }
`;

// The row's fields, plus the two parts that are slow to compute and arrive later (`@defer`): the
// ledger validation and the suggestions. Those are not in mutation results, so that a save does
// not wait for them.
// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment ChargeForChargesTableFields on Charge {
    id
    ...ChargesTableRowFields
    metadata {
      ... on ChargeMetadata @defer {
        invalidLedger
      }
    }
    ...ChargesTableSuggestionsFields @defer
  }
`;

export interface ChargeRow {
  id: string;
  /** Loads the charge again from the server. For an action that did not hand back the row. */
  onChange: () => void;
  /**
   * For an edit whose mutation result already carried the row's fields (see `ChargesTableRowFields`):
   * shows the charge as the client cache now has it, and asks the server only when the cache
   * cannot answer, which is the case in a table whose list did not go through the cache.
   */
  onSaved: () => void;
  /**
   * `onChange`, plus a refresh of the charge's expansion in expand-all mode. For actions that
   * change what the expansion shows, such as a document upload.
   */
  onChangeWithExpansion: () => void;
  /** Drops this charge's row from the table after it was deleted on the server. */
  onDelete: () => void;
  type: ChargeType;
  date?: DateProps;
  amount?: AmountProps['amount'];
  vat?: Omit<VatProps, 'isError'>;
  counterparty?: CounterpartyProps;
  description: Omit<DescriptionProps, 'onChange'>;
  tags: Omit<TagsProps, 'onChange'>;
  taxCategory?: TaxCategoryProps;
  businessTrip?: BusinessTripProps;
  moreInfo: Omit<MoreInfoProps, 'onChange'>;
  accountantApproval: AccountantStatus;
}

/**
 * Reads one fragment's fields off a charge that spreads it.
 *
 * `getFragmentData` cannot take the charge as it is typed: `Charge` is an interface, so codegen
 * gives each concrete type its own reference to the fragment, and the overloads don't distribute
 * over that union. At runtime the unwrap is an identity either way.
 */
function fieldsOf<TFields>(
  document: DocumentTypeDecoration<TFields, unknown>,
  charge: unknown,
): TFields {
  return getFragmentData(
    document,
    charge as FragmentType<DocumentTypeDecoration<TFields, unknown>>,
  );
}

export function convertChargeFragmentToTableRow(
  fragmentData: ChargeForChargesTableFieldsFragment,
): ChargeRow {
  const row = fieldsOf(ChargesTableRowFieldsFragmentDoc, fragmentData);
  const type = fieldsOf(ChargesTableTypeFieldsFragmentDoc, row).__typename as ChargeType;
  const dates = fieldsOf(ChargesTableDateFieldsFragmentDoc, row);
  const amount = fieldsOf(ChargesTableAmountFieldsFragmentDoc, row);
  const vat = fieldsOf(ChargesTableVatFieldsFragmentDoc, row);
  const counterparty = fieldsOf(ChargesTableCounterpartyFieldsFragmentDoc, row);
  const description = fieldsOf(ChargesTableDescriptionFieldsFragmentDoc, row);
  const tags = fieldsOf(ChargesTableTagsFieldsFragmentDoc, row);
  const taxCategory = fieldsOf(ChargesTableTaxCategoryFieldsFragmentDoc, row);
  const businessTrip = fieldsOf(ChargesTableBusinessTripFieldsFragmentDoc, row);
  const moreInfo = fieldsOf(ChargesTableMoreInfoFieldsFragmentDoc, row);
  const approval = fieldsOf(ChargesTableApprovalFieldsFragmentDoc, row);
  // The suggestions fragment is deferred — its fields are absent from the
  // payload until the patch arrives, so unwrap defensively.
  const missingInfoSuggestions = fieldsOf(
    ChargesTableSuggestionsFieldsFragmentDoc,
    fragmentData,
  )?.missingInfoSuggestions;
  return {
    id: fragmentData.id,
    onChange: () => {},
    onSaved: () => {},
    onChangeWithExpansion: () => {},
    onDelete: () => {},
    type,
    date: getDateProps({
      minDebitDate: dates.minDebitDate,
      minEventDate: dates.minEventDate,
      minDocumentsDate: dates.minDocumentsDate,
      maxDebitDate: dates.maxDebitDate,
      maxEventDate: dates.maxEventDate,
      maxDocumentsDate: dates.maxDocumentsDate,
    }),
    amount: amount.totalAmount
      ? {
          value: amount.totalAmount.raw,
          currency: amount.totalAmount.currency,
          shouldValidate: amount.__typename === 'CreditcardBankCharge',
          isValid:
            amount.__typename === 'CreditcardBankCharge' ? amount.validCreditCardAmount : undefined,
        }
      : undefined,
    vat: shouldHaveVat(type)
      ? {
          value: vat.vat?.raw,
          currency: vat.totalAmount?.currency,
          missingInfo: vat.validationData?.missingInfo.includes(MissingChargeInfo.Vat),
          amountValue: vat.totalAmount?.raw,
        }
      : undefined,
    counterparty: shouldHaveCounterparty(type)
      ? {
          counterparty: counterparty.counterparty
            ? {
                name: counterparty.counterparty.name,
                id: counterparty.counterparty.id,
              }
            : undefined,
          counterparties:
            counterparty.__typename === 'ForeignSecuritiesCharge'
              ? counterparty.counterparties.map(({ id, name }) => ({ id, name }))
              : undefined,
          type,
          isMissing: counterparty.validationData?.missingInfo.includes(
            MissingChargeInfo.Counterparty,
          ),
        }
      : undefined,
    description: {
      chargeId: fragmentData.id,
      value: description.userDescription?.trim() ?? undefined,
      isMissing: description.validationData?.missingInfo.includes(MissingChargeInfo.Description),
      suggestedDescription: missingInfoSuggestions?.description?.trim() ?? undefined,
    },
    tags: {
      chargeId: fragmentData.id,
      tags: tags.tags.map(tag => ({
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
      isMissing: tags.validationData?.missingInfo.includes(MissingChargeInfo.Tags),
    },
    taxCategory: shouldHaveTaxCategory(type)
      ? {
          taxCategory: taxCategory.taxCategory
            ? {
                id: taxCategory.taxCategory.id,
                name: taxCategory.taxCategory.name,
              }
            : undefined,
          isMissing: taxCategory.validationData?.missingInfo.includes(
            MissingChargeInfo.TaxCategory,
          ),
        }
      : undefined,
    businessTrip:
      'businessTrip' in businessTrip && businessTrip.businessTrip
        ? {
            id: businessTrip.businessTrip.id,
            name: businessTrip.businessTrip.name,
          }
        : undefined,
    moreInfo: {
      chargeId: fragmentData.id,
      type,
      isTransactionsMissing: moreInfo.validationData?.missingInfo.includes(
        MissingChargeInfo.Transactions,
      ),
      isDocumentsMissing: moreInfo.validationData?.missingInfo.includes(
        MissingChargeInfo.Documents,
      ),
      info: moreInfo.metadata
        ? {
            transactionsCount: moreInfo.metadata.transactionsCount,
            documentsCount: moreInfo.metadata.documentsCount,
            ledgerCount: moreInfo.metadata.ledgerCount,
            miscExpensesCount: moreInfo.metadata.miscExpensesCount,
            depreciationRecordsCount: moreInfo.metadata.depreciationRecordsCount,
            // Deferred, so it is read off the row itself and is absent until its part arrives.
            invalidLedger: fragmentData.metadata?.invalidLedger,
          }
        : undefined,
    },
    accountantApproval: approval.accountantApproval,
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
    setExpanded(isAllOpened || {});
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

  // Drop a deleted charge's row from the table. The charge no longer exists on the server, so
  // refetching it (the usual `onChange` path) would only fail and leave a stale row behind.
  // Its selection entry goes with it, so batch actions can't target a deleted charge.
  const removeCharge = useCallback(
    (chargeId: string) => {
      setCharges(old => old.filter(row => row.id !== chargeId));
      setRowSelection(old => {
        if (!(chargeId in old)) {
          return old;
        }
        const { [chargeId]: _removed, ...rest } = old;
        return rest;
      });
    },
    [setRowSelection],
  );

  // Callers routinely build this array inline (`data={charge ? [charge] : []}`, `data={nodes ?? []}`,
  // `data={list.filter(...).map(...)}`), handing us a fresh identity on every render even when the
  // charges are unchanged. Re-deriving the rows from it each time would throw away the fresher data
  // a per-row refetch (`updateCharge`) just wrote into local state, so the row would visibly revert
  // to the list query's stale values. Stabilizing the reference keeps the rebuild tied to actual
  // content changes.
  const stableData = useStableValue(data);

  // Update charges when data changes
  useEffect(() => {
    setCharges(
      stableData?.map(rawCharge =>
        convertChargeFragmentToTableRow(
          getFragmentData(ChargeForChargesTableFieldsFragmentDoc, rawCharge),
        ),
      ) ?? [],
    );
  }, [stableData]);

  const table = useTable({
    features: paginatedTableFeaturesConfig,
    data: charges,
    columns,
    // Key row selection by charge id (not row index) so the selection map is stable across
    // sorting/filtering and shareable between tables when selection is controlled.
    getRowId: row => row.id,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onExpandedChange: setExpanded,
    // Rows carry no subRows — the expansion renders a detail panel, not child rows. v9's
    // `row.toggleExpanded()` bails out unless the row "can expand", which defaults to
    // `!!row.subRows.length`, so every row must be declared expandable explicitly.
    getRowCanExpand: () => true,
    // Refreshing a single charge (`updateCharge`) hands the table a new `data` array, which v9
    // treats as a row-structure change and answers by resetting `expanded` to the initial state —
    // collapsing every open charge. Expansion here is a user-driven detail panel keyed by charge
    // id, so it must survive data refreshes.
    autoResetExpanded: false,
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
    // Rows publish their refetch here, so a mutation that touched several charges at once can
    // refresh whichever of them this table happens to be showing.
    <ChargeRefreshProvider>
      <BatchChargesExtendedInfoProvider chargeIds={chargeIds} active={isAllOpened}>
        <div className="flex flex-col gap-2 w-full">
          {showExport && (
            <div className="flex justify-end">
              <DownloadChargesCsv chargeIds={exportIds} />
            </div>
          )}
          <div className="overflow-hidden rounded-md border w-full">
            {/* Cells wrap (overriding the ui table's nowrap, and the nowrap of the sort
              buttons in the headers) so the table fits the viewport instead of forcing
              the page to scroll sideways. */}
            <Table className="[&_th]:whitespace-normal [&_td]:whitespace-normal [&_th_button]:whitespace-normal">
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
              <TableBody>
                {table.getRowModel().rows?.length ? (
                  table
                    .getRowModel()
                    .rows.map(row => (
                      <ChargeRow
                        key={row.id}
                        row={row}
                        updateCharge={updateCharge}
                        removeCharge={removeCharge}
                      />
                    ))
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
    </ChargeRefreshProvider>
  );
};
