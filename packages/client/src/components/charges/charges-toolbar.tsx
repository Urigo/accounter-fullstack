import type { ReactElement } from 'react';
import { AlignJustify, StretchVertical } from 'lucide-react';
import type { OnChangeFn, SortingState, Table } from '@tanstack/react-table';
import type { TableFeaturesConfig } from '@/lib/table-features.js';
import { ChargeSortByField, type ChargeSortBy } from '../../gql/graphql.js';
import { Tooltip } from '../common/index.js';
import { Button } from '../ui/button.js';
import { Checkbox } from '../ui/checkbox.js';
import { ChargesBatchActionsMenu } from './charges-batch-actions-menu.js';
import { ChargesSortMenu, CLIENT_SORT_OPTIONS, type SortOption } from './charges-sort-menu.js';
import type { ChargeRow } from './charges-table.js';
import { DownloadChargesCsv } from './download-charges-csv.js';
import type { ChargeDensity } from './use-charge-density.js';

/** The three fields the server can sort a charge query by. */
export const SERVER_SORT_OPTIONS: readonly SortOption[] = [
  { value: ChargeSortByField.Date, label: 'Date' },
  { value: ChargeSortByField.Amount, label: 'Amount' },
  { value: ChargeSortByField.AbsAmount, label: 'Absolute amount' },
];

type Props = {
  table: Table<TableFeaturesConfig, ChargeRow>;
  /** Render the CSV export control. The parent decides whether to expose it. */
  showExport: boolean;
  /** Charges the export covers — the selection when there is one, otherwise every charge. */
  exportIds: string[];
  /** Server-side sort binding, when the screen owns a `ChargeFilter`. */
  sort?: {
    value?: ChargeSortBy | null;
    onChange: (next: ChargeSortBy) => void;
  };
  /** Client-side sort state, used as the fallback binding when `sort` is absent. */
  sorting: SortingState;
  onSortingChange: OnChangeFn<SortingState>;
  /** Refreshes the given charges after a batch action, via `ChargesTable`'s refetch registry. */
  onRefreshCharges?: (chargeIds: string[]) => void;
  density: ChargeDensity;
  onDensityChange: (next: ChargeDensity) => void;
};

/**
 * Controls that used to live in the table's `select` column header.
 *
 * Selection and bulk actions are properties of the whole list, not of one column, and a column
 * header is a poor place for them: it has no room for a selected-count readout, and it disappears
 * entirely once the list stops being a `<table>`. Hoisting them here also lets the count act as the
 * `aria-live` announcement for selection changes, which the checkbox alone never provided.
 */
export function ChargesToolbar({
  table,
  showExport,
  exportIds,
  sort,
  sorting,
  onSortingChange,
  onRefreshCharges,
  density,
  onDensityChange,
}: Props): ReactElement {
  const selectedCount = table.getSelectedRowModel().rows.length;
  const rowCount = table.getRowModel().rows.length;

  // Exactly one binding is live, so the two sorts can never fight. When the screen owns a
  // `ChargeFilter` the menu drives the server sort (whole result set, triggers a refetch);
  // otherwise it drives tanstack's `sorting` over the charges already loaded.
  const sortMenu = sort ? (
    <ChargesSortMenu
      scope="server"
      options={SERVER_SORT_OPTIONS}
      // A charge query is always sorted, so showing "None" before the user picks anything would be
      // wrong. Fall back to the same default the filters form has always seeded.
      field={sort.value?.field ?? ChargeSortByField.Date}
      ascending={sort.value?.asc ?? false}
      onChange={(field, ascending) =>
        sort.onChange({ field: field as ChargeSortByField, asc: ascending })
      }
    />
  ) : (
    <ChargesSortMenu
      scope="page"
      options={CLIENT_SORT_OPTIONS}
      field={sorting[0]?.id}
      ascending={!sorting[0]?.desc}
      onChange={(field, ascending) => onSortingChange([{ id: field, desc: !ascending }])}
    />
  );

  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && 'indeterminate')
          }
          onCheckedChange={value => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all charges"
        />
        <span aria-live="polite" className="text-sm text-gray-600 dark:text-gray-400">
          {selectedCount > 0
            ? `${selectedCount} of ${rowCount} selected`
            : `${rowCount} charge${rowCount === 1 ? '' : 's'}`}
        </span>
        <ChargesBatchActionsMenu table={table} onRefreshCharges={onRefreshCharges} />
      </div>
      <div className="flex items-center gap-2">
        {/* Nothing to order with one charge — the single-charge screen renders exactly one record and
            was offering a sort control reading "None". */}
        {rowCount > 1 && sortMenu}
        <Tooltip content={density === 'compact' ? 'Show more detail' : 'Show less detail'}>
          <Button
            variant="outline"
            size="sm"
            aria-label={density === 'compact' ? 'Comfortable density' : 'Compact density'}
            aria-pressed={density === 'compact'}
            onClick={() => onDensityChange(density === 'compact' ? 'comfortable' : 'compact')}
          >
            {density === 'compact' ? (
              <StretchVertical className="size-4" />
            ) : (
              <AlignJustify className="size-4" />
            )}
          </Button>
        </Tooltip>
        {showExport && <DownloadChargesCsv chargeIds={exportIds} />}
      </div>
    </div>
  );
}
