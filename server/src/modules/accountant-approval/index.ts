import { accountantApprovalResolvers } from './resolvers/accountant-approval.resolver.js';
import accountantApproval from './typeDefs/accountant-approval.graphql.js';
import { createModule } from 'graphql-modules';

const __dirname = new URL('.', import.meta.url).pathname;

export const accountantApprovalModule = createModule({
  id: 'accountantApproval',
  dirname: __dirname,
  typeDefs: [accountantApproval],
  resolvers: [accountantApprovalResolvers],
  providers: () => [],
});
