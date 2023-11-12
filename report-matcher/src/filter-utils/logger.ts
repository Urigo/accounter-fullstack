import { Currency } from "gql/graphql.js";
import { LedgerRecord } from "./index.js";
import { AccountingMovement } from "report-handler/accounting-movements";
import {format} from 'date-fns';
import { checkAccountsMatch } from "report-handler/utils.js";

function setGap(before: string, gap: number) {
    const beforeChars = before.length;
    const gapToAdd = gap - beforeChars;
    return ' '.repeat(gapToAdd > 0 ? gapToAdd : 0);
}

function addGap(before: string, gap = 12) {
    return before + setGap(before, gap);
}

function lineGenerator(header: string, firstVal: string, secondVal: any): string {
    const valuesAreEqual = firstVal === secondVal;
    const valuesAreZeroAmount = header === 'Foreign amount:' && firstVal === '0.00' && secondVal === undefined;
    const valuesAreLocalCurrency = header === 'Currency:' && firstVal === 'USD' && secondVal === null;
    const valuesAreMatchingAccounts = header === 'Account:' && checkAccountsMatch(firstVal, secondVal)
    const areValuesMatch = valuesAreEqual || valuesAreZeroAmount || valuesAreLocalCurrency || valuesAreMatchingAccounts;
    const diffIndicator = areValuesMatch ? ' ' : '*';
    const headerGap = addGap(header, 16);
    const firstValGap = addGap(firstVal, 20);
    return `${diffIndicator}${headerGap}${firstValGap}${firstValGap.length > 20 ? '\n                ' : ''}${secondVal}`;
}

export function logMatch(movement: AccountingMovement, ledger: LedgerRecord, account: string, amount: number | null, currency: Currency | null, foreignAmount: number | null, isCredit: boolean) {
    const linesVariables: Array<[string, string, any]> = [
        ['Account:', movement.accountInMovement, account],
        ['Value date:', movement.valueDate, format(new Date(ledger.valueDate), 'yyyyMMdd')],
        ['Date:', movement.date, format(new Date(ledger.invoiceDate), 'yyyyMMdd')],
        ['Local amount:', movement.amount.toFixed(2), amount?.toFixed(2)],
        ['Foreign amount:', movement.foreignAmount.toFixed(2), foreignAmount?.toFixed(2)],
        ['Currency:', movement.currency, currency],
        ['Reference:', movement.reference, ledger.reference1],
        ['Side:', movement.side, isCredit ? 'credit' : 'debit'],
        ['Description:', movement.details, ledger.description],
    ]

    let isErrored = false
    const generatedLines = linesVariables.map((vars) => {
        const line = lineGenerator(...vars);
        if (line[0] === '*' && !line.startsWith('*Description:')) {
            isErrored = true;
        }
        return lineGenerator(...vars)
    });

    if (isErrored) {
        console.log(`
Matched movement ${movement.serial} to ledger record ${ledger.id}
${generatedLines.join('\n')}
`);
    }
};