import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import {
  useTable,
  type ExpandedState,
  type OnChangeFn,
  type RowSelectionState,
  type SortingState,
} from '@tanstack/react-table';
import { tableFeaturesConfig } from '@/lib/table-features.js';
import {
  ChargeForChargesTableFieldsFragmentDoc,
  ChargesTableSuggestionsFieldsFragmentDoc,
  type AccountantStatus,
  type ChargeForChargesTableFieldsFragment,
  type ChargeSortBy,
  type Currency,
  type LedgerValidationStatus,
  type MissingChargeInfo,
} from '../../gql/graphql.js';
import { getFragmentData, type FragmentType } from '../../gql/index.js';
import type { ChargeType } from '../../helpers/index.js';
import { useStableValue } from '../../hooks/use-stable-value.js';
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '../ui/empty.js';
import { getChargeDates, type ChargeDates } from './charge-dates.js';
import { ChargeRecord } from './charge-record.js';
import type { SuggestedTag } from './charge-suggestion-field.js';
import { BatchChargesExtendedInfoProvider } from './charges-extended-info-loader.js';
import { ChargesToolbar } from './charges-toolbar.js';
import { columns } from './columns.js';
import { useChargeDensity } from './use-charge-density.js';

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

/**
 * A charge, flattened for display. Deliberately shaped as plain data rather than as props for
 * particular components — the old shape nested values under `counterparty.counterparty.name` and
 * `description.value` purely to spread into cell components that no longer exist.
 *
 * Note what is *not* here: any judgement about whether a field should be shown. That belongs to the
 * spec matrix in `charge-fields.ts`, keyed on `type`, so the record's shape is a pure function of the
 * charge type rather than of whichever fields happened to arrive.
 */
export interface ChargeRow {
  id: string;
  type: ChargeType;
  dates?: ChargeDates;
  amount?: {
    value: number;
    currency: Currency;
    /** Only `CreditcardBankCharge` validates its amount. */
    shouldValidate: boolean;
    isValid?: boolean;
  };
  vat?: { value?: number; currency?: Currency };
  counterparty?: { id: string; name: string };
  description?: string;
  suggestedDescription?: string;
  tags: SuggestedTag[];
  suggestedTags: SuggestedTag[];
  taxCategory?: { id: string; name: string };
  businessTrip?: { id: string; name: string };
  counts: {
    transactions: number;
    documents: number;
    ledger: number;
    miscExpenses: number;
    /** Absent until the deferred patch arrives — see `ledgerState`. */
    invalidLedger?: LedgerValidationStatus;
  };
  /** Server-reported, unfiltered. Consumers narrow it through the matrix. */
  missingInfo: MissingChargeInfo[];
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
  const type = fragmentData.__typename as ChargeType;
  const isCreditcardBank = fragmentData.__typename === 'CreditcardBankCharge';

  const toTag = (tag: { id: string; name: string; namePath?: string[] | null }): SuggestedTag => ({
    id: tag.id,
    name: tag.name,
    namePath: tag.namePath ?? undefined,
  });

