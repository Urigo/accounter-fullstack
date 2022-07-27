import { formatFinancialAmount } from '../../../helpers/amount.mjs';
import { effectiveDateSuplement } from '../../../helpers/misc.mjs';
import { FinancialAccountsProvider } from '../../financial-accounts/providers/financial-accounts.providers.mjs';
import { IUpdateChargeParams } from '../generated-types/charges.provider.types.mjs';
import { ChargesModule } from '../generated-types/graphql';
import { ChargesProvider } from '../providers/charges.provider.mjs';

const commonTransactionFields:
  | ChargesModule.ConversionTransactionResolvers
  | ChargesModule.FeeTransactionResolvers
  | ChargesModule.WireTransactionResolvers
  | ChargesModule.CommonTransactionResolvers = {
  id: DbTransaction => DbTransaction.id,
  referenceNumber: DbTransaction => DbTransaction.bank_reference ?? 'Missing',
  createdAt: DbTransaction => DbTransaction.event_date,
  effectiveDate: DbTransaction => effectiveDateSuplement(DbTransaction),
  direction: DbTransaction => (parseFloat(DbTransaction.event_amount) > 0 ? 'CREDIT' : 'DEBIT'),
  amount: DbTransaction => formatFinancialAmount(DbTransaction.event_amount, DbTransaction.currency_code),
  description: DbTransaction => `${DbTransaction.bank_description} ${DbTransaction.detailed_bank_description}`,
  userNote: DbTransaction => DbTransaction.user_description,
  account: async (DbTransaction, _, { injector }) => {
    // TODO: enhance logic to be based on ID instead of account_number
    if (!DbTransaction.account_number) {
      throw new Error(`Transaction ID="${DbTransaction.id}" is missing account_number`);
    }
    const account = await injector
      .get(FinancialAccountsProvider)
      .getFinancialAccountByAccountNumberLoader.load(DbTransaction.account_number);
    if (!account) {
      throw new Error(`Transaction ID="${DbTransaction.id}" is missing account_number`);
    }
    return account;
  },
  balance: DbTransaction => formatFinancialAmount(DbTransaction.current_balance),
};

const commonFinancialAccountFields:
  | ChargesModule.CardFinancialAccountResolvers
  | ChargesModule.BankFinancialAccountResolvers = {
  charges: async (DbAccount, { filter }, { injector }) => {
    if (!filter || Object.keys(filter).length === 0) {
      const charges = await injector
        .get(ChargesProvider)
        .getChargeByFinancialAccountNumberLoader.load(DbAccount.account_number);
      return charges;
    }
    const charges = await injector.get(ChargesProvider).getChargesByFinancialAccountNumbersWithFilters({
      financialAccountNumbers: [DbAccount.account_number],
      fromDate: filter?.fromDate,
      toDate: filter?.toDate,
    });
    return charges;
  },
};

const commonFinancialEntityFields:
  | ChargesModule.LtdFinancialEntityResolvers
  | ChargesModule.PersonalFinancialEntityResolvers = {
  charges: async (DbBusiness, { filter }, { injector }) => {
    if (!filter || Object.keys(filter).length === 0) {
      const charges = await injector.get(ChargesProvider).getChargeByFinancialEntityIdLoader.load(DbBusiness.id);
      return charges;
    }
    const charges = await injector.get(ChargesProvider).getChargesByFinancialEntityIdsWithFilters({
      financialEntityIds: [DbBusiness.id],
      fromDate: filter?.fromDate,
      toDate: filter?.toDate,
    });
    return charges;
  },
};

