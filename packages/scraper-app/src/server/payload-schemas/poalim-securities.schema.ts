import { z } from 'zod';

/**
 * Asserts only what the vars mapper reads off `View.Meta`. The scraper already
 * validates the full response; this is the narrower contract this app depends on.
 * `View.Account` (live balances) and `View.Orders` are deliberately ignored.
 */
const SecurityItemSchema = z
  .object({
    '-Key': z.string(),
    EngName: z.string(),
    HebName: z.string(),
    ItemType: z.string(),
    IsForeign: z.boolean(),
    CurrencyCode: z.string(),
    Exchange: z.string(),
    EquityType: z.number(),
    EquitySubType: z.number(),
  })
  .loose();

export const PoalimSecuritiesPayloadSchema = z
  .object({
    View: z
      .object({
        Meta: z
          .object({
            '-AsOfDate': z.string(),
            Security: z.array(SecurityItemSchema),
          })
          .loose(),
      })
      .loose(),
  })
  .loose();

export type PoalimSecuritiesPayload = z.infer<typeof PoalimSecuritiesPayloadSchema>;
