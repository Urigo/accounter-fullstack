import { GraphQLError, GraphQLScalarType, Kind, ValueNode } from 'graphql';
import { DateResolver, DateTimeResolver, IBANResolver, URLResolver } from 'graphql-scalars';

import { Resolvers } from '../__generated__/types.mjs';

function vlidatePercentage(value: number) {
  if (value >= 0 && value <= 1) return value;

  throw new GraphQLError(`Percantage value must be between 0 and 1, but got a: ${value}`);
}

export const Percentage = new GraphQLScalarType({
  name: 'Percentage',
  description: 'A floating point number between 0 and 1',

  serialize(value: unknown) {
    return Number(value);
  },

  parseValue(value: unknown) {
    return vlidatePercentage(Number(value));
  },

  parseLiteral(ast: ValueNode) {
    if (ast.kind === Kind.FLOAT || ast.kind === Kind.INT) {
      return vlidatePercentage(Number(ast.value));
    }

    throw new GraphQLError(`Can only validate numbers as Percentage but got: ${ast.kind}`);
  },
});

export const resolvers: Partial<Resolvers> = {
  Date: DateTimeResolver,
  TimelessDate: DateResolver,
  IBAN: IBANResolver,
  Percentage,
  URL: URLResolver,
};
