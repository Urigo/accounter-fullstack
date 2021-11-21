import * as React from 'react';
import { ConfirmButton } from '../components/confirmButton';
import { UpdateButton } from '../components/updateButton';
import { AllTransactionsEntity } from '../getAllTransactions';
import {
  businessesWithoutTaxCategory,
  isBusiness,
  suggestedTransaction,
} from '../utils';

type Props = {
  transaction: AllTransactionsEntity;
  style: React.CSSProperties;
};

export const Vat: React.FC<Props> = ({ transaction, style }) => {
  const businessesWithoutVAT = [
    'Apple',
    'Halman Aldubi Training Fund',
    'Halman Aldubi Pension',
    'Social Security Deductions',
    'Tax Deductions',
  ];

  const indicator =
    (!transaction.vat &&
      isBusiness(transaction) &&
      transaction.currency_code == 'ILS' &&
      !businessesWithoutVAT.includes(transaction.financial_entity || '') &&
      !businessesWithoutTaxCategory.includes(
        transaction.financial_entity || ''
      )) ||
    (transaction.vat &&
      ((transaction.vat > 0 && Number(transaction.event_amount) < 0) ||
        (transaction.vat < 0 && Number(transaction.event_amount) > 0)));

  const cellText = transaction.vat
    ? transaction.vat
    : suggestedTransaction(transaction)?.vat;

  return (
    <td
      style={{
        ...style,
        ...(indicator ? { backgroundColor: 'rgb(236, 207, 57)' } : {}),
      }}
    >
      {cellText ?? 'undefined'}
      {!transaction.vat && (
        <ConfirmButton
          transaction={transaction}
          propertyName={'vat'}
          value={cellText?.toString()}
        />
      )}
      <UpdateButton
        transaction={transaction}
        propertyName={'vat'}
        promptText="New VAT:"
      />
    </td>
  );
};
