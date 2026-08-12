import type { IGetSecuritiesByKeysResult } from './__generated__/foreign-securities.types.js';

export type * from './__generated__/types.js';
export type * from './__generated__/foreign-securities.types.js';

/** A row of `accounter_schema.poalim_securities`, as selected by `getSecuritiesByKeys`. */
export type SecurityRow = IGetSecuritiesByKeysResult;

export type ChargeSecurityProto = {
  /** Scoped to the charge so the client cache keeps a key's entries distinct per charge. */
  id: string;
  securityKey: string;
  details: SecurityRow | null;
  transactionIds: string[];
};
