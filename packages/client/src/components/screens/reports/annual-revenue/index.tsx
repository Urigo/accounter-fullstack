'use client';

import { useContext, useEffect, useMemo, useState, type ReactElement } from 'react';
import { Download } from 'lucide-react';
import { useQuery } from 'urql';
import { Button } from '@/components/ui/button.js';
import { YearPickerInput } from '@mantine/dates';
import { AnnualRevenueReportScreenDocument } from '../../../../gql/graphql.js';
import { FiltersContext } from '../../../../providers/filters-context.js';
import { AccounterLoader } from '../../../common/index.js';
import { PageLayout } from '../../../layout/page-layout.js';
import { AnnualRevenueCountry } from './country.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query AnnualRevenueReportScreen($filters: AnnualRevenueReportFilter!) {
    annualRevenueReport(filters: $filters) {
      id
      year
      countries {
        code
        name
        revenue {
          raw
          formatted
          currency
        }
        clients {
          id
          name
          revenue {
            raw
            formatted
            currency
          }
          transactions {
            id
          }
        }
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

  const downloadCSV = () => {
    const rows: string[] = [];

    // Header
    rows.push('Country,Client,Transaction ID,Date,Description,Revenue ILS,Revenue USD');

    // Data rows
    data?.annualRevenueReport.countries.map(country => {
      country.clients.map(client => {
        if (client.transactions && client.transactions.length > 0) {
          client.transactions.map(transaction => {
            rows.push(
              `${country.name},${client.name},${transaction.id},${transaction.date},${transaction.description},${transaction.amountILS},${transaction.amountUSD}`,
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
    link.setAttribute('download', `annual-revenue-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const { setFiltersContext } = useContext(FiltersContext);

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

  const description = useMemo(() => {
    return `Annual Revenue Report for ${year}`;
  }, [year]);

  return (
    <PageLayout title="Annual Revenue Report" description={description}>
      {fetching ? (
        <AccounterLoader />
      ) : (
        <div className="min-h-screen bg-background">
          {/* Main Content */}
          <main className="container mx-auto px-4 py-8 md:px-6 lg:px-8 max-w-7xl">
            <div className="space-y-8">
              {data?.annualRevenueReport.countries.map(country => (
                <AnnualRevenueCountry key={country.code} country={country} />
              ))}
            </div>
          </main>
        </div>
      )}
    </PageLayout>
  );
};
