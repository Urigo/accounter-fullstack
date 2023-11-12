import { format } from 'date-fns';
import { AccountingMovement, AccountingMovementsMap } from 'report-handler/accounting-movements.js';
import { accountsDict, checkAccountsMatch } from 'report-handler/utils.js';
import type { SubLedger } from 'types.js';
import { logMatchSuccessRate } from 'utils/logger.js';
import { ChargesHandler } from '../accounter-ledger-handler/index.js';

export function matchesHandler(
  chargesHandler: ChargesHandler,
  accountingMovementsHandler: AccountingMovementsMap,
) {
  const charges = chargesHandler.getCharges();

  applyOverrides(chargesHandler, accountingMovementsHandler);

  for (const charge of charges) {
    handleStrictChargeMatches(
      charge.id,
      chargesHandler,
      accountingMovementsHandler,
      strictestMatch,
    );
  }
  console.log('Strict matches done');
  logMatchSuccessRate(accountingMovementsHandler);

  // mismatching local amounts
  for (const charge of charges) {
    handleLocalAmountMismatches(
      charge.id,
      chargesHandler,
      accountingMovementsHandler,
      matchIgnoringLocalAmounts,
    );
  }
  console.log('Secondary matches done');
  logMatchSuccessRate(accountingMovementsHandler);
}

function handleStrictChargeMatches(
  chargeId: string,
  chargesHandler: ChargesHandler,
  accountingMovementsHandler: AccountingMovementsMap,
  matchingFunction: (subLedger: SubLedger, movement: AccountingMovement) => boolean,
) {
  const subLedgerRecords = chargesHandler.getUnmatchedSubLedgerRecordsByChargeId(chargeId);
  if (!subLedgerRecords) {
    return;
  }

  for (const subLedger of subLedgerRecords) {
    const allRelevantMovements = getAllRelevantMovementsForSubLedger(
      subLedger,
      accountingMovementsHandler,
    );

    const filteredMovements = allRelevantMovements.filter(movement =>
      matchingFunction(subLedger, movement),
    );

    if (filteredMovements.length === 1) {
      chargesHandler.setSubRecordMatch(subLedger.id, filteredMovements[0].serial);
      accountingMovementsHandler.setMatch(filteredMovements[0].serial, subLedger.id);
      continue;
    }

    if (filteredMovements.length > 1) {
      // console.warn(`Found ${filteredMovements.length} matches for record ${subLedger.id}`);
      continue;
    }

    // console.warn(`Could not find match for record ${subLedger.id}`);
    continue;
  }
}

function handleLocalAmountMismatches(
  chargeId: string,
  chargesHandler: ChargesHandler,
  accountingMovementsHandler: AccountingMovementsMap,
  matchingFunction: (subLedger: SubLedger, movement: AccountingMovement) => boolean,
) {
  const subLedgerRecords = chargesHandler.getUnmatchedSubLedgerRecordsByChargeId(chargeId);
  if (!subLedgerRecords) {
    return;
  }

  for (const subLedger of subLedgerRecords) {
    const allRelevantMovements = getAllRelevantMovementsForSubLedger(
      subLedger,
      accountingMovementsHandler,
    );

    const filteredMovements = allRelevantMovements.filter(movement =>
      matchingFunction(subLedger, movement),
    );

    if (filteredMovements.length === 1) {
      const charge = chargesHandler.getChargeById(chargeId);
      const isConversion = charge?.tags?.some(tag => tag.name === 'conversion');
      // TODO: note that this could affect the total yearly amounts
      const isRoundingError =
        Math.floor(subLedger.localCurrencyAmount ?? 0) <= Math.ceil(filteredMovements[0].amount) &&
        Math.ceil(subLedger.localCurrencyAmount ?? 0) >= Math.floor(filteredMovements[0].amount);
      if (isConversion || isRoundingError) {
        chargesHandler.setSubRecordMatch(subLedger.id, filteredMovements[0].serial);
        accountingMovementsHandler.setMatch(filteredMovements[0].serial, subLedger.id);
        continue;
      }
      continue;
    }

    if (filteredMovements.length > 1) {
      // console.warn(`Found ${filteredMovements.length} matches for record ${subLedger.id}`);
      continue;
    }

    // console.warn(`Could not find match for record ${subLedger.id}`);
    continue;
  }
}

function getAllRelevantMovementsForSubLedger(
  subLedger: SubLedger,
  accountingMovementsHandler: AccountingMovementsMap,
): Array<AccountingMovement> {
  const allRelevantMovements = new Map<number, AccountingMovement>();

  let accountNames = accountsDict.get(subLedger.account.name);
  if (!accountNames) {
    console.warn(`Could not find account ${subLedger.account.name} in accounts dict`);
    accountNames = [];
  }

  const movements = [
    ...accountingMovementsHandler.getMovementsByValueDate(
      format(new Date(subLedger.valueDate), 'yyyyMMdd'),
      { unmatchedOnly: true },
    ),
    ...accountNames
      .map(name => accountingMovementsHandler.getMovementsByAccount(name, { unmatchedOnly: true }))
      .flat(2),
    ...(subLedger.localCurrencyAmount
      ? accountingMovementsHandler.getMovementsByAmount(subLedger.localCurrencyAmount, {
          unmatchedOnly: true,
        })
      : []),
    ...accountingMovementsHandler.getMovementsByDate(
      format(new Date(subLedger.invoiceDate), 'yyyyMMdd'),
      { unmatchedOnly: true },
    ),
  ];
  movements.map(movement => allRelevantMovements.set(movement.serial, movement));

  return Array.from(allRelevantMovements.values());
}

