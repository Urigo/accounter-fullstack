import { z } from 'zod';

const MessageVariantA = z
  .object({
    messageCode: z.union([z.literal(11_040), z.literal(1_260_003), z.literal(1_260_011)]),
    messageDescription: z.string(),
    messagePurposeCategoryCode: z.literal('1'),
    severity: z.literal('I'),
  })
  .strict();

const MessageVariantB = z
  .object({
    messageCode: z.literal(51),
    messageDescription: z.literal(''),
    severity: z.literal('I'),
  })
  .strict();

const MetadataSchema = z
  .object({
    links: z.object({}).strict(),
    messages: z.array(z.union([MessageVariantA, MessageVariantB])),
  })
  .strict();

const BeneficiaryDetailsDataSchema = z
  .object({
    messageDetail: z.string().nullable(),
    messageHeadline: z.string().nullable(),
    partyHeadline: z.string().nullable(),
    partyName: z.string().nullable(),
    recordNumber: z.number(),
    tableNumber: z.number(),
    beneficiaryDetails: z.string().nullable(),
  })
  .strict();

const TransactionSchema = z
  .object({
    activityDescription: z.string(),
    activityDescriptionIncludeValueDate: z.string().nullable(),
    activityTypeCode: z.number(),
    beneficiaryDetailsData: z.union([BeneficiaryDetailsDataSchema, z.null()]),
    comment: z.string().nullable(),
    commentExistenceSwitch: z.literal(0),
    contraAccountNumber: z.number(),
    contraAccountTypeCode: z.number(),
    contraBankNumber: z.number(),
    contraBranchNumber: z.number(),
    currentBalance: z.number(),
    dataGroupCode: z.number(),
    details: z.string().nullable(),
    differentDateIndication: z.string(),
    englishActionDesc: z.string().nullable(),
    eventActivityTypeCode: z.union([z.literal(1), z.literal(2)]),
    eventAmount: z.number(),
    eventDate: z.number(),
    eventId: z.number().int(),
    executingBranchNumber: z.number(),
    expandedEventDate: z.string(),
    fieldDescDisplaySwitch: z.union([z.literal(0), z.literal(1)]),
    formattedEventDate: z.string(),
    formattedOriginalEventCreateDate: z.null(),
    formattedValueDate: z.string(),
    internalLinkCode: z.number().int(),
    marketingOfferContext: z.literal(0),
    offerActivityContext: z.string().nullable(),
    originalEventCreateDate: z.number(),
    pfmDetails: z.string().nullable(),
    recordNumber: z.number(),
    referenceCatenatedNumber: z.number(),
    referenceNumber: z.number(),
    rejectedDataEventPertainingIndication: z.string(),
    serialNumber: z.number(),
    tableNumber: z.number(),
    textCode: z.number(),
    transactionType: z.union([z.literal('REGULAR'), z.literal('TODAY'), z.literal('FUTURE')]),
    valueDate: z.number(),
    displayCreditAccountDetails: z.union([z.literal(0), z.literal(1)]),
    displayRTGSIncomingTrsDetails: z.union([z.literal(0), z.literal(1)]),
    formattedEventAmount: z.string(),
    formattedCurrentBalance: z.string(),
  })
  .strict();

const RetrievalTransactionDataSchema = z
  .object({
    accountNumber: z.number(),
    balanceAmountDisplayIndication: z.literal('Y'),
    bankNumber: z.literal(12),
    branchNumber: z.number(),
    eventCounter: z.number(),
    formattedRetrievalEndDate: z.string(),
    formattedRetrievalMaxDate: z.string(),
    formattedRetrievalMinDate: z.string(),
    formattedRetrievalStartDate: z.string(),
    joinPfm: z.union([z.literal(false), z.literal(true)]),
    retrievalEndDate: z.number(),
    retrievalMaxDate: z.number(),
    retrievalMinDate: z.number(),
    retrievalStartDate: z.number(),
  })
  .strict();

export const HapoalimILSTransactionsSchema = z
  .object({
    comments: z.array(z.string()),
    message: z.array(z.string()),
    metadata: MetadataSchema.optional(),
    numItemsPerPage: z.number(),
    pdfUrl: z.string(),
    retrievalTransactionData: RetrievalTransactionDataSchema,
    transactions: z.array(TransactionSchema),
  })
  .strict();

export type HapoalimILSTransactions = z.infer<typeof HapoalimILSTransactionsSchema>;
