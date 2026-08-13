import { z } from 'zod';

/**
 * Asserts every field the vars mapper reads off `View.Meta`. This must stay in
 * step with `poalimSecuritiesInfoVars` — the object is `.loose()`, so anything left
 * out here is typed `unknown` and reaches the mutation completely unchecked.
 *
 * `View.Account` (live balances) and `View.Orders` are deliberately ignored.
 */
const SecurityInfoItemSchema = z
  .object({
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
  })
  .loose();

export const PoalimSecuritiesInfoPayloadSchema = z
  .object({
    View: z
      .object({
        Meta: z
          .object({
            '-AsOfDate': z.string(),
            // Accounts with no securities portfolio omit this entirely.
            Security: z.array(SecurityInfoItemSchema).default([]),
          })
          .loose(),
      })
      .loose(),
  })
  .loose();

export type PoalimSecuritiesInfoPayload = z.infer<typeof PoalimSecuritiesInfoPayloadSchema>;
