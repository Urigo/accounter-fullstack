import { createModule } from 'graphql-modules';
import { IsracardAmexScraperIngestionProvider } from './providers/isracard-amex-scraper-ingestion.provider.js';
import { PoalimScraperIngestionProvider } from './providers/poalim-scraper-ingestion.provider.js';
import { ScraperIngestionProvider } from './providers/scraper-ingestion.provider.js';
import { scraperIngestionResolvers } from './resolvers/scraper-ingestion.resolver.js';
import scraperIngestion from './typeDefs/scraper-ingestion.graphql.js';

const __dirname = new URL('.', import.meta.url).pathname;

export const scraperIngestionModule = createModule({
  id: 'scraperIngestion',
  dirname: __dirname,
  typeDefs: [scraperIngestion],
  resolvers: [scraperIngestionResolvers],
  providers: () => [
    ScraperIngestionProvider,
    PoalimScraperIngestionProvider,
    IsracardAmexScraperIngestionProvider,
  ],
});
