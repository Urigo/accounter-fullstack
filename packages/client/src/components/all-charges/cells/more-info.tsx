import { ReactElement, useMemo } from 'react';
import { Indicator } from '@mantine/core';
import {
  AllChargesMoreInfoFieldsFragmentDoc,
  AllChargesMoreLedgerInfoFieldsFragmentDoc,
  MissingChargeInfo,
} from '../../../gql/graphql.js';
import { FragmentType, getFragmentData } from '../../../gql/index.js';
import { DragFile, ListCapsule } from '../../common/index.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment AllChargesMoreInfoFields on Charge {
    id
    metadata {
      transactionsCount
      documentsCount
      isSalary
    }
    ... on Charge @defer {
      validationData {
        missingInfo
      }
    }
    ...AllChargesMoreLedgerInfoFields
  }
`;

type Props = {
  data: FragmentType<typeof AllChargesMoreInfoFieldsFragmentDoc>;
};

export const MoreInfo = ({ data: rawData }: Props): ReactElement => {
  const data = getFragmentData(AllChargesMoreInfoFieldsFragmentDoc, rawData);
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
              style: {},
              content: <LedgerInfo data={data} />,
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
              style:
                !validationData?.missingInfo?.includes(MissingChargeInfo.Documents) ||
                !shouldHaveDocuments
                  ? {}
                  : { backgroundColor: 'rgb(236, 207, 57)' },
            },
          ]}
        />
      </DragFile>
    </td>
  );
};

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment AllChargesMoreLedgerInfoFields on Charge {
    id
    ... on Charge @defer {
      ledger {
        __typename
        records {
          id
        }
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

type LedgerInfoProps = {
  data: FragmentType<typeof AllChargesMoreLedgerInfoFieldsFragmentDoc>;
};

const LedgerInfo = ({ data }: LedgerInfoProps): ReactElement => {
  const { ledger } = getFragmentData(AllChargesMoreLedgerInfoFieldsFragmentDoc, data);
  const isValidationComplete = useMemo(
    () => ledger?.validate?.differences !== undefined,
    [ledger?.validate?.differences],
  );
  const isLedgerError = useMemo(() => !ledger || ledger.records.length === 0, [ledger]);
  const isLedgerUnbalanced = useMemo(
    () => !isLedgerError && ledger?.balance && !ledger?.balance.isBalanced,
    [isLedgerError, ledger?.balance],
  );
  const isLedgerValidated = useMemo(() => ledger?.validate?.isValid, [ledger?.validate?.isValid]);

  const ledgerRecordsCount = isLedgerError ? 0 : ledger?.records.length;
  return (
    <Indicator
      key="ledger"
      inline
      size={12}
      processing={!isValidationComplete}
      disabled={isValidationComplete && !isLedgerError && !isLedgerUnbalanced && isLedgerValidated}
      color={ledger?.validate?.differences?.length ? 'orange' : 'red'}
      zIndex="auto"
    >
      <div className="whitespace-nowrap">
        Ledger Records: {isLedgerError ? 'Error' : ledgerRecordsCount}
      </div>
    </Indicator>
  );
};
