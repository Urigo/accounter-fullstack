'use client';

import { useCallback, useContext, useEffect, useMemo, useState, type ReactElement } from 'react';
import { Download } from 'lucide-react';
import { useQuery } from 'urql';
import { YearPickerInput } from '@mantine/dates';
import { Button } from '@/components/ui/button.js';
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

  const downloadCSV = useCallback(() => {
    const rows: string[] = [];

    // Header
    rows.push('Country,Client,charge ID,Date,Description,Revenue ILS,Revenue USD');

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
