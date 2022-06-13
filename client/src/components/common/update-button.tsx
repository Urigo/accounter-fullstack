import { useSql } from '../../hooks/use-sql';
import type { TransactionType } from '../../models/types';

type Props = {
  transaction: TransactionType;
  propertyName: keyof TransactionType;
  promptText: string;
};

export const UpdateButton = ({ transaction, propertyName, promptText }: Props) => {
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
