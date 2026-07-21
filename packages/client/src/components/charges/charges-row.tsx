import { useEffect, useMemo, type ReactElement } from 'react';
import { useQuery } from 'urql';
import { flexRender, type Row } from '@tanstack/react-table';
import {
  ChargeForChargesTableFieldsFragmentDoc,
  RefetchChargeForChargesTableDocument,
} from '@/gql/graphql.js';
import { getFragmentData } from '@/gql/index.js';
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
  row: Row<ChargeRowType>;
};

export const ChargeRow = ({ row, updateCharge }: Props): ReactElement => {
  const [{ data: newData, fetching }, fetchCharge] = useQuery({
    query: RefetchChargeForChargesTableDocument,
    pause: true,
    variables: {
      chargeId: row.original.id,
    },
  });

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
  // charge after an edit.
  // eslint-disable-next-line react-hooks/immutability -- intentional react-table row-model mutation
  row.original.onChange = fetchCharge;

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
            <Card className="w-full shadow-lg">
              <ChargeExtendedInfo
                chargeID={row.original.id}
                onChange={fetchCharge}
                fetching={fetching}
              />
            </Card>
          </TableCell>
        </TableRow>
      )}
    </>
  );
};
