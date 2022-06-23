import gql from 'graphql-tag';
import { useCallback } from 'react';

import { LedgerRecordsDateFieldsFragment } from '../../../../__generated__/types';
import { useUpdateLedgerRecord } from '../../../../hooks/use-update-ledger-record';
import { EditMiniButton } from '../../../common';

gql`
  fragment LedgerRecordsDateFields on LedgerRecord {
    id
    date
  }
`;

type Props = {
  data: LedgerRecordsDateFieldsFragment;
};

export const Date = ({ data }: Props) => {
  const { date, id: ledgerRecordId } = data;

  const { mutate, isLoading } = useUpdateLedgerRecord();

  const updateDate = useCallback(
    (value?: string) => {
      if (value !== undefined) {
        mutate({
          ledgerRecordId,
          fields: { date: value },
        });
      }
    },
    [ledgerRecordId, mutate]
  );

  return (
    <td>
      {date ?? 'Missing Data'}
      <EditMiniButton
        onClick={() => updateDate(prompt('New date (format dd/mm/yyyy):') ?? undefined)}
        disabled={isLoading}
      />
    </td>
  );
};
