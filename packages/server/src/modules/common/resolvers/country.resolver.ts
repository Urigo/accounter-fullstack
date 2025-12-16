import { GraphQLError, GraphQLScalarType, Kind, ValueNode } from 'graphql';
import { CountryCode } from '../../../shared/enums.js';

const COUNTRY_CODE_REGEX = new RegExp(`^(${Object.values(CountryCode).join('|')})$`, 'i');

const validate = (value: unknown, ast?: ValueNode) => {
  if (typeof value !== 'string') {
    throw new GraphQLError(
      `Value is not string: ${value}`,
      ast
        ? {
            nodes: ast,
          }
        : undefined,
    );
  }

  if (!COUNTRY_CODE_REGEX.test(value)) {
    throw new GraphQLError(
      `Value is not a valid country code: ${value}`,
      ast
        ? {
            nodes: ast,
          }
        : undefined,
    );
  }
  return value;
};

export const GraphQLCountryCode = new GraphQLScalarType({
  name: 'CountryCode',
  description: 'A country code as defined by ISO 3166-1 alpha-3',
  serialize(value) {
    return validate(value);
  },

  parseValue(value) {
    return validate(value);
  },

  parseLiteral(ast) {
    if (ast.kind !== Kind.STRING) {
      throw new GraphQLError(`Can only validate strings as country codes but got a: ${ast.kind}`, {
        nodes: [ast],
      });
    }
    return validate(ast.value, ast);
  },
  extensions: {
    codegenScalarType: 'string',
    jsonSchema: {
      title: 'CountryCode',
      type: 'string',
      pattern: COUNTRY_CODE_REGEX.source,
    },
  },
});
