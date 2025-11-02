/**
 * Calculate the absolute difference between two numbers as a percentage of the smaller absolute value
 * @param amount1 - First amount
 * @param amount2 - Second amount
 * @returns Percentage difference (0-100+)
 */
function calculatePercentageDiff(amount1: number, amount2: number): number {
  const abs1 = Math.abs(amount1);
  const abs2 = Math.abs(amount2);
  const smallerAmount = Math.min(abs1, abs2);

  // Handle zero amounts - if one is zero, we can't calculate percentage
  // In this case, treat any difference > 1 as beyond 20%
  if (smallerAmount === 0) {
    return 100; // Return a high percentage to indicate no match
  }

  const diff = Math.abs(abs1 - abs2);
  return (diff / smallerAmount) * 100;
}

/**
 * Calculate confidence score based on amount similarity
 * @param transactionAmount - The transaction amount (signed number)
 * @param documentAmount - The normalized document amount (signed number)
 * @returns Confidence score between 0.0 and 1.0
 */
export function calculateAmountConfidence(
  transactionAmount: number,
  documentAmount: number,
): number {
  // Calculate absolute difference
  const absoluteDiff = Math.abs(Math.abs(transactionAmount) - Math.abs(documentAmount));

  // Exact match (0% difference): 1.0
  if (absoluteDiff === 0) {
    return 1.0;
  }

  // Within 1 currency unit: 0.9
  if (absoluteDiff <= 1) {
    return 0.9;
  }

  // Calculate percentage difference for amounts beyond 1 unit
  const percentageDiff = calculatePercentageDiff(transactionAmount, documentAmount);

  // 20%+ difference: 0.0
  if (percentageDiff >= 20) {
    return 0.0;
  }

  // Between 1 unit and 20% difference: Linear degradation from 0.7 to 0.0
  // We need to determine which threshold is reached first:
  // - The absolute difference exceeds 1 unit (already true at this point)
  // - The percentage difference reaches 20%

  // Linear interpolation from 0.7 (at percentage start) to 0.0 (at 20%)
  // We need to find where we are in the range

  // Calculate what percentage corresponds to 1 unit difference
  const abs1 = Math.abs(transactionAmount);
  const abs2 = Math.abs(documentAmount);
  const smallerAmount = Math.min(abs1, abs2);

  const oneUnitPercentage = (1 / smallerAmount) * 100;

  // If we're still within the percentage range that corresponds to 1 unit,
  // this shouldn't happen since we already checked absoluteDiff <= 1 above
  // But just in case of floating point issues
  if (percentageDiff <= oneUnitPercentage) {
    return 0.9;
  }

  // Linear degradation from 0.7 to 0.0 over the range [oneUnitPercentage, 20%]
  const rangeStart = oneUnitPercentage;
  const rangeEnd = 20;
  const rangeSpan = rangeEnd - rangeStart;

  // How far are we into this range? (0.0 = at start, 1.0 = at end)
  const position = (percentageDiff - rangeStart) / rangeSpan;

  // Linear degradation from 0.7 to 0.0
  const confidence = 0.7 * (1 - position);

  // Round to 2 decimal places
  return Math.round(confidence * 100) / 100;
}
