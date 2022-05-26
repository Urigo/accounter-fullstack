import { Table } from '@mantine/core';
import { PropsWithChildren, ReactNode } from 'react';

export interface AccounterTableProps<T> {
  highlightOnHover?: boolean;
  striped?: boolean;
  stickyHeader?: boolean;
  columns: Array<{
    title: string | ReactNode;
    value: (item: T) => string | ReactNode;
  }>;
  items: Array<T>;
}

export function AccounterTable<T>(props: PropsWithChildren<AccounterTableProps<T>>) {
  return (
    <Table striped={props.striped} highlightOnHover={props.highlightOnHover}>
      <thead style={props.stickyHeader ? { position: 'sticky', top: 0, zIndex: 20 } : {}}>
        <tr style={{ backgroundColor: 'lightgrey', width: 'center' }}>
          {props.columns.map((c, index) => (
            <td key={String(index)}>{c.title}</td>
          ))}
        </tr>
      </thead>
      <tbody>
        {props.items.map((item, index) => {
          return (
            <tr key={String(index)}>
              {props.columns.map(c => (
                <td key={String(index)}>{c.value(item)}</td>
              ))}
            </tr>
          );
        })}
      </tbody>
    </Table>
  );
}
