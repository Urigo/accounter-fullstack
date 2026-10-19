/** The country a security counts as local to: the tenant's books are kept in Israel. */
const LOCAL_COUNTRY_CODE = 'IL';

/** ISO 3166-1 alpha-2 — what the feed reports as the issuer country, and how an ISIN opens. */
const COUNTRY_CODE_PATTERN = /^[A-Z]{2}$/;

const asCountryCode = (value: string | null | undefined): string | null => {
  const code = value?.trim().toUpperCase();
  return code && COUNTRY_CODE_PATTERN.test(code) ? code : null;
};

/**
 * Whether a security is foreign, judged by where its issuer is based.
 *
 * The trading currency says nothing here: Israeli funds and bonds denominated in dollars are
 * still local. The issuer's country is what the securities feed reports for that, and the
 * ISIN's country prefix is the fallback when it is missing. Null when neither is readable —
 * unknown is not the same as foreign.
 */
export function isForeignSecurity(descriptors: {
  issuerCountryCode?: string | null;
  isin?: string | null;
}): boolean | null {
  const countryCode =
    asCountryCode(descriptors.issuerCountryCode) ??
    asCountryCode(descriptors.isin?.trim().slice(0, 2));
  return countryCode ? countryCode !== LOCAL_COUNTRY_CODE : null;
}
