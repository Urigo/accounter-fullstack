import { z } from 'zod';

const SwiftItemSchema = z
  .object({
    startDate: z.number(),
    swiftStatusCode: z.string(),
    amount: z.number(),
    currencyCodeCatenatedKey: z.string(),
    chargePartyName: z.string(),
    referenceNumber: z.string(),
    transferCatenatedId: z.string(),
  })
  .loose();

export const PoalimSwiftPayloadSchema = z
  .object({
    swiftsList: z.array(SwiftItemSchema),
  })
  .loose();
