import DataLoader from 'dataloader';
import { Injectable, Scope } from 'graphql-modules';
import type { TimelessDateString } from '../../../shared/types/index.js';
import {
  isConfidentMatch,
  matchCreditCardStatements,
  statementKeyId,
  toCents,
  type AutoLinkMethod,
  type CandidateStatement,
  type MatcherBankTransaction,
  type MatchResult,
  type StatementKey,
} from '../helpers/creditcard-statement-matcher.helper.js';
import {
  CreditCardStatementsProvider,
  type BankTransactionRow,
  type CandidateStatementRow,
  type CreditCardStatementLinkMethod,
} from './creditcard-statements.provider.js';

/** A card statement as the charge shows it: persisted, or a confident match not stored yet. */
export type ResolvedCreditCardStatement = StatementKey & {
  /** The bank transaction settling the statement, if any */
  bankTransactionId: string | null;
  linkMethod: CreditCardStatementLinkMethod | null;
  /** True for a persisted link, false for a match computed on read */
  confirmed: boolean;
};

export type CreditCardStatementSuggestionProto = {
  statements: ResolvedCreditCardStatement[];
  reason: string;
};

/** The card statements behind one bank transaction of a charge. */
export type BankTransactionStatements = {
  bankTransaction: BankTransactionRow;
  statements: ResolvedCreditCardStatement[];
  /** Only when nothing is linked or confidently matched */
  suggestions: CreditCardStatementSuggestionProto[];
};

export function toMatcherBankTransaction(row: BankTransactionRow): MatcherBankTransaction {
  return {
    id: row.id,
    accountId: row.account_id,
    amount: row.amount,
    currency: row.currency,
    effectiveDate: row.effective_date as TimelessDateString,
    sourceReference: row.source_reference,
    sourceDescription: row.source_description,
  };
}

export function toCandidateStatement(row: CandidateStatementRow): CandidateStatement | null {
  if (!row.debit_date) {
    return null;
  }
  return {
    cardAccountId: row.card_account_id,
    currency: row.currency,
    debitDate: row.debit_date,
    total: row.total ?? '0',
    transactionsCount: row.transactions_count ?? 0,
    accountNumber: row.account_number,
    accountName: row.account_name,
    settlementAccountId: row.settlement_account_id,
    linkedBankTransactionId: row.linked_bank_transaction_id ?? null,
  };
}

/**
 * Runs the matcher for one bank transaction, read-only: loads its raw hints and candidate
 * statements and decides. Never writes.
 */
export async function matchBankTransaction(
  statementsProvider: CreditCardStatementsProvider,
  bankTransaction: BankTransactionRow,
): Promise<MatchResult> {
  if (!bankTransaction.effective_date) {
    return { suggestions: [] };
  }
  const [hints, candidates] = await Promise.all([
    statementsProvider.getBankCardHintsByTransactionIdLoader.load(bankTransaction.id),
    statementsProvider.getCandidateStatementsByBankTransactionIdLoader.load(bankTransaction.id),
  ]);
  return matchCreditCardStatements(
    toMatcherBankTransaction(bankTransaction),
    hints.map(hint => ({
      transactionId: hint.transaction_id,
      source: hint.source ?? '',
      hint: hint.hint ?? '',
    })),
    candidates.map(toCandidateStatement).filter((c): c is CandidateStatement => !!c),
  );
}

@Injectable({
  scope: Scope.Operation,
  global: true,
})
export class CreditCardTransactionsProvider {
  constructor(private statementsProvider: CreditCardStatementsProvider) {}

