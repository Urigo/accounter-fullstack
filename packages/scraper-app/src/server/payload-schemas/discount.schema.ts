import { z } from 'zod';

// Matches DiscountTransaction from @accounter/modern-poalim-scraper
const DiscountTransactionSchema = z
  .object({
    OperationDate: z.string(),
    ValueDate: z.string(),
    OperationCode: z.string(),
    OperationDescription: z.string(),
    OperationAmount: z.number(),
    BalanceAfterOperation: z.number(),
    OperationNumber: z.number(),
  })
  .loose();

// One entry per (accountNumber, month) pair scraped
const DiscountMonthResultSchema = z.object({
  accountNumber: z.string(),
  month: z.string(),
  balance: z.number(),
  transactions: z.array(DiscountTransactionSchema),
});

export const DiscountPayloadSchema = z.array(DiscountMonthResultSchema);

export type DiscountPayload = z.infer<typeof DiscountPayloadSchema>;
