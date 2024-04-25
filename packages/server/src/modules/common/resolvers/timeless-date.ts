import { GraphQLError, GraphQLScalarType, Kind, ValueNode } from 'graphql';
import { TIMELESS_DATE_REGEX } from '@shared/constants';
import { dateToTimelessDateString } from '@shared/helpers';
import type { TimelessDateString } from '@shared/types';

function validateTimelessDateFormat(raw: string) {
  if (TIMELESS_DATE_REGEX.test(raw)) {
    return raw as TimelessDateString;
  }
  throw new GraphQLError(`Expected TimelessDate to be of yyyy-mm-dd format, but got: "${raw}"`);
}

export const TimelessDateScalar = new GraphQLScalarType({
  name: 'TimelessDate',
  description: 'A date with no time of day',

  serialize(value: unknown) {
    if (typeof value === 'string') {
      return validateTimelessDateFormat(value);
    }
    if (value instanceof Date) {
      return dateToTimelessDateString(value);
    }
    throw new GraphQLError(`Expected TimelessDate to be yyyy-mm-dd string, but got: "${value}"`);
  },

  parseValue(value: unknown) {
    if (typeof value === 'string') {
      return validateTimelessDateFormat(value);
    }
    if (value instanceof Date) {
      return dateToTimelessDateString(value);
    }
    throw new GraphQLError(`Expected TimelessDate to be yyyy-mm-dd string, but got: "${value}"`);
  },

  parseLiteral(ast: ValueNode) {
    if (ast.kind === Kind.STRING) {
      return validateTimelessDateFormat(ast.value);
    }

    throw new GraphQLError(`Can only validate strings as TimelessDate but got: ${ast.kind}`);
  },
});
