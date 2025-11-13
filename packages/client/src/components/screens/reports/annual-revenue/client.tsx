'use client';

import { useState, type ReactElement } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import {
  AnnualRevenueReportClientFragmentDoc,
  type AnnualRevenueReportClientFragment,
} from '@/gql/graphql.js';
import { getFragmentData, type FragmentType } from '@/gql/index.js';
import { AnnualRevenueTransaction } from './transaction';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment AnnualRevenueReportClient on AnnualRevenueReportCountryClient {
    id
    name
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
    transactionsInfo {
      id
      ...AnnualRevenueReportTransaction
    }
  }
`;

type Client = {
  id: string;
  name: string;
  revenueILS: number;
  revenueUSD: number;
  transactions: Array<{
    id: string;
    data: AnnualRevenueReportClientFragment['transactionsInfo'][number];
  }>;
};

function clientFromFragment(fragment: AnnualRevenueReportClientFragment): Client {
  return {
    id: fragment.id,
    name: fragment.name,
    revenueILS: fragment.revenueLocal.raw,
    revenueUSD: fragment.revenueDefaultForeign.raw,
    transactions: fragment.transactionsInfo.map(t => ({
      id: t.id,
      data: t,
    })),
  };
}

export const AnnualRevenueClient = ({
  clientData,
}: {
  clientData: FragmentType<typeof AnnualRevenueReportClientFragmentDoc>;
}): ReactElement => {
  const [expanded, setExpanded] = useState<boolean>(false);

  const clientFragment = getFragmentData(AnnualRevenueReportClientFragmentDoc, clientData);
  const client = clientFromFragment(clientFragment);

  const toggleClient = () => {
    setExpanded(prev => !prev);
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div>
      {/* Client Header */}
      <button
        onClick={() => toggleClient()}
        className="w-full flex items-center justify-between p-3 bg-background rounded-lg border border-border/50 hover:bg-accent/5 transition-colors"
      >
        <div className="flex items-center gap-3 flex-1">
          {expanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          )}
          <div className="text-left">
            <p className="font-medium text-foreground text-sm">{client.name}</p>
            <p className="text-xs text-muted-foreground">
              {client.transactions?.length || 0} transaction
              {client.transactions?.length === 1 ? '' : 's'}
            </p>
          </div>
        </div>

        <div className="hidden md:grid grid-cols-2 gap-8 text-right flex-shrink-0">
          <div>
            <p className="text-xs text-muted-foreground">
              {formatCurrency(client.revenueILS, 'ILS')}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">
              {formatCurrency(client.revenueUSD, 'USD')}
            </p>
          </div>
        </div>

        <div className="md:hidden ml-4 text-right">
          <p className="text-xs font-medium text-foreground">
            {formatCurrency(client.revenueILS, 'ILS')}
          </p>
          <p className="text-xs text-muted-foreground">
            {formatCurrency(client.revenueUSD, 'USD')}
          </p>
        </div>
      </button>

      {/* Expanded Transactions */}
      {expanded && client.transactions && (
        <div className="mt-2 ml-3 space-y-2 border-l-2 border-border/50 pl-4">
          {client.transactions.map(transaction => (
            <AnnualRevenueTransaction key={transaction.id} transactionData={transaction.data} />
          ))}
        </div>
      )}
    </div>
  );
};
