import { Currency, type LedgerForKovetzAchidQuery } from 'gql/graphql.js';
import { AccountingMovement } from 'report-handler/accounting-movements.js';
import { checkAccountsMatch } from 'report-handler/utils.js';
import { logMatch } from './logger.js';
import { validateMatches } from 'match-validation.js';

export type LedgerRecord = Extract<
  LedgerForKovetzAchidQuery['allCharges']['nodes'][number]['ledgerRecords'],
  { records: Array<unknown> }
>['records'][number];

function movementsDifferences(movements: AccountingMovement[]): (keyof AccountingMovement)[] {
  const diffs: (keyof AccountingMovement)[] = [];

  // if only one movement, no diffs
  if (movements.length === 1) {
    return diffs;
  }

  const firstMovement = movements[0];
  for (const movement of movements) {
    if (movement.serial === firstMovement.serial) {
      continue;
    }
    for (const key of Object.keys(movement) as (keyof AccountingMovement)[]) {
      const irrelevantKeys: (keyof AccountingMovement)[] = ['serial', 'movementNumber', 'lineNumberInMovement'];
      if (irrelevantKeys.includes(key)) {
        continue;
      }
      if (movement[key] !== firstMovement[key]) {
        diffs.push(key);
      }
    }
  }
  return diffs;
}

function matchReference(movementRef: string, ledgerRef?: string | null) {
    if (movementRef === ledgerRef) {
      return true;
    }

    if (!ledgerRef || !movementRef || !movementRef.length || !ledgerRef.length) {
      return false;
    }

    const sanitizedLedgerRef = ledgerRef.match(/\d+/g)?.join('') ?? '';

    if (sanitizedLedgerRef.includes(movementRef)) {
      return true;
    }

    return false;

}

export function filterMatches(
    accountingMovements: () => AccountingMovement[],
    ledgerRecord: LedgerRecord,
    account: 'credit1' | 'credit2' | 'debit1' | 'debit2',
    setMatched: (serial: number) => void,
  ): boolean {
    // consider missing accounts as a match
    let ledgerAccount: string | null | undefined = null;
    switch (account) {
      case 'credit1':
        ledgerAccount = ledgerRecord.creditAccount1.name;
        break;
      case 'credit2':
        ledgerAccount = ledgerRecord.creditAccount2?.name;
        break;
      case 'debit1':
        ledgerAccount = ledgerRecord.debitAccount1?.name;
        break;
      case 'debit2':
        ledgerAccount = ledgerRecord.debitAccount2?.name;
        break;
    }
  
    if (!ledgerAccount) {
      return true;
    }
  
    let ledgerLocalAmount: number | null = null;
    let ledgerCurrency: Currency | null = null;
    let ledgerForeignAmount: number | null = null;
    switch (account) {
      case 'credit1':
        ledgerLocalAmount = ledgerRecord.localCurrencyCreditAmount1
          ? Number(ledgerRecord.localCurrencyCreditAmount1.raw.toFixed(2))
          : null;
          ledgerCurrency = ledgerRecord.creditAmount1
          ? ledgerRecord.creditAmount1.currency
          : null;
          ledgerForeignAmount = ledgerRecord.creditAmount1
          ? Number(ledgerRecord.creditAmount1.raw.toFixed(2))
          : null;
        break;
      case 'credit2':
        ledgerLocalAmount = ledgerRecord.localCurrencyCreditAmount2
          ? Number(ledgerRecord.localCurrencyCreditAmount2.raw.toFixed(2))
          : null;
          ledgerCurrency = ledgerRecord.creditAmount2
          ? ledgerRecord.creditAmount2.currency
          : null;
          ledgerForeignAmount = ledgerRecord.creditAmount2
          ? Number(ledgerRecord.creditAmount2.raw.toFixed(2))
          : null;
        break;
      case 'debit1':
        ledgerLocalAmount = ledgerRecord.localCurrencyDebitAmount1
          ? Number(ledgerRecord.localCurrencyDebitAmount1.raw.toFixed(2))
          : null;
          ledgerCurrency = ledgerRecord.debitAmount1
          ? ledgerRecord.debitAmount1.currency
          : null;
          ledgerForeignAmount = ledgerRecord.debitAmount1
          ? Number(ledgerRecord.debitAmount1.raw.toFixed(2))
          : null;
        break;
      case 'debit2':
        ledgerLocalAmount = ledgerRecord.localCurrencyDebitAmount2
          ? Number(ledgerRecord.localCurrencyDebitAmount2.raw.toFixed(2))
          : null;
          ledgerCurrency = ledgerRecord.debitAmount2
          ? ledgerRecord.debitAmount2.currency
          : null;
          ledgerForeignAmount = ledgerRecord.debitAmount2
          ? Number(ledgerRecord.debitAmount2.raw.toFixed(2))
          : null;
        break;
    }
  
    const isCredit = account === 'credit1' || account === 'credit2';
  
    const filteredMovements = accountingMovements().filter(movement => {
      const localAmountsMatch = movement.amount === ledgerLocalAmount;
      const foreignCurrencyMatch = movement.currency === ledgerCurrency;
      const foreignAmountMatch = movement.foreignAmount > 0 && foreignCurrencyMatch && (movement.foreignAmount === ledgerForeignAmount);
      if (foreignAmountMatch && !localAmountsMatch) {
        console.log(`Foreign amount match but locals not, for record ${ledgerRecord.id} in charge ${ledgerRecord.id}`)
      }
      const amountsMatch = localAmountsMatch || foreignAmountMatch;
      const sidesMatch = isCredit ? movement.side === 'credit' : movement.side === 'debit';
      const accountsMatch = checkAccountsMatch(movement.accountInMovement, ledgerAccount);
      return amountsMatch && sidesMatch && accountsMatch;
    });
  
    if (filteredMovements.length) {
      const movementsDiffs = movementsDifferences(filteredMovements);
      if (movementsDiffs.length === 0) {
        // TODO: add more validations
        setMatched(filteredMovements[0].serial);
        logMatch(filteredMovements[0], ledgerRecord, ledgerAccount, ledgerLocalAmount, ledgerCurrency, ledgerForeignAmount, isCredit); // TODO: clean this after done
        validateMatches({[filteredMovements[0].serial]: ledgerRecord.id}) // TODO: clean this after done
        return true;
      }
  
      let furtherFilteredMovements = filteredMovements;
      if (movementsDiffs.includes('reference')) {
        furtherFilteredMovements = filteredMovements.filter(
          movement => matchReference(movement.reference, ledgerRecord.reference1),
        );
      }
  
      if (furtherFilteredMovements.length === 1) {
        // TODO: add more validations
        setMatched(filteredMovements[0].serial);
        logMatch(filteredMovements[0], ledgerRecord, ledgerAccount, ledgerLocalAmount, ledgerCurrency, ledgerForeignAmount, isCredit); // TODO: clean this after done
        validateMatches({[filteredMovements[0].serial]: ledgerRecord.id}) // TODO: clean this after done
        return true;
      }
  
      // case multiple movements found
      console.warn(
        `Found ${filteredMovements.length} matches for record ${ledgerRecord.id} in charge ${ledgerRecord.id}`,
      );
      return false;
    }
  
    // case no movements found
    console.warn(`Could not find match for record ${ledgerRecord.id} in charge ${ledgerRecord.id}`);
    return false;
  }