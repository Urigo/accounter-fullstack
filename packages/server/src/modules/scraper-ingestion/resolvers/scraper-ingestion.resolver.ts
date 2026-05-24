import { IsracardAmexScraperIngestionProvider } from '../providers/isracard-amex-scraper-ingestion.provider.js';
import { OtsarHahayalScraperIngestionProvider } from '../providers/otsar-hahayal-scraper-ingestion.provider.js';
import { PoalimScraperIngestionProvider } from '../providers/poalim-scraper-ingestion.provider.js';
import { ScraperIngestionProvider } from '../providers/scraper-ingestion.provider.js';
import type { ScraperIngestionModule } from '../types.js';

export const scraperIngestionResolvers: ScraperIngestionModule.Resolvers = {
  Mutation: {
    uploadPoalimIlsTransactions: (_, { transactions }, { injector }) =>
      injector.get(PoalimScraperIngestionProvider).uploadPoalimIlsTransactions(transactions),

    uploadPoalimForeignTransactions: (_, { transactions }, { injector }) =>
      injector.get(PoalimScraperIngestionProvider).uploadPoalimForeignTransactions(transactions),

    uploadPoalimSwiftTransactions: (_, { swifts }, { injector }) =>
      injector.get(PoalimScraperIngestionProvider).uploadPoalimSwiftTransactions(swifts),

    uploadIsracardTransactions: (_, { transactions }, { injector }) =>
      injector.get(IsracardAmexScraperIngestionProvider).uploadIsracardTransactions(transactions),

    uploadAmexTransactions: (_, { transactions }, { injector }) =>
      injector.get(IsracardAmexScraperIngestionProvider).uploadAmexTransactions(transactions),

    uploadCalTransactions: (_, { transactions }, { injector }) =>
      injector.get(ScraperIngestionProvider).uploadCalTransactions(transactions),

    uploadDiscountTransactions: (_, { transactions }, { injector }) =>
      injector.get(ScraperIngestionProvider).uploadDiscountTransactions(transactions),

    uploadMaxTransactions: (_, { transactions }, { injector }) =>
      injector.get(ScraperIngestionProvider).uploadMaxTransactions(transactions),

    uploadCurrencyRates: (_, { rates }, { injector }) =>
      injector.get(ScraperIngestionProvider).uploadCurrencyRates(rates),

    uploadOtsarHahayalIlsTransactions: (_, { transactions }, { injector }) =>
      injector.get(OtsarHahayalScraperIngestionProvider).uploadOtsarHahayalIlsTransactions(transactions),

    uploadOtsarHahayalForeignTransactions: (_, { transactions }, { injector }) =>
      injector.get(OtsarHahayalScraperIngestionProvider).uploadOtsarHahayalForeignTransactions(transactions),

    uploadOtsarHahayalCreditCardTransactions: (_, { transactions }, { injector }) =>
      injector.get(OtsarHahayalScraperIngestionProvider).uploadOtsarHahayalCreditCardTransactions(transactions),
  },
};
