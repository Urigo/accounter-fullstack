import { GraphQLError } from 'graphql';
import { ChargesTempProvider } from '@modules/charges/providers/charges-temp.provider.js';
import { storeInitialGeneratedRecords } from '@modules/ledger/helpers/ledgrer-storage.helper.js';
import { generateMiscExpensesLedger } from '@modules/ledger/helpers/misc-expenses-ledger.helper.js';
import { MiscExpensesProvider } from '@modules/misc-expenses/providers/misc-expenses.provider.js';
import { Maybe, ResolverFn, ResolversTypes } from '@shared/gql-types';
import type { LedgerProto } from '@shared/types';
import { ledgerProtoToRecordsConverter } from '../../../helpers/utils.helper.js';

export const generateLedgerRecordsForBalance: ResolverFn<
  Maybe<ResolversTypes['GeneratedLedgerRecords']>,
  Awaited<ResolversTypes['Charge']>,
  GraphQLModules.Context,
  { insertLedgerRecordsIfNotExists: boolean }
> = async (chargeId, { insertLedgerRecordsIfNotExists }, context) => {
  try {
    const { injector } = context;

    // validate balance record exists
    const [charge, miscExpenses] = await Promise.all([
      injector.get(ChargesTempProvider).getChargeByIdLoader.load(chargeId),
      injector.get(MiscExpensesProvider).getExpensesByChargeIdLoader.load(chargeId),
    ]);

    if (!miscExpenses?.length) {
      throw new GraphQLError('Balance charge must include balance records');
    }

    const ledgerEntries: LedgerProto[] = [];

    // generate ledger from misc expenses
    const expensesLedgerPromise = generateMiscExpensesLedger(chargeId, context).then(entries => {
      entries.map(entry => {
        entry.ownerId = charge.owner_id;
        ledgerEntries.push(entry);
      });
    });

    await Promise.all([expensesLedgerPromise]);

    if (insertLedgerRecordsIfNotExists) {
      await storeInitialGeneratedRecords(chargeId, ledgerEntries, context);
    }

    return {
      records: ledgerProtoToRecordsConverter(ledgerEntries),
      chargeId,
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
      message: `Failed to generate ledger records for charge ID="${chargeId}"\n${e}`,
    };
  }
};
