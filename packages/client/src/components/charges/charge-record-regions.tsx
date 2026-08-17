import type { ReactElement } from 'react';
import { format } from 'date-fns';
import { ArrowRight, ChevronDown, ChevronUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ROUTES } from '@/router/routes.js';
import { MissingChargeInfo } from '../../gql/graphql.js';
import { getChargeTypeIcon, getChargeTypeName } from '../../helpers/index.js';
import { Tooltip, UpdateAccountantStatus } from '../common/index.js';
import { Button } from '../ui/button.js';
import { Checkbox } from '../ui/checkbox.js';
import { ChargeActionsMenu } from './charge-actions-menu.js';
import { hasDateRange } from './charge-dates.js';
import { isFieldVisible, isMissing, isSpecialField } from './charge-fields.js';
import {
  amountState,
  AmountText,
  CountChip,
  ledgerState,
  NeedsBadge,
  StatusDot,
  vatState,
} from './charge-indicators.js';
import { ChargeDescriptionField, ChargeTagsField } from './charge-suggestion-field.js';
import type { ChargeRow } from './charges-table.js';
import type { ChargeDensity } from './use-charge-density.js';

/**
 * The record is six regions at fixed horizontal positions. Region placement is identical on every
 * charge — that is what preserves the vertical scanning a table gave us — while *which fields* appear
 * inside a region varies by type, per the spec matrix.
 *
 * Every region therefore renders its grid cell unconditionally, even when the matrix hides all of its
 * fields. Returning `null` instead removes a grid child, which slides every later region one column
 * left: a `FinancialCharge` has neither amount nor VAT, and its actions column ended up misaligned
 * with every other record's.
 */

type RegionProps = {
  row: ChargeRow;
  onChange: () => void;
};

/**
 * Compact mode keeps the fields that answer "which charge is this and does it need me" — type, date,
 * description, amount, and the needs badge — and drops the supporting detail (date range, counterparty
 * → tax category, tags, count chips). It is a display choice only: nothing about the matrix changes,
 * so a field hidden by compact was still going to be hidden by the matrix if the type excluded it.
 */
function isCompact(density: ChargeDensity): boolean {
  return density === 'compact';
}

/** Quiet placeholder for a displayed field with no value. The needs badge carries the alarm. */
function Absent({ children }: { children: string }): ReactElement {
  return <span className="italic text-gray-400 dark:text-gray-500">{children}</span>;
}

/** A — selection, accountant approval, and the row-level roll-up of what this charge is missing. */
export function ManageRegion({
  row,
  onChange,
  isSelected,
  onSelectedChange,
  onStatusChange,
}: RegionProps & {
  isSelected: boolean;
  onSelectedChange: (selected: boolean) => void;
  onStatusChange: () => void;
}): ReactElement {
  return (
    // Laid out in a row, not a column. Stacked, these three controls were ~70px tall and set the
    // record's height regardless of how much content it had — the same mistake the old table's
    // `select` cell made, where a checkbox over a status button padded every row out.
    <div className="col-span-3 flex items-center gap-1 md:col-span-1">
      <Checkbox
        checked={isSelected}
        onCheckedChange={value => onSelectedChange(!!value)}
        // 100 identical "Select row" labels are useless to a screen reader; name the charge.
        aria-label={`Select charge ${row.description ?? row.id}`}
      />
      <UpdateAccountantStatus
        chargeId={row.id}
        value={row.accountantApproval}
        onChange={onChange}
        // Once the status is set the charge is handled — collapse it so the list moves on.
        onStatusChange={onStatusChange}
      />
      <NeedsBadge type={row.type} missingInfo={row.missingInfo} />
    </div>
  );
}

