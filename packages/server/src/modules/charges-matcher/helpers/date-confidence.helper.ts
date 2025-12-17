/**
 * Calculate the absolute difference in days between two dates
 * Ignores time components by comparing only the date parts
 * @param date1 - First date
 * @param date2 - Second date
 * @returns Absolute difference in days
 */
function calculateDaysDifference(date1: Date, date2: Date): number {
  // Create new dates with time set to midnight to ignore time components
  const d1 = new Date(date1.getFullYear(), date1.getMonth(), date1.getDate());
  const d2 = new Date(date2.getFullYear(), date2.getMonth(), date2.getDate());

  // Calculate difference in milliseconds
  const diffMs = Math.abs(d1.getTime() - d2.getTime());

  // Convert to days
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  return diffDays;
}

/**
 * Calculate confidence score based on date proximity
 *
 * Client-Aware Logic:
 * - Client same-business matches: Always return 1.0
 *   This allows amount/currency matching to be primary ranking factors for recurring charges from clients
 * - Non-client or cross-business matches: Apply linear degradation (1.0 same-day to 0.0 at 30+ days)
 *
 * @param date1 - First date
 * @param date2 - Second date
 * @param isClientMatch - Whether transaction business matches document business AND is a registered CLIENT (default: false)
 * @returns Confidence score from 0.0 (30+ days) to 1.0 (same day for non-client, always for client)
 */
export function calculateDateConfidence(
  date1: Date,
  date2: Date,
  isClientMatch: boolean = false,
): number {
  // Client same-business matches: no date penalty, return flat confidence
  if (isClientMatch) {
    return 1.0;
  }

  const daysDiff = calculateDaysDifference(date1, date2);

  // 30 or more days: return 0.0
  if (daysDiff >= 30) {
    return 0.0;
  }

  // Linear degradation: 1.0 - (days_diff / 30)
  const confidence = 1.0 - daysDiff / 30;

  // Round to 2 decimal places
  return Math.round(confidence * 100) / 100;
}
