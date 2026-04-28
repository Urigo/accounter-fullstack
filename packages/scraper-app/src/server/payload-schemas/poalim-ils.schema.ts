import { z } from 'zod';

const IlsTransactionSchema = z
  .object({
    activityDescription: z.string(),
    activityTypeCode: z.number(),
    eventAmount: z.number(),
    eventDate: z.number(),
    serialNumber: z.number(),
    transactionType: z.enum(['REGULAR', 'TODAY', 'FUTURE']),
    currentBalance: z.number(),
    referenceNumber: z.number(),
  })
  .loose();

const RetrievalTransactionDataSchema = z
  .object({
    accountNumber: z.number(),
    branchNumber: z.number(),
    bankNumber: z.number(),
  })
  .loose();

export const PoalimIlsPayloadSchema = z
  .object({
    transactions: z.array(IlsTransactionSchema),
    retrievalTransactionData: RetrievalTransactionDataSchema,
  })
  .loose();

export type PoalimIlsPayload = z.infer<typeof PoalimIlsPayloadSchema>;
