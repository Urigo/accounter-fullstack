import { ReportEntry } from '../types/index.js';

/**
 * Parses report entries from the content for a specific section
 * @param content - The full report content
 * @param section - The section to parse ('profitAndLoss', 'taxAdjustment', or 'balanceSheet')
 * @returns Array of ReportEntry objects, with filler records filtered out
 */
export function parseReportEntries(
  content: string,
  section: 'profitAndLoss' | 'taxAdjustment' | 'balanceSheet',
): ReportEntry[] {
  // Define starting positions based on the specification
  const startPosition = {
    profitAndLoss: 512, // Position 512 according to spec
    taxAdjustment: 3212, // Position 3212 according to spec
    balanceSheet: 5912, // Position 5912 according to spec
  };

  // Determine maximum number of entries (150 for each section according to spec)
  const maxEntries = 150;
  const entryLength = 18; // Each entry is 18 bytes (5 digits code + 13 digits amount)

  const entries: ReportEntry[] = [];

  // Start position for this section
  const position = startPosition[section];

  // Parse each entry
  for (let i = 0; i < maxEntries; i++) {
    const entryStartPos = position + i * entryLength;
    const entryEndPos = entryStartPos + entryLength;

    // Extract the entry if content is long enough
    if (content.length >= entryEndPos) {
      const codeStr = content.substring(entryStartPos, entryStartPos + 5).trim();
      const amountStr = content.substring(entryStartPos + 5, entryEndPos).trim();

      // Parse code and amount
      const code = parseInt(codeStr || '0');
      let amount = 0;

      if (amountStr) {
        // Check if the amount is negative (sign in leftmost position)
        const isNegative = amountStr.charAt(0) === '-';
        // Remove sign if present, then parse
        const absAmountStr = isNegative ? amountStr.substring(1) : amountStr;
        amount = parseInt(absAmountStr || '0');

        // Apply negative sign if needed
        if (isNegative) {
          amount = -amount;
        }
      }

      // Filter out filler records (code 0 and amount 0)
      if (!(code === 0 && amount === 0)) {
        entries.push({ code, amount });
      }
    }
  }

  return entries;
}
