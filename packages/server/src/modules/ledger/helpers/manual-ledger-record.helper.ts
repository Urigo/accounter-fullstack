import type { LedgerRecordInput } from '../../../__generated__/types.js';
import { DocumentType, type Currency } from '../../../shared/enums.js';
import { timelessDateStringToLocalDate } from '../../../shared/helpers/misc.js';
import { compareTimelessDates } from '../../../shared/helpers/timeless-date.js';
import type { TimelessDateString } from '../../../shared/types/index.js';
import type { IInsertDocumentsParams } from '../../documents/types.js';
import type { IInsertExpenseParams } from '../../misc-expenses/types.js';
import type { IInsertLedgerRecordsParams } from '../types.js';

/** The largest gap between the debit and credit local totals that still counts as balanced */
export const LEDGER_BALANCE_TOLERANCE = 0.005;

/** The column-shaped content of a manual ledger record, shared by insert and update */
export type ManualLedgerRecordParams = Omit<
  IInsertLedgerRecordsParams['ledgerRecords'][number],
  'chargeId' | 'ownerId'
>;

/**
 * Map a `LedgerRecordInput` to its ledger record column params. Absent optional values become
 * `null`, so an update overwrites (clears) them rather than keeping the stored value.
 */
export function ledgerRecordInputToParams(input: LedgerRecordInput): ManualLedgerRecordParams {
  return {
    debitEntity1: input.debitEntity1,
    debitLocalAmount1: input.debitLocalAmount1,
    debitForeignAmount1: input.debitForeignAmount1 ?? null,
    creditEntity1: input.creditEntity1,
    creditLocalAmount1: input.creditLocalAmount1,
    creditForeignAmount1: input.creditForeignAmount1 ?? null,
    debitEntity2: input.debitEntity2 ?? null,
    debitLocalAmount2: input.debitLocalAmount2 ?? null,
    debitForeignAmount2: input.debitForeignAmount2 ?? null,
    creditEntity2: input.creditEntity2 ?? null,
    creditLocalAmount2: input.creditLocalAmount2 ?? null,
    creditForeignAmount2: input.creditForeignAmount2 ?? null,
    currency: input.currency,
    invoiceDate: input.invoiceDate,
    valueDate: input.valueDate,
    description: input.description ?? null,
    reference: input.reference ?? null,
  };
}

type LedgerSlot = {
  label: string;
  side: 'debit' | 'credit';
  entity: string | null | undefined;
  localAmount: number | null | undefined;
  foreignAmount: number | null | undefined;
};

function ledgerSlots(input: LedgerRecordInput): LedgerSlot[] {
  return [
    {
      label: 'Debit 1',
      side: 'debit',
      entity: input.debitEntity1,
      localAmount: input.debitLocalAmount1,
      foreignAmount: input.debitForeignAmount1,
    },
    {
      label: 'Credit 1',
      side: 'credit',
      entity: input.creditEntity1,
      localAmount: input.creditLocalAmount1,
      foreignAmount: input.creditForeignAmount1,
    },
    {
      label: 'Debit 2',
      side: 'debit',
      entity: input.debitEntity2,
      localAmount: input.debitLocalAmount2,
      foreignAmount: input.debitForeignAmount2,
    },
    {
      label: 'Credit 2',
      side: 'credit',
      entity: input.creditEntity2,
      localAmount: input.creditLocalAmount2,
      foreignAmount: input.creditForeignAmount2,
    },
  ];
}

function isPresent<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

/** Absorbs float noise in the balance comparison; far below any real amount difference */
const BALANCE_EPSILON = 1e-9;

/** Drops float noise (e.g. `0.30000000000000004`) so totals print as entered */
function roundAmount(amount: number): number {
  return Math.round(amount * 1e9) / 1e9;
}

/**
 * Check a manual ledger record against the form rules shared by insert and update: per-slot
 * entity/amount pairing, foreign amounts matching the currency, a debit/credit balance, and dates
 * after the ledger lock. Returns every problem found as an end-user readable message; an empty
 * array means the input is valid.
 */