  return {
    id: fragmentData.id,
    type,
    dates: getChargeDates({
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
          shouldValidate: isCreditcardBank,
          isValid: isCreditcardBank ? fragmentData.validCreditCardAmount : undefined,
        }
      : undefined,
    // No `shouldHaveVat` / `shouldHaveCounterparty` / `shouldHaveTaxCategory` gating here any more.
    // Those helpers duplicated per-type rules that had already drifted from the server's, and the
    // spec matrix is now the single authority on what each type displays.
    vat: {
      value: fragmentData.vat?.raw,
      currency: fragmentData.totalAmount?.currency,
    },
    counterparty: fragmentData.counterparty
      ? { id: fragmentData.counterparty.id, name: fragmentData.counterparty.name }
      : undefined,
    description: fragmentData.userDescription?.trim() ?? undefined,
    suggestedDescription: missingInfoSuggestions?.description?.trim() ?? undefined,
    tags: fragmentData.tags.map(toTag),
    suggestedTags: missingInfoSuggestions?.tags.map(toTag) ?? [],
    taxCategory: fragmentData.taxCategory
      ? { id: fragmentData.taxCategory.id, name: fragmentData.taxCategory.name }
      : undefined,
    businessTrip:
      'businessTrip' in fragmentData && fragmentData.businessTrip
        ? { id: fragmentData.businessTrip.id, name: fragmentData.businessTrip.name }
        : undefined,
    counts: {
      transactions: fragmentData.metadata?.transactionsCount ?? 0,
      documents: fragmentData.metadata?.documentsCount ?? 0,
      ledger: fragmentData.metadata?.ledgerCount ?? 0,
      miscExpenses: fragmentData.metadata?.miscExpensesCount ?? 0,
      invalidLedger: fragmentData.metadata?.invalidLedger,
    },
    missingInfo: fragmentData.validationData?.missingInfo ?? [],
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
  /**
   * Binds the toolbar's sort menu to the screen's server-side `sortBy` filter, so sorting covers the
   * whole result set rather than just the loaded page. Only screens that own a `ChargeFilter` can
   * supply this; when it is omitted the toolbar falls back to sorting the charges already loaded,
   * which is the correct behavior for the short embedded lists (business page, VAT report sections).
   */
  sort?: {
    value?: ChargeSortBy | null;
    onChange: (next: ChargeSortBy) => void;
  };
  /**
   * Suppresses the list toolbar. Set on the single-charge screen, where select-all, a charge count,
   * batch actions and export are all list affordances applied to a list of one.
   */
  hideToolbar?: boolean;
}

export const ChargesTable = ({
  data,
  rowSelection: controlledRowSelection,
  onRowSelectionChange,
  isAllOpened = false,
  showExport = false,
  sort,
  hideToolbar = false,
}: Props): ReactElement => {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [internalRowSelection, setInternalRowSelection] = useState<RowSelectionState>({});
  const [density, setDensity] = useChargeDensity();
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

  /**
   * Per-charge refetch handlers, registered by each mounted record.
   *
   * This replaces writing `row.original.onChange = fetchCharge` during render. That worked, but it
   * made the handler a property of state that `setCharges` rebuilt on every `data` change — so a
   * memoized record would have held the no-op placeholder the converter set, and under `@stream`
   * (the ledger-validation screen) `data` changes on every patch. It also silently no-op'd for
   * selected charges that were not currently rendered, which is how batch "refresh selected" could
   * appear to succeed while doing nothing.
   */
  const refetchers = useRef(new Map<string, () => void>());
  const registerRefetch = useCallback((chargeId: string, refetch: () => void) => {
    refetchers.current.set(chargeId, refetch);
    return () => {
      refetchers.current.delete(chargeId);
    };
  }, []);
  const refreshCharges = useCallback((chargeIds: string[]) => {
    for (const chargeId of chargeIds) {
      refetchers.current.get(chargeId)?.();
    }
  }, []);

  // Update a charge by its stable id. Matching on id (rather than row index) keeps the update
  // correct when the list is sorted, filtered, or paginated.
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
    features: tableFeaturesConfig,
    data: charges,
    columns,
    // Key row selection by charge id (not row index) so the selection map is stable across
    // sorting/filtering and shareable between tables when selection is controlled.
    getRowId: row => row.id,
    onSortingChange: setSorting,
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
    // When the screen sorts server-side, suppress the client-side sort entirely: the toolbar orders
    // every matching charge, whereas tanstack would only reorder the charges already loaded — so
    // "sort by Amount" would surface the largest charge *on this page*, not overall.
    enableSorting: !sort,
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    state: {
      sorting,
      rowSelection,
      expanded,
    },
    initialState: {
      // Every screen paginates server-side (`page`/`limit` on the query), so the list must render
      // whatever it was handed. `rowPaginationFeature` is registered in the shared feature set, and
      // `getRowModel()` sits at the end of a pipeline that ends in pagination — so leaving this
      // unset would silently truncate to tanstack's default of 10 rows, and the previous value of
      // 100 hid everything past row 100 on the two screens that fetch without a limit
      // (ledger validation streams, and the VAT report sections are unbounded).
      pagination: { pageIndex: 0, pageSize: Number.MAX_SAFE_INTEGER },
    },
  });

  // Ids of every charge in the table, fed to the batch loader so expand-all hydrates them all in a
  // single query.
  const chargeIds = useMemo(() => charges.map(charge => charge.id), [charges]);

  // Export the active selection when one exists, otherwise every charge currently in the table.
  // Intersected with this table's own charges: the VAT report shares one selection map across three
  // tables, so an unfiltered selection would leak the other tables' charges into this export.
  const selectedIds = Object.keys(rowSelection).filter(
    id => rowSelection[id] && chargeIds.includes(id),
  );
  const exportIds = selectedIds.length > 0 ? selectedIds : chargeIds;

  const { rows } = table.getRowModel();

  return (
    <BatchChargesExtendedInfoProvider chargeIds={chargeIds} active={isAllOpened}>
      {/* Toolbar and list share one bordered surface. Floating the toolbar above a separately
          bordered list read as two unrelated objects, and its select-all checkbox in particular
          looked disconnected from the rows it governs. `overflow-hidden` is what lets the first and
          last record's background respect the rounded corners. */}
      <div className="w-full overflow-hidden rounded-md border bg-card">
        {!hideToolbar && (
          <div className="border-b px-3 py-2">
            <ChargesToolbar
              table={table}
              showExport={showExport}
              exportIds={exportIds}
              sort={sort}
              sorting={sorting}
              onSortingChange={setSorting}
              onRefreshCharges={refreshCharges}
              density={density}
              onDensityChange={setDensity}
            />
          </div>
        )}
        {rows.length ? (
          // A list, not a grid: the record's fields stack and vary per charge type, so table
          // semantics (and `role="grid"`, which would promise arrow-key cell navigation) would
          // misdescribe it. Alignment across records comes from the shared grid inside each record.
          <ul className="w-full divide-y">
            {rows.map(row => (
              <ChargeRecord
                key={row.id}
                row={row.original}
                isSelected={row.getIsSelected()}
                isExpanded={row.getIsExpanded()}
                density={density}
                onSelectedChange={selected => row.toggleSelected(selected)}
                onToggleExpanded={() => row.toggleExpanded()}
                onCollapse={() => row.toggleExpanded(false)}
                registerRefetch={registerRefetch}
                updateCharge={updateCharge}
                removeCharge={removeCharge}
              />
            ))}
          </ul>
        ) : (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>No charges</EmptyTitle>
              <EmptyDescription>Nothing matches the current filters.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </div>
    </BatchChargesExtendedInfoProvider>
  );
};
