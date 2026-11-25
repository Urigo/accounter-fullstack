import { useMemo, useRef, useState, type ReactElement } from 'react';
import { ArrowDown, ArrowUp, Copy, Plus, Trash2, X } from 'lucide-react';
import { useCopyShareholdersFromYear } from '../../../../hooks/use-copy-shareholders-from-year.js';
import { useGetBusinesses } from '../../../../hooks/use-get-businesses.js';
import { useSetShareholders } from '../../../../hooks/use-set-shareholders.js';
import { cn } from '../../../../lib/utils.js';
import { ComboBox } from '../../../common/index.js';
import { Badge } from '../../../ui/badge.js';
import { Button } from '../../../ui/button.js';
import { Checkbox } from '../../../ui/checkbox.js';
import { Input } from '../../../ui/input.js';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../ui/table.js';
import { useForm1214Report } from './report-context.js';
import {
  dividendRightsTotal,
  emptyShareholderRow,
  hasShareholderRowErrors,
  isDividendTotalComplete,
  MAX_SHAREHOLDERS,
  moveShareholderRow,
  rowToShareholderInput,
  sameShareholderRows,
  shareholderToRow,
  validateShareholderRow,
  type NumericField,
  type ShareholderData,
  type ShareholderRow,
  type ShareholderRowErrors,
} from './shareholders.js';

type Props = {
  /** The saved shareholders of the year, in report order. */
  shareholders: ShareholderData[];
};

const numberFormat = new Intl.NumberFormat('en-US', { maximumFractionDigits: 4 });

const NUMERIC_COLUMNS: Array<{ field: NumericField; label: string; widthClass: string }> = [
  { field: 'dividendRightsPercent', label: 'Dividend %', widthClass: 'w-24' },
  { field: 'votingRightsPercent', label: 'Voting %', widthClass: 'w-24' },
  { field: 'otherRightsPercent', label: 'Other rights %', widthClass: 'w-24' },
  { field: 'salaryMonths1To9', label: 'Salary 1-9', widthClass: 'w-28' },
  { field: 'salaryMonths10To12', label: 'Salary 10-12', widthClass: 'w-28' },
  { field: 'otherPayments', label: 'Other payments', widthClass: 'w-28' },
];

/**
 * The shareholders of the year (form 1214 records 1020), edited locally and saved as a whole list:
 * the list order is the report order. The server and the generator check the rest (duplicate IDs,
 * the 100% dividend total, the 99-row limit); this only catches format typos before the round trip.
 */
