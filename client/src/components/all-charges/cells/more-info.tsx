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
        id
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
  const isTransactionsError = false;
  // TODO(Gil): implement isTransactionsError
  // validationData?.missingInfo?.includes(MissingChargeInfo.Transactions);
  const isLedgerError = validationData?.missingInfo?.includes(MissingChargeInfo.LedgerRecords);
  const isDocumentsError = validationData?.missingInfo?.includes(MissingChargeInfo.Documents);

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
              style: ledgerRecords.length > 0 ? {} : { backgroundColor: 'rgb(236, 207, 57)' },
              content: (
                <Indicator
                  key="ledger"
                  inline
                  size={12}
                  disabled={!isLedgerError}
                  color="red"
                  zIndex="auto"
                >
                  <div className="whitespace-nowrap">Ledger Records: {ledgerRecords.length}</div>
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