/** B — what kind of charge this is, and when. */
export function IdentityRegion({
  row,
  density,
}: {
  row: ChargeRow;
  density: ChargeDensity;
}): ReactElement {
  const showRange =
    !isCompact(density) && isFieldVisible(row.type, 'dateRange') && hasDateRange(row.dates);

  return (
    <div className="col-span-9 flex min-w-0 flex-col gap-0.5 md:col-span-2">
      <span className="flex items-center gap-1.5">
        {/* The type used to be an icon behind a tooltip. It is the key to interpreting everything
            else in the record, so it carries its name. */}
        <span className="shrink-0 text-gray-500 dark:text-gray-400 [&_svg]:size-4">
          {getChargeTypeIcon(row.type)}
        </span>
        <span className="truncate text-sm font-medium">{getChargeTypeName(row.type)}</span>
      </span>
      {isFieldVisible(row.type, 'mainDate') && (
        <span className="text-xs tabular-nums text-gray-600 dark:text-gray-400">
          {row.dates?.date ? format(row.dates.date, 'dd MMM yy') : <Absent>No date</Absent>}
        </span>
      )}
      {showRange && (
        <span className="text-xs tabular-nums text-gray-400 dark:text-gray-500">
          {format(row.dates!.mostMinDate!, 'dd MMM')} –{' '}
          {format(row.dates!.mostMaxDate!, 'dd MMM yy')}
        </span>
      )}
    </div>
  );
}

/** C — what the charge means: description, who it is with, how it is classified, and its tags. */
export function MeaningRegion({
  row,
  onChange,
  density,
}: RegionProps & { density: ChargeDensity }): ReactElement {
  const compact = isCompact(density);
  const showCounterparty = !compact && isFieldVisible(row.type, 'mainCounterparty');
  const showTaxCategory = !compact && isFieldVisible(row.type, 'mainTaxCategory');
  const showBusinessTrip = !compact && isFieldVisible(row.type, 'businessTrip');
  // The spec's footnote: an internal transfer moves money between two of your own accounts, so a
  // single "counterparty" would be a half-truth.
  const bothSides = isSpecialField(row.type, 'mainCounterparty');

  return (
    <div className="col-span-12 flex min-w-0 flex-col gap-1 md:col-span-4">
      {isFieldVisible(row.type, 'description') && (
        <span className="min-w-0 break-words text-sm">
          <ChargeDescriptionField
            chargeId={row.id}
            value={row.description}
            suggestion={row.suggestedDescription}
            onChange={onChange}
          />
        </span>
      )}

      {(showCounterparty || showTaxCategory || showBusinessTrip) && (
        <span className="flex min-w-0 flex-wrap items-center gap-1 text-xs text-gray-600 dark:text-gray-400">
          {showCounterparty &&
            (row.counterparty ? (
              <>
                <Link
                  to={ROUTES.BUSINESSES.DETAIL(row.counterparty.id)}
                  target="_blank"
                  rel="noreferrer"
                  onClick={event => event.stopPropagation()}
                  className="font-medium underline-offset-2 hover:underline"
                >
                  {row.counterparty.name}
                </Link>
                {bothSides && (
                  <Tooltip content="Internal transfer — both sides of the movement are your own accounts">
                    <span className="inline-flex items-center gap-1 text-gray-400 dark:text-gray-500">
                      <ArrowRight aria-hidden className="size-3" />
                      both sides
                    </span>
                  </Tooltip>
                )}
              </>
            ) : (
              <Absent>No counterparty</Absent>
            ))}

          {showCounterparty && showTaxCategory && (
            <ArrowRight aria-hidden className="size-3 shrink-0 text-gray-300 dark:text-gray-600" />
          )}

          {showTaxCategory &&
            (row.taxCategory ? (
              <span className="truncate">{row.taxCategory.name}</span>
            ) : (
              <Absent>No tax category</Absent>
            ))}

          {showBusinessTrip && row.businessTrip && (showCounterparty || showTaxCategory) && (
            <span aria-hidden className="text-gray-300 dark:text-gray-600">
              ·
            </span>
          )}

          {showBusinessTrip && row.businessTrip && (
            <Link
              to={ROUTES.BUSINESS_TRIPS.DETAIL(row.businessTrip.id)}
              target="_blank"
              rel="noreferrer"
              onClick={event => event.stopPropagation()}
              className="font-medium underline-offset-2 hover:underline"
            >
              {row.businessTrip.name}
            </Link>
          )}
        </span>
      )}

      {!compact && isFieldVisible(row.type, 'tags') && (
        <span className="min-w-0 text-xs">
          <ChargeTagsField
            chargeId={row.id}
            tags={row.tags}
            suggestedTags={row.suggestedTags}
            onChange={onChange}
          />
        </span>
      )}
    </div>
  );
}

