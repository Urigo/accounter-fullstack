import type {
  Maybe,
  ResolverFn,
  ResolversParentTypes,
  ResolversTypes,
} from '../../../../../__generated__/types.js';
import { EMPTY_UUID } from '../../../../../shared/constants.js';
import { currentTenantYear } from '../../../../../shared/helpers/index.js';
import type { LedgerProto, TimelessDateString } from '../../../../../shared/types/index.js';
import { AdminContextProvider } from '../../../../admin-context/providers/admin-context.provider.js';
import { BankDepositsProvider } from '../../../../bank-deposits/providers/bank-deposits.provider.js';
import {
  DepositTimelineProvider,
  type DepositTimelineResult,
} from '../../../../bank-deposits/providers/deposit-timeline.provider.js';
import { storeInitialGeneratedRecords } from '../../../helpers/ledgrer-storage.helper.js';
import { generateMiscExpensesLedger } from '../../../helpers/misc-expenses-ledger.helper.js';
import { ledgerProtoToRecordsConverter } from '../../../helpers/utils.helper.js';

export const BANK_DEPOSITS_REVALUATION_LEDGER_DESCRIPTION = 'Bank deposits revaluation of currency';

export const generateLedgerRecordsForBankDepositsRevaluation: ResolverFn<
  Maybe<ResolversTypes['GeneratedLedgerRecords']>,
  ResolversParentTypes['Charge'],
  GraphQLModules.Context,
  { insertLedgerRecordsIfNotExists: boolean }
> = async (charge, { insertLedgerRecordsIfNotExists }, context) => {
  try {
    const { injector } = context;
    if (!charge.user_description) {
      return {
        __typename: 'CommonError',
        message: `Bank deposits revaluation charge must include user description with designated year`,
      };
    }

    const {
      defaultLocalCurrency,
      general: {
        taxCategories: { exchangeRevaluationTaxCategoryId },
      },
      bankDeposits: { bankDepositBusinessId },
    } = await injector.get(AdminContextProvider).getVerifiedAdminContext();
    if (!bankDepositBusinessId) {
      return {
        __typename: 'CommonError',
        message: `Bank deposits business is not set`,
      };
    }

    // get revaluation date - search for "yyyy-mm-dd" in description
    const dateRegex = /\b(\d{4})\b/;
    const matches = charge.user_description.match(dateRegex);
    if (!matches?.length) {
      return {
        __typename: 'CommonError',
        message: `Bank deposits revaluation charge description must include full year`,
      };
    }

    const stringYear = matches[0];
    const year = Number(stringYear);
    if (Number.isNaN(year) || year < 2000 || year > currentTenantYear()) {
      return {
        __typename: 'CommonError',
        message: `Bank deposits revaluation charge description must include valid year (2000 - current year)`,
      };
    }

    const revaluationDate = `${year}-12-31` as TimelessDateString;

    const errors: Set<string> = new Set();
    const ledgerEntries: LedgerProto[] = [];

    // Per deposit, from the same timeline the deposit charges are booked with: the carried
    // principal is revalued from its last event (or last year-end) to the 31/12 rate.
    // Only this charge owner's deposits: the read scope may span several businesses.
    const foreignDeposits = (await injector.get(BankDepositsProvider).getAllBankDeposits()).filter(
      deposit =>
        deposit.owner_id === charge.owner_id &&
        deposit.currency &&
        deposit.currency !== defaultLocalCurrency,
    );
    const currenciesLedgerPromise = foreignDeposits.map(async deposit => {
      let timeline: DepositTimelineResult;
      try {
        timeline = await injector
          .get(DepositTimelineProvider)
          .depositTimelineLoader.load(deposit.id);
      } catch (e) {
        // one failing deposit must not block the others' year-end revaluation
        errors.add(`Deposit "${deposit.name}": ${e instanceof Error ? e.message : String(e)}`);
        return;
      }
      const yearEnd = timeline.yearEnds.find(step => step.date === revaluationDate);
      if (!yearEnd || Math.abs(yearEnd.revaluation) < 0.005) {
        return;
      }

      const isUp = yearEnd.revaluation > 0;
      const amount = Math.abs(yearEnd.revaluation);
      ledgerEntries.push({
        id: EMPTY_UUID,
        invoiceDate: revaluationDate,
        valueDate: revaluationDate,
        currency: defaultLocalCurrency,
        isCreditorCounterparty: !isUp,
        debitAccountID1: isUp ? bankDepositBusinessId : exchangeRevaluationTaxCategoryId,
        creditAccountID1: isUp ? exchangeRevaluationTaxCategoryId : bankDepositBusinessId,
        localCurrencyCreditAmount1: amount,
        localCurrencyDebitAmount1: amount,
        description: `${BANK_DEPOSITS_REVALUATION_LEDGER_DESCRIPTION} "${timeline.currency}" (${deposit.name})`,
        ownerId: charge.owner_id,
        chargeId: charge.id,
        currencyRate: yearEnd.rate,
      });
    });

    // generate ledger from misc expenses
    const expensesLedgerPromise = generateMiscExpensesLedger(charge, injector).then(entries => {
      entries.map(entry => {
        entry.ownerId = charge.owner_id;
        ledgerEntries.push(entry);
      });
    });

    await Promise.all([expensesLedgerPromise, ...currenciesLedgerPromise]);

    if (insertLedgerRecordsIfNotExists) {
      await storeInitialGeneratedRecords(charge.id, ledgerEntries, injector);
    }

    return {
      records: ledgerProtoToRecordsConverter(ledgerEntries),
      charge,
      balance: {
        isBalanced: true,
        unbalancedEntities: [],
        balanceSum: 0,
        financialEntities: [],
      },
      errors: Array.from(errors),
    };
  } catch (e) {
    return {
      __typename: 'CommonError',
      message: `Failed to generate ledger records for charge ID="${charge.id}"\n${e}`,
    };
  }
};
