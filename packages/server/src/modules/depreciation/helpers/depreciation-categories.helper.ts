/**
 * Validates a category's annual rate, in percent: 0 (a category that is not depreciated, such as
 * trademarks) up to 100. Returns an error message, or null when valid or not given.
 */
export function validateDepreciationPercentage(
  percentage: number | null | undefined,
): string | null {
  if (percentage == null) {
    return null;
  }
  if (!Number.isFinite(percentage) || percentage < 0 || percentage > 100) {
    return 'Depreciation percentage must be between 0 and 100 (0 for a category that is not depreciated)';
  }
  return null;
}
