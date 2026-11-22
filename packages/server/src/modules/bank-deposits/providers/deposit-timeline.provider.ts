import DataLoader from 'dataloader';
import { Injectable, Scope } from 'graphql-modules';
import type { Currency } from '../../../shared/enums.js';
import type { TimelessDateString } from '../../../shared/types/index.js';
import { AdminContextProvider } from '../../admin-context/providers/admin-context.provider.js';
import { ExchangeProvider } from '../../exchange-rates/providers/exchange.provider.js';
import { identifyInterestTransactionIds } from '../helpers/bank-deposit-interest.helper.js';
import {
  buildDepositTimeline,
  matchDepositTaxEvents,
  type DepositMovement,
  type DepositTaxEventRow,
  type DepositTimeline,
} from '../helpers/deposit-timeline.helper.js';
import type { IGetTransactionsByBankDepositsResult } from '../types.js';
import { BankDepositChargesProvider } from './bank-deposit-charges.provider.js';
import { BankDepositTaxEventsProvider } from './bank-deposit-tax-events.provider.js';
import { BankDepositsProvider } from './bank-deposits.provider.js';

export type DepositTimelineResult = DepositTimeline & {
  depositId: string;
  currency: string;
  /** Bank tax rows of the deposit's account that matched no deposit event */
  unmatchedTaxEvents: DepositTaxEventRow[];
};

function movementDate(t: IGetTransactionsByBankDepositsResult): TimelessDateString {
  return t.debit_date_override ?? t.debit_date ?? t.event_date;
}

/**
 * Builds each deposit's timeline (see `deposit-timeline.helper.ts`) from its transactions, the
 * exchange rates the ledger uses for them, the bank's deposits tax events of the account it is held
 * in, the booked year-end revaluation checkpoints and the ledger lock.
 */
@Injectable({
  scope: Scope.Operation,
  global: true,
})
export class DepositTimelineProvider {
  constructor(
    private adminContextProvider: AdminContextProvider,
    private bankDepositsProvider: BankDepositsProvider,
    private bankDepositChargesProvider: BankDepositChargesProvider,
    private taxEventsProvider: BankDepositTaxEventsProvider,
    private exchangeProvider: ExchangeProvider,
  ) {}

  private yearEndsCache = new Map<
    string,
    Promise<Array<{ date: TimelessDateString; rate: number }>>
  >();

  private async toMovements(
    transactions: readonly IGetTransactionsByBankDepositsResult[],
    localCurrency: Currency,
  ): Promise<DepositMovement[]> {
    const withIds = transactions.filter(t => t.id && t.charge_id);
    const interestIds = identifyInterestTransactionIds(withIds, {
      getId: t => t.id,
      getChargeId: t => t.charge_id,
      getAmount: t => Number(t.amount),
    });
    return Promise.all(
      withIds.map(async t => {
        const date = movementDate(t);
        const rate =
          t.currency === localCurrency
            ? 1
            : await this.exchangeProvider.getExchangeRates(
                t.currency as Currency,
                localCurrency,
                date,
              );
        return {
          id: t.id,
          chargeId: t.charge_id,
          date,
          altDate: t.event_date,
          amount: Number(t.amount),
          rate,
          isPrincipal: !interestIds.has(t.id),
        };
      }),
    );
  }

  private yearEnds(currency: Currency, localCurrency: Currency, taxCategoryId: string | null) {
    const cached = this.yearEndsCache.get(currency);
    if (cached) return cached;
    const promise = (async () => {
      if (!taxCategoryId || currency === localCurrency) return [];
      const years = await this.taxEventsProvider.getRevaluationYears(taxCategoryId);
      return Promise.all(
        years.map(async year => {
          const date = `${year}-12-31` as TimelessDateString;
          const rate = await this.exchangeProvider.getExchangeRates(currency, localCurrency, date);
          return { date, rate };
        }),
      );
    })();
    this.yearEndsCache.set(currency, promise);
    return promise;
  }

  private async buildTimeline(depositId: string): Promise<DepositTimelineResult> {
    const {
      defaultLocalCurrency,
      ledgerLock,
      bankDeposits: { bankDepositInterestIncomeTaxCategoryId },
    } = await this.adminContextProvider.getVerifiedAdminContext();

    const deposit = await this.bankDepositsProvider.bankDepositByIdLoader.load(depositId);
    if (!deposit) {
      throw new Error(`Bank deposit ${depositId} not found`);
    }

    const transactions =
      await this.bankDepositChargesProvider.getTransactionsByBankDepositLoader.load(depositId);
    const currency = (deposit.currency ??
      transactions.find(t => t.currency)?.currency ??
      defaultLocalCurrency) as Currency;
    const movements = await this.toMovements(transactions, defaultLocalCurrency);

    // Bank rows carry no deposit id: match them against every deposit of the same account
    let bankFigures: Parameters<typeof buildDepositTimeline>[0]['bankFigures'];
    let unmatchedTaxEvents: DepositTaxEventRow[] = [];
    if (deposit.account_id) {
      const rows = await this.taxEventsProvider.taxEventsByAccountIdLoader.load(deposit.account_id);
      if (rows.length) {
        const accountDeposits = (await this.bankDepositsProvider.getAllBankDeposits()).filter(
          d => d.account_id === deposit.account_id,
        );
        const accountDepositsMovements = await Promise.all(
          accountDeposits.map(async d => ({
            depositId: d.id,
            movements:
              d.id === depositId
                ? movements
                : await this.bankDepositChargesProvider.getTransactionsByBankDepositLoader
                    .load(d.id)
                    .then(t => this.toMovements(t, defaultLocalCurrency)),
          })),
        );
        const matched = matchDepositTaxEvents(
          rows.map(r => ({
            id: r.id,
            date: r.executing_date,
            actionTypeDescription: r.action_type_description,
            taxEventAmount: Number(r.tax_event_amount),
            debitAmount: Number(r.debit_amount),
            crditAmount: Number(r.crdit_amount),
          })),
          accountDepositsMovements,
        );
        bankFigures = matched.byDeposit.get(depositId);
        // only rows in this deposit's lifetime are worth reporting on it
        const from = deposit.open_date ?? movements.map(m => m.date).sort()[0];
        const to = deposit.close_date;
        unmatchedTaxEvents = matched.unmatched.filter(
          r => (!from || r.date >= from) && (!to || r.date <= to),
        );
      }
    }

    const timeline = buildDepositTimeline({
      currency,
      localCurrency: defaultLocalCurrency,
      movements,
      bankFigures,
      yearEnds: await this.yearEnds(
        currency,
        defaultLocalCurrency,
        bankDepositInterestIncomeTaxCategoryId,
      ),
      ledgerLock: ledgerLock ?? null,
      isClosed: !!deposit.close_date,
    });

    return { ...timeline, depositId, currency, unmatchedTaxEvents };
  }

  public depositTimelineLoader = new DataLoader(
    (depositIds: readonly string[]) =>
      Promise.all(depositIds.map(id => this.buildTimeline(id).catch((e: unknown) => e as Error))),
    { cacheKeyFn: id => id },
  );
}
