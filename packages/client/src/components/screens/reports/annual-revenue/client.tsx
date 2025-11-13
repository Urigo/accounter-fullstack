'use client';

import { useState, type ReactElement } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import {
  AnnualRevenueReportClientFragmentDoc,
  Currency,
  type AnnualRevenueReportClientFragment,
} from '@/gql/graphql.js';
import { getFragmentData, type FragmentType } from '@/gql/index.js';
import { AnnualRevenueTransaction } from './transaction.js';
import { formatCurrency } from './utils.js';

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

  return (
    <div>
      {/* Client Header */}
      <button
        onClick={toggleClient}
        className="w-full flex items-center justify-between p-2 bg-background rounded-lg border border-border/50 hover:bg-accent/5 transition-colors"
      >
        <div className="flex items-center gap-3 flex-1">
          {expanded ? (
            <ChevronDown className="size-4 text-muted-foreground flex-shrink-0" />
          ) : (
            <ChevronRight className="size-4 text-muted-foreground flex-shrink-0" />
          )}
          <div className="text-left">
            <p className="font-medium text-foreground text-sm">{client.name}</p>
            <p className="text-xs text-muted-foreground">
              {client.transactions?.length || 0} transaction
              {client.transactions?.length === 1 ? '' : 's'}
            </p>
          </div>
        </div>

        <div className="hidden md:grid grid-cols-2 gap-4 text-right flex-shrink-0">
          <div>
            <p className="text-xs text-muted-foreground">
              {formatCurrency(client.revenueILS, Currency.Ils)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">
              {formatCurrency(client.revenueUSD, Currency.Usd)}
            </p>
          </div>
        </div>

        <div className="md:hidden ml-4 text-right">
          <p className="text-xs font-medium text-foreground">
            {formatCurrency(client.revenueILS, Currency.Ils)}
          </p>
          <p className="text-xs text-muted-foreground">
            {formatCurrency(client.revenueUSD, Currency.Usd)}
          </p>
        </div>
      </button>

      {/* Expanded Transactions */}
      {expanded && client.transactions && (
        <div className="mt-3 ml-2 space-y-3 border-l-2 border-border/50 pl-2">
          {client.transactions.map(transaction => (
            <AnnualRevenueTransaction key={transaction.id} transactionData={transaction.data} />
          ))}
        </div>
      )}
    </div>
  );
};
