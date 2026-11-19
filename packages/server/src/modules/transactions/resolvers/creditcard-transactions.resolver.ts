import { GraphQLError } from 'graphql';
import type { Injector } from 'graphql-modules';
import type { Resolvers } from '../../../__generated__/types.js';
import type { Currency } from '../../../shared/enums.js';
import { formatFinancialAmount } from '../../../shared/helpers/index.js';
import { degradeChargesAccountantApproval } from '../../accountant-approval/helpers/degrade-charges.helper.js';
import { AdminContextProvider } from '../../admin-context/providers/admin-context.provider.js';
import { forgetDerivedChargeType } from '../../charges/helpers/charge-type.js';
import { forgetChargeValidation } from '../../charges/helpers/validate.helper.js';
import { ChargesProvider } from '../../charges/providers/charges.provider.js';
import { FinancialAccountsProvider } from '../../financial-accounts/providers/financial-accounts.provider.js';
import { FinancialCreditCardAccountsProvider } from '../../financial-accounts/providers/financial-credit-card-accounts.provider.js';
import {
  statementKeyId,
  type StatementKey,
} from '../helpers/creditcard-statement-matcher.helper.js';
import { CreditCardStatementsProvider } from '../providers/creditcard-statements.provider.js';
import { CreditCardTransactionsProvider } from '../providers/creditcard-transactions.provider.js';
import type { TransactionsModule } from '../types.js';

type StatementKeyInput = {
  cardAccountId: string;
  currency: Currency;
  debitDate: StatementKey['debitDate'];
};

/**
 * Loads the bank transaction and the card accounts of a link mutation and checks they belong to
 * the current owner. Returns the bank transaction's charge id.
 *
 * With `sameCurrency`, also checks every statement is in the bank transaction's currency: a debit
 * settles statements in its own currency, and the ledger books it so. Unlinking skips that check,
 * so a link stored in another currency can still be removed.
 */
async function validateLinkTarget(
  injector: Injector,
  ownerId: string,
  bankTransactionId: string,
  statements: readonly StatementKeyInput[],
  { sameCurrency = true }: { sameCurrency?: boolean } = {},
): Promise<string> {
  const statementsProvider = injector.get(CreditCardStatementsProvider);
  const bankTransaction =
    await statementsProvider.getBankTransactionByIdLoader.load(bankTransactionId);
  if (!bankTransaction || bankTransaction.owner_id !== ownerId) {
    throw new GraphQLError(`Bank transaction ID="${bankTransactionId}" not found`);
  }
  if (bankTransaction.account_type === 'CREDIT_CARD') {
    throw new GraphQLError('A credit card transaction cannot settle a card statement');
  }
  if (bankTransaction.is_fee) {
    throw new GraphQLError('A fee transaction cannot settle a card statement');
  }
  if (sameCurrency) {
    const otherCurrency = statements.find(
      statement => statement.currency !== bankTransaction.currency,
    );
    if (otherCurrency) {
      throw new GraphQLError(
        `A bank transaction in ${bankTransaction.currency} cannot settle a card statement in ${otherCurrency.currency}`,
      );
    }
  }

  const cardAccountIds = Array.from(new Set(statements.map(s => s.cardAccountId)));
  const accounts = await injector
    .get(FinancialCreditCardAccountsProvider)
    .getFinancialAccountsOwnership(cardAccountIds);
  for (const cardAccountId of cardAccountIds) {
    const account = accounts.find(a => a.id === cardAccountId);
    if (!account || account.owner_id !== ownerId) {
      throw new GraphQLError(`Card account ID="${cardAccountId}" not found`);
    }
    if (account.type !== 'CREDIT_CARD') {
      throw new GraphQLError(`Account ID="${cardAccountId}" is not a credit card account`);
    }
  }
  return bankTransaction.charge_id;
}

