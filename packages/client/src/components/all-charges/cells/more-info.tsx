import { ReactElement, useMemo } from 'react';
import { Indicator } from '@mantine/core';
import { FragmentOf, graphql, readFragment } from '../../../graphql.js';
import { DragFile, ListCapsule } from '../../common/index.js';

export const AllChargesMoreInfoFieldsFragmentDoc = graphql(`
  fragment AllChargesMoreInfoFields on Charge {
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
`);

type Props = {
  data: FragmentOf<typeof AllChargesMoreInfoFieldsFragmentDoc>;
};

export const MoreInfo = ({ data: rawData }: Props): ReactElement => {
  const data = readFragment(AllChargesMoreInfoFieldsFragmentDoc, rawData);
  const { metadata, id, __typename } = data;
  const validationData = 'validationData' in data ? data.validationData : undefined;

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
        return false;
      default:
        return true;
    }
  }, [__typename]);

  const isTransactionsError = useMemo(
    () => validationData?.missingInfo?.includes('TRANSACTIONS'),
    [validationData?.missingInfo],
  );

  const isDocumentsError = useMemo(
    () => shouldHaveDocuments && validationData?.missingInfo?.includes('DOCUMENTS'),
    [shouldHaveDocuments, validationData?.missingInfo],
  );

  const isProcessingLedger = useMemo(
    () => !(metadata && 'invalidLedger' in metadata && metadata?.invalidLedger),
    [metadata],
  );
  const ledgerStatus = useMemo(
    () => !!metadata && 'invalidLedger' in metadata && metadata?.invalidLedger,
    [metadata],
  );

  return (
    <td>
      <DragFile chargeId={id}>
        <ListCapsule
          items={[
            {
              extraClassName: metadata?.transactionsCount ? undefined : 'bg-yellow-400',
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
                !validationData?.missingInfo?.includes('DOCUMENTS') || !shouldHaveDocuments
                  ? undefined
                  : 'bg-yellow-400',
            },
          ]}
        />
      </DragFile>
    </td>
  );
};
