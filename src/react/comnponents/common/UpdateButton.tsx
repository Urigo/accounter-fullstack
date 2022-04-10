import * as React from 'react';
import { useEditTransaction } from '../../hooks/useEditTransaction';
import type { TransactionType } from '../../models/types';

type Props = {
  transaction: TransactionType;
  propertyName: keyof TransactionType;
  promptText: string;
};

export const UpdateButton: React.FC<Props> = ({
  transaction,
  propertyName,
  promptText,
}) => {
  const { editTransaction } = useEditTransaction();

  return (
    <button
      type="button"
      onClick={() =>
        editTransaction(transaction, propertyName, prompt(promptText) ?? '')
      }
    >
      &#x270f;
    </button>
  );
};