/** Re-flags the charge for accountant review and returns its fresh state. */
async function freshCharge(injector: Injector, chargeId: string) {
  injector.get(CreditCardTransactionsProvider).clearCache();
  // links drive the charge type (and so its validation): derive them again for the response
  forgetDerivedChargeType(injector, chargeId);
  forgetChargeValidation(injector, chargeId);
  const degraded = await degradeChargesAccountantApproval(injector, [chargeId]);
  const charge =
    degraded.get(chargeId) ??
    (await injector.get(ChargesProvider).getChargeByIdLoader.load(chargeId));
  if (!charge) {
    throw new GraphQLError(`Charge ID="${chargeId}" not found`);
  }
  return charge;
}

function commonError(error: unknown, fallback: string) {
  if (!(error instanceof GraphQLError)) {
    console.error(fallback, error);
  }
  return {
    __typename: 'CommonError' as const,
    message: error instanceof GraphQLError ? error.message : fallback,
  };
}

export const CreditCardTransactionsResolvers: TransactionsModule.Resolvers &
  Pick<Resolvers, 'CreditCardStatementLinkResult'> = {
  Mutation: {
    linkCreditCardStatements: async (_, { bankTransactionId, statements }, { injector }) => {
      try {
        if (statements.length === 0) {
          throw new GraphQLError('No statements to link');
        }
        const { ownerId } = await injector.get(AdminContextProvider).getVerifiedAdminContext();
        const chargeId = await validateLinkTarget(injector, ownerId, bankTransactionId, statements);

        const statementsProvider = injector.get(CreditCardStatementsProvider);
        const existing = await statementsProvider.getLinksByStatementKeys(ownerId, statements);
        const takenElsewhere = existing.filter(
          link => link.bank_transaction_id !== bankTransactionId,
        );
        if (takenElsewhere.length > 0) {
          throw new GraphQLError(
            `Credit card statement already linked to another bank transaction: ${takenElsewhere
              .map(link => `${link.currency} ${link.debit_date}`)
              .join(', ')}`,
          );
        }
        const alreadyLinked = new Set(
          existing.map(link =>
            statementKeyId({
              cardAccountId: link.card_account_id,
              currency: link.currency,
              debitDate: link.debit_date,
            }),
          ),
        );
        const uniqueStatements = Array.from(
          new Map(statements.map(statement => [statementKeyId(statement), statement])).values(),
        );
        // also forgets any earlier unlink of these statements from this bank transaction
        await statementsProvider.linkStatementsManually({
          ownerId,
          bankTransactionId,
          statements: uniqueStatements.filter(
            statement => !alreadyLinked.has(statementKeyId(statement)),
          ),
          relinked: uniqueStatements,
        });

        return { charge: await freshCharge(injector, chargeId) };
      } catch (error) {
        return commonError(error, 'Failed to link credit card statements');
      }
    },
    dismissCreditCardStatements: async (_, { bankTransactionId, statements }, { injector }) => {
      try {
        if (statements.length === 0) {
          throw new GraphQLError('No statements to dismiss');
        }
        const { ownerId } = await injector.get(AdminContextProvider).getVerifiedAdminContext();
        const chargeId = await validateLinkTarget(injector, ownerId, bankTransactionId, statements);

        const statementsProvider = injector.get(CreditCardStatementsProvider);
        const linkedHere = (
          await statementsProvider.getLinksByStatementKeys(ownerId, statements)
        ).filter(link => link.bank_transaction_id === bankTransactionId);
        if (linkedHere.length > 0) {
          throw new GraphQLError(
            'The statement is linked to this bank transaction: unlink it instead of dismissing it',
          );
        }
        await statementsProvider.rejectStatements({ ownerId, bankTransactionId, statements });

        return { charge: await freshCharge(injector, chargeId) };
      } catch (error) {
        return commonError(error, 'Failed to dismiss credit card statements');
      }
    },
    unlinkCreditCardStatement: async (_, { bankTransactionId, statement }, { injector }) => {
      try {
        const { ownerId } = await injector.get(AdminContextProvider).getVerifiedAdminContext();
        const chargeId = await validateLinkTarget(
          injector,
          ownerId,
          bankTransactionId,
          [statement],
          { sameCurrency: false },
        );
        // also records the rejection, so it is not proposed again for this bank transaction
        const deleted = await injector.get(CreditCardStatementsProvider).unlinkStatement({
          ...statement,
          ownerId,
          bankTransactionId,
        });
        if (deleted.length === 0) {
          throw new GraphQLError('The statement is not linked to this bank transaction');
        }

        return { charge: await freshCharge(injector, chargeId) };
      } catch (error) {
        return commonError(error, 'Failed to unlink credit card statement');
      }
    },
  },
  CreditCardStatementLinkResult: {
    __resolveType: obj => {
      if ('__typename' in obj && obj.__typename === 'CommonError') {
        return 'CommonError';
      }
      return 'CreditCardStatementLinkSuccessfulResult';
    },
  },
  CreditcardBankCharge: {
    creditCardTransactions: async (dbCharge, _, { injector }) =>
      injector
        .get(CreditCardTransactionsProvider)
        .getCreditCardTransactionIdsByChargeId(dbCharge.id),
    validCreditCardAmount: async (dbCharge, _, { injector }) => {
      try {
        return await injector
          .get(CreditCardTransactionsProvider)
          .isCreditCardAmountValid(dbCharge.id);
      } catch (error) {
        console.error(error);
        return false;
      }
    },
    creditCardStatements: async (dbCharge, _, { injector }) => {
      const perBank = await injector
        .get(CreditCardTransactionsProvider)
        .getStatementsByChargeIdLoader.load(dbCharge.id);
      return perBank.flatMap(({ statements }) => statements);
    },
    creditCardStatementSuggestions: async (dbCharge, _, { injector }) => {
      const perBank = await injector
        .get(CreditCardTransactionsProvider)
        .getStatementsByChargeIdLoader.load(dbCharge.id);
      // unlinked debits (even without candidates, so the panel can say so), and debits whose
      // shown statements may be wrong or incomplete
      return perBank
        .filter(({ statements, suggestions }) => statements.length === 0 || suggestions.length > 0)
        .map(({ bankTransaction, suggestions }) => ({
          bankTransactionId: bankTransaction.id,
          suggestions,
        }));
    },
  },
  CreditCardStatement: {
    id: statement => statementKeyId(statement),
    cardAccount: async (statement, _, { injector }) => {
      const account = await injector
        .get(FinancialAccountsProvider)
        .getFinancialAccountByAccountIDLoader.load(statement.cardAccountId);
      if (!account) {
        throw new GraphQLError(`Card account ID="${statement.cardAccountId}" not found`);
      }
      return account;
    },
    currency: statement => statement.currency as Currency,
    debitDate: statement => statement.debitDate,
    total: async (statement, _, { injector }) => {
      const cents = await injector
        .get(CreditCardTransactionsProvider)
        .getStatementTotalCents(statement);
      return formatFinancialAmount(cents / 100, statement.currency);
    },
    transactions: async (statement, _, { injector }) => {
      const rows = await injector
        .get(CreditCardStatementsProvider)
        .getCardTransactionsByStatementKeyLoader.load(statementKeyId(statement));
      return rows.map(row => row.id);
    },
    bankTransaction: statement => statement.bankTransactionId,
    linkMethod: statement => statement.linkMethod,
    confirmed: statement => statement.confirmed,
  },
  CreditCardStatementSuggestion: {
    statements: suggestion => suggestion.statements,
    reason: suggestion => suggestion.reason,
    previouslyRejected: suggestion => suggestion.previouslyRejected,
  },
  CreditCardStatementSuggestions: {
    bankTransaction: suggestions => suggestions.bankTransactionId,
    suggestions: suggestions => suggestions.suggestions,
  },
};
