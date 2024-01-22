import { ReactElement, useMemo } from 'react';
import { useQuery } from 'urql';
import { Indicator } from '@mantine/core';
import {
  AllChargesMoreInfoFieldsFragmentDoc,
  MissingChargeInfo,
  ValidateChargeLedgerDocument,
} from '../../../gql/graphql.js';
import { FragmentType, getFragmentData } from '../../../gql/index.js';
import { entitiesWithoutInvoice } from '../../../helpers';
import { DragFile, ListCapsule } from '../../common';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment AllChargesMoreInfoFields on Charge {
    id
    metadata {
      transactionsCount
      documentsCount
      isSalary
    }
    ledgerRecords {
      __typename
      records {
        id
      }
      balance {
        isBalanced
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

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query ValidateChargeLedger($chargeId: UUID!) {
    validateLedgerByChargeId(chargeId: $chargeId)
  }
`;

type Props = {
  data: FragmentType<typeof AllChargesMoreInfoFieldsFragmentDoc>;
};

export const MoreInfo = ({ data }: Props): ReactElement => {
  const { metadata, ledgerRecords, counterparty, validationData, id, __typename } = getFragmentData(
    AllChargesMoreInfoFieldsFragmentDoc,
    data,
  );

  const [{ data: ledgerValidationData, fetching }] = useQuery({
    query: ValidateChargeLedgerDocument,
    variables: {
      chargeId: id,
    },
  });

  const shouldHaveDocuments = useMemo((): boolean => {
    switch (__typename) {
      case 'BusinessTripCharge':
      case 'ConversionCharge':
      case 'DividendCharge':
      case 'InternalTransferCharge':
      case 'SalaryCharge':
        return false;
      default:
        return true;
    }
  }, [__typename]);

  const isTransactionsError = validationData?.missingInfo?.includes(MissingChargeInfo.Transactions);
  const isLedgerValidated = ledgerValidationData && !ledgerValidationData.validateLedgerByChargeId;
  // TODO(Gil): implement isLedgerError by server validation
  const isLedgerError = !ledgerRecords || ledgerRecords.records.length === 0 || isLedgerValidated;
  const isLedgerUnbalanced =
    !isLedgerError && ledgerRecords.balance && !ledgerRecords.balance.isBalanced;
  const isDocumentsError =
    shouldHaveDocuments && validationData?.missingInfo?.includes(MissingChargeInfo.Documents);

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
                  processing={fetching}
                  disabled={!isLedgerError && !isLedgerUnbalanced}
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
                !shouldHaveDocuments ||
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