export function validateManualLedgerRecord(
  input: LedgerRecordInput,
  ctx: { localCurrency: Currency; ledgerLock?: TimelessDateString | null },
): string[] {
  const errors: string[] = [];
  const slots = ledgerSlots(input);

  // Slot: an entity needs a positive local amount, and an amount needs an entity
  for (const { label, entity, localAmount, foreignAmount } of slots) {
    if (entity) {
      if (!isPresent(localAmount)) {
        errors.push(`${label}: amount is required`);
      } else if (localAmount <= 0) {
        errors.push(`${label}: amount must be greater than 0`);
      }
    } else if (isPresent(localAmount) || isPresent(foreignAmount)) {
      errors.push(`${label}: an entity is required when an amount is entered`);
    }
  }

  // Currency: foreign amounts exactly on the filled slots of a foreign-currency record
  const isLocalCurrency = input.currency === ctx.localCurrency;
  for (const { label, entity, foreignAmount } of slots) {
    if (isLocalCurrency) {
      if (isPresent(foreignAmount)) {
        errors.push(`${label}: foreign amount is not allowed for ${ctx.localCurrency} records`);
      }
    } else if (entity) {
      if (!isPresent(foreignAmount)) {
        errors.push(`${label}: foreign amount is required for ${input.currency} records`);
      } else if (foreignAmount <= 0) {
        errors.push(`${label}: foreign amount must be greater than 0`);
      }
    }
  }

  // Balance: the local totals of both sides must match within the tolerance
  let debitTotal = 0;
  let creditTotal = 0;
  for (const { side, localAmount } of slots) {
    if (side === 'debit') {
      debitTotal += localAmount ?? 0;
    } else {
      creditTotal += localAmount ?? 0;
    }
  }
  // Binary floats make an exact 0.005 gap compute as e.g. 0.005000000000002558, so allow a tiny
  // epsilon over the tolerance: the boundary stays inclusive and deterministic, while any real gap
  // above it (even 0.0050004) still fails
  if (Math.abs(debitTotal - creditTotal) > LEDGER_BALANCE_TOLERANCE + BALANCE_EPSILON) {
    errors.push(
      `Debit and credit totals must be equal (debit ${roundAmount(debitTotal)}, credit ${roundAmount(creditTotal)})`,
    );
  }

  // Lock date: never move a record into a closed period. Both dates must be strictly after the
  // lock date, matching `lockLedgerRecords`, which locks every record dated on or before it
  if (ctx.ledgerLock) {
    const { ledgerLock } = ctx;
    if (compareTimelessDates(input.invoiceDate, ledgerLock) <= 0) {
      errors.push(`Invoice date must be after the ledger lock date (${ledgerLock})`);
    }
    if (compareTimelessDates(input.valueDate, ledgerLock) <= 0) {
      errors.push(`Value date must be after the ledger lock date (${ledgerLock})`);
    }
  }

  return errors;
}

/**
 * Derive the charge a manual ledger record creates when it is inserted without one: it is described
 * by the record's description, else its reference, else not at all. Everything else (status, owner)
 * is left to the charge's defaults and the caller.
 */
export function deriveNewChargeFromLedgerInput(input: LedgerRecordInput): {
  userDescription: string | null;
} {
  return {
    userDescription: input.description?.trim() || input.reference?.trim() || null,
  };
}

/** The misc expense a manual ledger record represents, before it is attached to a charge */
export type ManualLedgerRecordMiscExpense = Omit<IInsertExpenseParams, 'chargeId' | 'ownerId'> & {
  amount: number;
  valueDate: Date;
};

/**
 * Derive the misc expense backing a manual MISC_EXPENSE ledger record from its slot-1 line: the
 * credit entity is the creditor, the debit entity the debtor, and the amount is the credit slot-1
 * amount in the record's currency (the foreign amount for a foreign-currency record). Slot 2 (e.g.
 * VAT) stays on the ledger record only.
 */
export function deriveMiscExpenseFromLedgerInput(
  input: LedgerRecordInput,
  ctx: { localCurrency: Currency },
): ManualLedgerRecordMiscExpense {
  const amount =
    input.currency === ctx.localCurrency ? input.creditLocalAmount1 : input.creditForeignAmount1;
  if (!isPresent(amount)) {
    // Unreachable after `validateManualLedgerRecord`, which requires it
    throw new Error(`Credit 1: foreign amount is required for ${input.currency} records`);
  }
  return {
    creditorId: input.creditEntity1,
    debtorId: input.debitEntity1,
    amount,
    currency: input.currency,
    description: input.description ?? null,
    invoiceDate: input.invoiceDate,
    // A timestamp column: store local midnight so the ledger generator, which reads it back with
    // `dateToTimelessDateString`, lands on the same calendar day in every timezone
    valueDate: timelessDateStringToLocalDate(input.valueDate),
  };
}

