import { useEffect, useId, useMemo, useRef, useState, type ReactElement } from 'react';
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
  validateShareholderRows,
  type NumericField,
  type ShareholderData,
  type ShareholderRow,
  type ShareholderRowErrors,
  type ShareholderRowField,
} from './shareholders.js';

type Props = {
  /** The business the report is of. Only its own businesses can be linked to a shareholder. */
  ownerId: string;
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
 * the list order is the report order. Format typos, repeated IDs and more than 99 rows are caught
 * here, before the round trip: Save then shows every error and focuses the first instead of
 * sending. The generator reports the rest (the 100% dividend total among them) in the validation
 * panel.
 */
export function ShareholdersEditor({ ownerId, shareholders }: Props): ReactElement {
  const { year, refresh, setDirty } = useForm1214Report();
  const { setShareholders, fetching: saving } = useSetShareholders();
  const { copyShareholdersFromYear, fetching: copying } = useCopyShareholdersFromYear();
  const { businesses, fetching: fetchingBusinesses } = useGetBusinesses();
  // The read scope may span several owners, but the server links only the owner's own businesses
  const ownBusinesses = useMemo(
    () =>
      businesses
        .filter(business => business.ownerId === ownerId)
        .map(business => ({ value: business.id, label: business.name })),
    [businesses, ownerId],
  );

  const propRows = useMemo(() => shareholders.map(shareholderToRow), [shareholders]);
  // What the last save or copy stored, shown until the refreshed report catches up with it
  const [stored, setStored] = useState<ShareholderRow[] | null>(null);
  // Local edits; `null` while showing what is saved. Collapses back to `null` once equal to it
  const [draft, setDraft] = useState<ShareholderRow[] | null>(null);
  // Cells (`rowKey:field`) the user left, whose errors show from then on
  const [touched, setTouched] = useState<ReadonlySet<string>>(() => new Set());

  // A refreshed report replaces what the last mutation returned. (A year change unmounts the
  // editor, so the draft never outlives its year.)
  const [seenPropRows, setSeenPropRows] = useState(propRows);
  if (seenPropRows !== propRows) {
    setSeenPropRows(propRows);
    setStored(null);
  } else if (stored && sameShareholderRows(stored, propRows)) {
    setStored(null);
  }

  const savedRows = stored ?? propRows;
  const rows = draft ?? savedRows;
  const dirty = draft !== null && !sameShareholderRows(draft, savedRows);

  useEffect(() => {
    setDirty(SECTION, dirty);
  }, [dirty, setDirty]);
  useEffect(() => () => setDirty(SECTION, false), [setDirty]);

  const rowErrors = useMemo(() => validateShareholderRows(rows), [rows]);
  const hasErrors = hasShareholderRowErrors(rowErrors);
  const visibleErrors = rows.map((row, index) =>
    visibleRowErrors(row.key, rowErrors[index], touched),
  );
  const hasVisibleErrors = hasShareholderRowErrors(visibleErrors);
  const tooManyRows = rows.length > MAX_SHAREHOLDERS;
  const dividendTotal = dividendRightsTotal(rows);

  const nextKey = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);
  // Set by a Save that found errors: once they render, focus the first one. The counter makes a
  // repeated failed Save focus again even when nothing else changed
  const focusFirstError = useRef(false);
  const [focusRequest, setFocusRequest] = useState(0);
  useEffect(() => {
    if (!focusFirstError.current) {
      return;
    }
    focusFirstError.current = false;
    containerRef.current
      ?.querySelector<HTMLElement>('[aria-invalid="true"], [data-row-limit-error]')
      ?.focus();
  }, [focusRequest]);
  const busy = saving || copying;

  function edit(update: (current: ShareholderRow[]) => ShareholderRow[]): void {
    setDraft(current => {
      const next = update(current ?? savedRows);
      return sameShareholderRows(next, savedRows) ? null : next;
    });
  }

  function updateRow(index: number, patch: Partial<ShareholderRow>): void {
    edit(current => current.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function touch(rowKey: string, field: ShareholderRowField): void {
    const cell = `${rowKey}:${field}`;
    setTouched(current => (current.has(cell) ? current : new Set(current).add(cell)));
  }

  function addRow(): void {
    nextKey.current += 1;
    const row = emptyShareholderRow(`new-${nextKey.current}`);
    edit(current => [...current, row]);
  }

  function cancel(): void {
    setDraft(null);
    setTouched(new Set());
  }

  async function save(): Promise<void> {
    if (!draft) {
      return;
    }
    if (hasErrors || tooManyRows) {
      // Reveal every error and take the user to the first one; nothing is sent
      setTouched(new Set(rows.flatMap(row => ROW_FIELDS.map(field => `${row.key}:${field}`))));
      focusFirstError.current = true;
      setFocusRequest(request => request + 1);
      return;
    }
    const result = await setShareholders({ year, shareholders: draft.map(rowToShareholderInput) });
    if (result) {
      setStored(result.map(shareholderToRow));
      setDraft(null);
      setTouched(new Set());
      refresh();
    }
  }

  async function copyFromPreviousYear(): Promise<void> {
    const result = await copyShareholdersFromYear({ fromYear: year - 1, toYear: year });
    if (result?.length === 0) {
      // Nothing to copy: nothing changed
      return;
    }
    if (result) {
      setStored(result.map(shareholderToRow));
      setDraft(null);
    }
    // A failed copy refreshes too: another tab may have saved shareholders for this year meanwhile
    refresh();
  }

  const canCopy = savedRows.length === 0 && !dirty;

  return (
    <div ref={containerRef} className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addRow}
          disabled={busy || rows.length >= MAX_SHAREHOLDERS}
        >
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
            onClick={cancel}
            disabled={!dirty || busy}
          >
            Cancel
          </Button>
          <Button type="button" size="sm" onClick={() => void save()} disabled={!dirty || busy}>
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
                <TableHead>
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, index) => (
                <ShareholderEditorRow
                  key={row.key}
                  row={row}
                  index={index}
                  rowCount={rows.length}
                  errors={visibleErrors[index]}
                  disabled={busy}
                  businesses={ownBusinesses}
                  fetchingBusinesses={fetchingBusinesses}
                  onChange={patch => updateRow(index, patch)}
                  onBlur={field => touch(row.key, field)}
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
      {tooManyRows && (
        <p data-row-limit-error tabIndex={-1} className="text-sm text-red-600">
          At most {MAX_SHAREHOLDERS} shareholders; remove {rows.length - MAX_SHAREHOLDERS}.
        </p>
      )}
      {hasVisibleErrors && (
        <p className="text-sm text-red-600">Fix the highlighted fields before saving.</p>
      )}
    </div>
  );
}

const SECTION = 'shareholders';

const ROW_FIELDS: ShareholderRowField[] = [
  'idNumber',
  'fullName',
  'isControllingShareholder',
  'isMaterialShareholder',
  'businessId',
  ...NUMERIC_COLUMNS.map(column => column.field),
];

/** A row's errors, limited to the cells the user already left. */
function visibleRowErrors(
  rowKey: string,
  errors: ShareholderRowErrors,
  touched: ReadonlySet<string>,
): ShareholderRowErrors {
  return Object.fromEntries(
    Object.entries(errors).filter(([field]) => touched.has(`${rowKey}:${field}`)),
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
  onBlur: (field: ShareholderRowField) => void;
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
  onBlur,
  onMove,
  onRemove,
}: RowProps): ReactElement {
  const position = index + 1;
  // Screen readers hear which shareholder a cell belongs to once it has a name or an ID
  const who = row.fullName.trim() || row.idNumber.trim();
  const rowLabel = who ? `row ${position} (${who})` : `row ${position}`;
  const businessLinkedOutsideList =
    !!row.businessId && !businesses.some(business => business.value === row.businessId);

  const numericCell = ({ field, label, widthClass }: (typeof NUMERIC_COLUMNS)[number]) => (
    <TableCell key={field}>
      <CellInput
        value={row[field]}
        error={errors[field]}
        label={`${label}, ${rowLabel}`}
        className={cn(widthClass, 'text-right')}
        inputMode="decimal"
        disabled={disabled}
        onChange={value => onChange({ [field]: value })}
        onBlur={() => onBlur(field)}
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
          label={`ID number, ${rowLabel}`}
          className="w-32 font-mono"
          inputMode="numeric"
          maxLength={9}
          disabled={disabled}
          onChange={idNumber => onChange({ idNumber })}
          onBlur={() => onBlur('idNumber')}
        />
      </TableCell>
      <TableCell>
        <CellInput
          value={row.fullName}
          error={errors.fullName}
          label={`Full name, ${rowLabel}`}
          className="min-w-48"
          dir="auto"
          disabled={disabled}
          onChange={fullName => onChange({ fullName })}
          onBlur={() => onBlur('fullName')}
        />
      </TableCell>
      <TableCell>
        <Checkbox
          aria-label={`Controlling shareholder, ${rowLabel}`}
          checked={row.isControllingShareholder}
          disabled={disabled}
          onCheckedChange={checked => onChange({ isControllingShareholder: checked === true })}
        />
      </TableCell>
      {NUMERIC_COLUMNS.slice(0, 3).map(numericCell)}
      <TableCell>
        <Checkbox
          aria-label={`Material shareholder, ${rowLabel}`}
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
            placeholder={
              businessLinkedOutsideList && !fetchingBusinesses
                ? 'Linked business (not in list)'
                : 'Not linked'
            }
            disabled={disabled || fetchingBusinesses}
            triggerProps={{ 'aria-label': `Business, ${rowLabel}`, className: 'min-w-40' }}
            onChange={businessId => onChange({ businessId })}
          />
          {row.businessId && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Unlink business, ${rowLabel}`}
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
            aria-label={`Move ${rowLabel} up`}
            disabled={disabled || index === 0}
            onClick={() => onMove(-1)}
          >
            <ArrowUp className="size-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`Move ${rowLabel} down`}
            disabled={disabled || index === rowCount - 1}
            onClick={() => onMove(1)}
          >
            <ArrowDown className="size-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`Remove ${rowLabel}`}
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
  onBlur: () => void;
};

function CellInput({
  value,
  error,
  label,
  className,
  onChange,
  ...props
}: CellInputProps): ReactElement {
  const errorId = useId();
  return (
    <div className="space-y-1">
      <Input
        {...props}
        aria-label={label}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={cn('h-8', className)}
        value={value}
        onChange={event => onChange(event.target.value)}
      />
      {error && (
        <p id={errorId} className="text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
