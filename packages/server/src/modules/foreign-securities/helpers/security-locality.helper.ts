import { countryCodeToAlpha2 } from '../../../shared/helpers/index.js';

export type SecurityLocality = 'LOCAL' | 'FOREIGN';

/** ISO 3166-1 alpha-2 — how the bank reports the issuer country, and how an ISIN starts. */
const COUNTRY_CODE_PATTERN = /^[A-Z]{2}$/;

const asCountryCode = (value: string | null | undefined): string | null => {
  const code = value?.trim().toUpperCase();
  return code && COUNTRY_CODE_PATTERN.test(code) ? code : null;
};

/**
 * Whether a security is local or foreign to the tenant, by where its issuer is: a dividend of a
 * local company listed abroad is still a local dividend, and a local fund denominated in dollars is
 * still a local fund. Falls back to the ISIN's country prefix when the issuer country is missing.
 * Null when neither is readable — unknown is not the same as foreign.
 *
 * `locality` is the tenant's own country as stored (`user_context.locality`, alpha-3).
 */
export function getSecurityLocality(
  security: { issuer_country_code?: string | null; isin?: string | null },
  locality: string,
): SecurityLocality | null {
  const localCountryCode = countryCodeToAlpha2(locality);
  if (!localCountryCode) {
    throw new Error(`Unknown tenant locality "${locality}"`);
  }

  const countryCode =
    asCountryCode(security.issuer_country_code) ?? asCountryCode(security.isin?.trim().slice(0, 2));
  if (!countryCode) {
    return null;
  }
  return countryCode === localCountryCode ? 'LOCAL' : 'FOREIGN';
}
