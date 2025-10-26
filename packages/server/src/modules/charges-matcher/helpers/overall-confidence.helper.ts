/**
 * Overall Confidence Calculator
 *
 * Combines individual confidence scores (amount, currency, business, date)
 * into a single weighted overall confidence score.
 *
 * Formula: (amount × 0.4) + (currency × 0.2) + (business × 0.3) + (date × 0.1)
 */

export interface ConfidenceComponents {
  amount: number;
  currency: number;
  business: number;
  date: number;
}

/**
 * Weights for each confidence component
 */
const CONFIDENCE_WEIGHTS = {
  amount: 0.4,
  currency: 0.2,
  business: 0.3,
  date: 0.1,
} as const;

/**
 * Calculate overall confidence score from individual components
 *
 * @param components - Individual confidence scores (each 0.0 to 1.0)
 * @returns Weighted overall confidence score (0.0 to 1.0, rounded to 2 decimals)
 *
 * @throws {Error} If any component is null or undefined
 * @throws {Error} If any component is outside the valid range [0.0, 1.0]
 *
 * @example
 * // Perfect match
 * calculateOverallConfidence({
 *   amount: 1.0,
 *   currency: 1.0,
 *   business: 1.0,
 *   date: 1.0
 * }) // Returns 1.0
 *
 * @example
 * // Mixed confidence
 * calculateOverallConfidence({
 *   amount: 0.9,
 *   currency: 1.0,
 *   business: 0.5,
 *   date: 0.8
 * }) // Returns 0.79
 */
export function calculateOverallConfidence(components: ConfidenceComponents): number {
  // Validate all components are present
  if (components.amount == null) {
    throw new Error('Amount confidence is required');
  }
  if (components.currency == null) {
    throw new Error('Currency confidence is required');
  }
  if (components.business == null) {
    throw new Error('Business confidence is required');
  }
  if (components.date == null) {
    throw new Error('Date confidence is required');
  }

  // Validate all components are in valid range
  const validateRange = (value: number, name: string): void => {
    if (value < 0.0 || value > 1.0) {
      throw new Error(`${name} confidence must be between 0.0 and 1.0, got ${value}`);
    }
  };

  validateRange(components.amount, 'Amount');
  validateRange(components.currency, 'Currency');
  validateRange(components.business, 'Business');
  validateRange(components.date, 'Date');

  // Calculate weighted sum
  const weightedSum =
    components.amount * CONFIDENCE_WEIGHTS.amount +
    components.currency * CONFIDENCE_WEIGHTS.currency +
    components.business * CONFIDENCE_WEIGHTS.business +
    components.date * CONFIDENCE_WEIGHTS.date;

  // Round to 2 decimal places
  return Math.round(weightedSum * 100) / 100;
}
