import { z } from 'zod';

const TxnIsraelSchema = z
  .object({
    cardIndex: z.string(),
    supplierName: z.string().nullable(),
    dealSum: z.string().nullable(),
    fullPurchaseDate: z.string().nullable(),
    purchaseDate: z.string().nullable(),
    voucherNumber: z.string().nullable(),
    voucherNumberRatz: z.string(),
  })
  .loose();

const TxnAbroadSchema = z
  .object({
    cardIndex: z.string(),
    fullSupplierNameOutbound: z.string(),
    dealSumOutbound: z.string().nullable(),
    fullPurchaseDateOutbound: z.string().nullable(),
    paymentSumOutbound: z.string(),
    voucherNumberRatzOutbound: z.string(),
  })
  .loose();

const CurrentCardTransactionsSchema = z
  .object({
    '@cardTransactions': z.string(),
    txnIsrael: z.array(TxnIsraelSchema).nullable().optional(),
    txnAbroad: z.array(TxnAbroadSchema).nullable().optional(),
  })
  .loose();

const IndexSchema = z
  .object({
    '@AllCards': z.string(),
    CurrentCardTransactions: z.array(CurrentCardTransactionsSchema),
  })
  .loose();

const HeaderSchema = z
  .object({
    Status: z.string(),
    Message: z.string().nullable(),
  })
  .loose();

export const IsracardPayloadSchema = z
  .object({
    Header: HeaderSchema,
    CardsTransactionsListBean: z
      .object({
        Index0: IndexSchema,
      })
      .loose(),
  })
  .loose();

export type IsracardPayload = z.infer<typeof IsracardPayloadSchema>;
