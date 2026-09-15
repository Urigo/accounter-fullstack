import { useState, type ReactElement, type ReactNode } from 'react';
import { cn } from '../../lib/utils.js';
import { Button } from '../ui/button.js';
import { Card } from '../ui/card.js';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table.js';

export interface AccounterTableProps<T, U> {
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
  const [opened, setOpened] = useState(false);
  const moreInfoValue = props.moreInfo ? props.moreInfo(props.item) : null;

  return (
    <>
      <TableRow>
        {props.columns.map((c, index) =>
          c.disabled ? null : (
            <TableCell key={String(index)} style={c.style}>
              {c.value(props.item, props.rowContext ? props.rowContext(props.item) : undefined)}
            </TableCell>
          ),
        )}
        {props.moreInfo && (
          <TableCell>
            {moreInfoValue === null ? (
              <p>No Data Related</p>
            ) : (
              <Button onClick={(): void => setOpened(!opened)} className="ml-auto">
                More Info
              </Button>
            )}
          </TableCell>
        )}
      </TableRow>
      {(props.isShowAll || opened) && moreInfoValue !== null && (
        <TableRow>
          <TableCell colSpan={12}>
            <Card className="w-full shadow-lg">{moreInfoValue}</Card>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

export function AccounterTable<T, U>(props: AccounterTableProps<T, U>): ReactNode {
  const [isShowAll, setIsShowAll] = useState(false);

  return (
    <>
      <div className="flex flex-row justify-end w-full">
        {props.showButton === true ? (
          <Button
            type="button"
            onClick={(): void => {
              setIsShowAll(prev => !prev);
            }}
          >
            {isShowAll ? 'Hide All' : 'Show All'}
          </Button>
        ) : null}
      </div>
      {/* `highlightOnHover` is gone from the props: TableRow highlights on hover
          unconditionally, so a prop that could only ever turn it off — and which no caller
          passed as false — would have been API that did nothing. Mantine's striped selector
          was `> tbody > tr:nth-of-type(odd)`; the child combinators matter because these
          tables nest a table in their "More Info" row. */}
      <Table className={cn(props.striped && '[&>tbody>tr:nth-child(odd)]:bg-gray-50')}>
        <TableHeader className={cn(props.stickyHeader && 'sticky top-0 z-20')}>
          <TableRow className="px-10 py-10 title-font tracking-wider font-medium text-gray-900 text-sm bg-gray-100 rounded-tl rounded-bl">
            {props.columns.map((c, index) =>
              c.disabled ? null : <TableHead key={String(index)}>{c.title}</TableHead>,
            )}
            {props.moreInfo && <TableHead>More Info</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
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
        </TableBody>
      </Table>
    </>
  );
}
