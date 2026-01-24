'use client';

import { useCallback, useContext, useEffect, useMemo, useState, type ReactElement } from 'react';
import { ChevronRight, Download } from 'lucide-react';
import { useQuery } from 'urql';
import { YearPickerInput } from '@mantine/dates';
import { Button } from '@/components/ui/button.js';
import { Card } from '@/components/ui/card.js';
import { AnnualRevenueReportScreenDocument, Currency } from '../../../../gql/graphql.js';
import { FiltersContext } from '../../../../providers/filters-context.js';
import { AccounterLoader } from '../../../common/index.js';
import { PageLayout } from '../../../layout/page-layout.js';
import { AnnualRevenueCountry } from './country.js';
import { formatCurrency } from './utils.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query AnnualRevenueReportScreen($filters: AnnualRevenueReportFilter!) {
    annualRevenueReport(filters: $filters) {
      id
      year
      countries {
        id
        name
        revenueLocal {
          raw
          currency
        }
        revenueDefaultForeign {
          raw
          currency
        }
        clients {
          id
          name
          revenueLocal {
            raw
          }
          revenueDefaultForeign {
            raw
          }
          records {
            id
            date
            description
            reference
            chargeId
            revenueLocal {
              raw
            }
            revenueDefaultForeign {
              raw
            }
          }
        }
        ...AnnualRevenueReportCountry
      }
    }
  }
`;

export const AnnualRevenueReport = (): ReactElement => {
  const [year, setYear] = useState<number>(new Date().getFullYear() - 1);

  const [{ data, fetching }] = useQuery({
    query: AnnualRevenueReportScreenDocument,
    variables: {
      filters: {
        year,
      },
    },
  });

  const { setFiltersContext } = useContext(FiltersContext);

  const description = useMemo(() => {
    return `Annual Revenue Report for ${year}`;
  }, [year]);

  const { totalClients, totalRevenueIls, totalRevenueUsd } = useMemo(() => {
    const total = {
      totalClients: 0,
      totalRevenueIls: 0,
      totalRevenueUsd: 0,
    };
    data?.annualRevenueReport.countries.map(country => {
      total.totalClients += country.clients.length;
      total.totalRevenueIls += country.revenueLocal.raw;
      total.totalRevenueUsd += country.revenueDefaultForeign.raw;
    });
    return total;
  }, [data?.annualRevenueReport.countries]);

  const downloadCSV = useCallback(() => {
    const rows: string[] = [];

    // Header
    rows.push('Country,Client,charge ID,Date,Description,Revenue ILS,Revenue USD');
    rows.push(`Annual,,,,TOTAL,${totalRevenueIls.toFixed(2)},${totalRevenueUsd.toFixed(2)}`);

    // Data rows
    data?.annualRevenueReport.countries
      .sort((a, b) => b.revenueDefaultForeign.raw - a.revenueDefaultForeign.raw)
      .map(country => {
        rows.push(
          `${country.name},,,,TOTAL,${country.revenueLocal.raw.toFixed(2)},${country.revenueDefaultForeign.raw.toFixed(2)}`,
        );
        country.clients
          .sort((a, b) => b.revenueDefaultForeign.raw - a.revenueDefaultForeign.raw)
          .map(client => {
            if (client.records && client.records.length > 0) {
              rows.push(
                `${country.name},${client.name},,,TOTAL,${client.revenueLocal.raw.toFixed(2)},${client.revenueDefaultForeign.raw.toFixed(2)}`,
              );
              client.records
                .sort((a, b) => a.date.localeCompare(b.date))
                .map(record => {
                  rows.push(
                    `${country.name},${client.name},${record.chargeId},${record.date},${record.description},${record.revenueLocal.raw.toFixed(2)},${record.revenueDefaultForeign.raw.toFixed(2)}`,
                  );
                });
            } else {
              rows.push(`${country.name},${client.name},,,,,`);
            }
          });
      });

    const csvContent = rows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `annual-revenue-${year}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [data, year]);

  useEffect(() => {
    setFiltersContext(
      <div className="flex items-center justify-end gap-2">
        <YearPickerInput
          value={new Date(year, 0, 1)}
          onChange={date => date && setYear(date?.getFullYear())}
          popoverProps={{ withinPortal: true }}
          minDate={new Date(2010, 0, 1)}
          maxDate={new Date()}
        />
        <Button
          onClick={downloadCSV}
          variant="outline"
          size="sm"
          className="flex items-center gap-2 bg-transparent"
        >
          <Download className="h-4 w-4" />
          <span className="hidden sm:inline">Export CSV</span>
        </Button>
      </div>,
    );
  }, [year, fetching, setFiltersContext, downloadCSV]);

  const sortedCountries = useMemo(() => {
    return data?.annualRevenueReport.countries.slice().sort((a, b) => {
      return b.revenueDefaultForeign.raw - a.revenueDefaultForeign.raw;
    });
  }, [data]);

  return (
    <PageLayout title="Annual Revenue Report" description={description}>
      {fetching ? (
        <AccounterLoader />
      ) : (
        <div className="min-h-screen bg-background">
          {/* Main Content */}
          <main className="container mx-auto px-2 py-2 max-w-7xl">
            <div className="space-y-2">
              <Card className="border border-border bg-blue-100">
                {/* Country Header */}

                <div className="w-full px-4 py-2 pl-12 hover:bg-accent/5 transition-colors flex items-center justify-between">
                  <div className="flex items-center gap-2 flex-1">
                    <div className="text-left">
                      <p className="font-semibold text-foreground text-lg">Total Revenue</p>
                      <p className="text-sm text-muted-foreground">{totalClients} clients</p>
                    </div>
                  </div>

                  <div className="hidden md:grid grid-cols-2 gap-4 text-right flex-shrink-0">
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">ILS</p>
                      <p className="font-semibold text-foreground">
                        {formatCurrency(totalRevenueIls, Currency.Ils)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">USD</p>
                      <p className="font-semibold text-foreground">
                        {formatCurrency(totalRevenueUsd, Currency.Usd)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Mobile Revenue Summary */}
                <div className="md:hidden px-2 py-2 bg-accent/5 border-t border-border flex gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">ILS</p>
                    <p className="font-semibold text-foreground">
                      {formatCurrency(totalRevenueIls, Currency.Ils)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">USD</p>
                    <p className="font-semibold text-foreground">
                      {formatCurrency(totalRevenueUsd, Currency.Usd)}
                    </p>
                  </div>
                </div>
              </Card>
              {sortedCountries?.map(country => (
                <AnnualRevenueCountry key={country.id} countryData={country} />
              ))}
            </div>
          </main>
        </div>
      )}
    </PageLayout>
  );
};