export function ShareholdersEditor({ shareholders }: Props): ReactElement {
  const { year, refresh } = useForm1214Report();
  const { setShareholders, fetching: saving } = useSetShareholders();
  const { copyShareholdersFromYear, fetching: copying } = useCopyShareholdersFromYear();
  const { selectableBusinesses, fetching: fetchingBusinesses } = useGetBusinesses();

  const propRows = useMemo(() => shareholders.map(shareholderToRow), [shareholders]);
  // What the last save or copy stored, shown until the refreshed report catches up with it
  const [stored, setStored] = useState<ShareholderRow[] | null>(null);
  // Local edits; `null` while showing what is stored
  const [draft, setDraft] = useState<ShareholderRow[] | null>(null);

  // A new report (a refresh, or another year) replaces what the last mutation returned, and a new
  // year drops the draft, which belongs to the year it was made in
  const [seen, setSeen] = useState({ propRows, year });
  if (seen.propRows !== propRows || seen.year !== year) {
    setSeen({ propRows, year });
    setStored(null);
    if (seen.year !== year) {
      setDraft(null);
    }
  }

  const savedRows = stored ?? propRows;
  const rows = draft ?? savedRows;
  const dirty = draft !== null && !sameShareholderRows(draft, savedRows);

  const rowErrors = useMemo(() => rows.map(validateShareholderRow), [rows]);
  const hasErrors = hasShareholderRowErrors(rowErrors);
  const dividendTotal = dividendRightsTotal(rows);

  const nextKey = useRef(0);
  const busy = saving || copying;

  function edit(update: (current: ShareholderRow[]) => ShareholderRow[]): void {
    setDraft(current => update(current ?? savedRows));
  }

  function updateRow(index: number, patch: Partial<ShareholderRow>): void {
    edit(current => current.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function addRow(): void {
    nextKey.current += 1;
    const row = emptyShareholderRow(`new-${nextKey.current}`);
    edit(current => [...current, row]);
  }

  async function save(): Promise<void> {
    if (!draft || hasErrors) {
      return;
    }
    const result = await setShareholders({ year, shareholders: draft.map(rowToShareholderInput) });
    if (result) {
      setStored(result.map(shareholderToRow));
      setDraft(null);
      refresh();
    }
  }

  async function copyFromPreviousYear(): Promise<void> {
    const result = await copyShareholdersFromYear({ fromYear: year - 1, toYear: year });
    if (result && result.length > 0) {
      setStored(result.map(shareholderToRow));
      setDraft(null);
      refresh();
    }
  }

  const canCopy = savedRows.length === 0 && !dirty;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={addRow} disabled={busy}>
          <Plus className="size-4" />
          Add shareholder
        </Button>
        {canCopy && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void copyFromPreviousYear()}
            disabled={busy}
          >
            <Copy className="size-4" />
            Copy from {year - 1}
          </Button>
        )}
        <div className="ml-auto flex items-center gap-2">
          {dirty && <Badge variant="outline">Unsaved changes</Badge>}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setDraft(null)}
            disabled={!dirty || busy}
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => void save()}
            disabled={!dirty || hasErrors || busy}
          >
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {dirty
            ? 'Every shareholder is removed: save to clear the year.'
            : 'No shareholders are saved for this year.'}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8">#</TableHead>
                <TableHead>ID number</TableHead>
                <TableHead>Full name</TableHead>
                <TableHead>Controlling</TableHead>
                {NUMERIC_COLUMNS.slice(0, 3).map(column => (
                  <TableHead key={column.field} className="text-right">
                    {column.label}
                  </TableHead>
                ))}
                <TableHead>Material</TableHead>
                {NUMERIC_COLUMNS.slice(3).map(column => (
                  <TableHead key={column.field} className="text-right">
                    {column.label}
                  </TableHead>
                ))}
                <TableHead>Business</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, index) => (
                <ShareholderEditorRow
                  key={row.key}
                  row={row}
                  index={index}
                  rowCount={rows.length}
                  errors={rowErrors[index]}
                  disabled={busy}
                  businesses={selectableBusinesses}
                  fetchingBusinesses={fetchingBusinesses}
                  onChange={patch => updateRow(index, patch)}
                  onMove={offset => edit(current => moveShareholderRow(current, index, offset))}
                  onRemove={() => edit(current => current.filter((_, i) => i !== index))}
                />
              ))}
              <TableRow>
                <TableCell colSpan={4} className="font-semibold">
                  Total dividend rights
                </TableCell>
                <TableCell
                  className={cn(
                    'text-right font-semibold',
                    !isDividendTotalComplete(dividendTotal) && 'text-amber-600',
                  )}
                >
                  {numberFormat.format(dividendTotal)}%
                </TableCell>
                <TableCell colSpan={8} />
              </TableRow>
            </TableBody>
          </Table>
        </div>
      )}

      {rows.length > 0 && !isDividendTotalComplete(dividendTotal) && (
        <p className="text-sm text-amber-600">
          The dividend rights add up to {numberFormat.format(dividendTotal)}%, not 100%. You can
          still save; the validation panel reports it.
        </p>
      )}
      {rows.length > MAX_SHAREHOLDERS && (
        <p className="text-sm text-amber-600">
          Form 1214 takes at most {MAX_SHAREHOLDERS} shareholders; this list has {rows.length}.
        </p>
      )}
      {hasErrors && (
        <p className="text-sm text-red-600">Fix the highlighted fields before saving.</p>
      )}
    </div>
  );
}

