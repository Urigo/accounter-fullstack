import { z } from 'zod';

const PersonalMessageItemSchema = z
  .object({
    messageDescription: z.string(),
    messageCode: z.literal(3),
  })
  .strict();

const AttributesToggleSchema = z
  .object({
    disabled: z.literal('true'),
    hidden: z.literal('true'),
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

const PersonalTransactionItemSchema = z
  .object({
    activityDescription: z.string(),
    activityTypeCode: z.number(),
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
    displayCreditAccountDetails: z.union([z.literal(0), z.literal(1)]).optional(),
    eventActivityTypeCode: z.number(),
    eventAmount: z.number(),
    eventDetails: z.string().nullable(),
    eventNumber: z.number(),
    executingDate: z.number(),
    formattedExecutingDate: z.string(),
    formattedValueDate: z.string().nullable(),
    metadata: TransactionMetadataSchema,
    originalSystemId: z.number(),
    rateFixingCode: z.number(),
    rateFixingDescription: z.string(),
    rateFixingShortDescription: z.string(),
    referenceCatenatedNumber: z.number(),
    referenceNumber: z.number(),
    transactionType: z.string(),
    urlAddress: z.string().nullable(),
    validityDate: z.number(),
    valueDate: z.number(),
  })
  .strict();

const PersonalBalancesAndLimitsItemSchema = z
  .object({
    creditLimits: z.array(z.string()),
    currencyCode: z.number(),
    currencyLongDescription: z.string(),
    currencyShortedDescription: z.string(),
    currencySwiftCode: z.string(),
    currencySwiftDescription: z.string(),
    currentAccountLimitsAmount: z.literal(0),
    currentBalance: z.literal(0),
    currentBalanceExchangeRateWayDescription: z.null(),
    currentBalanceExchangeRateWayCode: z.literal(0),
    detailedAccountTypeCode: z.literal(142),
    detailedAccountTypeShortedDescription: z.string(),
    formattedLastEventDate: z.null(),
    formattedRetrievalMaxDate: z.string().nullable(),
    formattedRetrievalMinDate: z.string().nullable(),
    lastBalanceExchangeRateWayCode: z.literal(0),
    lastEventDate: z.literal(0),
    messages: z.array(PersonalMessageItemSchema).nullable(),
    outputArrayRecordSum3: z.literal(0),
    outputArrayRecordSum4: z.literal(0),
    pendingBalance: z.literal(0),
    rateExerciseDescription: z.null(),
    rateRealizationCode: z.literal(0),
    retrievalMaxDate: z.number(),
    retrievalMinDate: z.number(),
    revaluatedCurrentBalance: z.literal(0),
    transactionResultCode: z.number(),
    transactions: z.array(PersonalTransactionItemSchema),
    withdrawalBalance: z.literal(0),
  })
  .strict();

const MetadataMessagesItemSchema = z
  .object({
    messageCode: z.union([
      z.literal(330),
      z.literal(11_003),
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

export const HapoalimForeignTransactionsPersonalSchema = z
  .object({
    balancesAndLimitsDataList: z.array(PersonalBalancesAndLimitsItemSchema),
    currencyCode: z.null(),
    currencyLongDescription: z.literal('שקל חדש'),
    detailedAccountTypeCode: z.null(),
    displayedRevaluationCurrencyCode: z.literal(0),
    formattedValidityDate: z.null(),
    messages: z.null(),
    metadata: MetadataSchema.optional(),
    outputArrayRecordSum2: z.literal(0),
    totalRevaluatedCurrentBalance: z.literal(0),
    validityDate: z.literal(0),
  })
  .strict();

export type HapoalimForeignTransactionsPersonal = z.infer<
  typeof HapoalimForeignTransactionsPersonalSchema
>;
