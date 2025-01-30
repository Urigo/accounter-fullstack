import { FinancialEntitiesProvider } from '@modules/financial-entities/providers/financial-entities.provider.js';
import { storeInitialGeneratedRecords } from '@modules/ledger/helpers/ledgrer-storage.helper.js';
import { LedgerProvider } from '@modules/ledger/providers/ledger.provider.js';
import {
  decorateLedgerRecords,
  getProfitLossReportAmounts,
  type DecoratedLedgerRecord,
} from '@modules/reports/helpers/profit-and-loss.helper.js';
import { calculateTaxAmounts } from '@modules/reports/helpers/tax.helper.js';
import { EMPTY_UUID } from '@shared/constants';
import { Maybe, ResolverFn, ResolversParentTypes, ResolversTypes } from '@shared/gql-types';
import type { LedgerProto } from '@shared/types';
import { ledgerProtoToRecordsConverter } from '../../../helpers/utils.helper.js';

export const generateLedgerRecordsForTaxExpenses: ResolverFn<
  Maybe<ResolversTypes['GeneratedLedgerRecords']>,
  ResolversParentTypes['Charge'],
  GraphQLModules.Context,
  { insertLedgerRecordsIfNotExists: boolean }
> = async (charge, { insertLedgerRecordsIfNotExists }, context) => {
  try {
    const {
      injector,
      adminContext: {
        defaultLocalCurrency,
        authorities: { taxBusinessId, taxExpensesTaxCategoryId },
      },
    } = context;
    if (!charge.user_description) {
      return {
        __typename: 'CommonError',
        message: `Tax expenses charge must include user description with designated year`,
      };
    }

    // get revaluation date - search for "yyyy-mm-dd" in description
    const dateRegex = /\b(\d{4})\b/;
    const matches = charge.user_description.match(dateRegex);
    if (!matches?.length) {
      return {
        __typename: 'CommonError',
        message: `Tax expenses charge description must include full year`,
      };
    }

    const stringYear = matches[0];
    const year = Number(stringYear);
    if (Number.isNaN(year) || year < 2000 || year > new Date().getFullYear()) {
      return {
        __typename: 'CommonError',
        message: `Tax expenses charge description must include valid year (2000 - current year)`,
      };
    }

    const from = new Date(year - 2, 0, 1, 0, 0, 1);
    const to = new Date(year + 1, 0, 0);
    const ledgerRecords = await injector
      .get(LedgerProvider)
      .getLedgerRecordsByDates({ fromDate: from, toDate: to });

    const financialEntities = await injector
      .get(FinancialEntitiesProvider)
      .getAllFinancialEntities();

    const financialEntitiesDict = new Map(financialEntities.map(entity => [entity.id, entity]));

    const decoratedLedgerByYear = new Map<number, DecoratedLedgerRecord[]>();
    for (let year = from.getFullYear(); year <= to.getFullYear(); year++) {
      if (from.getFullYear() > to.getFullYear()) {
        break;
      }

      decoratedLedgerByYear.set(year, []);
    }

    ledgerRecords.map(record => {
      const year = record.invoice_date.getFullYear();
      const [decoratedRecord] = decorateLedgerRecords([record], financialEntitiesDict);
      decoratedLedgerByYear.get(year)?.push(decoratedRecord);
    });

    const profitLossByYear = new Map<number, ReturnType<typeof getProfitLossReportAmounts>>();
    // eslint-disable-next-line no-inner-declarations
    function getProfitLossReportAmountsByYear(year: number) {
      let amounts = profitLossByYear.get(year);
      if (!amounts) {
        const decoratedLedgerRecords = decoratedLedgerByYear.get(year) ?? [];
        amounts = getProfitLossReportAmounts(decoratedLedgerRecords);
        profitLossByYear.set(year, amounts);
      }
      return amounts;
    }

    let cumulativeResearchAndDevelopmentExpensesAmount = 0;
    for (const rndYear of [year - 2, year - 1, year]) {
      const profitLossHelperReportAmounts = getProfitLossReportAmountsByYear(rndYear);

      cumulativeResearchAndDevelopmentExpensesAmount +=
        profitLossHelperReportAmounts.researchAndDevelopmentExpensesAmount;
    }

    const taxableCumulativeResearchAndDevelopmentExpensesAmount =
      cumulativeResearchAndDevelopmentExpensesAmount / 3;

    const { researchAndDevelopmentExpensesAmount, profitBeforeTaxAmount } =
      getProfitLossReportAmountsByYear(year);

    const { annualTaxExpenseAmount } = await calculateTaxAmounts(
      context,
      year,
      decoratedLedgerByYear.get(year) ?? [],
      researchAndDevelopmentExpensesAmount,
      taxableCumulativeResearchAndDevelopmentExpensesAmount,
      profitBeforeTaxAmount,
    );

    const ledgerEntry: LedgerProto = {
      id: EMPTY_UUID,
      invoiceDate: new Date(year, 11, 31),
      valueDate: new Date(year, 11, 31),
      currency: defaultLocalCurrency,
      isCreditorCounterparty: true,
      creditAccountID1: taxBusinessId,
      debitAccountID1: taxExpensesTaxCategoryId,
      localCurrencyCreditAmount1: Math.abs(annualTaxExpenseAmount),
      localCurrencyDebitAmount1: Math.abs(annualTaxExpenseAmount),
      description: `Tax expenses for ${year}`,
      ownerId: charge.owner_id,
      chargeId: charge.id,
      currencyRate: 1,
    };

    const ledgerEntries = [ledgerEntry];

    if (insertLedgerRecordsIfNotExists) {
      await storeInitialGeneratedRecords(charge, ledgerEntries, context);
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
      errors: [],
    };
  } catch (e) {
    return {
      __typename: 'CommonError',
      message: `Failed to generate ledger records for charge ID="${charge.id}"\n${e}`,
    };
  }
};
