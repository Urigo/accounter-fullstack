import { memo, useCallback, useEffect, useMemo, type ReactElement } from 'react';
import { useQuery } from 'urql';
import {
  ChargeForChargesTableFieldsFragmentDoc,
  RefetchChargeForChargesTableDocument,
} from '@/gql/graphql.js';
import { getFragmentData } from '@/gql/index.js';
import { cn } from '@/lib/utils.js';
import { DragFile } from '../common/index.js';
import { Card } from '../ui/card.js';
import { ChargeExtendedInfo } from './charge-extended-info.js';
import {
  ActionsRegion,
  HealthRegion,
  IdentityRegion,
  ManageRegion,
  MeaningRegion,
  MoneyRegion,
} from './charge-record-regions.js';
import { convertChargeFragmentToTableRow, type ChargeRow } from './charges-table.js';
import type { ChargeDensity } from './use-charge-density.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query RefetchChargeForChargesTable($chargeId: UUID!) {
    charge(chargeId: $chargeId) {
      id
      ...ChargeForChargesTableFields
    }
  }
`;

type Props = {
  row: ChargeRow;
  /**
   * Selection and expansion arrive as plain booleans rather than as the tanstack row.
   *
   * `row.getIsExpanded()` reads live table state, so a retained row object returns the *current*
   * value — which made a `memo` comparator that called it useless: after a toggle both the previous
   * and next props reported the new value, the comparator saw equality, and the record never
   * re-rendered. Primitives snapshot correctly.
   */
  isSelected: boolean;
  isExpanded: boolean;
  density: ChargeDensity;
  onSelectedChange: (selected: boolean) => void;
  onToggleExpanded: () => void;
  onCollapse: () => void;
  /** Registers this charge's refetch so batch actions can refresh it without it being rendered. */
  registerRefetch: (chargeId: string, refetch: () => void) => () => void;
  updateCharge: (charge: ChargeRow) => void;
  removeCharge: (chargeId: string) => void;
};

function ChargeRecordImpl({
  row,
  isSelected,
  isExpanded,
  density,
  onSelectedChange,
  onToggleExpanded,
  onCollapse,
  registerRefetch,
  updateCharge,
  removeCharge,
}: Props): ReactElement {
  const [{ data: newData, fetching }, fetchCharge] = useQuery({
    query: RefetchChargeForChargesTableDocument,
    pause: true,
    variables: { chargeId: row.id },
  });

  // Handlers are ordinary props now, not properties written onto the row model during render.
  useEffect(() => registerRefetch(row.id, fetchCharge), [registerRefetch, row.id, fetchCharge]);

  const onChange = useCallback(() => fetchCharge(), [fetchCharge]);
  const onDelete = useCallback(() => removeCharge(row.id), [removeCharge, row.id]);

  const originalStringified = useMemo(() => JSON.stringify(row), [row]);
  const newRow = useMemo(
    () =>
      newData?.charge
        ? convertChargeFragmentToTableRow(
            getFragmentData(ChargeForChargesTableFieldsFragmentDoc, newData.charge),
          )
        : null,
    [newData],
  );
  const newStringified = useMemo(() => (newRow ? JSON.stringify(newRow) : null), [newRow]);

  useEffect(() => {
    if (newRow && newStringified && !fetching && newStringified !== originalStringified) {
      updateCharge(newRow);
    }
  }, [newRow, newStringified, originalStringified, fetching, updateCharge]);

  const titleId = `charge-${row.id}-title`;
  const panelId = `charge-${row.id}-panel`;

  return (
    <li>
      {/* The whole record is the drop target. Previously only the narrow More Info cell accepted a
          dropped document, so filing a PDF meant hitting one column. */}
      <DragFile chargeId={row.id}>
        <article
          aria-labelledby={titleId}
          data-state={isSelected ? 'selected' : undefined}
          className={cn(
            'grid grid-cols-12 items-start gap-x-3 data-[state=selected]:bg-gray-50 dark:data-[state=selected]:bg-gray-900',
            density === 'compact' ? 'gap-y-0.5 px-3 py-1.5' : 'gap-y-2 p-3',
          )}
        >
          <ManageRegion
            row={row}
            onChange={onChange}
            isSelected={isSelected}
            onSelectedChange={onSelectedChange}
            onStatusChange={onCollapse}
          />
          <IdentityRegion row={row} density={density} />
          {/* The description doubles as the record's accessible name. */}
          <span id={titleId} className="hidden">
            {row.description ?? row.suggestedDescription ?? `Charge ${row.id}`}
          </span>
          <MeaningRegion row={row} onChange={onChange} density={density} />
          {/* Health before money, so the amount lands hard against the right edge next to the
              actions — the strongest position for the number the eye scans for. Ordered the other
              way round, a right-aligned amount butted straight into the left-aligned count chips and
              the two read as one run-on string. */}
          <HealthRegion row={row} density={density} />
          <MoneyRegion row={row} density={density} />
          <ActionsRegion
            row={row}
            onChange={onChange}
            onDelete={onDelete}
            isExpanded={isExpanded}
            onToggleExpanded={onToggleExpanded}
            panelId={panelId}
          />
        </article>
      </DragFile>

      {/* Inside the same `<li>`, not a sibling — otherwise the list count and keyboard order break. */}
      {isExpanded && (
        <div
          id={panelId}
          role="region"
          aria-labelledby={titleId}
          className="border-t bg-gray-50/50 p-3 dark:bg-gray-900/50"
        >
          {/* `w-0 min-w-full overflow-x-auto` keeps the (wide) extended info from stretching the
              page: it renders at the record's width and anything wider scrolls in here. The panel
              still contains genuinely wide nested tables (transactions, documents, ledger). */}
          <div className="w-0 min-w-full overflow-x-auto">
            <Card className="w-full shadow-lg">
              <ChargeExtendedInfo chargeID={row.id} onChange={onChange} fetching={fetching} />
            </Card>
          </div>
        </div>
      )}
    </li>
  );
}

/**
 * Memoized on the fields that actually change what is drawn. Worth it at 100 records — and only safe
 * because the refetch handler is no longer written onto `row` during render (see the registry in
 * `ChargesTable`); with the old mutation a memoized record would have kept a no-op handler.
 */
export const ChargeRecord = memo(
  ChargeRecordImpl,
  (prev, next) =>
    prev.row === next.row &&
    prev.isSelected === next.isSelected &&
    prev.isExpanded === next.isExpanded &&
    prev.density === next.density,
  // The callbacks are deliberately not compared: they are fresh closures on every render but each
  // one calls through to the live table, so a retained closure still acts on current state.
);
