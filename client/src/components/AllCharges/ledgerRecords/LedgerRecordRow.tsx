import { Table } from '@mantine/core';
import gql from 'graphql-tag';
import { LedgerRecordsFieldsFragment } from '../../../__generated__/types';

gql`
  fragment LedgerRecordsFields on Charge {
    ledgerRecords {
      id
      date
      originalAmount {
        formatted
      }
      localCurrencyAmount {
        formatted
      }
      creditAccount {
        name
      }
      debitAccount {
        name
      }
      accountantApproval {
        approved
      }
      description
      hashavshevetId
    }
  }
`;

type Props = {
  ledgerRecord?: LedgerRecordsFieldsFragment['ledgerRecords']['0'];
};

export const LedgerRecords = ({ ledgerRecord }: Props) => {
  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-start', flexDirection: 'column', width: '50%' }}>
        <Table style={{ textAlign: 'center' }}>
          <tr>Date:</tr>
        </Table>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-start', flexDirection: 'column', width: '50%' }}>
        <Table style={{ textAlign: 'center' }}>
          <tr>{ledgerRecord?.id}</tr>
        </Table>
      </div>
    </>
  );
};
