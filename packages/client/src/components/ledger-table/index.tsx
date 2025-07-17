import { ReactElement } from 'react';
import { TableLedgerRecordsFieldsFragmentDoc } from '../../gql/graphql.js';
import { FragmentType, getFragmentData } from '../../gql/index.js';
import { LedgerTable } from './ledger-table.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment TableLedgerRecordsFields on Charge {
    id
    ledger {
      __typename
      records {
        id
        creditAccount1 {
          __typename
          id
          name
        }
        creditAccount2 {
          __typename
          id
          name
        }
        debitAccount1 {
          __typename
          id
          name
        }
        debitAccount2 {
          __typename
          id
          name
        }
        creditAmount1 {
          formatted
          currency
        }
        creditAmount2 {
          formatted
          currency
        }
        debitAmount1 {
          formatted
          currency
        }
        debitAmount2 {
          formatted
          currency
        }
        localCurrencyCreditAmount1 {
          formatted
          raw
        }
        localCurrencyCreditAmount2 {
          formatted
          raw
        }
        localCurrencyDebitAmount1 {
          formatted
          raw
        }
        localCurrencyDebitAmount2 {
          formatted
          raw
        }
        invoiceDate
        valueDate
        description
        reference
      }
      ... on Ledger @defer {
        validate {
          ... on LedgerValidation @defer {
            matches
            differences {
              id
              creditAccount1 {
                __typename
                id
                name
              }
              creditAccount2 {
                __typename
                id
                name
              }
              debitAccount1 {
                __typename
                id
                name
              }
              debitAccount2 {
                __typename
                id
                name
              }
              creditAmount1 {
                formatted
                currency
              }
              creditAmount2 {
                formatted
                currency
              }
              debitAmount1 {
                formatted
                currency
              }
              debitAmount2 {
                formatted
                currency
              }
              localCurrencyCreditAmount1 {
                formatted
                raw
              }
              localCurrencyCreditAmount2 {
                formatted
                raw
              }
              localCurrencyDebitAmount1 {
                formatted
                raw
              }
              localCurrencyDebitAmount2 {
                formatted
                raw
              }
              invoiceDate
              valueDate
              description
              reference
            }
          }
        }
      }
    }
  }
`;

type Props = {
  ledgerFragment: FragmentType<typeof TableLedgerRecordsFieldsFragmentDoc>;
};

export const LedgerTableContainer = ({ ledgerFragment }: Props): ReactElement => {
  const { ledger } = getFragmentData(TableLedgerRecordsFieldsFragmentDoc, ledgerFragment);

  return <LedgerTable ledger={ledger} />;
};
