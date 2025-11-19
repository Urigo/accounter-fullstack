import { type ReactElement } from 'react';
import { flexRender, type Row } from '@tanstack/react-table';
import { ROUTES } from '@/router/routes.js';
import { TableCell, TableRow } from '../ui/table.js';
import type { ExtendedLedger } from './business-extended-info.js';

type Props = {
  row: Row<ExtendedLedger>;
};

export const BusinessExtendedInfoRow = ({ row }: Props): ReactElement => {
  const handleRowClick = (event: React.MouseEvent): void => {
    event.stopPropagation();
    window.open(ROUTES.CHARGES.DETAIL(row.original.chargeId), '_blank', 'noreferrer');
  };

  return (
    <TableRow
      onClick={handleRowClick}
      className="cursor-pointer hover:bg-gray-50 transition-colors"
    >
      {row.getVisibleCells().map(cell => (
        <TableCell key={cell.id}>
          {flexRender(cell.column.columnDef.cell, cell.getContext())}
        </TableCell>
      ))}
    </TableRow>
  );
};
