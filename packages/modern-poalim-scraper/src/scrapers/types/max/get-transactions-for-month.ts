import { z } from 'zod';

const transactionDealDataSchema = z.object({
  arn: z.string(),
});

const maxTransactionSchema = z.object({
  shortCardNumber: z.string(),
  paymentDate: z.string().optional(),
  purchaseDate: z.string(),
  actualPaymentAmount: z.string(),
  paymentCurrency: z.union([z.number(), z.null()]),
  originalCurrency: z.string(),
  originalAmount: z.number(),
  planName: z.string(),
  planTypeId: z.number(),
  comments: z.string(),
  merchantName: z.string(),
  categoryId: z.number(),
  fundsTransferComment: z.string().optional(),
  fundsTransferReceiverOrTransfer: z.string().optional(),
  dealData: transactionDealDataSchema.optional(),
});
export type MaxTransaction = z.infer<typeof maxTransactionSchema>;

const resultSchema = z.object({
  transactions: z.array(maxTransactionSchema),
});

export const maxTransactionsSchema = z.object({
  result: resultSchema,
});
