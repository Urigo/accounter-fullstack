export const resolvers = {
  Query: {
    financialEntity: (parent: unknown, args: { id: string }) => {
        // Implement...
    },
  },
  FinancialEntity: {
    id: (parent: FinancialEntity) => parent.id,
    govermentId: (parent: FinancialEntity) => parent.govermentId,
    name: (parent: FinancialEntity) => parent.name,
    address: (parent: FinancialEntity) => parent.address,

    englishName: (parent: FinancialEntity) => parent.englishName,
    email: (parent: FinancialEntity) => parent.email,
    website: (parent: FinancialEntity) => parent.website,
    phoneNumber: (parent: FinancialEntity) => parent.phoneNumber,

    accounts: (parent: FinancialEntity) => parent.accounts,
    charges: (parent: FinancialEntity, args: { filter: ChargeFilter }) =>
      parent.charges,
  },
};
