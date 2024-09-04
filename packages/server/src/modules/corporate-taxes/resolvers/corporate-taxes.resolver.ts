import { GraphQLError } from 'graphql';
import { dateToTimelessDateString } from '@shared/helpers';
import { CorporateTaxesProvider } from '../providers/corporate-taxes.provider.js';
import type { CorporateTaxesModule } from '../types.js';

export const corporateTaxesResolvers: CorporateTaxesModule.Resolvers = {
  Query: {
    corporateTaxByDate: async (_, { date }, { injector }) => {
      try {
        return await injector
          .get(CorporateTaxesProvider)
          .getCorporateTaxesByDateLoader.load(date)
          .then(res => {
            if (!res) {
              console.error(`Error fetching corporate taxes for date ${date}`);
              throw new Error('Corporate tax not found');
            }
            return res;
          });
      } catch (e) {
        console.error('Error fetching corporate taxes', e);
        throw new GraphQLError((e as Error)?.message ?? 'Error fetching corporate taxes');
      }
    },
  },
  CorporateTax: {
    id: corporateTax =>
      `${corporateTax.corporate_id}|${dateToTimelessDateString(corporateTax.date)}`,
    corporateId: corporateTax => corporateTax.corporate_id,
    date: corporateTax => dateToTimelessDateString(corporateTax.date),
    taxRate: corporateTax => Number(corporateTax.tax_rate),
  },
};
