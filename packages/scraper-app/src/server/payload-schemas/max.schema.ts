import { z } from 'zod';

// Matches MaxTransaction from @accounter/modern-poalim-scraper
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

// Matches TransactionsAccount (MaxScrapingResult element)
const MaxAccountSchema = z.object({
  accountNumber: z.string(),
  txns: z.array(MaxTransactionSchema),
});

// MaxScrapingResult = TransactionsAccount[]
export const MaxPayloadSchema = z.array(MaxAccountSchema);

export type MaxPayload = z.infer<typeof MaxPayloadSchema>;
