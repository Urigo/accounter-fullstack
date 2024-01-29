import accountantApproval from './typeDefs/accountant-approval.graphql.js';
import { createModule } from 'graphql-modules';
import { accountantApprovalResolvers } from './resolvers/accountant-approval.resolver.js';

const __dirname = new URL('.', import.meta.url).pathname;

export const accountantApprovalModule = createModule({
  id: 'accountantApproval',
  dirname: __dirname,
  typeDefs: [accountantApproval],
  resolvers: [accountantApprovalResolvers],
});

export * as AccountantApprovalTypes from './types.js';
