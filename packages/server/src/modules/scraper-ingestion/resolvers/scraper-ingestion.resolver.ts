import { ScraperIngestionProvider } from '../providers/scraper-ingestion.provider.js';
import type { ScraperIngestionModule } from '../types.js';

export const scraperIngestionResolvers: ScraperIngestionModule.Resolvers = {
  Mutation: {
    uploadPoalimIlsTransactions: (_, { transactions }, { injector }) =>
      injector.get(ScraperIngestionProvider).uploadPoalimIlsTransactions(transactions),

    uploadPoalimForeignTransactions: (_, { transactions }, { injector }) =>
      injector.get(ScraperIngestionProvider).uploadPoalimForeignTransactions(transactions),

    uploadPoalimSwiftTransactions: (_, { swifts }, { injector }) =>
      injector.get(ScraperIngestionProvider).uploadPoalimSwiftTransactions(swifts),

    uploadIsracardTransactions: (_, { transactions }, { injector }) =>
      injector.get(ScraperIngestionProvider).uploadIsracardTransactions(transactions),

    uploadAmexTransactions: (_, { transactions }, { injector }) =>
      injector.get(ScraperIngestionProvider).uploadAmexTransactions(transactions),

    uploadCalTransactions: (_, { transactions }, { injector }) =>
      injector.get(ScraperIngestionProvider).uploadCalTransactions(transactions),

    uploadDiscountTransactions: (_, { transactions }, { injector }) =>
      injector.get(ScraperIngestionProvider).uploadDiscountTransactions(transactions),

    uploadMaxTransactions: (_, { transactions }, { injector }) =>
      injector.get(ScraperIngestionProvider).uploadMaxTransactions(transactions),

    uploadCurrencyRates: (_, { rates }, { injector }) =>
      injector.get(ScraperIngestionProvider).uploadCurrencyRates(rates),
  },
};
