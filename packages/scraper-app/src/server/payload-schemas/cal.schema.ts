import { z } from 'zod';

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

const DebitDateSchema = z
  .object({
    date: z.string(),
    transactions: z.array(CalTransactionSchema),
  })
  .loose();

const BankAccountSchema = z
  .object({
    bankName: z.string(),
    bankAccountNum: z.string(),
    debitDates: z.array(DebitDateSchema),
  })
  .loose();

export const CalPayloadSchema = z
  .object({
    result: z
      .object({
        bankAccounts: z.array(BankAccountSchema),
      })
      .loose(),
    statusCode: z.number(),
    statusDescription: z.string(),
  })
  .loose();

export type CalPayload = z.infer<typeof CalPayloadSchema>;
