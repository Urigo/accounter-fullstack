import { useMemo, type ReactElement } from 'react';
import { Indicator } from '@mantine/core';
import type { ChargeType } from '../../../helpers/index.js';
import { DragFile, ListCapsule } from '../../common/index.js';

export type MoreInfoProps = {
  chargeId: string;
  type: ChargeType;
  isTransactionsMissing?: boolean;
  isDocumentsMissing?: boolean;
  info?: {
    transactionsCount: number;
    documentsCount: number;
    ledgerCount: number;
    miscExpensesCount: number;
    invalidLedger?: 'VALID' | 'DIFF' | 'INVALID';
    isSalary: boolean;
  };
};

export const MoreInfo = ({
  chargeId,
  type,
  isTransactionsMissing,
  isDocumentsMissing,
  info,
}: MoreInfoProps): ReactElement => {
  const shouldHaveDocuments = useMemo((): boolean => {
    switch (type) {
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
  }, [type]);

  const shouldHaveTransactions = useMemo((): boolean => {
    switch (type) {
      case 'FinancialCharge':
        return false;
      default:
        return true;
    }
  }, [type]);

  const isTransactionsError = useMemo(
    () => shouldHaveTransactions && isTransactionsMissing,
    [shouldHaveTransactions, isTransactionsMissing],
  );

  const isDocumentsError = useMemo(
    () => shouldHaveDocuments && isDocumentsMissing,
    [shouldHaveDocuments, isDocumentsMissing],
  );

  const ledgerStatus = useMemo(() => info?.invalidLedger, [info?.invalidLedger]);

  const list = useMemo(() => {
    const items: (
      | React.ReactNode
      | {
          content: React.ReactNode;
          extraClassName?: string;
        }
    )[] = [];

    if (isTransactionsError || info?.transactionsCount || shouldHaveTransactions) {
      items.push({
        extraClassName:
          info?.transactionsCount || !shouldHaveTransactions ? undefined : 'bg-yellow-400',
        content: (
          <Indicator
            key="transactions"
            inline
            size={12}
            disabled={!isTransactionsError}
            color="red"
            zIndex="auto"
          >
            <div className="whitespace-nowrap">Transactions: {info?.transactionsCount ?? 0}</div>
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
          processing={!ledgerStatus}
          disabled={ledgerStatus === 'VALID'}
          color={ledgerStatus === 'DIFF' ? 'orange' : 'red'}
          zIndex="auto"
        >
          <div className="whitespace-nowrap">Ledger Records: {info?.ledgerCount ?? 0}</div>
        </Indicator>
      ),
    });

    if (isDocumentsError || info?.documentsCount) {
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
            <div className="whitespace-nowrap">Documents: {info?.documentsCount ?? 0}</div>
          </Indicator>
        ),
        extraClassName: !isDocumentsMissing || !shouldHaveDocuments ? undefined : 'bg-yellow-400',
      });
    }

    if (info?.miscExpensesCount) {
      items.push({
        content: (
          <div className="whitespace-nowrap">Misc Expenses: {info.miscExpensesCount ?? 0}</div>
        ),
      });
    }

    return items;
  }, [
    info?.transactionsCount,
    info?.ledgerCount,
    info?.documentsCount,
    info?.miscExpensesCount,
    shouldHaveDocuments,
    shouldHaveTransactions,
    isTransactionsError,
    isDocumentsError,
    isDocumentsMissing,
    ledgerStatus,
  ]);

  return (
    <DragFile chargeId={chargeId}>
      <ListCapsule items={list} />
    </DragFile>
  );
};
