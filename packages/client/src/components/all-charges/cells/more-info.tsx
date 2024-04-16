import { ReactElement, useMemo } from 'react';
import { Indicator } from '@mantine/core';
import { AllChargesMoreInfoFieldsFragmentDoc, MissingChargeInfo } from '../../../gql/graphql.js';
import { FragmentType, getFragmentData } from '../../../gql/index.js';
import { DragFile, ListCapsule } from '../../common/index.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment AllChargesMoreInfoFields on Charge {
    id
    metadata {
      transactionsCount
      documentsCount
      ledgerCount
      isSalary
    }
    ... on Charge @defer {
      validationData {
        missingInfo
      }
    }
    ... on Charge @defer {
      ledger {
        balance {
          isBalanced
        }
        ... on Ledger @defer {
          validate {
            isValid
            differences {
              id
            }
          }
        }
      }
    }
  }
`;

type Props = {
  data: FragmentType<typeof AllChargesMoreInfoFieldsFragmentDoc>;
};

export const MoreInfo = ({ data: rawData }: Props): ReactElement => {
  const data = getFragmentData(AllChargesMoreInfoFieldsFragmentDoc, rawData);
  const { metadata, validationData, ledger, id, __typename } = data;

  const shouldHaveDocuments = useMemo((): boolean => {
    switch (__typename) {
      case 'BusinessTripCharge':
      case 'ConversionCharge':
      case 'DividendCharge':
      case 'InternalTransferCharge':
      case 'SalaryCharge':
      case 'MonthlyVatCharge':
      case 'BankDepositCharge':
        return false;
      default:
        return true;
    }
  }, [__typename]);

  const isTransactionsError = useMemo(
    () => validationData?.missingInfo?.includes(MissingChargeInfo.Transactions),
    [validationData?.missingInfo],
  );

  const isDocumentsError = useMemo(
    () => shouldHaveDocuments && validationData?.missingInfo?.includes(MissingChargeInfo.Documents),
    [shouldHaveDocuments, validationData?.missingInfo],
  );

  const isProcessingLedger = useMemo(
    () => ledger?.validate?.differences === undefined,
    [ledger?.validate?.differences],
  );
  const isLedgerUnbalanced = useMemo(
    () => ledger?.balance && !ledger?.balance.isBalanced,
    [ledger?.balance],
  );
  const isLedgerValidated = useMemo(() => ledger?.validate?.isValid, [ledger?.validate?.isValid]);
  const isLedgerError = useMemo(
    () => !ledger || isLedgerUnbalanced || !isLedgerValidated,
    [ledger, isLedgerUnbalanced, isLedgerValidated],
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
                  disabled={!isProcessingLedger && !isLedgerError}
                  color={ledger?.validate?.differences?.length ? 'orange' : 'red'}
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
