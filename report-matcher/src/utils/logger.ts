import { format } from 'date-fns';
import { AccountingMovement, AccountingMovementsMap } from 'report-handler/accounting-movements.js';
import { checkAccountsMatch } from 'report-handler/utils.js';
import type { SubLedger } from 'types.js';

function setGap(before: string, gap: number) {
  const beforeChars = before.length;
  const gapToAdd = gap - beforeChars;
  return ' '.repeat(gapToAdd > 0 ? gapToAdd : 0);
}

function addGap(before: string, gap = 12) {
  return before + setGap(before, gap);
}

function lineGenerator(header: string, firstVal: string, secondVal: unknown): string {
  const valuesAreEqual = firstVal === secondVal;
  const valuesAreZeroAmount =
    header === 'Foreign amount:' && firstVal === '0.00' && secondVal === undefined;
  const valuesAreLocalCurrency = header === 'Currency:' && firstVal === 'USD' && secondVal === null;
  const valuesAreMatchingAccounts =
    header === 'Account:' && checkAccountsMatch(firstVal, secondVal as string);
  const areValuesMatch =
    valuesAreEqual || valuesAreZeroAmount || valuesAreLocalCurrency || valuesAreMatchingAccounts;
  const diffIndicator = areValuesMatch ? ' ' : '*';
  const headerGap = addGap(header, 16);
  const firstValGap = addGap(firstVal, 20);
  return `${diffIndicator}${headerGap}${firstValGap}${
    firstValGap.length > 20 ? '\n                ' : ''
  }${secondVal}`;
}

export function logMatch(movement: AccountingMovement, subLedger: SubLedger) {
  const linesVariables: Array<[string, string, unknown]> = [
    ['Account:', movement.accountInMovement, subLedger.account?.name],
    ['Value date:', movement.valueDate, format(new Date(subLedger.valueDate), 'yyyyMMdd')],
    ['Date:', movement.date, format(new Date(subLedger.invoiceDate), 'yyyyMMdd')],
    ['Local amount:', movement.amount.toFixed(2), subLedger.localCurrencyAmount?.toFixed(2)],
    ['Foreign amount:', movement.foreignAmount.toFixed(2), subLedger.amount?.toFixed(2)],
    ['Currency:', movement.currency, subLedger.currency],
    ['Reference:', movement.reference, subLedger.reference1],
    ['Side:', movement.side, subLedger.isCredit ? 'credit' : 'debit'],
    ['Description:', movement.details, subLedger.description],
  ];

  const generatedLines = linesVariables.map(vars => {
    return lineGenerator(...vars);
  });

  console.log(`
Matched movement ${movement.serial} to subLedger record ${subLedger.id}
${generatedLines.join('\n')}
`);
}

export function logMatchSuccessRate(accountingMovementsHandler: AccountingMovementsMap) {
  const movementsCount = accountingMovementsHandler.getMovements().length;
  const matchedCount = Object.values(accountingMovementsHandler.getMatchedData()).filter(
    value => !!value,
  ).length;
  console.log(`${(matchedCount * 100) / movementsCount}% of movements matched`);
}
