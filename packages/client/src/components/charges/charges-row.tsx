import { useCallback, useEffect, useMemo, type ReactElement } from 'react';
import { useQuery } from 'urql';
import { flexRender, type Row } from '@tanstack/react-table';
import {
  ChargeForChargesTableFieldsFragmentDoc,
  RefetchChargeForChargesTableDocument,
} from '@/gql/graphql.js';
import { getFragmentData } from '@/gql/index.js';
import type { TableFeaturesConfig } from '@/lib/table-features.js';
import { useRegisterChargeRefresh } from '../../providers/charge-refresh.js';
import { Card } from '../ui/card.js';
import { TableCell, TableRow } from '../ui/table.js';
import { ChargeExtendedInfo } from './charge-extended-info.js';
import {
  convertChargeFragmentToTableRow,
  type ChargeRow as ChargeRowType,
} from './charges-table.js';

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
  updateCharge: (charge: ChargeRowType) => void;
  removeCharge: (chargeId: string) => void;
  row: Row<TableFeaturesConfig, ChargeRowType>;
};

export const ChargeRow = ({ row, updateCharge, removeCharge }: Props): ReactElement => {
  const [{ data: newData, fetching }, fetchCharge] = useQuery({
    query: RefetchChargeForChargesTableDocument,
    pause: true,
    variables: {
      chargeId: row.original.id,
    },
  });

  // The handler every action in (and under) this row calls once it has mutated the charge.
  //  * `network-only` — this always runs right after a mutation, so a replayed/cached result would
  //    silently re-apply the pre-mutation charge. Mirrors `ChargeExtendedInfo`'s refetch.
  //  * argument-swallowing — `onChange` is handed to plain callbacks and DOM handlers alike;
  //    forwarding their argument would land it in urql's `OperationContext`.
  const refetchCharge = useCallback((): void => {
    fetchCharge({ requestPolicy: 'network-only' });
  }, [fetchCharge]);

  // Publish the same refetch under this charge's id, so a batch mutation elsewhere in the tree can
  // refresh this row without holding a reference to it. `row.original` is swapped out on every
  // refresh, but its id is stable, which is what the registry keys on.
  useRegisterChargeRefresh(row.original.id, refetchCharge);

  const dropCharge = useCallback((): void => {
    removeCharge(row.original.id);
  }, [removeCharge, row.original.id]);

  const originalStringified = useMemo(() => JSON.stringify(row.original), [row.original]);
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

  // react-table's row model is mutated in place to thread this row's refetch
  // handler onto `row.original.onChange`, which the cells read to reload the
  // charge after an edit. `updateCharge` swaps `row.original` for a freshly
  // converted row whose handlers are inert stubs, so the re-threading below has
  // to happen on every render — not just on mount.
  // eslint-disable-next-line react-hooks/immutability -- intentional react-table row-model mutation
  row.original.onChange = refetchCharge;
  // Same threading for the delete path — the row is dropped from the table instead of refetched.
  // eslint-disable-next-line react-hooks/immutability -- intentional react-table row-model mutation
  row.original.onDelete = dropCharge;

  return (
    <>
      <TableRow key={row.id} className="w-fit max-w-full">
        {fetching && !row.original ? (
          <TableCell colSpan={row.getVisibleCells().length + 1}>Loading...</TableCell>
        ) : (
          <>
            {row.getVisibleCells().map(cell => (
              <TableCell key={cell.id}>
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
              </TableCell>
            ))}
          </>
        )}
      </TableRow>

      {/* Charge expansion row */}
      {row.getIsExpanded() && (
        <TableRow>
          <TableCell colSpan={row.getVisibleCells().length}>
            {/* `w-0 min-w-full` keeps the (wide) extended info from contributing to the
                outer table's intrinsic width — it renders at the row's width, its nested
                tables wrap their cells, and anything still too wide scrolls in here
                instead of stretching the page sideways. */}
            <div className="w-0 min-w-full overflow-x-auto [&_th]:whitespace-normal [&_td]:whitespace-normal">
              <Card className="w-full shadow-lg">
                <ChargeExtendedInfo
                  chargeID={row.original.id}
                  onChange={refetchCharge}
                  onChargeDeleted={removeCharge}
                  fetching={fetching}
                />
              </Card>
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
};
