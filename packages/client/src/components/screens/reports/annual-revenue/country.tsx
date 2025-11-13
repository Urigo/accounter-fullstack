'use client';

import { useState, type ReactElement } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Card } from '@/components/ui/card.js';
import { AnnualRevenueClient } from './client';

export const AnnualRevenueCountry = ({
  country,
}: {
  country: {
    code: string;
    name: string;
    revenues: { ILS: number; USD: number };
    clients: Array<{
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
    }>;
  };
}): ReactElement => {
  const [expanded, setExpanded] = useState<boolean>(false);

  const toggleCountry = () => {
    setExpanded(prev => !prev);
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const totalClientsRevenue = country.clients.reduce(
    (sum, client) => ({
      ILS: sum.ILS + client.revenueILS,
      USD: sum.USD + client.revenueUSD,
    }),
    { ILS: 0, USD: 0 },
  );

  return (
    <Card key={country.code} className="border border-border">
      {/* Country Header */}
      <button
        onClick={() => toggleCountry()}
        className="w-full px-6 py-4 hover:bg-accent/5 transition-colors flex items-center justify-between"
      >
        <div className="flex items-center gap-4 flex-1">
          {expanded ? (
            <ChevronDown className="h-5 w-5 text-muted-foreground flex-shrink-0" />
          ) : (
            <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
          )}
          <div className="text-left">
            <p className="font-semibold text-foreground text-lg">{country.name}</p>
            <p className="text-sm text-muted-foreground">{country.clients.length} clients</p>
          </div>
        </div>

        <div className="hidden md:grid grid-cols-2 gap-8 text-right flex-shrink-0">
          <div>
            <p className="text-sm text-muted-foreground mb-1">ILS</p>
            <p className="font-semibold text-foreground">
              {formatCurrency(country.revenues.ILS, 'ILS')}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-1">USD</p>
            <p className="font-semibold text-foreground">
              {formatCurrency(country.revenues.USD, 'USD')}
            </p>
          </div>
        </div>
      </button>

      {/* Mobile Revenue Summary */}
      <div className="md:hidden px-6 py-3 bg-accent/5 border-t border-border flex gap-8">
        <div>
          <p className="text-xs text-muted-foreground mb-1">ILS</p>
          <p className="font-semibold text-foreground">
            {formatCurrency(country.revenues.ILS, 'ILS')}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-1">USD</p>
          <p className="font-semibold text-foreground">
            {formatCurrency(country.revenues.USD, 'USD')}
          </p>
        </div>
      </div>

      {/* Expanded Clients List */}
      {expanded && (
        <div className="border-t border-border">
          <div className="space-y-2 p-6 bg-muted/30">
            {country.clients.map(client => (
              <AnnualRevenueClient key={client.id} client={client} />
            ))}

            {/* Clients Subtotal */}
            <div className="pt-2 border-t border-border/50 mt-4">
              <div className="flex items-center justify-between p-3">
                <p className="font-semibold text-foreground text-sm">Clients Subtotal</p>
                <div className="hidden md:grid grid-cols-2 gap-8 text-right">
                  <div>
                    <p className="font-semibold text-foreground">
                      {formatCurrency(totalClientsRevenue.ILS, 'ILS')}
                    </p>
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">
                      {formatCurrency(totalClientsRevenue.USD, 'USD')}
                    </p>
                  </div>
                </div>
                <div className="md:hidden ml-4 text-right">
                  <p className="text-sm font-semibold text-foreground">
                    {formatCurrency(totalClientsRevenue.ILS, 'ILS')}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatCurrency(totalClientsRevenue.USD, 'USD')}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
};
