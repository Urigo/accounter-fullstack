import { GraphQLScalarType } from 'graphql';
import { DateTimeResolver, IBANResolver, URLResolver, UUIDResolver } from 'graphql-scalars';
import { DBProvider } from '@modules/app-providers/db.provider.js';
import type { CommonModule } from '../types.js';
import { TimelessDateScalar } from './timeless-date.js';

export const scalarsResolvers: CommonModule.Resolvers = {
  Date: DateTimeResolver,
  IBAN: IBANResolver,
  URL: URLResolver,
  TimelessDate: TimelessDateScalar,
  UUID: UUIDResolver as GraphQLScalarType<string, string>,
  Query: {
    ping: async (_, __, { injector }) => {
      try {
        const db = await injector.get(DBProvider);
        // const accounts = db.query(`INSERT INTO accountr_schema.businesses (name)
        // VALUES ('');`);
        const accounts = await db.query(
          `select * from accounter_schema.extended_charges WHERE id='62a0b6b8-cc65-4a03-935a-565ce7a8e0f5';`,
        );
        console.log(accounts);
        return true;
      } catch (e) {
        return false;
      }
    },
  },
};
