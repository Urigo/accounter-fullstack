/**
 * Key generator utility for generating unique identifiers
 * Used for fields 1004, 1103, and 1153 which require randomly generated unique IDs
 */

/**
 * Generates a random numeric string of specified length
 * @param length - The length of the numeric string to generate (max 15 digits)
 * @returns A random numeric string padded with leading zeros if necessary
 */
export function generateRandomKey(length: number = 15): string {
  if (length <= 0 || length > 15) {
    throw new Error('Key length must be between 1 and 15 digits');
  }

  // Generate a random number with the specified number of digits
  // For length 15, max value is 999,999,999,999,999 (15 nines)
  const maxValue = Math.pow(10, length) - 1;
  const minValue = Math.pow(10, length - 1); // Ensures we always get the full length

  // Generate random number between minValue and maxValue
  const randomNum = Math.floor(Math.random() * (maxValue - minValue + 1)) + minValue;

  // Convert to string and pad with zeros if needed
  return randomNum.toString().padStart(length, '0');
}

/**
 * Generates a primary identifier for fields 1004, 1103, and 1153
 * These fields must have the same value across all records in a single file
 * @returns A 15-digit numeric string
 */
export function generatePrimaryIdentifier(): string {
  return generateRandomKey(15);
}

/**
 * Key generator context to maintain consistent IDs across records
 * This ensures that fields 1004, 1103, and 1153 use the same value within a single file
 */
export class KeyGeneratorContext {
  private _primaryIdentifier: string | null = null;

  /**
   * Gets or generates the primary identifier for this context
   * Ensures the same ID is used across all records that require it
   */
  getPrimaryIdentifier(): string {
    if (!this._primaryIdentifier) {
      this._primaryIdentifier = generatePrimaryIdentifier();
    }
    return this._primaryIdentifier;
  }

  /**
   * Resets the context, generating new IDs for the next file
   */
  reset(): void {
    this._primaryIdentifier = null;
  }

  /**
   * Sets a specific primary identifier (useful for testing or when you have a specific ID requirement)
   */
  setPrimaryIdentifier(id: string): void {
    if (!/^\d{1,15}$/.test(id)) {
      throw new Error('Primary identifier must be a numeric string with 1-15 digits');
    }
    this._primaryIdentifier = id.padStart(15, '0');
  }
}

/**
 * Default key generator context instance
 * Use this for most cases to ensure consistency across records
 */
export const defaultKeyGenerator = new KeyGeneratorContext();