/** The document a manual ledger record represents, before it is attached to a charge */
export type ManualLedgerRecordDocument = Omit<
  IInsertDocumentsParams['documents'][number],
  'chargeId' | 'ownerId'
>;

/**
 * A slot's amount in the record's currency: the foreign amount for a foreign-currency record,
 * otherwise the local amount
 */
function slotAmount(
  {
    label,
    localAmount,
    foreignAmount,
  }: Pick<LedgerSlot, 'label' | 'localAmount' | 'foreignAmount'>,
  isLocalCurrency: boolean,
  currency: Currency,
): number {
  const amount = isLocalCurrency ? localAmount : foreignAmount;
  if (!isPresent(amount)) {
    // Unreachable after `validateManualLedgerRecord`, which requires it
    throw new Error(
      isLocalCurrency
        ? `${label}: amount is required`
        : `${label}: foreign amount is required for ${currency} records`,
    );
  }
  return amount;
}

/**
 * Derive the INVOICE document backing a manual DOCUMENT ledger record. The counterparty is the one
 * slot-1 entity that is a business: on the credit side the record is an expense (the counterparty
 * is the creditor and the charge owner the debtor), on the debit side an income (the reverse). The
 * document's total is the counterparty's slot-1 amount. Its VAT is the slot-2 amount on the side
 * opposite the counterparty (debit 2 for an expense, credit 2 for an income) when that slot holds
 * the input or output VAT tax category, and 0 otherwise.
 *
 * Throws an `Error` with an end-user readable message when no single business counterparty can be
 * found, or when it is the charge owner.
 */
export function deriveDocumentFromLedgerInput(
  input: LedgerRecordInput,
  ctx: {
    ownerId: string;
    localCurrency: Currency;
    entityTypes: Map<string, string>;
    inputVatTaxCategoryId?: string | null;
    outputVatTaxCategoryId?: string | null;
  },
): ManualLedgerRecordDocument {
  const isDebitBusiness = ctx.entityTypes.get(input.debitEntity1) === 'business';
  const isCreditBusiness = ctx.entityTypes.get(input.creditEntity1) === 'business';
  if (isDebitBusiness === isCreditBusiness) {
    throw new Error(
      'A document needs exactly one business among the main debit and credit entities',
    );
  }

  // An expense when the counterparty is on the credit side, an income when it is on the debit side
  const isExpense = isCreditBusiness;
  const counterpartyId = isExpense ? input.creditEntity1 : input.debitEntity1;
  const counterpartySlot = isExpense
    ? {
        label: 'Credit 1',
        localAmount: input.creditLocalAmount1,
        foreignAmount: input.creditForeignAmount1,
      }
    : {
        label: 'Debit 1',
        localAmount: input.debitLocalAmount1,
        foreignAmount: input.debitForeignAmount1,
      };
  const vatSlot = isExpense
    ? {
        label: 'Debit 2',
        entity: input.debitEntity2,
        localAmount: input.debitLocalAmount2,
        foreignAmount: input.debitForeignAmount2,
      }
    : {
        label: 'Credit 2',
        entity: input.creditEntity2,
        localAmount: input.creditLocalAmount2,
        foreignAmount: input.creditForeignAmount2,
      };
  if (counterpartyId === ctx.ownerId) {
    throw new Error("A document's counterparty cannot be the charge owner");
  }

  const isLocalCurrency = input.currency === ctx.localCurrency;
  const vatCategoryIds = [ctx.inputVatTaxCategoryId, ctx.outputVatTaxCategoryId].filter(isPresent);
  const vat =
    vatSlot.entity && vatCategoryIds.includes(vatSlot.entity)
      ? slotAmount(vatSlot, isLocalCurrency, input.currency)
      : 0;

  return {
    documentType: DocumentType.Invoice,
    creditorId: isExpense ? counterpartyId : ctx.ownerId,
    debtorId: isExpense ? ctx.ownerId : counterpartyId,
    amount: slotAmount(counterpartySlot, isLocalCurrency, input.currency),
    currencyCode: input.currency,
    vat,
    serialNumber: input.reference ?? null,
    date: input.invoiceDate,
    description: input.description ?? null,
    image: null,
    file: null,
    vatReportDateOverride: null,
    noVatAmount: null,
    allocationNumber: null,
    exchangeRateOverride: null,
    fileHash: null,
    remarks: null,
  };
}
