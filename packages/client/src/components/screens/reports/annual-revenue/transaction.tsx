'use client';

import { type ReactElement } from 'react';
import { Link } from 'react-router-dom';
import {
  AnnualRevenueReportTransactionFragmentDoc,
  Currency,
  type AnnualRevenueReportTransactionFragment,
} from '@/gql/graphql.js';
import { getFragmentData, type FragmentType } from '@/gql/index.js';
import { ROUTES } from '@/router/routes.js';
import { formatCurrency } from './utils.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment AnnualRevenueReportTransaction on AnnualRevenueReportClientTransaction {
    id
    revenueLocal {
      raw
      formatted
      currency
    }
    revenueDefaultForeign {
      raw
      formatted
      currency
    }
    transaction {
      id
      chargeId
      effectiveDate
      eventDate
      amount {
        formatted
      }
      sourceDescription
    }
  }
`;

type Transaction = {
  id: string;
  chargeId: string;
  date: string;
  description: string;
  amountILS: number;
  amountUSD: number;
  originalAmount: string;
};

function transactionFromFragment(fragment: AnnualRevenueReportTransactionFragment): Transaction {
  return {
    id: fragment.transaction.id,
    chargeId: fragment.transaction.chargeId,
    date: fragment.transaction.effectiveDate ?? fragment.transaction.eventDate,
    description: fragment.transaction.sourceDescription,
    amountILS: fragment.revenueLocal.raw,
    amountUSD: fragment.revenueDefaultForeign.raw,
    originalAmount: fragment.transaction.amount.formatted,
  };
}

export const AnnualRevenueTransaction = ({
  transactionData,
}: {
  transactionData: FragmentType<typeof AnnualRevenueReportTransactionFragmentDoc>;
}): ReactElement => {
  const transactionFragment = getFragmentData(
    AnnualRevenueReportTransactionFragmentDoc,
    transactionData,
  );
  const transaction = transactionFromFragment(transactionFragment);

  return (
    <div className="p-2 bg-background rounded-lg border border-border/30 text-sm">
      <Link
        to={ROUTES.CHARGES.DETAIL(transaction.chargeId)}
        target="_blank"
        rel="noreferrer"
        onClick={event => event.stopPropagation()}
        className="flex items-start justify-between gap-2"
      >
        <div className="flex-1">
          <p className="font-medium text-foreground">{transaction.description}</p>
          <div className="flex gap-4 mt-1 text-xs text-muted-foreground">
            <span>{transaction.id}</span>
            <span>{transaction.date}</span>
          </div>
        </div>
        <div className="invisible md:visible md:text-right flex-shrink-0">
          <p className="text-sm font-medium text-foreground">
            {formatCurrency(transaction.amountILS, Currency.Ils)}
          </p>
          <p className="text-xs text-muted-foreground">
            {formatCurrency(transaction.amountUSD, Currency.Usd)}
          </p>
          <p className="text-xs text-muted-foreground">{transaction.originalAmount}</p>
        </div>
        <div className="md:invisible ml-2 text-right">
          <p className="text-xs font-medium text-foreground">
            {formatCurrency(transaction.amountILS, Currency.Ils)}
          </p>
        </div>
      </Link>
    </div>
  );
};
