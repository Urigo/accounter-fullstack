import { ReactElement, ReactNode, useState } from 'react';
import { Pagination, PaginationProps, Paper, Table } from '@mantine/core';
import { Button } from '.';

export interface AccounterTableProps<T, U> {
  highlightOnHover?: boolean;
  striped?: boolean;
  stickyHeader?: boolean;
  columns: Array<{
    title: string | ReactNode;
    disabled?: boolean;
    value: (item: T, context?: U) => string | ReactNode;
    style?: React.CSSProperties;
  }>;
  items: Array<T>;
  moreInfo?: (item: T) => ReactNode;
  showButton?: boolean;
  rowContext?: (item: T) => U | undefined;
  pagination?: PaginationProps;
}

export interface AccountTableRow<T, U> {
  item: T;
  columns: AccounterTableProps<T, U>['columns'];
  moreInfo?: AccounterTableProps<T, U>['moreInfo'];
  stateBaseId?: string;
  isShowAll: boolean;
  rowContext?: (item: T) => U | undefined;
}

export function AccounterTableRow<T, U>(props: AccountTableRow<T, U>): ReactElement {
  const [opened, setOpen] = useState(false);
  const moreInfoValue = props.moreInfo ? props.moreInfo(props.item) : null;

  return (
    <>
      <tr>
        {props.columns.map((c, index) =>
          c.disabled ? null : (
            <td key={String(index)} style={c.style}>
              {c.value(props.item, props.rowContext ? props.rowContext(props.item) : undefined)}
            </td>
          ),
        )}
        {props.moreInfo && (
          <td>
            {moreInfoValue === null ? (
              <p>No Data Related</p>
            ) : (
              <Button title="More Info" onClick={(): void => setOpen(!opened)} />
            )}
          </td>
        )}
      </tr>
      {(props.isShowAll || opened) && moreInfoValue !== null && (
        <tr>
          <td colSpan={12}>
            <Paper style={{ width: '100%' }} withBorder shadow="lg">
              {moreInfoValue}
            </Paper>
          </td>
        </tr>
      )}
    </>
  );
}

export function AccounterTable<T, U>(props: AccounterTableProps<T, U>): ReactNode {
  const [isShowAll, setShowAll] = useState(false);

  return (
    <>
      <div className="flex flex-row justify-end w-full">
        {props.pagination && <Pagination className="flex-auto" {...props.pagination} />}
        {props.showButton === true ? (
          <button
            className="inline-flex text-white bg-indigo-500 border-0 py-1.5 px-3 focus:outline-none hover:bg-indigo-600 rounded text-sm"
            type="button"
            onClick={(): void => {
              setShowAll(prev => !prev);
            }}
          >
            {isShowAll ? 'Hide All' : 'Show All'}
          </button>
        ) : null}
      </div>
      <Table striped={props.striped} highlightOnHover={props.highlightOnHover}>
        <thead style={props.stickyHeader ? { position: 'sticky', top: 0, zIndex: 20 } : {}}>
          <tr className="px-10 py-10 title-font tracking-wider font-medium text-gray-900 text-sm bg-gray-100 rounded-tl rounded-bl">
            {props.columns.map((c, index) =>
              c.disabled ? null : <th key={String(index)}>{c.title}</th>,
            )}
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
              rowContext={props.rowContext}
            />
          ))}
        </tbody>
      </Table>
    </>
  );
}
