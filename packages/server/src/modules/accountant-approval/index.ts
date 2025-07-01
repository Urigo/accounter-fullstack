import accountantApproval from './typeDefs/accountant-approval.graphql.js';
import { createModule } from 'graphql-modules';
import { AccountantApprovalProvider } from './providers/accountant-approval.provider.js';
import { accountantApprovalResolvers } from './resolvers/accountant-approval.resolver.js';

const __dirname = new URL('.', import.meta.url).pathname;

export const accountantApprovalModule = createModule({
  id: 'accountantApproval',
  dirname: __dirname,
  typeDefs: [accountantApproval],
  resolvers: [accountantApprovalResolvers],
  providers: [AccountantApprovalProvider],
});

export * as AccountantApprovalTypes from './types.js';