/** D — the money. Right-aligned and tabular so amounts compare down the list. */
export function MoneyRegion({
  row,
  density,
}: {
  row: ChargeRow;
  density: ChargeDensity;
}): ReactElement {
  const showAmount = isFieldVisible(row.type, 'amount');
  const showVat = !isCompact(density) && isFieldVisible(row.type, 'vat');

  // The spec's footnote: a conversion has a base and a quote amount, so one total would hide half of
  // what happened. The base/quote pair itself lives on the expansion panel; the record shows the
  // amount it has plus a marker that there are two sides.
  const isConversion = isSpecialField(row.type, 'amount');

  return (
    <div className="col-span-6 flex min-w-0 flex-col items-end gap-0.5 md:col-span-2">
      {showAmount &&
        (row.amount ? (
          <span className="flex items-center gap-1">
            <StatusDot state={amountState(row.amount.shouldValidate, row.amount.isValid)} />
            <AmountText
              value={row.amount.value}
              currency={row.amount.currency}
              className="text-sm font-semibold"
            />
          </span>
        ) : (
          <Absent>No amount</Absent>
        ))}
      {isConversion && (
        <span className="text-xs text-gray-400 dark:text-gray-500">base → quote</span>
      )}
      {showVat && (
        <span className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400">
          <StatusDot
            state={vatState({
              value: row.vat?.value,
              currency: row.vat?.currency,
              amountValue: row.amount?.value,
              isMissingInfo: isMissing(row.type, row.missingInfo, MissingChargeInfo.Vat),
            })}
          />
          {row.vat?.value == null ? (
            <Absent>No VAT</Absent>
          ) : (
            <span className="tabular-nums">VAT {row.vat.value.toLocaleString()}</span>
          )}
        </span>
      )}
    </div>
  );
}

/** E — the charge's health: what is attached to it, and whether any of it is wrong. */
export function HealthRegion({
  row,
  density,
}: {
  row: ChargeRow;
  density: ChargeDensity;
}): ReactElement {
  const chips: ReactElement[] = [];
  const compact = isCompact(density);

  if (!compact && isFieldVisible(row.type, 'transactionsCount')) {
    chips.push(
      <CountChip
        key="tx"
        label="tx"
        count={row.counts.transactions}
        state={
          isMissing(row.type, row.missingInfo, MissingChargeInfo.Transactions) ? 'error' : 'ok'
        }
      />,
    );
  }
  if (!compact && isFieldVisible(row.type, 'documentsCount')) {
    chips.push(
      <CountChip
        key="doc"
        label="doc"
        count={row.counts.documents}
        state={isMissing(row.type, row.missingInfo, MissingChargeInfo.Documents) ? 'error' : 'ok'}
      />,
    );
  }
  if (!compact && isFieldVisible(row.type, 'miscExpensesCount')) {
    chips.push(<CountChip key="misc" label="misc" count={row.counts.miscExpenses} />);
  }
  if (!compact && isFieldVisible(row.type, 'ledgerCount')) {
    chips.push(
      <CountChip
        key="ledger"
        label="ledger"
        count={row.counts.ledger}
        state={ledgerState(row.counts.invalidLedger)}
      />,
    );
  }

  return (
    <div className="col-span-6 flex min-w-0 flex-wrap items-start gap-x-2 gap-y-0.5 md:col-span-2">
      {chips}
    </div>
  );
}

/** F — per-charge actions and the expansion toggle. */
export function ActionsRegion({
  row,
  onChange,
  onDelete,
  isExpanded,
  onToggleExpanded,
  panelId,
}: RegionProps & {
  onDelete: () => void;
  isExpanded: boolean;
  onToggleExpanded: () => void;
  panelId: string;
}): ReactElement {
  return (
    <div className="col-span-3 flex items-center justify-end gap-1 md:col-span-1">
      <ChargeActionsMenu
        chargeId={row.id}
        chargeType={row.type}
        onChange={onChange}
        onDelete={onDelete}
        isIncome={(row.amount?.value ?? 0) > 0}
      />
      <Tooltip content={isExpanded ? 'Collapse' : 'Expand info'} asChild>
        <Button
          variant={isExpanded ? 'default' : 'outline'}
          onClick={event => {
            event.stopPropagation();
            onToggleExpanded();
          }}
          className="size-7.5"
          // The tooltip only exists in the DOM while open, so without this the button is a nameless
          // chevron to assistive tech.
          aria-label={isExpanded ? 'Collapse charge details' : 'Expand charge details'}
          aria-expanded={isExpanded}
          aria-controls={panelId}
        >
          {isExpanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
        </Button>
      </Tooltip>
    </div>
  );
}
