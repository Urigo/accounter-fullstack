import { useEffect, useState, type ReactElement } from 'react';
import { YearHalf } from '../../../../gql/graphql.js';
import type { AdminBusinesses } from '../../../../hooks/use-get-admin-businesses.js';
import { cn } from '../../../../lib/utils.js';
import { Input } from '../../../ui/input.js';
import { Label } from '../../../ui/label.js';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../ui/select.js';
import { HALF_LABELS, selectableYears, type SemiAnnualFilter } from './helpers.js';

const HALVES = [YearHalf.H1, YearHalf.H2];

function HalfToggle({
  value,
  onChange,
}: {
  value: YearHalf;
  onChange: (half: YearHalf) => void;
}): ReactElement {
  return (
    <div
      role="radiogroup"
      aria-label="Half of the year"
      className="inline-flex rounded-lg bg-gray-100 p-1 dark:bg-gray-800"
    >
      {HALVES.map(half => (
        <button
          key={half}
          type="button"
          role="radio"
          aria-checked={value === half}
          onClick={() => onChange(half)}
          className={cn(
            'rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-ring',
            value === half
              ? 'bg-white text-gray-950 shadow-sm dark:bg-gray-950 dark:text-gray-50'
              : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100',
          )}
        >
          {HALF_LABELS[half].en}
          <span className="ms-1.5 text-xs font-normal text-gray-500">
            {HALF_LABELS[half].months}
          </span>
        </button>
      ))}
    </div>
  );
}

/**
 * The prior years' carried-forward losses, applied when the field is left or Enter is pressed —
 * not on every keystroke, since each change reruns the report.
 */
function LossesInput({
  value,
  onCommit,
}: {
  value?: number;
  onCommit: (value: number | undefined) => void;
}): ReactElement {
  const [draft, setDraft] = useState(value == null ? '' : String(value));
  useEffect(() => setDraft(value == null ? '' : String(value)), [value]);

  const commit = () => {
    const parsed = Number(draft.replaceAll(',', ''));
    if (draft.trim() === '' || !Number.isFinite(parsed) || parsed <= 0) {
      setDraft('');
      onCommit(undefined);
      return;
    }
    onCommit(parsed);
  };

  return (
    <Input
      id="prior-years-losses"
      inputMode="decimal"
      placeholder="0"
      className="w-40 tabular-nums"
      value={draft}
      onChange={event => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={event => {
        if (event.key === 'Enter') {
          commit();
        }
      }}
    />
  );
}

type Props = {
  filter: SemiAnnualFilter;
  onChange: (filter: SemiAnnualFilter) => void;
  businesses: AdminBusinesses;
  /** The business shown when the filter names none */
  defaultBusinessId?: string;
};

export function ReportControls({
  filter,
  onChange,
  businesses,
  defaultBusinessId,
}: Props): ReactElement {
  return (
    <div className="flex flex-wrap items-end gap-6 rounded-xl border bg-white p-4 shadow-sm print:hidden">
      <div className="space-y-1.5">
        <Label>Tax year</Label>
        <Select
          value={String(filter.year)}
          onValueChange={year => onChange({ ...filter, year: Number(year) })}
        >
          <SelectTrigger className="w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {selectableYears().map(year => (
              <SelectItem key={year} value={String(year)}>
                {year}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label>Period</Label>
        <HalfToggle value={filter.half} onChange={half => onChange({ ...filter, half })} />
      </div>

      {businesses.length > 1 && (
        <div className="space-y-1.5">
          <Label>Company</Label>
          <Select
            value={filter.businessId ?? defaultBusinessId}
            onValueChange={businessId => onChange({ ...filter, businessId })}
          >
            <SelectTrigger className="w-56">
              <SelectValue placeholder="Select a company" />
            </SelectTrigger>
            <SelectContent>
              {businesses.map(business => (
                <SelectItem key={business.id} value={business.id}>
                  {business.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="prior-years-losses">Losses carried forward from prior years (₪)</Label>
        <LossesInput
          value={filter.priorYearsLosses}
          onCommit={priorYearsLosses => onChange({ ...filter, priorYearsLosses })}
        />
      </div>
    </div>
  );
}
