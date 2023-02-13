import { GraphQLError, GraphQLScalarType, Kind, ValueNode } from 'graphql';

function validatePercentage(value: number) {
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
    return validatePercentage(Number(value));
  },

  parseLiteral(ast: ValueNode) {
    if (ast.kind === Kind.FLOAT || ast.kind === Kind.INT) {
      return validatePercentage(Number(ast.value));
    }

    throw new GraphQLError(`Can only validate numbers as Percentage but got: ${ast.kind}`);
  },
});
