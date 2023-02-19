import { CSSProperties } from 'react';
import {
  businessesWithoutTaxCategory,
  entitiesWithoutInvoice,
  isBusiness,
  suggestedTransaction,
} from '../../../../helpers';
import type { TransactionType } from '../../../../models/types';
import { ConfirmButton, UpdateButton } from '../../../common';

type Props = {
  transaction: TransactionType;
  style?: CSSProperties;
};

export const Vat = ({ transaction, style }: Props) => {
  const indicator =
    (!transaction.vat &&
      isBusiness(transaction) &&
      transaction.currency_code === 'ILS' &&
      !entitiesWithoutInvoice.includes(transaction.financial_entity_id || '') &&
      !businessesWithoutTaxCategory.includes(transaction.financial_entity_id ?? '')) ||
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
      {!transaction.vat && (
        <ConfirmButton transaction={transaction} propertyName="vat" value={cellText?.toString()} />
      )}
      <UpdateButton transaction={transaction} propertyName="vat" promptText="New VAT:" />
    </td>
  );
};
