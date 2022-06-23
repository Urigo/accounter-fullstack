import gql from 'graphql-tag';
import { useCallback } from 'react';

import { LedgerRecordsDebitAccountFieldsFragment } from '../../../../__generated__/types';
import { useUpdateLedgerRecord } from '../../../../hooks/use-update-ledger-record';
import { EditMiniButton } from '../../../common';

gql`
  fragment LedgerRecordsDebitAccountFields on LedgerRecord {
    id
    debitAccount {
      name
    }
  }
`;

type Props = {
  data: LedgerRecordsDebitAccountFieldsFragment;
};

export const DebitAccount = ({ data }: Props) => {
  const { debitAccount, id: ledgerRecordId } = data;

  const { mutate, isLoading } = useUpdateLedgerRecord();

  const updateDebitAccount = useCallback(
    (value?: string) => {
      if (value !== undefined) {
        mutate({
          ledgerRecordId,
          fields: { debitAccount: { name: value } },
        });
      }
    },
    [ledgerRecordId, mutate]
  );

  return (
    <td>
      {debitAccount?.name ?? 'Missing Account'}
      <EditMiniButton
        onClick={() => updateDebitAccount(prompt('Debit account name:') ?? undefined)}
        disabled={isLoading}
      />
    </td>
  );
};
