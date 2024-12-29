import { createYoga } from 'graphql-yoga';
import { buildSubgraphSchema } from '@apollo/subgraph';
import { accountantApprovalSubgraphResolvers } from './resolver';
import { typeDefsAccountantApproval } from './schema';

export const getAccountantApprovalSubgraph = () =>
  buildSubgraphSchema([
    { typeDefs: typeDefsAccountantApproval, resolvers: accountantApprovalSubgraphResolvers },
  ]);

export const accountantApprovalYoga = createYoga({
  schema: getAccountantApprovalSubgraph(),
  landingPage: true,
  graphqlEndpoint: '/accountant-approval',
  graphiql: {
    title: 'Accountant Approval Subgraph',
  },
});
