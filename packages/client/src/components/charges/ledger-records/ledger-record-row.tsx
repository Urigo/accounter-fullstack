import { ReactElement } from 'react';
import { Badge } from '@mantine/core';
import { TableLedgerRecordsRowFieldsFragmentDoc } from '../../../gql/graphql.js';
import { FragmentType, getFragmentData } from '../../../gql/index.js';
import { AccountDetails, GeneralDate } from './cells/index.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment TableLedgerRecordsRowFields on LedgerRecord {
    id
    ...LedgerRecordsAccountDetailsFields
    ...LedgerRecordsGeneralDateFields
    description
    reference
  }
`;

type Props = {
  ledgerRecordProps: FragmentType<typeof TableLedgerRecordsRowFieldsFragmentDoc>;
  matchingStatus?: 'New' | 'Diff' | 'Deleted';
  diffs?: FragmentType<typeof TableLedgerRecordsRowFieldsFragmentDoc>;
};

export const LedgerRecordRow = ({
  ledgerRecordProps,
  diffs,
  matchingStatus,
}: Props): ReactElement => {
  const record = getFragmentData(TableLedgerRecordsRowFieldsFragmentDoc, ledgerRecordProps);
  const diffsRecord = getFragmentData(TableLedgerRecordsRowFieldsFragmentDoc, diffs);

  if (matchingStatus === 'Diff' && !diffsRecord) {
    matchingStatus = 'Deleted';
  }

  let rowStyle = '';
  switch (matchingStatus) {
    case 'New':
      rowStyle = 'bg-green-100/30';
      break;
    case 'Deleted':
      rowStyle = 'bg-red-100/30';
      break;
    case 'Diff':
      rowStyle = 'bg-yellow-100/30';
      break;
  }

  return (
    <tr key={record.id} className={rowStyle}>
      <GeneralDate data={record} diff={diffsRecord} type={1} />
      <GeneralDate data={record} diff={diffsRecord} type={2} />
      <AccountDetails data={record} diff={diffsRecord} cred={false} first />
      <AccountDetails data={record} diff={diffsRecord} cred first />
      <AccountDetails data={record} diff={diffsRecord} cred={false} first={false} />
      <AccountDetails data={record} diff={diffsRecord} cred first={false} />
      <td>
        <div className="flex flex-col">
          <p
            className={
              !diffsRecord?.description || diffsRecord.description === record.description
                ? ''
                : 'line-through'
            }
          >
            {record.description}
          </p>
          {diffsRecord?.description && diffsRecord.description !== record.description && (
            <div className="border-2 border-yellow-500 rounded-md">{diffsRecord?.description}</div>
          )}
        </div>
      </td>
      <td>
        <div className="flex flex-col">
          <p
            className={
              !diffsRecord?.reference || diffsRecord.reference === record.reference
                ? ''
                : 'line-through'
            }
          >
            {record.reference}
          </p>
          {diffsRecord?.reference && diffsRecord?.reference !== record.reference && (
            <div className="border-2 border-yellow-500 rounded-md">{diffsRecord?.reference}</div>
          )}
        </div>
      </td>
      <td>
        {!!matchingStatus && (
          <Badge
            variant="filled"
            color={
              matchingStatus === 'Deleted' ? 'red' : matchingStatus === 'Diff' ? 'yellow' : 'green'
            }
          >
            {matchingStatus}
          </Badge>
        )}
      </td>
    </tr>
  );
};
