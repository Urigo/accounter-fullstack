import { initGraphQLTada } from 'gql.tada';
import type { introspection } from './graphql-env.d.js';

export const graphql = initGraphQLTada<{
  introspection: introspection;
  scalars: {
    Date: Date;
    FileScalar: File | Blob;
    TimelessDate: string;
    URL: string;
    UUID: string;
  };
}>();

export type { FragmentOf, ResultOf, VariablesOf } from 'gql.tada';
export { readFragment } from 'gql.tada';
