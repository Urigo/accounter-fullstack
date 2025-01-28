import { ReactElement, useMemo } from 'react';
import { Indicator } from '@mantine/core';
import { ChargesTableMoreInfoFieldsFragmentDoc, MissingChargeInfo } from '../../../gql/graphql.js';
import { FragmentType, getFragmentData } from '../../../gql/index.js';
import { DragFile, ListCapsule } from '../../common/index.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment ChargesTableMoreInfoFields on Charge {
    __typename
    id
    metadata {
      transactionsCount
      documentsCount
      ledgerCount
      isSalary
      ... on ChargeMetadata @defer {
        invalidLedger
      }
    }
    ... on Charge @defer {
      validationData {
        missingInfo
      }
    }
  }
`;

type Props = {
  data: FragmentType<typeof ChargesTableMoreInfoFieldsFragmentDoc>;
};

export const MoreInfo = ({ data: rawData }: Props): ReactElement => {
  const data = getFragmentData(ChargesTableMoreInfoFieldsFragmentDoc, rawData);
  const { metadata, validationData, id, __typename } = data;

  const shouldHaveDocuments = useMemo((): boolean => {
    switch (__typename) {
      case 'BusinessTripCharge':
      case 'ConversionCharge':
      case 'DividendCharge':
      case 'InternalTransferCharge':
      case 'SalaryCharge':
      case 'MonthlyVatCharge':
      case 'BankDepositCharge':
      case 'CreditcardBankCharge':
      case 'FinancialCharge':
        return false;
      default:
        return true;
    }
  }, [__typename]);

  const shouldHaveTransactions = useMemo((): boolean => {
    switch (__typename) {
      case 'FinancialCharge':
        return false;
      default:
        return true;
    }
  }, [__typename]);

  const isTransactionsError = useMemo(
    () =>
      shouldHaveTransactions &&
      validationData?.missingInfo?.includes(MissingChargeInfo.Transactions),
    [shouldHaveTransactions, validationData?.missingInfo],
  );

  const isDocumentsError = useMemo(
    () => shouldHaveDocuments && validationData?.missingInfo?.includes(MissingChargeInfo.Documents),
    [shouldHaveDocuments, validationData?.missingInfo],
  );

  const isProcessingLedger = useMemo(() => !metadata?.invalidLedger, [metadata?.invalidLedger]);
  const ledgerStatus = useMemo(() => metadata?.invalidLedger, [metadata?.invalidLedger]);

  return (
    <td>
      <DragFile chargeId={id}>
        <ListCapsule
          items={[
            {
              extraClassName:
                metadata?.transactionsCount || !shouldHaveTransactions
                  ? undefined
                  : 'bg-yellow-400',
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
              content: (
                <Indicator
                  key="ledger"
                  inline
                  size={12}
                  processing={isProcessingLedger}
                  disabled={ledgerStatus === 'VALID'}
                  color={ledgerStatus === 'DIFF' ? 'orange' : 'red'}
                  zIndex="auto"
                >
                  <div className="whitespace-nowrap">
                    Ledger Records: {metadata?.ledgerCount ?? 0}
                  </div>
                </Indicator>
              ),
            },
            {
              content: (
                <Indicator
                  key="documents"
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
              extraClassName:
                !validationData?.missingInfo?.includes(MissingChargeInfo.Documents) ||
                !shouldHaveDocuments
                  ? undefined
                  : 'bg-yellow-400',
            },
          ]}
        />
      </DragFile>
    </td>
  );
};
