import { z } from 'zod';

const MaxTransactionSchema = z
  .object({
    cardIndex: z.number(),
    categoryId: z.number(),
    merchantName: z.string(),
    originalAmount: z.number(),
    originalCurrency: z.string(),
    purchaseDate: z.string(),
    uid: z.string(),
    planName: z.string(),
    planTypeId: z.number(),
  })
  .loose();

export const MaxPayloadSchema = z
  .object({
    result: z
      .object({
        transactions: z.array(MaxTransactionSchema),
      })
      .loose()
      .nullable(),
    returnCode: z.number(),
  })
  .loose();

export type MaxPayload = z.infer<typeof MaxPayloadSchema>;
