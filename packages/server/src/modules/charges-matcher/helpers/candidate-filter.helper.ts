import {
  getTimelessDateDay,
  getTimelessDateMonth,
  getTimelessDateYear,
  timelessDateFromParts,
} from '../../../shared/helpers/index.js';
import type { TimelessDateString } from '../../../shared/types/index.js';
import type { Document, Transaction } from '../types.js';

/**
 * Filter transactions that should be excluded from matching
 * Excludes transactions marked as fees (is_fee = true)
 * @param transaction - Transaction to check
 * @returns true if transaction should be included in matching
 */
export function isValidTransactionForMatching(transaction: Transaction): boolean {
  // Exclude fee transactions
  return !transaction.is_fee;
}

/**
 * Filter documents that should be excluded from matching
 * Excludes documents with null mandatory fields (total_amount or currency_code)
 * @param document - Document to check
 * @returns true if document should be included in matching
 */
export function isValidDocumentForMatching(document: Document): boolean {
  // Document must have total_amount (can be zero, but not null)
  if (document.total_amount === null || document.total_amount === undefined) {
    return false;
  }

  // Document must have currency_code
  if (!document.currency_code) {
    return false;
  }

  return true;
}

/**
 * Calculate the ±windowMonths date window around a reference date (both bounds inclusive).
 * A day that does not exist in the target month rolls over into the next one, like `Date#setMonth`
 * (e.g. 2024-02-29 - 12 months = 2023-03-01).
 * @param referenceDate - Center point of the window
 * @param windowMonths - Number of months before/after (default 12)
 */
export function getDateWindow(
  referenceDate: TimelessDateString,
  windowMonths: number = 12,
): { minDate: TimelessDateString; maxDate: TimelessDateString } {
  const year = getTimelessDateYear(referenceDate);
  const month = getTimelessDateMonth(referenceDate);
  const day = getTimelessDateDay(referenceDate);
  return {
    minDate: timelessDateFromParts(year, month - windowMonths, day),
    maxDate: timelessDateFromParts(year, month + windowMonths, day),
  };
}

/**
 * Check if a date falls within the matching window
 * Window is calculated as ±windowMonths from the reference date
 * @param candidateDate - Date to check
 * @param referenceDate - Center point of the window
 * @param windowMonths - Number of months before/after (default 12)
 * @returns true if within window
 */
export function isWithinDateWindow(
  candidateDate: TimelessDateString,
  referenceDate: TimelessDateString,
  windowMonths: number = 12,
): boolean {
  const { minDate, maxDate } = getDateWindow(referenceDate, windowMonths);

  // Check if candidate is within range (inclusive)
  return candidateDate >= minDate && candidateDate <= maxDate;
}
