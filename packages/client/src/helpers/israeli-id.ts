/** Strips the spaces and dashes people type into ID numbers (e.g. `51-623267-5`) */
export function normalizeIsraeliId(raw: string): string {
  return raw.replace(/[\s-]/g, '');
}

/**
 * Validates the check digit of an Israeli ID number (ת.ז.) or company number (ח.פ.), which share
 * the same alternating ×1/×2 checksum. IDs shorter than 9 digits are left-padded with zeros.
 */
export function isValidIsraeliId(raw: string): boolean {
  const id = normalizeIsraeliId(raw);
  if (!/^\d{5,9}$/.test(id)) {
    return false;
  }
  const padded = id.padStart(9, '0');
  const sum = Array.from(padded, Number).reduce((total, digit, index) => {
    const step = digit * ((index % 2) + 1);
    return total + (step > 9 ? step - 9 : step);
  }, 0);
  return sum % 10 === 0;
}
