import { z } from 'zod';

const MessageItemSchema = z
  .object({
    messageDescription: z.string(),
    messageCode: z.literal(3),
  })
  .strict();

const MetadataMessagesItemSchema = z
  .object({
    messageCode: z.union([
      z.literal(330),
      z.literal(11_024),
      z.literal(11_038),
      z.literal(11_039),
      z.literal(11_040),
    ]),
    messageDescription: z.string(),
    severity: z.union([z.literal('I'), z.literal('E')]),
  })
  .strict();

const MetadataSchema = z
  .object({
    links: z.object({}).strict(),
    messages: z.array(MetadataMessagesItemSchema),
  })
  .strict();

const AttributesToggleSchema = z
  .object({
    disabled: z.literal('true').optional(),
    hidden: z.literal('true').optional(),
  })
  .strict();

const TransactionMetadataSchema = z
  .object({
    attributes: z
      .object({
        contraAccountFieldNameLable: AttributesToggleSchema.optional(),
        contraAccountNumber: AttributesToggleSchema.optional(),
        contraBankNumber: AttributesToggleSchema.optional(),
        contraBranchNumber: AttributesToggleSchema.optional(),
        contraCurrencyCode: AttributesToggleSchema.optional(),
        currencyRate: AttributesToggleSchema.optional(),
        dataGroupCode: AttributesToggleSchema.optional(),
        originalEventKey: AttributesToggleSchema.optional(),
        rateFixingCode: AttributesToggleSchema.optional(),
      })
      .strict(),
    links: z.object({}).strict(),
  })
  .strict();

const TransactionItemSchema = z
  .object({
    accountName: z.string().nullable(),
    activityDescription: z.string(),
    activityTypeCode: z.number(),
    comments: z.null(),
    commentExistenceSwitch: z.literal(0),
    contraAccountFieldNameLable: z.string().nullable(),
    contraAccountNumber: z.number(),
    contraBankNumber: z.number(),
    contraBranchNumber: z.number(),
    contraCurrencyCode: z.union([
      z.literal(0),
      z.literal(1),
      z.literal(19),
      z.literal(27),
      z.literal(36),
      z.literal(51),
      z.literal(78),
      z.literal(100),
      z.literal(140),
      z.literal(248),
    ]),
    currencyLongDescription: z.string(),
    currencyRate: z.number(),
    currencySwiftCode: z.string(),
    currentBalance: z.number(),
    dataGroupCode: z.literal(0),
    displayCreditAccountDetails: z.union([z.literal(0), z.literal(1)]),
    eventActivityTypeCode: z.number(),
    eventAmount: z.number(),
    eventDetails: z.string().nullable(),
    eventNumber: z.number(),
    executingDate: z.number(),
    expendedExecutingDate: z.string(),
    formattedExecutingDate: z.string(),
    formattedValueDate: z.string().nullable(),
    metadata: TransactionMetadataSchema.optional(),
    originalEventKey: z.literal(0),
    originalSystemId: z.number(),
    rateFixingCode: z.number(),
    rateFixingDescription: z.string(),
    rateFixingShortDescription: z.string(),
    recordSerialNumber: z.number(),
    referenceCatenatedNumber: z.number(),
    referenceNumber: z.number(),
    transactionType: z.string(),
    urlAddress: z.string().nullable(),
    validityDate: z.number(),
    valueDate: z.number(),
  })
  .strict();

const BalancesAndLimitsItemSchema = z
  .object({
    accountNumber: z.number(),
    bankNumber: z.union([z.literal(12), z.literal(0)]),
    branchNumber: z.number(),
    creditLimits: z.array(z.string()),
    currencyCode: z.number(),
    currencyLongDescription: z.string().nullable(),
    currencyShortedDescription: z.string().nullable(),
    currencySwiftCode: z.string().nullable(),
    currencySwiftDescription: z.string().nullable(),
    currentAccountLimitsAmount: z.literal(0),
    currentBalance: z.literal(0),
    currentBalanceExchangeRateWayDescription: z.null(),
    currentBalanceExchangeRateWayCode: z.literal(0),
    detailedAccountTypeCode: z.literal(142),
    detailedAccountTypeShortedDescription: z.string(),
    formattedLastEventDate: z.null(),
    formattedRetrievalMaxDate: z.string().nullable(),
    formattedRetrievalMinDate: z.string().nullable(),
    lastBalance: z.literal(0),
    lastBalanceExchangeRateWayCode: z.literal(0),
    lastEventDate: z.literal(0),
    messages: z.array(MessageItemSchema).nullable(),
    numItemsPerPage: z.number(),
    outputArrayRecordSum3: z.literal(0),
    outputArrayRecordSum4: z.literal(0),
    pendingBalance: z.literal(0),
    rateExerciseDescription: z.null(),
    rateRealizationCode: z.literal(0),
    retrievalMaxDate: z.number(),
    retrievalMinDate: z.number(),
    revaluatedCurrentBalance: z.array(z.string()).length(0),
    transactionResultCode: z.number(),
    transactions: z.array(TransactionItemSchema),
    withdrawalBalance: z.literal(0),
  })
  .strict();

export const HapoalimForeignTransactionsBusinessSchema = z
  .object({
    balancesAndLimitsDataList: z.array(BalancesAndLimitsItemSchema),
    balancesAndTransactionsCurrencyCombo: z.object({ currencyCode: z.null() }).strict(),
    currancyBalanceData: z.null(),
    currencyCode: z.null(),
    detailedAccountTypeCode: z.null(),
    displayedRevaluationCurrencyCode: z.literal(0),
    foreignCurrencyBalancesData: z.null(),
    formattedValidityDate: z.null(),
    messages: z.null(),
    metadata: MetadataSchema.optional(),
    outputArrayRecordSum2: z.literal(0),
    pdfUrl: z.null(),
    rateFixingDescription: z.null(),
    validityDate: z.literal(0),
  })
  .strict();

export type HapoalimForeignTransactionsBusiness = z.infer<
  typeof HapoalimForeignTransactionsBusinessSchema
>;
