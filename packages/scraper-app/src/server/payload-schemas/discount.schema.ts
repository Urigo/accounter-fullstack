import { z } from 'zod';

const DiscountTransactionSchema = z
  .object({
    OperationDate: z.string(),
    ValueDate: z.string(),
    OperationDescription: z.string(),
    OperationAmount: z.number(),
    BalanceAfterOperation: z.number(),
    OperationNumber: z.number(),
  })
  .loose();

export const DiscountPayloadSchema = z
  .object({
    CurrentAccountLastTransactions: z
      .object({
        CurrentAccountInfo: z
          .object({
            AccountBalance: z.number(),
            AccountCurrencyCode: z.string(),
          })
          .loose(),
        OperationEntry: z.array(DiscountTransactionSchema),
      })
      .loose(),
  })
  .loose();

export type DiscountPayload = z.infer<typeof DiscountPayloadSchema>;
