import { createYoga } from 'graphql-yoga';
import { buildSubgraphSchema } from '@apollo/subgraph';
import { accountantApprovalResolvers } from '../resolvers/accountant-approval.resolver';
import { typeDefsAccountantApproval } from './schema';

export const getAccountantApprovalSubgraph = () =>
  buildSubgraphSchema([
    { typeDefs: typeDefsAccountantApproval, resolvers: accountantApprovalResolvers },
  ]);

export const accountantApprovalYoga = createYoga({
  schema: getAccountantApprovalSubgraph(),
  landingPage: true,
  graphqlEndpoint: '/accountant-approval',
  graphiql: {
    title: 'Accountant Approval Subgraph',
  },
});
