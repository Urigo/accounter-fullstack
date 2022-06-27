import { Paper, Table } from '@mantine/core';
import { ReactNode, useState } from 'react';

import { AccounterButton } from './button';

export interface AccounterTableProps<T, U> {
  highlightOnHover?: boolean;
  striped?: boolean;
  stickyHeader?: boolean;
  columns: Array<{
    title: string | ReactNode;
    value: (item: T, alternativeCharge?: U) => string | ReactNode;
  }>;
  items: Array<T>;
  moreInfo?: (item: T) => ReactNode | string | null;
  showButton?: boolean;
  extraRowData?: (item: T) => U | undefined;
}

export interface AccountTableRow<T, U> {
  item: T;
  columns: AccounterTableProps<T, U>['columns'];
  moreInfo?: AccounterTableProps<T, U>['moreInfo'];
  stateBaseId?: string;
  isShowAll: boolean;
  extraRowData?: (item: T) => U | undefined;
}

export function AccounterTableRow<T, U>(props: AccountTableRow<T, U>) {
  const [opened, setOpen] = useState(false);
  const moreInfoValue = props.moreInfo ? props.moreInfo(props.item) : null;

  return (
    <>
      <tr>
        {props.columns.map((c, index) => (
          <td key={String(index)}>
            {c.value(props.item, props.extraRowData ? props.extraRowData(props.item) : undefined)}
          </td>
        ))}
        {props.moreInfo && (
          <td>
            {moreInfoValue === null ? (
              'No Data Related'
            ) : (
              <AccounterButton title="Ledger Info" onClick={() => setOpen(!opened)} />
            )}
          </td>
        )}
      </tr>
      {(props.isShowAll || opened) && moreInfoValue !== null ? (
        <tr>
          <td colSpan={6}>
            <Paper style={{ width: '100%' }} withBorder shadow="lg">
              {moreInfoValue}
            </Paper>
          </td>
        </tr>
      ) : null}
    </>
  );
}

export function AccounterTable<T, U>(props: AccounterTableProps<T, U>) {
  const [isShowAll, setShowAll] = useState(false);

  return (
    <>
      {props.showButton === true ? (
        <button
          className="inline-flex text-white bg-indigo-500 border-0 py-1.5 px-3 focus:outline-none hover:bg-indigo-600 rounded text-sm"
          type="button"
          onClick={() => {
            setShowAll(prev => !prev);
          }}
        >
          {isShowAll ? 'Hide All' : 'Show All'}
        </button>
      ) : null}
      <Table striped={props.striped} highlightOnHover={props.highlightOnHover}>
        <thead style={props.stickyHeader ? { position: 'sticky', top: 0, zIndex: 20 } : {}}>
          <tr className="px-10 py-10 title-font tracking-wider font-medium text-gray-900 text-sm bg-gray-100 rounded-tl rounded-bl">
            {props.columns.map((c, index) => (
              <th key={String(index)}>{c.title}</th>
            ))}
            {props.moreInfo && <th>More Info</th>}
          </tr>
        </thead>
        <tbody>
          {props.items.map((item, index) => (
            <AccounterTableRow
              key={index}
              columns={props.columns}
              item={item}
              moreInfo={props.moreInfo}
              isShowAll={isShowAll}
              extraRowData={props.extraRowData}
            />
          ))}
        </tbody>
      </Table>
    </>
  );
}
