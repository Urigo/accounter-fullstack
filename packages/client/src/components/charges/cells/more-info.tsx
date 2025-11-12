import { useMemo, type ReactElement } from 'react';
import { Indicator } from '@mantine/core';
import { ChargesTableMoreInfoFieldsFragmentDoc, MissingChargeInfo } from '../../../gql/graphql.js';
import { getFragmentData, type FragmentType } from '../../../gql/index.js';
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
      miscExpensesCount
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
      case 'ForeignSecuritiesCharge':
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

  const list = useMemo(() => {
    const items: (
      | React.ReactNode
      | {
          content: React.ReactNode;
          extraClassName?: string;
        }
    )[] = [];

    if (isTransactionsError || metadata?.transactionsCount || shouldHaveTransactions) {
      items.push({
        extraClassName:
          metadata?.transactionsCount || !shouldHaveTransactions ? undefined : 'bg-yellow-400',
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
      });
    }

    items.push({
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
          <div className="whitespace-nowrap">Ledger Records: {metadata?.ledgerCount ?? 0}</div>
        </Indicator>
      ),
    });

    if (isDocumentsError || metadata?.documentsCount) {
      items.push({
        content: (
          <Indicator
            key="documents"
            inline
            size={12}
            disabled={!isDocumentsError}
            color="red"
            zIndex="auto"
          >
            <div className="whitespace-nowrap">Documents: {metadata?.documentsCount ?? 0}</div>
          </Indicator>
        ),
        extraClassName:
          !validationData?.missingInfo?.includes(MissingChargeInfo.Documents) ||
          !shouldHaveDocuments
            ? undefined
            : 'bg-yellow-400',
      });
    }

    if (metadata?.miscExpensesCount) {
      items.push({
        content: (
          <div className="whitespace-nowrap">Misc Expenses: {metadata?.miscExpensesCount ?? 0}</div>
        ),
      });
    }

    return items;
  }, [
    metadata?.transactionsCount,
    metadata?.ledgerCount,
    metadata?.documentsCount,
    metadata?.miscExpensesCount,
    shouldHaveDocuments,
    shouldHaveTransactions,
    isTransactionsError,
    isDocumentsError,
    validationData?.missingInfo,
    ledgerStatus,
    isProcessingLedger,
  ]);

  return (
    <td>
      <DragFile chargeId={id}>
        <ListCapsule items={list} />
      </DragFile>
    </td>
  );
};
