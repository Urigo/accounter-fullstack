import { z } from 'zod';

const barsGraphDetailsResultMonthlySummarySchema = z
  .object({
    date: z.string(),
    actualDebitSumNIS: z.number(),
    isFutureDebit: z.boolean(),
  })
  .strict();

const barsGraphDetailsResultSchema = z
  .object({
    monthlySummary: z.array(barsGraphDetailsResultMonthlySummarySchema),
    isShowExchangeRemark: z.boolean(),
  })
  .strict();

const resultCancelDenialDataCancelDenialReasonsSchema = z
  .object({
    reasonText: z.string(),
    reasonId: z.number(),
  })
  .strict();

const resultCancelDenialDataSchema = z
  .object({
    cancelDenialTitle: z.string(),
    cancelDenialSubTitle: z.string(),
    cancelDenialInfo: z.string(),
    cancelDenialReasons: z.array(resultCancelDenialDataCancelDenialReasonsSchema),
    cancelDenialNotValidText: z.string(),
    cancelDenialBtnText: z.string(),
    cancelDenialLinkText: z.string(),
    successTitle: z.string(),
    successSubTitle: z.string(),
    successBtnText: z.string(),
    successBlockedTitle: z.string(),
    successBlockedSubTitle: z.string(),
    successBlockedInfo: z.string(),
    successBlockedLinkText: z.string(),
    successBlockedBtnText: z.string(),
    successBlockedBtnTextMobile: z.string(),
    successBlockedPhoneNumber: z.string(),
    failTitle: z.string(),
    failSubTitle: z.string(),
    failBtnText: z.string(),
    failLinkText: z.string(),
    noCbkIdFailSubTitle: z.string(),
    noCbkIdBtnText: z.string(),
    createClaimSubTitle: z.string(),
    createClaimLinkText: z.string(),
    createClaimBtnText: z.string(),
  })
  .strict();

const resultCategoriesSchema = z
  .object({
    id: z.number(),
    currency: z.number(),
    sum: z.number(),
    ilsSum: z.number(),
  })
  .strict();

const dealTrackResultSchema = z
  .object({
    registerText: z.string(),
    registerTitle: z.string(),
    successText: z.string(),
    successTitle: z.string(),
    successLinkText: z.string(),
  })
  .strict();

const resultInfoSchema = z
  .object({
    date: z.null(),
    userIndex: z.number(),
  })
  .strict();

const resultTotalCycleSchema = z
  .object({
    currency: z.number(),
    totalAmount: z.number(),
    pastDebit: z.number(),
    futureDebit: z.number(),
  })
  .strict();

const transactionMerchantDataSchema = z
  .object({
    address: z.union([z.null(), z.string()]),
    coordinates: z.null(),
    maxPhone: z.boolean(),
    merchant: z.string(),
    merchantCommercialName: z.union([z.null(), z.string()]),
    merchantNumber: z.string(),
    merchantPhone: z.string(),
    merchantTaxId: z.string(),
  })
  .strict();

const transactionRuntimeReferenceSchema = z
  .object({
    id: z.string(),
    type: z.number(),
  })
  .strict();

