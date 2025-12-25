import DataLoader from 'dataloader';
import { Injectable, Scope } from 'graphql-modules';
import { sql } from '@pgtyped/runtime';
import { dateToTimelessDateString } from '../../../shared/helpers/index.js';
import { DBProvider } from '../../app-providers/db.provider.js';
import { identifyInterestTransactionIds } from '../../ledger/helpers/bank-deposit-ledger-generation.helper.js';
import { TransactionsProvider } from '../../transactions/providers/transactions.provider.js';
import type {
  IGetAllDepositsWithTransactionsQuery,
  IGetDepositTransactionsByChargeIdQuery,
  IGetTransactionsByBankDepositsQuery,
  IInsertOrUpdateBankDepositChargeParams,
  IInsertOrUpdateBankDepositChargeQuery,
} from '../types.js';

const getTransactionsByBankDeposits = sql<IGetTransactionsByBankDepositsQuery>`
    SELECT 
      cbd.deposit_id,
      cbd.account_id as deposit_account_id,
      t.*
    FROM accounter_schema.charges_bank_deposits cbd
    LEFT JOIN accounter_schema.transactions t
      ON cbd.id = t.charge_id
    WHERE deposit_id IN $$depositIds;`;

const getDepositTransactionsByChargeId = sql<IGetDepositTransactionsByChargeIdQuery>`
    SELECT
      cbd.deposit_id,
      cbd.account_id as deposit_account_id,
      t.*
    FROM accounter_schema.charges_bank_deposits cbd
    LEFT JOIN accounter_schema.transactions t
      ON cbd.id = t.charge_id
    WHERE deposit_id IN (
      SELECT deposit_id
      FROM accounter_schema.charges_bank_deposits
      LEFT JOIN accounter_schema.transactions
        ON cbd.id = t.charge_id
      WHERE charge_id = $chargeId
    )
    AND ($includeCharge OR charge_id <> $chargeId);`;

const insertOrUpdateBankDepositCharge = sql<IInsertOrUpdateBankDepositChargeQuery>`
  INSERT INTO accounter_schema.charges_bank_deposits (id, deposit_id, account_id)
  VALUES ($chargeId, $depositId, $accountId)
  ON CONFLICT (id) DO UPDATE SET deposit_id = EXCLUDED.deposit_id, account_id = EXCLUDED.account_id;
`;

const getAllDepositsWithTransactions = sql<IGetAllDepositsWithTransactionsQuery>`
    SELECT 
      cbd.deposit_id,
      t.id,
      t.currency,
      t.debit_date,
      t.event_date,
      t.amount,
      t.current_balance,
      t.charge_id
    FROM accounter_schema.charges_bank_deposits cbd
    LEFT JOIN accounter_schema.transactions t
        ON cbd.id = t.charge_id
    WHERE cbd.deposit_id IS NOT NULL
    ORDER BY cbd.deposit_id, COALESCE(t.debit_date, t.event_date);`;

@Injectable({
  scope: Scope.Singleton,
  global: true,
})
export class BankDepositChargesProvider {
  constructor(
    private dbProvider: DBProvider,
    private transactionsProvider: TransactionsProvider,
  ) {}

  private async batchTransactionsByBankDeposits(depositIds: readonly string[]) {
    const transactions = await getTransactionsByBankDeposits.run(
      {
        depositIds,
      },
      this.dbProvider,
    );
    return depositIds.map(id => transactions.filter(t => t.deposit_id === id));
  }

  public getTransactionsByBankDepositLoader = new DataLoader(
    (keys: readonly string[]) => this.batchTransactionsByBankDeposits(keys),
    { cache: false },
  );

  public getDepositTransactionsByChargeId(chargeId: string, includeCharge = false) {
    return getDepositTransactionsByChargeId.run({ chargeId, includeCharge }, this.dbProvider);
  }

  public insertOrUpdateBankDepositCharge(params: IInsertOrUpdateBankDepositChargeParams) {
    return insertOrUpdateBankDepositCharge.run(params, this.dbProvider);
  }

