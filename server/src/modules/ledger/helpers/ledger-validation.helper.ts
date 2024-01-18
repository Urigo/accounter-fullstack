import { DEFAULT_LOCAL_CURRENCY } from "@shared/constants";
import type { IInsertLedgerRecordsParams } from "../types.js";

export function validateLedgerRecordParams(record: IInsertLedgerRecordsParams['ledgerRecords'][number]) {
    if (!record.creditEntity1 && !record.debitEntity1) {
        throw new Error('Ledger record must have at least one main credit or debit entity');
    }

    if (!record.invoiceDate) {
        throw new Error('Ledger record must have an invoice date');
    }

    if (!record.valueDate) {
        throw new Error('Ledger record must have a value date');
    }

    const credit1AmountIsFine = !!record.creditEntity1 && !record.creditLocalAmount1;
    const credit2AmountIsFine = !!record.creditEntity2 && !record.creditLocalAmount2;
    const debit1AmountIsFine = !!record.debitEntity1 && !record.debitLocalAmount1;
    const debit2AmountIsFine = !!record.debitEntity2 && !record.debitLocalAmount2;
    if (!credit1AmountIsFine || !credit2AmountIsFine || !debit1AmountIsFine || !debit2AmountIsFine) {
        throw new Error('Ledger record financial entity must have an amount');
    }

    if (!record.currency || record.currency === DEFAULT_LOCAL_CURRENCY) {
        const credit1HasForeignAmount = !!record.creditEntity1 && !!record.creditForeignAmount1;
        const credit2HasForeignAmount = !!record.creditEntity2 && !!record.creditForeignAmount2;
        const debit1HasForeignAmount = !!record.debitEntity1 && !!record.debitForeignAmount1;
        const debit2HasForeignAmount = !!record.debitEntity2 && !!record.debitForeignAmount2;
        if (credit1HasForeignAmount || credit2HasForeignAmount || debit1HasForeignAmount || debit2HasForeignAmount) {
            throw new Error('Ledger record foreign currency is missing');
        }
    }
}