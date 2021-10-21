import * as React from 'react';
import { ConfirmButton } from '../components/confirmButton';
import { UpdateButton } from '../components/updateButton';
import { AllTransactionsEntity } from '../getAllTransactions';
import { suggestedTransaction } from '../utils';

type Props = {
  transaction: AllTransactionsEntity;
};

export const Entity: React.FC<Props> = ({ transaction }) => {
  const isFinancialEntity = !!transaction.financial_entity;
  const cellText = transaction.financial_entity
    ? transaction.financial_entity
    : suggestedTransaction(transaction)?.financialEntity;

  return (
    <div
      style={
        isFinancialEntity ? undefined : { backgroundColor: 'rgb(236, 207, 57)' }
      }
    >
      {cellText}
      {!transaction.financial_entity && (
        <ConfirmButton
          transaction={transaction}
          propertyName={'financial_entity'}
          value={cellText}
        />
      )}
      <UpdateButton
        transaction={transaction}
        propertyName={'financial_entity'}
        promptText="New financial entity:"
      />
    </div>
  );
};
