import { SecurityTradeType } from '../../../shared/enums.js';
import type { SecurityExecutionRow } from '../types.js';
import { TRANSFER_PAIRING_WINDOW_DAYS, type FifoCostBasis } from './security-cost-basis.helper.js';
import { tryToSecurityTradeType } from './security-execution-enums.helper.js';

export function describeSecurity(
  execution: Pick<SecurityExecutionRow, 'symbol' | 'security' | 'isin'>,
) {
  const name = execution.symbol ?? execution.security;
  return execution.isin ? `${name} (${execution.isin})` : name;
}

/** Why the FIFO purchase cost of a disposal cannot be worked out, or null when it can */
export function costBasisProblem(
  execution: SecurityExecutionRow,
  costBasis: FifoCostBasis,
): string | null {
  const security = describeSecurity(execution);
  const isSale = tryToSecurityTradeType(execution.trade_type) === SecurityTradeType.Sell;
  const disposed = `${isSale ? 'sold' : 'redeemed'} on ${execution.trade_date}`;
  const account = `${execution.bank_number}-${execution.branch_number}-${execution.account_number}`;
  const bankProfitLoss = Number(execution.nominal_profit_loss_nis);
  const bankNote =
    Number.isFinite(bankProfitLoss) && bankProfitLoss !== 0
      ? ` For reference, the bank reports a nominal profit/loss of ${bankProfitLoss} ₪ on it.`
      : '';

  if (costBasis.redeemedUnits === 0) {
    return `The ${isSale ? 'sale' : 'redemption'} of ${security} on ${execution.trade_date} reports no ${isSale ? 'sold' : 'redeemed'} units, so its purchase cost cannot be found.${bankNote}`;
  }
  if (costBasis.openingPositionUnknown) {
    const history = costBasis.historyStartDate
      ? ` (it starts on ${costBasis.historyStartDate})`
      : '';
    return `Could not determine the purchase cost of ${costBasis.redeemedUnits} units of ${security} ${disposed}: the scraped securities history of account ${account}${history}, or of an account units were transferred into it from, starts mid-position — units were sold or transferred out before as many were seen bought, so an earlier holding of unknown cost comes first. Scrape older securities transactions to complete it.${bankNote}`;
  }
  if (costBasis.missingUnits > 0) {
    const history = costBasis.historyStartDate
      ? `the scraped securities history of account ${account} starts on ${costBasis.historyStartDate}`
      : `no securities history of it was scraped for account ${account}`;
    return `Could not find the purchase of ${costBasis.missingUnits} of ${costBasis.redeemedUnits} units of ${security} ${disposed}: ${history}. Scrape older securities transactions to complete it.${bankNote}`;
  }
  if (costBasis.unknownCostUnits > 0) {
    return `${costBasis.unknownCostUnits} of ${costBasis.redeemedUnits} units of ${security} ${disposed} have no known purchase cost: they arrived by a transfer in that no transfer out from another of the owner's accounts pairs with (same units, within ${TRANSFER_PAIRING_WINDOW_DAYS} days), by a distribution other than a dividend in kind, or were bought or distributed in another currency.${bankNote}`;
  }
  return null;
}
