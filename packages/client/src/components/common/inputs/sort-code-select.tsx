import { useEffect, useMemo, type ReactElement } from 'react';
import type { AllSortCodesQuery } from '../../../gql/graphql.js';
import { useGetSortCodes } from '../../../hooks/use-get-sort-codes.js';
import { ComboBox } from './combo-box.js';

export type SortCode = NonNullable<AllSortCodesQuery['allSortCodesByBusiness']>[number];

type SortCodeSelectProps = {
  /** Business owner id used to fetch the relevant sort codes. */
  ownerId?: string | null;
  /** Currently selected sort code key. */
  value?: number | string | null;
  /**
   * Called when the selection changes.
   * Provides the numeric sort code key (or null) and the full sort code object when available.
   */
  onChange: (value: number | null, sortCode?: SortCode | null) => void;
  disabled?: boolean;
  placeholder?: string;
  /** Render inside a shadcn `FormControl` (forwards form styling). */
  formPart?: boolean;
  error?: string;
  triggerClassName?: string;
  /** Notifies the parent about the sort codes fetching state. */
  onFetchingChange?: (fetching: boolean) => void;
};

/**
 * General, reusable sort code selector.
 *
 * Fetches the sort codes for the given business owner and renders a searchable
 * shadcn combo box. Each option displays both the sort code key and its name.
 */
export function SortCodeSelect({
  ownerId,
  value,
  onChange,
  disabled,
  placeholder = 'Scroll to see all options',
  formPart,
  error,
  triggerClassName,
  onFetchingChange,
}: SortCodeSelectProps): ReactElement {
  const { sortCodes, fetching } = useGetSortCodes({ ownerId });

  useEffect(() => {
    onFetchingChange?.(fetching);
  }, [onFetchingChange, fetching]);

  const options = useMemo(() => {
    const list = sortCodes.map(sortCode => ({
      value: sortCode.key.toString(),
      label: sortCode.name ? `${sortCode.key} - ${sortCode.name}` : sortCode.key.toString(),
    }));
    // Keep the currently selected value visible even while the list is still
    // loading or if it no longer exists among the fetched sort codes.
    if (value !== undefined && value !== null) {
      const stringValue = value.toString();
      if (!list.some(option => option.value === stringValue)) {
        list.push({ value: stringValue, label: stringValue });
      }
    }
    return list;
  }, [sortCodes, value]);

  return (
    <ComboBox
      data={options}
      value={value?.toString() ?? null}
      onChange={selected => {
        if (!selected) {
          onChange(null, null);
          return;
        }
        const numericValue = Number(selected);
        const sortCode = sortCodes.find(sc => Number(sc.key) === numericValue) ?? null;
        onChange(numericValue, sortCode);
      }}
      disabled={disabled || fetching}
      placeholder={placeholder}
      formPart={formPart}
      error={error}
      triggerProps={triggerClassName ? { className: triggerClassName } : undefined}
    />
  );
}