type RowProps = {
  row: ShareholderRow;
  index: number;
  rowCount: number;
  errors: ShareholderRowErrors;
  disabled: boolean;
  businesses: Array<{ value: string; label: string }>;
  fetchingBusinesses: boolean;
  onChange: (patch: Partial<ShareholderRow>) => void;
  onMove: (offset: number) => void;
  onRemove: () => void;
};

function ShareholderEditorRow({
  row,
  index,
  rowCount,
  errors,
  disabled,
  businesses,
  fetchingBusinesses,
  onChange,
  onMove,
  onRemove,
}: RowProps): ReactElement {
  const position = index + 1;
  const numericCell = ({ field, label, widthClass }: (typeof NUMERIC_COLUMNS)[number]) => (
    <TableCell key={field}>
      <CellInput
        value={row[field]}
        error={errors[field]}
        label={`${label}, row ${position}`}
        className={cn(widthClass, 'text-right')}
        inputMode="decimal"
        disabled={disabled}
        onChange={value => onChange({ [field]: value })}
      />
    </TableCell>
  );

  return (
    <TableRow>
      <TableCell className="text-muted-foreground">{position}</TableCell>
      <TableCell>
        <CellInput
          value={row.idNumber}
          error={errors.idNumber}
          label={`ID number, row ${position}`}
          className="w-32 font-mono"
          inputMode="numeric"
          maxLength={9}
          disabled={disabled}
          onChange={idNumber => onChange({ idNumber })}
        />
      </TableCell>
      <TableCell>
        <CellInput
          value={row.fullName}
          error={errors.fullName}
          label={`Full name, row ${position}`}
          className="min-w-48"
          dir="auto"
          disabled={disabled}
          onChange={fullName => onChange({ fullName })}
        />
      </TableCell>
      <TableCell>
        <Checkbox
          aria-label={`Controlling shareholder, row ${position}`}
          checked={row.isControllingShareholder}
          disabled={disabled}
          onCheckedChange={checked => onChange({ isControllingShareholder: checked === true })}
        />
      </TableCell>
      {NUMERIC_COLUMNS.slice(0, 3).map(numericCell)}
      <TableCell>
        <Checkbox
          aria-label={`Material shareholder, row ${position}`}
          checked={row.isMaterialShareholder === true}
          disabled={disabled}
          onCheckedChange={checked => onChange({ isMaterialShareholder: checked === true })}
        />
      </TableCell>
      {NUMERIC_COLUMNS.slice(3).map(numericCell)}
      <TableCell>
        <div className="flex items-center gap-1">
          <ComboBox
            data={businesses}
            value={row.businessId}
            placeholder="Not linked"
            disabled={disabled || fetchingBusinesses}
            triggerProps={{ 'aria-label': `Business, row ${position}`, className: 'min-w-40' }}
            onChange={businessId => onChange({ businessId })}
          />
          {row.businessId && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Unlink business, row ${position}`}
              disabled={disabled}
              onClick={() => onChange({ businessId: null })}
            >
              <X className="size-4" />
            </Button>
          )}
        </div>
      </TableCell>
      <TableCell>
        <div className="flex items-center">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`Move row ${position} up`}
            disabled={disabled || index === 0}
            onClick={() => onMove(-1)}
          >
            <ArrowUp className="size-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`Move row ${position} down`}
            disabled={disabled || index === rowCount - 1}
            onClick={() => onMove(1)}
          >
            <ArrowDown className="size-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`Remove row ${position}`}
            disabled={disabled}
            onClick={onRemove}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

type CellInputProps = {
  value: string;
  error: string | undefined;
  label: string;
  className?: string;
  inputMode?: 'numeric' | 'decimal';
  maxLength?: number;
  dir?: 'auto';
  disabled: boolean;
  onChange: (value: string) => void;
};

function CellInput({
  value,
  error,
  label,
  className,
  onChange,
  ...props
}: CellInputProps): ReactElement {
  return (
    <div className="space-y-1">
      <Input
        {...props}
        aria-label={label}
        aria-invalid={error ? true : undefined}
        title={error}
        className={cn('h-8', className)}
        value={value}
        onChange={event => onChange(event.target.value)}
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
