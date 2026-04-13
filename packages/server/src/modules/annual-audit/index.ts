import { createModule } from 'graphql-modules';
import { AnnualAuditProvider } from './providers/annual-audit.provider.js';
import { annualAuditResolvers } from './resolvers/annual-audit.resolver.js';
import annualAudit from './typeDefs/annual-audit.graphql.js';

const __dirname = new URL('.', import.meta.url).pathname;

export const annualAuditModule = createModule({
  id: 'annual-audit',
  dirname: __dirname,
  typeDefs: [annualAudit],
  resolvers: [annualAuditResolvers],
  providers: () => [AnnualAuditProvider],
});