function strictestMatch(subLedger: SubLedger, movement: AccountingMovement) {
  const localAmountsMatch =
    movement.amount === subLedger.localCurrencyAmount ||
    (movement.amount === 0 && subLedger.localCurrencyAmount === null);
  const foreignCurrencyMatch =
    movement.currency === subLedger.currency ||
    (movement.currency === 'USD' && subLedger.currency === null);
  const foreignAmountMatch =
    movement.foreignAmount === subLedger.amount ||
    (movement.foreignAmount === 0 && subLedger.amount === null);
  const sidesMatch = subLedger.isCredit ? movement.side === 'credit' : movement.side === 'debit';
  const accountsMatch = checkAccountsMatch(movement.accountInMovement, subLedger.account.name);
  const valueDatesMatch = movement.valueDate === format(new Date(subLedger.valueDate), 'yyyyMMdd');
  const invoiceDatesMatch = movement.date === format(new Date(subLedger.invoiceDate), 'yyyyMMdd');

  return (
    localAmountsMatch &&
    foreignCurrencyMatch &&
    foreignAmountMatch &&
    foreignAmountMatch &&
    sidesMatch &&
    accountsMatch &&
    valueDatesMatch &&
    invoiceDatesMatch
  );
}

function secondaryMatch(subLedger: SubLedger, movement: AccountingMovement) {
  const localAmountsMatch =
    movement.amount === subLedger.localCurrencyAmount ||
    (movement.amount === 0 && subLedger.localCurrencyAmount === null);
  const foreignCurrencyMatch =
    movement.currency === subLedger.currency ||
    (movement.currency === 'USD' && subLedger.currency === null);
  const foreignAmountMatch =
    movement.foreignAmount === subLedger.amount ||
    (movement.foreignAmount === 0 && subLedger.amount === null);
  const sidesMatch = subLedger.isCredit ? movement.side === 'credit' : movement.side === 'debit';
  const accountsMatch = checkAccountsMatch(movement.accountInMovement, subLedger.account.name);
  const valueDatesMatch = movement.valueDate === format(new Date(subLedger.valueDate), 'yyyyMMdd');
  const invoiceDatesMatch = movement.date === format(new Date(subLedger.invoiceDate), 'yyyyMMdd');

  const amountsMatch = localAmountsMatch || (foreignCurrencyMatch && foreignAmountMatch);
  const datesMatch = valueDatesMatch || invoiceDatesMatch;

  return amountsMatch && foreignAmountMatch && sidesMatch && accountsMatch && datesMatch;
}

function matchIgnoringLocalAmounts(subLedger: SubLedger, movement: AccountingMovement) {
  const foreignCurrencyMatch =
    movement.currency === subLedger.currency ||
    (movement.currency === 'USD' && subLedger.currency === null);
  const foreignAmountMatch =
    movement.foreignAmount === subLedger.amount ||
    (movement.foreignAmount === 0 && subLedger.amount === null);
  const sidesMatch = subLedger.isCredit ? movement.side === 'credit' : movement.side === 'debit';
  const accountsMatch = checkAccountsMatch(movement.accountInMovement, subLedger.account.name);
  const valueDatesMatch = movement.valueDate === format(new Date(subLedger.valueDate), 'yyyyMMdd');
  const invoiceDatesMatch = movement.date === format(new Date(subLedger.invoiceDate), 'yyyyMMdd');

  const amountsMatch = foreignCurrencyMatch && foreignAmountMatch;

  return (
    amountsMatch &&
    foreignAmountMatch &&
    sidesMatch &&
    accountsMatch &&
    valueDatesMatch &&
    invoiceDatesMatch
  );
}

function applyOverrides(
  chargesHandler: ChargesHandler,
  accountingMovementsHandler: AccountingMovementsMap,
) {
  const overrideMatches: Record<number, string[]> = {
    295: ['a6c1c75f-594e-4935-948e-0a91810d0c0e|1|credit1'], // Saihaj salery + completions from 2021 + weird exchange rate
    296: ['a6c1c75f-594e-4935-948e-0a91810d0c0e|1|debit1'], // Saihaj salery + completions from 2021 + weird exchange rate
    1525: [
      '4084665d-24ef-4dd0-85b5-a9e33c4f083b|0|debit1',
      '4084665d-24ef-4dd0-85b5-a9e33c4f083b|0|debit2',
    ], // report doesn't take VAT into account
    2020: ['57ad73b4-176f-4d82-b55a-393d053424e1|0|debit1'],
    2023: ['eb938dc9-b84c-4c71-a75f-0844a499b6a1|0|debit1'], // TODO: dividend. need better ledger generation implementation
  };
  for (const [serial, IDs] of Object.entries(overrideMatches)) {
    for (const id of IDs) {
      chargesHandler.setSubRecordMatch(id, Number(serial));
    }
    accountingMovementsHandler.setMatch(Number(serial), IDs[0]);
  }
}
