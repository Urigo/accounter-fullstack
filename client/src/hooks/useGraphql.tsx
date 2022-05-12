import { GraphQLClient } from 'graphql-request';

export const useGraphql = () => {
  const endpoint = 'http://localhost:4000/graphql';

  const graphQLClient = new GraphQLClient(endpoint, {
    // TODO: add auth
    headers: {},
  });

  const onRequest = async <T, V>(query: string, variables?: V): Promise<T> => {
    const data = await graphQLClient.request<T, V>(query, variables);
    return data;
  };

  return { request: onRequest };
};
