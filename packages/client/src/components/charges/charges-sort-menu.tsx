import type { ReactElement } from 'react';
import { ArrowDownWideNarrow, ArrowUpNarrowWide } from 'lucide-react';
import { Button } from '../ui/button.js';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu.js';

export type SortOption = { value: string; label: string };

type Props = {
  options: readonly SortOption[];
  /** Currently sorted field, or undefined when nothing is sorted. */
  field: string | undefined;
  ascending: boolean;
  onChange: (field: string, ascending: boolean) => void;
  /**
   * Whether the sort covers the whole result set (server-side) or only the charges already loaded.
   * Surfaced in the menu because the difference is not otherwise visible — and the page-local
   * variant is genuinely misleading on a paginated screen.
   */
  scope: 'server' | 'page';
};

export function ChargesSortMenu({
  options,
  field,
  ascending,
  onChange,
  scope,
}: Props): ReactElement {
  const active = options.find(option => option.value === field);
  const DirectionIcon = ascending ? ArrowUpNarrowWide : ArrowDownWideNarrow;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5" aria-label="Sort charges">
          <DirectionIcon className="size-4" />
          <span className="text-xs font-normal text-muted-foreground">Sort</span>
          <span className="text-xs font-medium">{active?.label ?? 'None'}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel variant="section">
          {scope === 'server' ? 'Sort all matching charges' : 'Sort the loaded charges'}
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={field ?? ''}
          onValueChange={next => onChange(next, ascending)}
        >
          {options.map(option => (
            <DropdownMenuRadioItem key={option.value} value={option.value}>
              {option.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={!field} onSelect={() => field && onChange(field, !ascending)}>
          <DirectionIcon className="size-4" />
          {ascending ? 'Ascending' : 'Descending'}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Client-side sortable columns, labelled. Keyed by the explicit `id`s in `columns.tsx` — which is why
 * those ids are declared rather than derived (tanstack would otherwise name them
 * `counterparty_counterparty_name`).
 */
export const CLIENT_SORT_OPTIONS: readonly SortOption[] = [
  { value: 'date', label: 'Date' },
  { value: 'amount', label: 'Amount' },
  { value: 'vat', label: 'VAT' },
  { value: 'counterparty', label: 'Counterparty' },
  { value: 'description', label: 'Description' },
  { value: 'taxCategory', label: 'Tax category' },
  { value: 'type', label: 'Type' },
  { value: 'businessTrip', label: 'Business trip' },
];
