import { FragmentType, getFragmentData } from '../../../gql';
import { TableLedgerRecordsFieldsFragmentDoc } from '../../../gql/graphql';
import { AccountDetails, GeneralDate } from './cells';

/* GraphQL */ `
  fragment TableLedgerRecordsFields on Charge {
    ledgerRecords {
      __typename
      ... on LedgerRecords {
        records {
          id
          ...LedgerRecordsDateFields
          ...LedgerRecordsCreditAccountFields
          ...LedgerRecordsDebitAccountFields
          ...LedgerRecordsAccountDetailsFields
          ...LedgerRecordsGeneralDateFields
          creditAmount1 {
            formatted
          }
          localCurrencyCreditAmount1 {
            formatted
          }
          debitAccount1 {
            ... on NamedCounterparty {
              id
              name
            }
            ... on TaxCategory {
              id
              name
            }
          }
          description
          reference1
        }
      }
      ... on CommonError {
        message
      }
    }
  }
`;

type Props = {
  ledgerRecordsProps: FragmentType<typeof TableLedgerRecordsFieldsFragmentDoc>;
};

export const LedgerRecordTable = ({ ledgerRecordsProps }: Props) => {
  const { ledgerRecords: data } = getFragmentData(
    TableLedgerRecordsFieldsFragmentDoc,
    ledgerRecordsProps,
  );

  if (!data || data.__typename === 'CommonError') {
    return <div>{data?.message}</div>;
  }

  return (
    <table style={{ width: '100%', height: '100%' }}>
      <thead>
        <tr>
          <th>Invoice Date</th>
          <th>Value Date</th>
          <th>Debit Account1</th>
          <th>Credit Account1</th>
          <th>Debit Account2</th>
          <th>Credit Account2</th>
          <th>Details</th>
          <th>Ref1</th>
        </tr>
      </thead>
      <tbody>
        {data.records.map(record => (
          <tr key={record.id}>
            <GeneralDate data={record} type={1} />
            <GeneralDate data={record} type={2} />
            <AccountDetails data={record} cred={false} first />
            <AccountDetails data={record} cred first />
            <AccountDetails data={record} cred={false} first={false} />
            <AccountDetails data={record} cred first={false} />
            <td>{record.description}</td>
            <td>{record.reference1}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};
