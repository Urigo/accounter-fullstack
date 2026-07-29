import { z } from 'zod';

const transactionDealDataSchema = z
  .object({
    acq: z.string().nullable(),
    adjustmentAmount: z.null(),
    adjustmentType: z.number(),
    amount: z.number().nullable(),
    amountIls: z.number().nullable(),
    amountLeft: z.number().nullable(),
    arn: z.string().nullable(),
    authorizationNumber: z.string(),
    cardName: z.string().nullable(),
    cardToken: z.string().nullable(),
    commissionVat: z.number().nullable(),
    directExchange: z.null(),
    exchangeCommissionAmount: z.null(),
    exchangeCommissionMaam: z.null(),
    exchangeCommissionType: z.null(),
    exchangeDirect: z.string().nullable(),
    exchangeRate: z.number().nullable(),
    indexRateBase: z.null(),
    indexRatePmt: z.null(),
    interestAmount: z.number().nullable(),
    isAllowedSpreadWithBenefit: z.boolean(),
    issuerCurrency: z.string().nullable(),
    issuerExchangeRate: z.null(),
    originalTerm: z.number().nullable(),
    percentMaam: z.number().nullable(),
    plan: z.number().nullable(),
    posEntryEmv: z.number(),
    processingDate: z.iso.datetime({ local: true }).nullable(),
    purchaseAmount: z.null(),
    purchaseTime: z
      .string()
      .regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/) // Time in format HH:MM
      .nullable(),
    refNbr: z.string().nullable(),
    showCancelDebit: z.boolean(),
    showSpread: z.boolean(),
    showSpreadBenefitButton: z.boolean(),
    showSpreadButton: z.boolean(),
    showSpreadForLeumi: z.boolean(),
    tdmCardToken: z.string().nullable(),
    tdmTransactionType: z.number().int().nullable(),
    transactionType: z.number().int(),
    txnCode: z.number().int(),
    userName: z.string(),
    withdrawalCommissionAmount: z.null(),
  })
  .strict();

const transactionMerchantDataSchema = z
  .object({
    address: z.string().nullable(),
    coordinates: z.null(),
    maxPhone: z.boolean(),
    merchant: z.string(),
    merchantCommercialName: z.string().nullable(),
    merchantNumber: z.string(),
    merchantPhone: z.string(),
    merchantTaxId: z.string().nullable(),
  })
  .strict();

const transactionRuntimeReferenceSchema = z
  .object({
    id: z.string(),
    type: z.number(),
  })
  .strict();

// Matches MaxTransaction from @accounter/modern-poalim-scraper
const MaxTransactionSchema = z
  .object({
    actualPaymentAmount: z.number().nullable(),
    arn: z.string().nullable(),
    cardIndex: z.number().int(),
    categoryId: z.number().int(),
    comments: z.string(),
    dealData: transactionDealDataSchema.optional(),
    discountKeyAmount: z.null(),
    discountKeyRecType: z.null(),
    ethocaInd: z.boolean().optional(),
    fundsTransferComment: z.string().optional().nullable(),
    fundsTransferReceiverOrTransfer: z.string().optional().nullable(),
    isRegisterCh: z.boolean(),
    isSpreadingAutorizationAllowed: z.boolean(),
    issuerId: z.number().int(),
    merchantData: transactionMerchantDataSchema,
    merchantName: z.string(),
    originalAmount: z.number(),
    originalCurrency: z.enum(['ILS']),
    paymentCurrency: z.number().nullable(),
    paymentDate: z.iso.datetime({ local: true }).optional().nullable(),
    planName: z.string(),
    planTypeId: z.number().int(),
    promotionAmount: z.number().nullable(),
    promotionClub: z.string().nullable(),
    promotionType: z.null(),
    purchaseDate: z.iso.datetime({ local: true }),
    receiptPDF: z.null().optional(),
    refIndex: z.number().int(),
    runtimeReference: transactionRuntimeReferenceSchema,
    runtimeReferenceId: z.null(),
    shortCardNumber: z.string().length(4),
    spreadTransactionByCampainInd: z.boolean(),
    spreadTransactionByCampainNumber: z.number().nullable(),
    tableType: z.number().int(),
    tag: z.null(),
    uid: z.string(),
    upSaleForTransactionResult: z.null(),
    userIndex: z.number(),
  })
  .strict();

// Matches TransactionsAccount (MaxScrapingResult element)
const MaxAccountSchema = z.object({
  accountNumber: z.string(),
  txns: z.array(MaxTransactionSchema),
});

// MaxScrapingResult = TransactionsAccount[]
export const MaxPayloadSchema = z.array(MaxAccountSchema);

export type MaxPayload = z.infer<typeof MaxPayloadSchema>;
