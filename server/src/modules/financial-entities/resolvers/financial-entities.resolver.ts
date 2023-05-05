// import { FinancialAccountsProvider } from '@modules/financial-accounts/providers/financial-accounts.provider.js';
import { DocumentsProvider } from '@modules/documents/providers/documents.provider.js';
import { TransactionsProvider } from '@modules/transactions/providers/transactions.provider.js';
import { FinancialEntitiesProvider } from '../providers/financial-entities.provider.js';
import type { FinancialEntitiesModule } from '../types.js';
import {
  commonDocumentsFields,
  commonFinancialEntityFields,
  commonTransactionFields,
} from './common.js';
import { ledgerCounterparty } from './ledger-counterparty.resolver.js';

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
    governmentId: DbBusiness => DbBusiness.vat_number ?? '', // TODO: lots missing. should it stay mandatory?
    name: DbBusiness => DbBusiness.name,
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
  BeneficiaryCounterparty: {
    // TODO: improve counterparty handle
    __isTypeOf: () => true,
    counterparty: parent => parent.counterpartyID,
    percentage: parent => parent.percentage,
  },
  Charge: {
    counterparty: async (DbCharge, _, { injector }) => {
      const counterpartyIDs = new Set<string>();
      const documents = await injector
        .get(DocumentsProvider)
        .getDocumentsByChargeIdLoader.load(DbCharge.id);
      const transactions = await injector
        .get(TransactionsProvider)
        .getTransactionsByChargeIDLoader.load(DbCharge.id);
      documents.map(d => {
        if (d.creditor_id && d.creditor_id !== DbCharge.owner_id)
          counterpartyIDs.add(d.creditor_id);
        if (d.debtor_id && d.debtor_id !== DbCharge.owner_id) counterpartyIDs.add(d.debtor_id);
      });
      transactions.map(t => {
        if (t.business_id) counterpartyIDs.add(t.business_id);
      });

      if (counterpartyIDs.size > 1) {
        return null;
      }
      if (counterpartyIDs.size === 1) {
        const [id] = counterpartyIDs;
        return id;
      }
      return null;
    },
    beneficiaries: () => [],
    // async (DbCharge, _, { injector }) => {
    //   // TODO: update to better implementation after DB is updated
    //   try {
    //     if (DbCharge.financial_accounts_to_balance) {
    //       return JSON.parse(DbCharge.financial_accounts_to_balance);
    //     }
    //   } catch {
    //     null;
    //   }
    //   switch (DbCharge.financial_accounts_to_balance) {
    //     case 'no':
    //       return [
    //         {
    //           counterpartyID: '7843b805-3bb7-4d1c-9219-ff783100334b',
    //           percentage: 0.5,
    //         },
    //         {
    //           counterpartyID: 'ca9d301f-f6db-40a8-a02e-7cf4b63fa2df',
    //           percentage: 0.5,
    //         },
    //       ];
    //     case 'uri':
    //       return [
    //         {
    //           counterpartyID: '7843b805-3bb7-4d1c-9219-ff783100334b',
    //           percentage: 1,
    //         },
    //       ];
    //     case 'dotan':
    //       return [
    //         {
    //           counterpartyID: 'ca9d301f-f6db-40a8-a02e-7cf4b63fa2df',
    //           percentage: 1,
    //         },
    //       ];
    //     default:
    //       {
    //         // case Guild account
    //         const guildAccounts = await injector
    //           .get(FinancialAccountsProvider)
    //           .getFinancialAccountsByFinancialEntityIdLoader.load(
    //             '6a20aa69-57ff-446e-8d6a-1e96d095e988',
    //           );
    //         const guildAccountsNumbers = guildAccounts.map(a => a.account_number);
    //         if (guildAccountsNumbers.includes(DbCharge.account_number)) {
    //           return [
    //             {
    //               counterpartyID: '7843b805-3bb7-4d1c-9219-ff783100334b',
    //               percentage: 0.5,
    //             },
    //             {
    //               counterpartyID: 'ca9d301f-f6db-40a8-a02e-7cf4b63fa2df',
    //               percentage: 0.5,
    //             },
    //           ];
    //         }

    //         // case UriLTD account
    //         const uriAccounts = await injector
    //           .get(FinancialAccountsProvider)
    //           .getFinancialAccountsByFinancialEntityIdLoader.load(
    //             'a1f66c23-cea3-48a8-9a4b-0b4a0422851a',
    //           );
    //         const uriAccountsNumbers = uriAccounts.map(a => a.account_number);
    //         if (uriAccountsNumbers.includes(DbCharge.account_number)) {
    //           return [
    //             {
    //               counterpartyID: '7843b805-3bb7-4d1c-9219-ff783100334b',
    //               percentage: 1,
    //             },
    //           ];
    //         }
    //       }
    //       return [];
    //   }
    // },
    owner: (DbCharge, _, { injector }) =>
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
  WireTransaction: {
    ...commonTransactionFields,
  },
  FeeTransaction: {
    ...commonTransactionFields,
  },
  ConversionTransaction: {
    ...commonTransactionFields,
  },
  CommonTransaction: {
    ...commonTransactionFields,
  },
  LedgerRecord: {
    creditAccount1: (DbLedgerRecord, _, context, info) =>
      ledgerCounterparty(DbLedgerRecord, { account: 'CreditAccount1' }, context, info),
    creditAccount2: (DbLedgerRecord, _, context, info) =>
      DbLedgerRecord.creditAccountID2
        ? ledgerCounterparty(DbLedgerRecord, { account: 'CreditAccount2' }, context, info)
        : null,
    debitAccount1: (DbLedgerRecord, _, context, info) =>
      ledgerCounterparty(DbLedgerRecord, { account: 'DebitAccount1' }, context, info),
    debitAccount2: (DbLedgerRecord, _, context, info) =>
      DbLedgerRecord.debitAccountID2
        ? ledgerCounterparty(DbLedgerRecord, { account: 'DebitAccount2' }, context, info)
        : null,
  },
  Invoice: {
    ...commonDocumentsFields,
  },
  InvoiceReceipt: {
    ...commonDocumentsFields,
  },
  Proforma: {
    ...commonDocumentsFields,
  },
  Unprocessed: {
    ...commonDocumentsFields,
  },
  Receipt: {
    ...commonDocumentsFields,
  },
};
