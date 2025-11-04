import { useState, type ReactElement } from 'react';
import { flexRender, type Row } from '@tanstack/react-table';
import { ToggleExpansionButton } from '../common/index.js';
import { TableCell, TableRow } from '../ui/table.jsx';
import type { ChargeMatchRow } from './index.js';
import { ChargeMatchesRowExtensions } from './row-extension.js';

type Props = {
  row: Row<ChargeMatchRow>;
};

export const ChargeMatchesRow = ({ row }: Props): ReactElement => {
  const [isExtended, setIsExtended] = useState(false);

  return (
    <>
      <TableRow key={row.id}>
        {row.getVisibleCells().map(cell => (
          <TableCell key={cell.id}>
            {flexRender(cell.column.columnDef.cell, cell.getContext())}
          </TableCell>
        ))}
        <TableCell>
          <ToggleExpansionButton toggleExpansion={setIsExtended} isExpanded={isExtended} />
        </TableCell>
      </TableRow>
      {isExtended && (
        <TableRow key={`${row.id}-extensions`}>
          <TableCell colSpan={row.getVisibleCells().length + 1}>
            <ChargeMatchesRowExtensions row={row} />
          </TableCell>
        </TableRow>
      )}
    </>
  );
};
