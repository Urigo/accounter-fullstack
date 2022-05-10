import { FinancialEntityResolvers, Resolvers } from './__generated__/types.mjs';

const commonfinancialEntityFields: FinancialEntityResolvers = {
  __resolveType: (parent) => parent.__typename!,
  id: (parent) => parent.id,
  accounts: (parent) => [], // TODO: implement
  charges: (parent) => [], // TODO: implement
  linkedEntities: (parent) => [], // TODO: implement
};

export const resolvers: Resolvers = {
  Query: {
    financialEntity: (_parent, { id }) => {
      // Implement...
    },
  },
  LtdFinancialEntity: {
    __isTypeOf: (parent) => parent.__typename === 'LtdFinancialEntity',
    ...commonfinancialEntityFields,
    govermentId: (parent) => parent.govermentId,
    name: (parent) => parent.name,
    address: (parent) => parent.address,

    englishName: (parent) => parent.englishName,
    email: (parent) => parent.email,
    website: (parent) => parent.website,
    phoneNumber: (parent) => parent.phoneNumber,

    accounts: (parent) => parent.accounts,
    charges: (parent, { filter }) => parent.charges,
    linkedEntities: (parent) => parent.linkedEntities,
  },
  PersonalFinancialEntity: {
    __isTypeOf: (parent) => parent.__typename === 'PersonalFinancialEntity',
    ...commonfinancialEntityFields,
    name: (parent) => parent.name
    email: (parent) => parent.email
    documents: (parent) => parent.documents
  },
};