const transactionDealDataSchema = z
  .object({
    acq: z.string(),
    adjustmentAmount: z.null(),
    adjustmentType: z.number(),
    amount: z.number(),
    amountIls: z.number(),
    amountLeft: z.number(),
    arn: z.string(),
    authorizationNumber: z.string(),
    cardName: z.null(),
    cardToken: z.null(),
    commissionVat: z.number(),
    directExchange: z.null(),
    exchangeCommissionAmount: z.null(),
    exchangeCommissionMaam: z.null(),
    exchangeCommissionType: z.null(),
    exchangeDirect: z.string(),
    exchangeRate: z.number(),
    indexRateBase: z.null(),
    indexRatePmt: z.null(),
    interestAmount: z.number(),
    isAllowedSpreadWithBenefit: z.boolean(),
    issuerCurrency: z.string(),
    issuerExchangeRate: z.null(),
    originalTerm: z.null(),
    percentMaam: z.union([z.null(), z.number()]),
    plan: z.number(),
    posEntryEmv: z.number(),
    processingDate: z.string(),
    purchaseAmount: z.null(),
    purchaseTime: z.union([z.null(), z.string()]),
    refNbr: z.string(),
    showCancelDebit: z.boolean(),
    showSpread: z.boolean(),
    showSpreadBenefitButton: z.boolean(),
    showSpreadButton: z.boolean(),
    showSpreadForLeumi: z.boolean(),
    tdmCardToken: z.string(),
    tdmTransactionType: z.number(),
    transactionType: z.number(),
    txnCode: z.number(),
    userName: z.string(),
    withdrawalCommissionAmount: z.null(),
  })
  .strict();

const maxTransactionSchema = z
  .object({
    actualPaymentAmount: z.number(),
    arn: z.string(),
    cardIndex: z.number(),
    categoryId: z.number(),
    comments: z.string(),
    dealData: transactionDealDataSchema.optional(),
    discountKeyAmount: z.null(),
    discountKeyRecType: z.null(),
    ethocaInd: z.boolean(),
    fundsTransferComment: z.string().optional(),
    fundsTransferReceiverOrTransfer: z.string().optional(),
    isRegisterCh: z.boolean(),
    isSpreadingAutorizationAllowed: z.boolean(),
    issuerId: z.number(),
    merchantData: transactionMerchantDataSchema,
    merchantName: z.string(),
    originalAmount: z.number(),
    originalCurrency: z.string(),
    paymentCurrency: z.union([z.number(), z.null()]),
    paymentDate: z.string().optional(),
    planName: z.string(),
    planTypeId: z.number(),
    promotionAmount: z.union([z.number(), z.null()]),
    promotionClub: z.string(),
    promotionType: z.null(),
    purchaseDate: z.string(),
    receiptPDF: z.null(),
    refIndex: z.number(),
    runtimeReference: transactionRuntimeReferenceSchema,
    runtimeReferenceId: z.null(),
    shortCardNumber: z.string(),
    spreadTransactionByCampainInd: z.boolean(),
    spreadTransactionByCampainNumber: z.union([z.number(), z.null()]),
    tableType: z.number(),
    tag: z.null(),
    uid: z.string(),
    upSaleForTransactionResult: z.null(),
    userIndex: z.number(),
  })
  .strict();

export type MaxTransaction = z.infer<typeof maxTransactionSchema>;

const resultUpSaleFixedChargeSchema = z
  .object({ isShowUpSaleFixedCharge: z.boolean(), upSaleFixedChargeText: z.string() })
  .strict();

const resultSchema = z
  .object({
    barsGraphDetailsResult: barsGraphDetailsResultSchema,
    cancelDenialData: resultCancelDenialDataSchema,
    categories: z.array(resultCategoriesSchema),
    dealTrackResult: dealTrackResultSchema,
    fixedCharges: z.array(z.null()),
    info: resultInfoSchema,
    isEZCountUser: z.boolean(),
    isMyMAXCardsFiltered: z.boolean(),
    monthlyBillingTransactionsData: z
      .object({
        monthlyBillingDataList: z.array(z.null()),
      })
      .strict(),
    passiveOffers: z.null(),
    totalCycle: z.array(resultTotalCycleSchema),
    transactions: z.array(maxTransactionSchema),
    upSaleFixedCharge: resultUpSaleFixedChargeSchema,
    validityDate: z.string(),
    weezmoAgreement: z.boolean(),
  })
  .strict();

export const maxTransactionsSchema = z
  .object({
    correlationID: z.string(),
    rcDesc: z.union([z.string(), z.null()]),
    result: z.union([resultSchema, z.null()]),
    returnCode: z.number(),
  })
  .strict();
