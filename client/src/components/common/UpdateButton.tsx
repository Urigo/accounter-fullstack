import * as React from 'react';
import { useSql } from '../../hooks/useSql';
import type { TransactionType } from '../../models/types';

type Props = {
  transaction: TransactionType;
  propertyName: keyof TransactionType;
  promptText: string;
};

export const UpdateButton: React.FC<Props> = ({ transaction, propertyName, promptText }) => {
  const { editTransaction } = useSql();

  return (
    <button
      type="button"
      onClick={() =>
        editTransaction({
          propertyToChange: propertyName,
          newValue: prompt(promptText) ?? '',
          id: transaction.id,
        })
      }
    >
      &#x270f;
    </button>
  );
};
