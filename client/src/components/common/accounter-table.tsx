import { Paper, Table } from '@mantine/core';
import { PropsWithChildren, ReactNode, useState } from 'react';

import { AccounterButton } from './button';

export interface AccounterTableProps<T> {
  highlightOnHover?: boolean;
  striped?: boolean;
  stickyHeader?: boolean;
  columns: Array<{
    title: string | ReactNode;
    value: (item: T) => string | ReactNode;
  }>;
  items: Array<T>;
  moreInfo?: (item: T) => ReactNode | string | null;
  showButton?: boolean;
}

export interface AccountTableRow<T> {
  item: T;
  key: string;
  columns: AccounterTableProps<T>['columns'];
  moreInfo?: AccounterTableProps<T>['moreInfo'];
  stateBaseId?: string;
  isShowAll: boolean;
}

export function AccounterTableRow<T>(props: PropsWithChildren<AccountTableRow<T>>) {
  const [opened, setOpen] = useState(false);
  const moreInfoValue = props.moreInfo ? props.moreInfo(props.item) : null;

  return (
    <>
      <tr key={props.key}>
        {props.columns.map((c, index) => (
          <td key={String(index)}>{c.value(props.item)}</td>
        ))}
        <td>
          {moreInfoValue === null ? (
            'No Data Related'
          ) : (
            <AccounterButton title="Ledger Info" onClick={() => setOpen(!opened)} />
          )}
        </td>
      </tr>
      {(props.isShowAll || opened) && moreInfoValue !== null ? (
        <tr key={`more_info_${props.key}`}>
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

export function AccounterTable<T>(props: PropsWithChildren<AccounterTableProps<T>>) {
  props.showButton === false;
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
            <tr style={{ backgroundColor: 'lightgrey', width: 'center' }}>
              {props.moreInfo === null || (undefined && 'More Info')}
            </tr>
          </tr>
        </thead>
        <tbody>
          {props.items.map((item, index) => (
            <AccounterTableRow
              key={String(index)}
              columns={props.columns}
              item={item}
              moreInfo={props.moreInfo}
              isShowAll={isShowAll}
            />
          ))}
        </tbody>
      </Table>
    </>
  );
}