export const resolvers: ChargesModule.Resolvers = {
  Query: {
    chargeById: async (_, { id }, { injector }) => {
      const dbCharge = await injector.get(ChargesProvider).getChargeByIdLoader.load(id);
      if (!dbCharge) {
        throw new Error(`Charge ID="${id}" not found`);
      }
      return dbCharge;
    },
  },
  Mutation: {
    updateCharge: async (_, { chargeId, fields }, { injector }) => {
      const financialAccountsToBalance = fields.beneficiaries
        ? JSON.stringify(fields.beneficiaries.map(b => ({ name: b.counterparty.name, percentage: b.percentage })))
        : null;
      const adjustedFields: IUpdateChargeParams = {
        accountNumber: null,
        accountType: null,
        bankDescription: null,
        bankReference: null,
        businessTrip: null,
        contraCurrencyCode: null,
        currencyCode: fields.totalAmount?.currency ?? null,
        currencyRate: null,
        currentBalance: null,
        debitDate: null,
        detailedBankDescription: null,
        eventAmount: fields.totalAmount?.raw?.toFixed(2) ?? null,
        eventDate: null,
        eventNumber: null,
        financialAccountsToBalance,
        financialEntity: fields.counterparty?.name,
        hashavshevetId: null,
        interest: null,
        isConversion: null,
        isProperty: fields.isProperty,
        links: null,
        originalId: null,
        personalCategory: fields.tags ? JSON.stringify(fields.tags) : null,
        proformaInvoiceFile: null,
        receiptDate: null,
        receiptImage: null,
        receiptNumber: null,
        receiptUrl: null,
        reviewed: fields.accountantApproval?.approved,
        taxCategory: null,
        taxInvoiceAmount: null,
        taxInvoiceCurrency: null,
        taxInvoiceDate: null,
        taxInvoiceFile: null,
        taxInvoiceNumber: null,
        userDescription: null,
        vat: fields.vat ?? null,
        withholdingTax: fields.withholdingTax ?? null,
        chargeId,
      };
      try {
        injector.get(ChargesProvider).getChargeByIdLoader.clear(chargeId);
        const res = await injector.get(ChargesProvider).updateCharge({ ...adjustedFields });
        return {
          __typename: 'Charge',
          ...res[0],
        };
      } catch (e) {
        return {
          __typename: 'CommonError',
          message:
            (e as Error)?.message ??
            (e as { errors: Error[] })?.errors.map(e => e.message).toString() ??
            'Unknown error',
        };
      }
    },
    updateTransaction: async (_, { transactionId, fields }, { injector }) => {
      const adjustedFields: IUpdateChargeParams = {
        accountNumber: null,
        accountType: null,
        bankDescription: null,
        bankReference: fields.referenceNumber,
        businessTrip: null,
        contraCurrencyCode: null,
        currencyCode: null,
        currencyRate: null,
        // TODO: implement not-Ils logic. currently if vatCurrency is set and not to Ils, ignoring the update
        currentBalance:
          fields.balance?.currency && fields.balance.currency !== 'ILS' ? null : fields.balance?.raw?.toFixed(2),
        debitDate: fields.effectiveDate,
        detailedBankDescription: null,
        // TODO: implement not-Ils logic. currently if vatCurrency is set and not to Ils, ignoring the update
        eventAmount:
          fields.amount?.currency && fields.amount.currency !== 'ILS' ? null : fields.amount?.raw?.toFixed(2),
        eventDate: null,
        eventNumber: null,
        financialAccountsToBalance: null,
        financialEntity: null,
        hashavshevetId: fields.hashavshevetId,
        interest: null,
        isConversion: null,
        isProperty: null,
        links: null,
        originalId: null,
        personalCategory: null,
        proformaInvoiceFile: null,
        receiptDate: null,
        receiptImage: null,
        receiptNumber: null,
        receiptUrl: null,
        reviewed: fields.accountantApproval?.approved,
        taxCategory: null,
        taxInvoiceAmount: null,
        taxInvoiceCurrency: null,
        taxInvoiceDate: null,
        taxInvoiceFile: null,
        taxInvoiceNumber: null,
        userDescription: fields.userNote,
        vat: null,
        withholdingTax: null,
        chargeId: transactionId,
      };
      try {
        injector.get(ChargesProvider).getChargeByIdLoader.clear(transactionId);
        const res = await injector.get(ChargesProvider).updateCharge({ ...adjustedFields });
        return res[0];
      } catch (e) {
        return {
          __typename: 'CommonError',
          message: (e as Error)?.message ?? 'Unknown error',
        };
      }
    },
  },
  Charge: {
    id: DbCharge => DbCharge.id,
    createdAt: () => null ?? 'There is not Date value', // TODO: missing in DB
    transactions: DbCharge => [DbCharge],
    counterparty: DbCharge => DbCharge.financial_entity,
    description: () => 'Missing', // TODO: implement
    tags: DbCharge => {
      const raw = DbCharge.personal_category;
      if (!raw) {
        return [];
      }
      try {
        return JSON.parse(DbCharge.personal_category!);
      } catch {
        null;
      }
      return [{ name: DbCharge.personal_category }];
    },
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
              .getFinancialAccountsByFinancialEntityIdLoader.load('6a20aa69-57ff-446e-8d6a-1e96d095e988');
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
              .getFinancialAccountsByFinancialEntityIdLoader.load('a1f66c23-cea3-48a8-9a4b-0b4a0422851a');
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
    totalAmount: DbCharge =>
      DbCharge.event_amount != null ? formatFinancialAmount(DbCharge.event_amount, DbCharge.currency_code) : null,
  },
  CommonTransaction: {
    __isTypeOf: () => true,
    ...commonTransactionFields,
  },
  BankFinancialAccount: {
    ...commonFinancialAccountFields,
  },
  CardFinancialAccount: {
    ...commonFinancialAccountFields,
  },
  LtdFinancialEntity: {
    ...commonFinancialEntityFields,
  },
  PersonalFinancialEntity: {
    ...commonFinancialEntityFields,
  },
  NamedCounterparty: {
    __isTypeOf: parent => !!parent,
    name: parent => parent ?? '',
  },
  BeneficiaryCounterparty: {
    // TODO: improve counterparty handle
    __isTypeOf: () => true,
    counterparty: parent => parent.name,
    percentage: parent => parent.percentage,
  },
};
