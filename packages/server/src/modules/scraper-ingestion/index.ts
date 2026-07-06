import { fileURLToPath } from 'node:url';
import { createModule } from 'graphql-modules';
import { IsracardAmexScraperIngestionProvider } from './providers/isracard-amex-scraper-ingestion.provider.js';
import { OtsarHahayalScraperIngestionProvider } from './providers/otsar-hahayal-scraper-ingestion.provider.js';
import { PoalimScraperIngestionProvider } from './providers/poalim-scraper-ingestion.provider.js';
import { ScraperIngestionProvider } from './providers/scraper-ingestion.provider.js';
import { scraperIngestionResolvers } from './resolvers/scraper-ingestion.resolver.js';
import scraperIngestion from './typeDefs/scraper-ingestion.graphql.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

export const scraperIngestionModule = createModule({
  id: 'scraperIngestion',
  dirname: __dirname,
  typeDefs: [scraperIngestion],
  resolvers: [scraperIngestionResolvers],
  providers: () => [
    ScraperIngestionProvider,
    PoalimScraperIngestionProvider,
    IsracardAmexScraperIngestionProvider,
    OtsarHahayalScraperIngestionProvider,
  ],
});
