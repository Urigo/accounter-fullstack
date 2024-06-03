import { initGraphQLTada } from 'gql.tada';
import type { introspection } from './graphql-env.d.js';
import { TimelessDateString } from './helpers/dates.js';

export const graphql = initGraphQLTada<{
  introspection: introspection;
  scalars: {
    ID: string;
    String: string;
    Boolean: boolean;
    Int: number;
    Float: number;

    Date: Date;
    FileScalar: File | Blob;
    TimelessDate: TimelessDateString;
    URL: string;
    UUID: string;
  };
}>();

export type { FragmentOf, ResultOf, VariablesOf } from 'gql.tada';
export { readFragment } from 'gql.tada';
