import { Indicator } from '@mantine/core';
import { FragmentType, getFragmentData } from '../../../gql';
import { AllChargesMoreInfoFieldsFragmentDoc, MissingChargeInfo } from '../../../gql/graphql';
import { entitiesWithoutInvoice } from '../../../helpers';
import { DragFile, ListCapsule } from '../../common';

/* GraphQL */ `
  fragment AllChargesMoreInfoFields on Charge {
    id
    transactions {
      id
    }
    ledgerRecords {
      ... on LedgerRecords {
        records {
          id
        }
      }
    }
    additionalDocuments {
        id
    }
    counterparty {
        id
    }
    validationData {
      missingInfo
    }
  }
`;

type Props = {
  data: FragmentType<typeof AllChargesMoreInfoFieldsFragmentDoc>;
};

export const MoreInfo = ({ data }: Props) => {
  const { transactions, ledgerRecords, additionalDocuments, counterparty, validationData, id } =
    getFragmentData(AllChargesMoreInfoFieldsFragmentDoc, data);
  const isTransactionsError = validationData?.missingInfo?.includes(MissingChargeInfo.Transactions);
  // TODO(Gil): implement isLedgerError by server validation
  const isLedgerError = !(ledgerRecords && 'records' in ledgerRecords);
  const isDocumentsError = validationData?.missingInfo?.includes(MissingChargeInfo.Documents);

  const ledgerRecordsCount = isLedgerError ? 0 : ledgerRecords.records.length;
  return (
    <td>
      <DragFile chargeId={id}>
        <ListCapsule
          items={[
            {
              style: transactions.length > 0 ? {} : { backgroundColor: 'rgb(236, 207, 57)' },
              content: (
                <Indicator
                  key="transactions"
                  inline
                  size={12}
                  disabled={!isTransactionsError}
                  color="red"
                  zIndex="auto"
                >
                  <div className="whitespace-nowrap">Transactions: {transactions.length}</div>
                </Indicator>
              ),
            },
            {
              style: ledgerRecordsCount > 0 ? {} : { backgroundColor: 'rgb(236, 207, 57)' },
              content: (
                <Indicator
                  key="ledger"
                  inline
                  size={12}
                  disabled={!isLedgerError}
                  color="red"
                  zIndex="auto"
                >
                  <div className="whitespace-nowrap">
                    Ledger Records: {isLedgerError ? 'Error' : ledgerRecordsCount}
                  </div>
                </Indicator>
              ),
            },
            {
              content: (
                <Indicator
                  key="ledger"
                  inline
                  size={12}
                  disabled={!isDocumentsError}
                  color="red"
                  zIndex="auto"
                >
                  <div className="whitespace-nowrap">Documents: {additionalDocuments.length}</div>
                </Indicator>
              ),
              style:
                additionalDocuments.length > 0 ||
                (counterparty && entitiesWithoutInvoice.includes(counterparty.id))
                  ? {}
                  : { backgroundColor: 'rgb(236, 207, 57)' },
            },
          ]}
        />
      </DragFile>
    </td>
  );
};
