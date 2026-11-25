/**
 * Codes whose values the package derives from other input (SPEC §7.4, "Derived values"); callers
 * never pass them (`input.derivedCode`). codes.csv has no column for this, so it is kept here and
 * becomes `CodeDef.derived` in the generated layout.
 */
export const DERIVED_CODES: Readonly<Record<string, readonly string[]>> = {
  /** 008 accounting standards, 028 forms attached, 273 declarations 1029/1030, 277/278/280 bank
   *  account, 297 form 6111 obligation. */
  '1000': ['008', '028', '273', '277', '278', '280', '297'],
  /** "Code 50 – improvement N", from `improvements[i].code50Amount`. */
  '3077': ['501', '502', '503', '504', '505'],
};
