/** Blank strings are how the securities feed spells "not reported"; null is the honest form. */
const clean = (value: string | null | undefined): string | null => value?.trim() || null;

/**
 * The name a security business is listed under, everywhere businesses are listed.
 *
 * `ENGNAME (SYMBOL)` mirrors how a security is already labelled on a charge, so the same
 * instrument reads the same in both places. Falls back through the descriptors the feed
 * actually provides, ending at the ISIN — unreadable, but never empty and never ambiguous.
 */
export function buildSecurityBusinessName(descriptors: {
  isin: string;
  engName?: string | null;
  symbol?: string | null;
}): string {
  const engName = clean(descriptors.engName);
  const symbol = clean(descriptors.symbol);

  if (engName && symbol) {
    return `${engName} (${symbol})`;
  }
  return engName ?? symbol ?? descriptors.isin;
}
