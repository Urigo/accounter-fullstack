import { GraphQLError } from 'graphql';
import { BALANCE_SHEET_CODE_NAMES, PROFIT_LOSS_CODE_NAMES } from '@accounter/shaam6111-generator';
import type { QueryResolvers } from '../../../../__generated__/types.js';
import { formatFinancialAmount } from '../../../../shared/helpers/index.js';
import { AdminContextProvider } from '../../../admin-context/providers/admin-context.provider.js';
import { FinancialEntitiesProvider } from '../../../financial-entities/providers/financial-entities.provider.js';
import { LedgerProvider } from '../../../ledger/providers/ledger.provider.js';
import { SortCodesProvider } from '../../../sort-codes/providers/sort-codes.provider.js';
import { groupLedgerRecordsByIrsCode } from '../../helpers/irs-codes-report.helper.js';

const IRS_CODE_LABELS: Record<number, string> = {
  ...BALANCE_SHEET_CODE_NAMES,
  ...PROFIT_LOSS_CODE_NAMES,
};

export const irsCodesReport: QueryResolvers['irsCodesReport'] = async (
  _,
  { fromDate, toDate },
  { injector },
) => {
  if (fromDate > toDate) {
    throw new GraphQLError('From date must be before or equal to to date');
  }

  const { ownerId, defaultLocalCurrency } = await injector
    .get(AdminContextProvider)
    .getVerifiedAdminContext();

  const [ledgerRecords, financialEntities, sortCodes] = await Promise.all([
    injector.get(LedgerProvider).getLedgerRecordsByDates({ fromDate, toDate, ownerId }),
    injector.get(FinancialEntitiesProvider).getAllFinancialEntities(),
    injector.get(SortCodesProvider).getSortCodesByOwnerIdLoader.load(ownerId),
  ]);

  const entitiesById = new Map(financialEntities.map(entity => [entity.id, entity]));
  // entities with no IRS code of their own fall back to their sort code's default
  const defaultIrsCodeBySortCode = new Map<number, number>();
  for (const sortCode of sortCodes) {
    if (sortCode.default_irs_code != null) {
      defaultIrsCodeBySortCode.set(sortCode.key, sortCode.default_irs_code);
    }
  }

  return groupLedgerRecordsByIrsCode(ledgerRecords, entitiesById, defaultIrsCodeBySortCode).map(
    ({ irsCode, amount, entities }) => ({
      id: `irs-code-${irsCode ?? 'misc'}-${fromDate}-${toDate}`,
      irsCode,
      label: irsCode === null ? 'Misc' : (IRS_CODE_LABELS[irsCode] ?? null),
      amount: formatFinancialAmount(amount, defaultLocalCurrency),
      entities,
    }),
  );
};
