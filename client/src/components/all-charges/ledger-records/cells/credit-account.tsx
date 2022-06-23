import gql from 'graphql-tag';
import { useCallback } from 'react';

import { LedgerRecordsCreditAccountFieldsFragment } from '../../../../__generated__/types';
import { useUpdateLedgerRecord } from '../../../../hooks/use-update-ledger-record';
import { EditMiniButton } from '../../../common';

gql`
  fragment LedgerRecordsCreditAccountFields on LedgerRecord {
    id
    creditAccount {
      name
    }
  }
`;

type Props = {
  data: LedgerRecordsCreditAccountFieldsFragment;
};

export const CreditAccount = ({ data }: Props) => {
  const { creditAccount, id: ledgerRecordId } = data;

  const { mutate, isLoading } = useUpdateLedgerRecord();

  const updateCreditAccount = useCallback(
    (value?: string) => {
      if (value !== undefined) {
        mutate({
          ledgerRecordId,
          fields: { creditAccount: { name: value } },
        });
      }
    },
    [ledgerRecordId, mutate]
  );

  return (
    <td>
      {creditAccount?.name ?? 'Missing Account'}
      <EditMiniButton
        onClick={() => updateCreditAccount(prompt('Credit account name:') ?? undefined)}
        disabled={isLoading}
      />
    </td>
  );
};
