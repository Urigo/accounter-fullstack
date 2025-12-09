import { endOfYear, startOfYear } from 'date-fns';
import { CountriesProvider } from '@modules/countries/providers/countries.provider.js';
import { BusinessesProvider } from '@modules/financial-entities/providers/businesses.provider.js';
import { TaxCategoriesProvider } from '@modules/financial-entities/providers/tax-categories.provider.js';
import { dateToTimelessDateString, formatFinancialAmount } from '@shared/helpers';
import { Currency } from '../../../shared/enums.js';
import { TimelessDateString } from '../../../shared/types/index.js';
import { AnnualRevenueReportProvider } from '../providers/annual-revenue-report.provider.js';
import type { ReportsModule } from '../types.js';

interface NormalizedRecord {
  clientId: string;
  countryCode: string;
  amountIls: number;
  amountUsd: number;
  record: {
    id: string;
    chargeId: string;
    businessId: string;
    date: TimelessDateString;
    description: string | null;
    reference: string | null;
    amountIls: number;
    amountUsd: number;
    amountOriginal: number;
    currency: Currency;
  };
}

export const annualRevenueResolvers: ReportsModule.Resolvers = {
  Query: {
    annualRevenueReport: async (_, { filters: { year, adminBusinessId } }, context) => {
      const adminId = adminBusinessId ?? context.adminContext.defaultAdminBusinessId;
      const incomeTaxCategories = await context.injector
        .get(TaxCategoriesProvider)
        .taxCategoriesBySortCodeLoader.load(810);
      const date = new Date(year, 6, 1);
      const records = await context.injector
        .get(AnnualRevenueReportProvider)
        .getNormalizedRevenueRecords({
          incomeTaxCategoriesIDs: incomeTaxCategories.map(tc => tc.id),
          incomeToCollectId: context.adminContext.crossYear.incomeToCollectTaxCategoryId,
          ownerId: adminId,
          fromDate: dateToTimelessDateString(startOfYear(date)),
          toDate: dateToTimelessDateString(endOfYear(date)),
        });

      // Normalize records (client, amount local currency, amount default foreign currency)
      const businessesProvider = context.injector.get(BusinessesProvider);
      const normalizedRecords: NormalizedRecord[] = [];

      const businesses = await Promise.all(
        records.map(r =>
          r.business_id ? businessesProvider.getBusinessByIdLoader.load(r.business_id) : null,
        ),
      );

      records.map((record, index) => {
        if (!record.business_id) return;

        const business = businesses[index];
        if (!business) return;

        const amountIls = record.amount_local ? parseFloat(record.amount_local) : 0;
        const amountUsd = record.amount_usd ? parseFloat(record.amount_usd) : 0;

        normalizedRecords.push({
          clientId: record.business_id,
          countryCode: business.country,
          amountIls,
          amountUsd,
          record: {
            id: record.id ?? '',
            chargeId: record.charge_id!,
            businessId: record.business_id!,
            date: dateToTimelessDateString(record.date!),
            description: record.description ?? null,
            reference: record.reference ?? null,
            amountIls,
            amountUsd,
            amountOriginal: record.amount_foreign ? parseFloat(record.amount_foreign) : 0,
            currency: record.currency as Currency,
          },
        });
      });

      // Group and sum by client
      const clientSums = new Map<
        string,
        {
          countryCode: string;
          amountIls: number;
          amountUsd: number;
          records: {
            id: string;
            chargeId: string;
            businessId: string;
            date: TimelessDateString;
            description: string | null;
            reference: string | null;
            amountIls: number;
            amountUsd: number;
            amountOriginal: number;
            currency: Currency;
          }[];
        }
      >();

      for (const normalized of normalizedRecords) {
        const existing = clientSums.get(normalized.clientId);
        if (existing) {
          existing.amountIls += normalized.amountIls;
          existing.amountUsd += normalized.amountUsd;
          existing.records.push(normalized.record);
        } else {
          clientSums.set(normalized.clientId, {
            countryCode: normalized.countryCode,
            amountIls: normalized.amountIls,
            amountUsd: normalized.amountUsd,
            records: [normalized.record],
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
            records: {
              id: string;
              chargeId: string;
              businessId: string;
              date: TimelessDateString;
              description: string | null;
              reference: string | null;
              amountIls: number;
              amountUsd: number;
              amountOriginal: number;
              currency: Currency;
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
            records: data.records,
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
                records: data.records,
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
                records: client.records.map(record => ({
                  id: `annual-revenue-report-${year}-${countryCode}-${client.id}-record-${record.id}`,
                  chargeId: record.chargeId,
                  date: record.date,
                  description: record.description,
                  reference: record.reference,
                  revenueLocal: formatFinancialAmount(record.amountIls, Currency.Ils),
                  revenueDefaultForeign: formatFinancialAmount(record.amountUsd, Currency.Usd),
                  revenueOriginal: formatFinancialAmount(record.amountOriginal, record.currency),
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