  private async resolveBankTransaction(
    bankTransaction: BankTransactionRow,
  ): Promise<BankTransactionStatements> {
    const links = await this.statementsProvider.getLinksByBankTransactionIdLoader.load(
      bankTransaction.id,
    );
    if (links.length > 0) {
      return {
        bankTransaction,
        statements: links.map(link => ({
          cardAccountId: link.card_account_id,
          currency: link.currency,
          debitDate: link.debit_date,
          bankTransactionId: link.bank_transaction_id,
          linkMethod: link.link_method,
          confirmed: true,
        })),
        suggestions: [],
      };
    }

    const result = await matchBankTransaction(this.statementsProvider, bankTransaction);
    if (isConfidentMatch(result)) {
      const method: AutoLinkMethod = result.method;
      return {
        bankTransaction,
        statements: result.links.map(key => ({
          ...key,
          bankTransactionId: bankTransaction.id,
          linkMethod: method,
          confirmed: false,
        })),
        suggestions: [],
      };
    }
    return {
      bankTransaction,
      statements: [],
      suggestions: result.suggestions.map(suggestion => ({
        reason: suggestion.reason,
        statements: suggestion.statements.map(statement => ({
          cardAccountId: statement.cardAccountId,
          currency: statement.currency,
          debitDate: statement.debitDate,
          bankTransactionId: null,
          linkMethod: null,
          confirmed: false,
        })),
      })),
    };
  }

  private async batchStatementsByChargeIds(chargeIds: readonly string[]) {
    const bankTransactionsByCharge = await Promise.all(
      chargeIds.map(id => this.statementsProvider.getBankTransactionsByChargeIdLoader.load(id)),
    );
    return Promise.all(
      bankTransactionsByCharge.map(bankTransactions =>
        Promise.all(bankTransactions.map(row => this.resolveBankTransaction(row))),
      ),
    );
  }

  /** Per charge: each bank transaction with its card statements (or suggestions) */
  public getStatementsByChargeIdLoader = new DataLoader((chargeIds: readonly string[]) =>
    this.batchStatementsByChargeIds(chargeIds),
  );

  /** Call after a link change, so the same operation reads the new state */
  public clearCache() {
    this.getStatementsByChargeIdLoader.clearAll();
    this.statementsProvider.clearCache();
  }

  /** The card transactions behind a charge's bank debits, flattened. */
  public async getCreditCardTransactionIdsByChargeId(chargeId: string): Promise<string[]> {
    const perBank = await this.getStatementsByChargeIdLoader.load(chargeId);
    const keys = perBank.flatMap(({ statements }) => statements.map(statementKeyId));
    const transactions = await this.statementsProvider.getCardTransactionsByStatementKeyLoader
      .loadMany(Array.from(new Set(keys)))
      .then(res => res.flatMap(rows => (rows instanceof Error ? [] : rows)));
    return Array.from(new Set(transactions.map(transaction => transaction.id)));
  }

  /** Sum of a statement's card transactions, in cents */
  public async getStatementTotalCents(key: StatementKey): Promise<number> {
    const rows = await this.statementsProvider.getCardTransactionsByStatementKeyLoader.load(
      statementKeyId(key),
    );
    return rows.reduce((sum, row) => sum + toCents(row.amount), 0);
  }

  /**
   * True when every bank debit of the charge settles at least one statement (persisted or
   * confidently matched) and the statements add up to the debit.
   */
  public async isCreditCardAmountValid(chargeId: string): Promise<boolean> {
    const perBank = await this.getStatementsByChargeIdLoader.load(chargeId);
    const debits = perBank.filter(({ bankTransaction }) => toCents(bankTransaction.amount) < 0);
    const toValidate = debits.length > 0 ? debits : perBank;
    if (toValidate.length === 0) {
      return false;
    }
    const validations = await Promise.all(
      toValidate.map(async ({ bankTransaction, statements }) => {
        if (statements.length === 0) {
          return false;
        }
        const totals = await Promise.all(statements.map(key => this.getStatementTotalCents(key)));
        return totals.reduce((sum, total) => sum + total, 0) === toCents(bankTransaction.amount);
      }),
    );
    return validations.every(Boolean);
  }
}

/** Suggestions for one bank transaction that has no linked or matched statement */
export type CreditCardStatementSuggestionsProto = {
  bankTransactionId: string;
  suggestions: CreditCardStatementSuggestionProto[];
};
