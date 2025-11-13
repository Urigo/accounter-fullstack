import { endOfYear, startOfYear } from 'date-fns';
import { CountriesProvider } from '@modules/countries/providers/countries.provider.js';
import { BusinessesProvider } from '@modules/financial-entities/providers/businesses.provider.js';
import { ClientsProvider } from '@modules/financial-entities/providers/clients.provider.js';
import { Currency } from '@shared/enums';
import { dateToTimelessDateString, formatFinancialAmount } from '@shared/helpers';
import { AnnualRevenueReportProvider } from '../providers/annual-revenue-report.provider.js';
import type { ReportsModule } from '../types.js';

interface NormalizedTransaction {
  clientId: string;
  countryCode: string;
  amountIls: number;
  amountUsd: number;
  transaction: {
    id: string;
    amountIls: number;
    amountUsd: number;
  };
}

export const annualRevenueResolvers: ReportsModule.Resolvers = {
  Query: {
    annualRevenueReport: async (_, { filters: { year, adminBusinessId } }, context) => {
      const adminId = adminBusinessId ?? context.adminContext.defaultAdminBusinessId;
      const clients = await context.injector.get(ClientsProvider).getAllClients();
      const clientBusinessIds = clients.map(client => client.business_id);
      const date = new Date(year, 6, 1);
      const transactions = await context.injector
        .get(AnnualRevenueReportProvider)
        .getNormalizedRevenueTransactions({
          businessIDs: clientBusinessIds,
          isBusinessIDs: clientBusinessIds.length,
          ownerId: adminId,
          fromDate: dateToTimelessDateString(startOfYear(date)),
          toDate: dateToTimelessDateString(endOfYear(date)),
        });

      // Normalize transactions (client, amount local currency, amount default foreign currency)
      const businessesProvider = context.injector.get(BusinessesProvider);
      const normalizedTransactions: NormalizedTransaction[] = [];

      for (const transaction of transactions) {
        if (!transaction.business_id) continue;

        const business = await businessesProvider.getBusinessByIdLoader.load(
          transaction.business_id,
        );
        if (!business) continue;

        const amountIls = transaction.amount_ils ? parseFloat(transaction.amount_ils) : 0;
        const amountUsd = transaction.amount_usd ? parseFloat(transaction.amount_usd) : 0;

        normalizedTransactions.push({
          clientId: transaction.business_id,
          countryCode: business.country,
          amountIls,
          amountUsd,
          transaction: {
            id: transaction.id,
            amountIls,
            amountUsd,
          },
        });
      }

      // Group and sum by client
      const clientSums = new Map<
        string,
        {
          countryCode: string;
          amountIls: number;
          amountUsd: number;
          transactions: {
            id: string;
            amountIls: number;
            amountUsd: number;
          }[];
        }
      >();

      for (const normalized of normalizedTransactions) {
        const existing = clientSums.get(normalized.clientId);
        if (existing) {
          existing.amountIls += normalized.amountIls;
          existing.amountUsd += normalized.amountUsd;
          existing.transactions.push(normalized.transaction);
        } else {
          clientSums.set(normalized.clientId, {
            countryCode: normalized.countryCode,
            amountIls: normalized.amountIls,
            amountUsd: normalized.amountUsd,
            transactions: [normalized.transaction],
          });
        }
      }

      // Group by country
      const countrySums = new Map<
        string,
        {
          amountIls: number;
          amountUsd: number;
          clients: Array<{
            id: string;
            amountIls: number;
            amountUsd: number;
            transactions: {
              id: string;
              amountIls: number;
              amountUsd: number;
            }[];
          }>;
        }
      >();

      for (const [clientId, data] of clientSums.entries()) {
        const existing = countrySums.get(data.countryCode);
        if (existing) {
          existing.amountIls += data.amountIls;
          existing.amountUsd += data.amountUsd;
          existing.clients.push({
            id: clientId,
            amountIls: data.amountIls,
            amountUsd: data.amountUsd,
            transactions: data.transactions,
          });
        } else {
          countrySums.set(data.countryCode, {
            amountIls: data.amountIls,
            amountUsd: data.amountUsd,
            clients: [
              {
                id: clientId,
                amountIls: data.amountIls,
                amountUsd: data.amountUsd,
                transactions: data.transactions,
              },
            ],
          });
        }
      }

      // Build the response
      const countriesProvider = context.injector.get(CountriesProvider);
      const countries = await Promise.all(
        Array.from(countrySums.entries()).map(async ([countryCode, data]) => {
          const country = await countriesProvider.getCountryByCodeLoader.load(countryCode);

          const clients = await Promise.all(
            data.clients.map(async client => {
              const business = await businessesProvider.getBusinessByIdLoader.load(client.id);

              return {
                id: `annual-revenue-report-${year}-${countryCode}-${client.id}`,
                name: business?.name ?? '',
                revenueLocal: formatFinancialAmount(client.amountIls, Currency.Ils),
                revenueDefaultForeign: formatFinancialAmount(client.amountUsd, Currency.Usd),
                transactionsInfo: client.transactions.map(transaction => ({
                  id: `annual-revenue-report-${year}-${countryCode}-${client.id}-transaction-${transaction.id}`,
                  transaction: transaction.id,
                  revenueLocal: formatFinancialAmount(transaction.amountIls, Currency.Ils),
                  revenueDefaultForeign: formatFinancialAmount(transaction.amountUsd, Currency.Usd),
                })),
              };
            }),
          );

          return {
            id: `annual-revenue-report-${year}-${countryCode}`,
            code: countryCode,
            name: country?.name ?? countryCode,
            revenueLocal: formatFinancialAmount(data.amountIls, Currency.Ils),
            revenueDefaultForeign: formatFinancialAmount(data.amountUsd, Currency.Usd),
            clients,
          };
        }),
      );

      return {
        id: year.toString(),
        year,
        countries,
      };
    },
  },
};
