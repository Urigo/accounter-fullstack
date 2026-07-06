import { fileURLToPath } from 'node:url';
import { createModule } from 'graphql-modules';
import { AccountantApprovalProvider } from './providers/accountant-approval.provider.js';
import { accountantApprovalResolvers } from './resolvers/accountant-approval.resolver.js';
import accountantApproval from './typeDefs/accountant-approval.graphql.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

export const accountantApprovalModule = createModule({
  id: 'accountantApproval',
  dirname: __dirname,
  typeDefs: [accountantApproval],
  resolvers: [accountantApprovalResolvers],
  providers: () => [AccountantApprovalProvider],
});

export * as AccountantApprovalTypes from './types.js';
