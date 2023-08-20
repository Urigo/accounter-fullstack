import { ReactElement } from 'react';
import { Indicator } from '@mantine/core';
import { FragmentType, getFragmentData } from '../../../gql';
import { AllChargesMoreInfoFieldsFragmentDoc, MissingChargeInfo } from '../../../gql/graphql';
import { entitiesWithoutInvoice } from '../../../helpers';
import { DragFile, ListCapsule } from '../../common';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment AllChargesMoreInfoFields on Charge {
    id
    metadata {
      transactionsCount
      documentsCount
    }
    ledgerRecords {
      ... on LedgerRecords {
        records {
          id
        }
      }
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

export const MoreInfo = ({ data }: Props): ReactElement => {
  const { metadata, ledgerRecords, counterparty, validationData, id } = getFragmentData(
    AllChargesMoreInfoFieldsFragmentDoc,
    data,
  );
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
              style: metadata?.transactionsCount ? {} : { backgroundColor: 'rgb(236, 207, 57)' },
              content: (
                <Indicator
                  key="transactions"
                  inline
                  size={12}
                  disabled={!isTransactionsError}
                  color="red"
                  zIndex="auto"
                >
                  <div className="whitespace-nowrap">
                    Transactions: {metadata?.transactionsCount ?? 0}
                  </div>
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
                  <div className="whitespace-nowrap">
                    Documents: {metadata?.documentsCount ?? 0}
                  </div>
                </Indicator>
              ),
              style:
                metadata?.documentsCount ||
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
