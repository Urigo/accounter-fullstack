'use client';

import { useState, type ReactElement } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

export const AnnualRevenueClient = ({
  client,
}: {
  client: {
    id: number;
    name: string;
    revenueILS: number;
    revenueUSD: number;
    transactions: Array<{
      id: string;
      date: string;
      description: string;
      amountILS: number;
      amountUSD: number;
    }>;
  };
}): ReactElement => {
  const [expanded, setExpanded] = useState<boolean>(false);

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
    <div key={client.id}>
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
            <div
              key={transaction.id}
              className="p-3 bg-background rounded-lg border border-border/30 text-sm"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <p className="font-medium text-foreground">{transaction.description}</p>
                  <div className="flex gap-4 mt-1 text-xs text-muted-foreground">
                    <span>{transaction.id}</span>
                    <span>{transaction.date}</span>
                  </div>
                </div>
                <div className="hidden md:text-right flex-shrink-0">
                  <p className="text-sm font-medium text-foreground">
                    {formatCurrency(transaction.amountILS, 'ILS')}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatCurrency(transaction.amountUSD, 'USD')}
                  </p>
                </div>
                <div className="md:hidden ml-2 text-right">
                  <p className="text-xs font-medium text-foreground">
                    {formatCurrency(transaction.amountILS, 'ILS')}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
