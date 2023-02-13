import { format } from 'date-fns';
import { GraphQLError, GraphQLScalarType, Kind, ValueNode } from 'graphql';

type addZero<T> = T | 0;
type oneToFour = 1 | 2 | 3 | 4;
type oneToNine = oneToFour | 5 | 6 | 7 | 8 | 9;
type d = addZero<oneToNine>;
type YYYY = `20${addZero<oneToFour>}${d}`;
type MM = `0${oneToNine}` | `1${0 | 1 | 2}`;
type DD = `${0}${oneToNine}` | `${1 | 2}${d}` | `3${0 | 1}`;

export type TimelessDateString = `${YYYY}-${MM}-${DD}`;

/* regex of yyyy-mm-dd  */
export const TIMELESS_DATE_REGEX =
  /^((?:1[6-9]|[2]\d)\d{2})(-)(?:((?:0[13578]|1[02])(-31))|(?:(?:0[1,3-9]|1[0-2])(-)(?:29|30)))$|^(?:(?:(?:1[6-9]|[2]\d)(?:0[48]|[2468][048]|[13579][26])|(?:(?:16|[2468][048]|[3579][26])00)))(-02-29)$|^(?:(?:1[6-9]|[2-9]\d)\d{2})(-)(?:(?:0[1-9])|(?:1[0-2]))(-)(?:0[1-9]|1\d|2[0-8])$/;

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
      return format(value, 'yyyy-MM-dd') as TimelessDateString;
    }
    throw new GraphQLError(`Expected TimelessDate to be yyyy-mm-dd string, but got: "${value}"`);
  },

  parseValue(value: unknown) {
    if (typeof value === 'string') {
      return validateTimelessDateFormat(value);
    }
    if (value instanceof Date) {
      return format(value, 'yyyy-MM-dd') as TimelessDateString;
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
