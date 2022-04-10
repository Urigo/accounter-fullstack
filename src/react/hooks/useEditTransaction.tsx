import { useCallback } from 'react';
import { TransactionType } from '../models/types';

export const useEditTransaction = () => {
  const onEditTransaction = useCallback(
    (
      transaction: TransactionType,
      propertyToChange: string,
      newValue: string
    ) => {
      const changeRequest = {
        newValue: newValue,
        propertyToChange,
        id: transaction.id,
        bank_reference: transaction.bank_reference,
        account_number: transaction.account_number,
        account_type: transaction.account_type,
        currency_code: transaction.currency_code,
        event_date: transaction.event_date
          .toISOString()
          .replace(/T/, ' ')
          .replace(/\..+/, ''),
        event_amount: transaction.event_amount,
        event_number: transaction.event_number,
      };
      console.log(
        `Updating ${propertyToChange} to ${newValue} for transaction:`,
        transaction
      );

      fetch('/editProperty', {
        method: 'POST',
        body: JSON.stringify(changeRequest),
      }).then((response) => {
        console.log('Request complete! response:', response);
      });
    },
    []
  );

  return {
    editTransaction: onEditTransaction,
  };
};
