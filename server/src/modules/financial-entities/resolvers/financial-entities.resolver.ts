import { FinancialAccountsProvider } from '@modules/financial-accounts/providers/financial-accounts.provider.js';
import { FinancialEntitiesProvider } from '../providers/financial-entities.provider.js';
import type { FinancialEntitiesModule } from '../types.js';
import { commonFinancialEntityFields } from './common.js';

export const financialEntitiesResolvers: FinancialEntitiesModule.Resolvers = {
  Query: {
    financialEntity: async (_, { id }, { injector }) => {
      const dbFe = await injector
        .get(FinancialEntitiesProvider)
        .getFinancialEntityByIdLoader.load(id);
      if (!dbFe) {
        throw new Error(`Financial entity ID="${id}" not found`);
      }
      return dbFe;
    },
    allFinancialEntities: async (_, __, { injector }) => {
      return injector.get(FinancialEntitiesProvider).getAllFinancialEntities();
    },
  },
  LtdFinancialEntity: {
    __isTypeOf: () => true,
    ...commonFinancialEntityFields,
    govermentId: DbBusiness => DbBusiness.vat_number ?? '', // TODO: lots missing. should it stay mandatory?
    name: DbBusiness => DbBusiness.hebrew_name ?? DbBusiness.name,
    address: DbBusiness => DbBusiness.address ?? DbBusiness.address_hebrew ?? '', // TODO: lots missing. should it stay mandatory?

    englishName: DbBusiness => DbBusiness.name,
    email: DbBusiness => DbBusiness.email,
    website: DbBusiness => DbBusiness.website,
    phoneNumber: DbBusiness => DbBusiness.phone_number,
  },
  PersonalFinancialEntity: {
    __isTypeOf: () => false,
    ...commonFinancialEntityFields,
    name: DbBusiness => DbBusiness.name,
    email: DbBusiness => DbBusiness.email ?? '', // TODO: remove alternative ''
  },
  Charge: {
    counterparty: DbCharge => DbCharge.financial_entity,
    beneficiaries: async (DbCharge, _, { injector }) => {
      // TODO: update to better implementation after DB is updated
      try {
        if (DbCharge.financial_accounts_to_balance) {
          return JSON.parse(DbCharge.financial_accounts_to_balance);
        }
      } catch {
        null;
      }
      switch (DbCharge.financial_accounts_to_balance) {
        case 'no':
          return [
            {
              name: 'Uri',
              percentage: 50,
            },
            {
              name: 'Dotan',
              percentage: 50,
            },
          ];
        case 'uri':
          return [
            {
              name: 'Uri',
              percentage: 100,
            },
          ];
        case 'dotan':
          return [
            {
              name: 'dotan',
              percentage: 100,
            },
          ];
        default:
          {
            // case Guild account
            const guildAccounts = await injector
              .get(FinancialAccountsProvider)
              .getFinancialAccountsByFinancialEntityIdLoader.load(
                '6a20aa69-57ff-446e-8d6a-1e96d095e988',
              );
            const guildAccountsNumbers = guildAccounts.map(a => a.account_number);
            if (guildAccountsNumbers.includes(DbCharge.account_number)) {
              return [
                {
                  name: 'Uri',
                  percentage: 50,
                },
                {
                  name: 'Dotan',
                  percentage: 50,
                },
              ];
            }

            // case UriLTD account
            const uriAccounts = await injector
              .get(FinancialAccountsProvider)
              .getFinancialAccountsByFinancialEntityIdLoader.load(
                'a1f66c23-cea3-48a8-9a4b-0b4a0422851a',
              );
            const uriAccountsNumbers = uriAccounts.map(a => a.account_number);
            if (uriAccountsNumbers.includes(DbCharge.account_number)) {
              return [
                {
                  name: 'Uri',
                  percentage: 100,
                },
              ];
            }
          }
          return [];
      }
    },
    financialEntity: (DbCharge, _, { injector }) =>
      injector
        .get(FinancialEntitiesProvider)
        .getFinancialEntityByChargeIdsLoader.load(DbCharge.id)
        .then(res => {
          if (!res) {
            throw new Error(`Unable to find financial entity for charge ${DbCharge.id}`);
          }
          return res;
        }),
  },
  LedgerRecord: {
    creditAccount: DbLedgerRecord => DbLedgerRecord.credit_account_1,
    debitAccount: DbLedgerRecord => DbLedgerRecord.debit_account_1,
  },
};
