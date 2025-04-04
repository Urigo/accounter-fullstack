import { ReactElement } from 'react';
import { format } from 'date-fns';
import { TransactionsTableRowType } from '../columns.js';

type Props = {
  transaction: TransactionsTableRowType;
};

export const EventDate = ({ transaction }: Props): ReactElement => {
  const eventDate = 'eventDate' in transaction ? transaction.eventDate : undefined;

  return (
    <div className="flex flex-col justify-center">
      {eventDate && format(new Date(eventDate), 'dd/MM/yy')}
    </div>
  );
};