  public async getAllDepositsWithMetadata() {
    const rows = await getAllDepositsWithTransactions.run(undefined, this.dbProvider);

    // Group transactions by deposit_id
    const depositMap = new Map<
      string,
      {
        id: string;
        currency: string | null;
        openDate: Date | null;
        closeDate: Date | null;
        currentBalance: number;
        totalInterest: number;
        totalDeposit: number;
        currencyError: string[];
        transactionIds: string[];
      }
    >();

    // Identify interest transactions using shared helper
    const interestTransactionIds = identifyInterestTransactionIds(rows, {
      getId: r => r.id,
      getChargeId: r => r.charge_id,
      getAmount: r => Number(r.amount ?? 0),
    });

    for (const row of rows) {
      if (!row.deposit_id) continue;

      if (!depositMap.has(row.deposit_id)) {
        depositMap.set(row.deposit_id, {
          id: row.deposit_id,
          currency: row.currency,
          openDate: row.debit_date ?? row.event_date,
          closeDate: null,
          currentBalance: 0,
          totalInterest: 0,
          totalDeposit: 0,
          currencyError: [],
          transactionIds: [],
        });
      }

      const deposit = depositMap.get(row.deposit_id)!;
      deposit.transactionIds.push(row.id);

      // Validate single currency
      if (deposit.currency && row.currency && deposit.currency !== row.currency) {
        const alreadyInErrors = deposit.currencyError.includes(row.id);
        if (!alreadyInErrors) {
          deposit.currencyError.push(row.id);
        }
      }

      // Update openDate (earliest transaction)
      const txDate = row.debit_date ?? row.event_date;
      if (!deposit.openDate || (txDate && txDate < deposit.openDate)) {
        deposit.openDate = txDate;
      }

      // Track balance and interest separately
      if (row.amount) {
        const amount = Number(row.amount);
        if (interestTransactionIds.has(row.id)) {
          deposit.totalInterest += amount;
        } else {
          deposit.currentBalance += amount;
          if (amount > 0) {
            deposit.totalDeposit += amount;
          }
        }
      }

      // If balance reaches zero, update closeDate (interest doesn't affect closure)
      if (Math.abs(deposit.currentBalance) < 0.005 && txDate) {
        deposit.closeDate = txDate;
      }
    }

    // Ensure closeDate reflects final state: if not closed, closeDate must be null
    for (const d of depositMap.values()) {
      if (Math.abs(d.currentBalance) >= 0.005) {
        d.closeDate = null;
      }
    }

    return Array.from(depositMap.values()).map(deposit => ({
      id: deposit.id,
      currency: deposit.currency,
      openDate: deposit.openDate ? dateToTimelessDateString(deposit.openDate) : null,
      closeDate: deposit.closeDate ? dateToTimelessDateString(deposit.closeDate) : null,
      currentBalance: deposit.currentBalance,
      totalInterest: deposit.totalInterest,
      totalDeposit: deposit.totalDeposit,
      currencyError: deposit.currencyError,
      transactionIds: deposit.transactionIds,
    }));
  }

  public async createDeposit(currency: string) {
    // Generate unique deposit ID using timestamp and random suffix
    const depositId = `${currency}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    return {
      id: depositId,
      currency,
      openDate: null,
      closeDate: null,
      currentBalance: 0,
      totalInterest: 0,
      currencyError: [],
      transactionIds: [],
    };
  }

  public async assignChargeToDeposit(chargeId: string, depositId: string) {
    const [depositTransactions, transactions] = await Promise.all([
      // Get target deposit transactions to validate currency
      this.getTransactionsByBankDepositLoader.load(depositId),
      this.transactionsProvider.transactionsByChargeIDLoader.load(chargeId),
    ]);

    // Check currency conflict
    if (depositTransactions.length > 0) {
      const depositCurrency = depositTransactions[0].currency;
      const depositAccountId = depositTransactions[0].deposit_account_id;
      for (const transaction of transactions) {
        const transactionCurrency = transaction.currency;
        if (depositCurrency && transactionCurrency !== depositCurrency) {
          throw new Error(
            `Currency conflict: Transaction currency (${transactionCurrency}) does not match deposit currency (${depositCurrency})`,
          );
        }
        if (depositAccountId !== transaction.account_id) {
          throw new Error(
            `Account conflict: Transaction account (${transaction.account_id}) does not match deposit account (${depositAccountId})`,
          );
        }
      }
    }

    await this.insertOrUpdateBankDepositCharge({ chargeId, depositId });

    // Return updated deposit metadata
    const allDeposits = await this.getAllDepositsWithMetadata();
    const updatedDeposit = allDeposits.find(d => d.id === depositId);

    if (!updatedDeposit) {
      throw new Error('Deposit not found after assignment');
    }

    return updatedDeposit;
  }
}
