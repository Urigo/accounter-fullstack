import { withScraperUploadErrors } from '../helpers/upload-error.helper.js';
import { IsracardAmexScraperIngestionProvider } from '../providers/isracard-amex-scraper-ingestion.provider.js';
import { OtsarHahayalScraperIngestionProvider } from '../providers/otsar-hahayal-scraper-ingestion.provider.js';
import { PoalimScraperIngestionProvider } from '../providers/poalim-scraper-ingestion.provider.js';
import { ScraperIngestionProvider } from '../providers/scraper-ingestion.provider.js';
import type { ScraperIngestionModule } from '../types.js';

export const scraperIngestionResolvers: ScraperIngestionModule.Resolvers = {
  Mutation: {
    uploadPoalimIlsTransactions: (_, { transactions }, { injector }) =>
      withScraperUploadErrors('uploadPoalimIlsTransactions', () =>
        injector.get(PoalimScraperIngestionProvider).uploadPoalimIlsTransactions(transactions),
      ),

    uploadPoalimForeignTransactions: (_, { transactions }, { injector }) =>
      withScraperUploadErrors('uploadPoalimForeignTransactions', () =>
        injector.get(PoalimScraperIngestionProvider).uploadPoalimForeignTransactions(transactions),
      ),

    uploadPoalimSwiftTransactions: (_, { swifts }, { injector }) =>
      withScraperUploadErrors('uploadPoalimSwiftTransactions', () =>
        injector.get(PoalimScraperIngestionProvider).uploadPoalimSwiftTransactions(swifts),
      ),

    uploadPoalimSecurities: (_, { securities }, { injector }) =>
      withScraperUploadErrors('uploadPoalimSecurities', () =>
        injector.get(PoalimScraperIngestionProvider).uploadPoalimSecurities(securities),
      ),

    uploadPoalimSecuritiesTransactions: (_, { transactions }, { injector }) =>
      withScraperUploadErrors('uploadPoalimSecuritiesTransactions', () =>
        injector
          .get(PoalimScraperIngestionProvider)
          .uploadPoalimSecuritiesTransactions(transactions),
      ),

    uploadIsracardTransactions: (_, { transactions }, { injector }) =>
      withScraperUploadErrors('uploadIsracardTransactions', () =>
        injector.get(IsracardAmexScraperIngestionProvider).uploadIsracardTransactions(transactions),
      ),

    uploadAmexTransactions: (_, { transactions }, { injector }) =>
      withScraperUploadErrors('uploadAmexTransactions', () =>
        injector.get(IsracardAmexScraperIngestionProvider).uploadAmexTransactions(transactions),
      ),

    uploadCalTransactions: (_, { transactions }, { injector }) =>
      withScraperUploadErrors('uploadCalTransactions', () =>
        injector.get(ScraperIngestionProvider).uploadCalTransactions(transactions),
      ),

    uploadDiscountTransactions: (_, { transactions }, { injector }) =>
      withScraperUploadErrors('uploadDiscountTransactions', () =>
        injector.get(ScraperIngestionProvider).uploadDiscountTransactions(transactions),
      ),

    uploadMaxTransactions: (_, { transactions }, { injector }) =>
      withScraperUploadErrors('uploadMaxTransactions', () =>
        injector.get(ScraperIngestionProvider).uploadMaxTransactions(transactions),
      ),

    uploadCurrencyRates: (_, { rates }, { injector }) =>
      withScraperUploadErrors('uploadCurrencyRates', () =>
        injector.get(ScraperIngestionProvider).uploadCurrencyRates(rates),
      ),

    uploadOtsarHahayalIlsTransactions: (_, { transactions }, { injector }) =>
      withScraperUploadErrors('uploadOtsarHahayalIlsTransactions', () =>
        injector
          .get(OtsarHahayalScraperIngestionProvider)
          .uploadOtsarHahayalIlsTransactions(transactions),
      ),

    uploadOtsarHahayalForeignTransactions: (_, { transactions }, { injector }) =>
      withScraperUploadErrors('uploadOtsarHahayalForeignTransactions', () =>
        injector
          .get(OtsarHahayalScraperIngestionProvider)
          .uploadOtsarHahayalForeignTransactions(transactions),
      ),

    uploadOtsarHahayalCreditCardTransactions: (_, { transactions }, { injector }) =>
      withScraperUploadErrors('uploadOtsarHahayalCreditCardTransactions', () =>
        injector
          .get(OtsarHahayalScraperIngestionProvider)
          .uploadOtsarHahayalCreditCardTransactions(transactions),
      ),
  },
};
