import { ReportEntry } from '../types/index.js';
import { padOrTrim } from '../utils/generation-utils.js';

/**
 * Generates a fixed-width formatted string for the report entries section.
 * @param entries An array of ReportEntry objects.
 * @remarks If more than 150 entries are provided, only the first 150 will be included in the output.
 * @returns A string formatted according to the specification, 2700 characters long.
 */
export function generateReportEntriesSection(entries: ReportEntry[]): string {
  const formattedEntries = entries.map(entry => {
    const code = padOrTrim(entry.code.toFixed(0), 5);
    const isNegative = entry.amount < 0;
    const absAmount = padOrTrim(Math.abs(entry.amount).toFixed(0), isNegative ? 12 : 13);
    const amount = ((isNegative ? '-' : '') + absAmount).slice(0, 13);
    return code + amount;
  });

  // Add phantom records if less than 150 entries
  const phantomRecord = '000000000000000000';
  while (formattedEntries.length < 150) {
    formattedEntries.push(phantomRecord);
  }

  // Join all entries into a single string
  const result = formattedEntries.join('');

  // Ensure the result is exactly 2700 characters long
  return result.slice(0, 2700);
}
