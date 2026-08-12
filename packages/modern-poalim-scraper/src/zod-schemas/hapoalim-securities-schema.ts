import { z } from 'zod';

/**
 * Static reference info for a single security, from the "mytrade" portfolio API
 * (`View.Meta.Security[]`). Keys prefixed with `-` are XML-to-JSON artifacts.
 *
 * Every key is always present; absent values arrive as `null` rather than being
 * omitted. `expirationDate`, `creationEquityNum` and `contractType` were null in
 * every observed row, so they are typed permissively rather than as `z.null()`.
 */
const PoalimSecuritySchema = z.strictObject({
  '-Key': z.string(),
  EngName: z.string(),
  HebName: z.string(),
  ItemType: z.string(),
  IsEtf: z.boolean().nullable(),
  IsForeign: z.boolean(),
  CurrencyCode: z.string(),
  Exchange: z.string(),
  EquityType: z.number(),
  AllowedOrderDirection: z.string().nullable(),
  EquitySubType: z.number(),
  EngSymbol: z.string().nullable(),
  HebSymbol: z.string().nullable(),
  Symbol: z.string().nullable(),
  ExpirationDate: z.string().nullable(),
  StockType: z.string().nullable(),
  CreationEquityNum: z.string().nullable(),
  ContractType: z.string().nullable(),
});

/**
 * Only `View.Meta` is modelled. `View.Account` (live balances and holdings) and
 * `View.Orders` are intentionally left loose — accounter does not consume them,
 * and pinning them down would make the schema churn on every bank-side change.
 */
export const HapoalimSecuritiesSchema = z.looseObject({
  // Account / Orders intentionally unmodelled
  View: z.looseObject({
    Meta: z.strictObject({
      '-AsOfDate': z.string(),
      Security: z.array(PoalimSecuritySchema),
    }),
  }),
});

export type HapoalimSecurities = z.infer<typeof HapoalimSecuritiesSchema>;
export type PoalimSecurity = z.infer<typeof PoalimSecuritySchema>;
