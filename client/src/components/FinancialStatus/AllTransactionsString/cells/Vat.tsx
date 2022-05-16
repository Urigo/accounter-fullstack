import { CSSProperties, FC } from 'react';
import type { TransactionType } from '../../../../models/types';
import { ConfirmButton, UpdateButton } from '../../../common';
import {
  businessesWithoutTaxCategory,
  businessesWithoutVAT,
  isBusiness,
  suggestedTransaction,
} from '../../../../helpers';

type Props = {
  transaction: TransactionType;
  style?: CSSProperties;
};

export const Vat: FC<Props> = ({ transaction, style }) => {
  const indicator =
    (!transaction.vat &&
      isBusiness(transaction) &&
      transaction.currency_code === 'ILS' &&
      !businessesWithoutVAT.includes(transaction.financial_entity || '') &&
      !businessesWithoutTaxCategory.includes(transaction.financial_entity ?? '')) ||
    (transaction.vat &&
      ((transaction.vat > 0 && Number(transaction.event_amount) < 0) ||
        (transaction.vat < 0 && Number(transaction.event_amount) > 0)));

  const cellText = transaction.vat ?? suggestedTransaction(transaction)?.vat;

  return (
    <td
      style={{
        ...(indicator ? { backgroundColor: 'rgb(236, 207, 57)' } : {}),
        ...style,
      }}
    >
      {cellText ?? 'undefined'}
      {!transaction.vat && <ConfirmButton transaction={transaction} propertyName="vat" value={cellText?.toString()} />}
      <UpdateButton transaction={transaction} propertyName="vat" promptText="New VAT:" />
    </td>
  );
};
