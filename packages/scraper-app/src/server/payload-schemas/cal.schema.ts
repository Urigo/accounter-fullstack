import { z } from 'zod';

// Matches CalTransaction from @accounter/modern-poalim-scraper
const CalTransactionSchema = z
  .object({
    trnIntId: z.string(),
    merchantName: z.string(),
    trnPurchaseDate: z.string(),
    trnAmt: z.number(),
    trnCurrencySymbol: z.string(),
    trnType: z.string(),
    debCrdDate: z.string(),
    amtBeforeConvAndIndex: z.number(),
    debCrdCurrencySymbol: z.string(),
  })
  .loose();

// One entry per (card, month) pair scraped
const CalMonthResultSchema = z.object({
  card: z.string(),
  month: z.string(),
  transactions: z.array(CalTransactionSchema),
});

export const CalPayloadSchema = z.array(CalMonthResultSchema);

export type CalPayload = z.infer<typeof CalPayloadSchema>;
