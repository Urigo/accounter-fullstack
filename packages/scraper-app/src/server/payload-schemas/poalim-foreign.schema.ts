import { z } from 'zod';

const ForeignTransactionSchema = z
  .object({
    activityDescription: z.string(),
    activityTypeCode: z.number(),
    eventAmount: z.number(),
    currencySwiftCode: z.string(),
    currencyRate: z.number(),
    currentBalance: z.number(),
    referenceNumber: z.number(),
    transactionType: z.string(),
  })
  .loose();

const BalancesAndLimitsItemSchema = z
  .object({
    currencySwiftCode: z.string(),
    currencyCode: z.number(),
    transactions: z.array(ForeignTransactionSchema),
  })
  .loose();

export const PoalimForeignPayloadSchema = z
  .object({
    balancesAndLimitsDataList: z.array(BalancesAndLimitsItemSchema),
  })
  .loose();
