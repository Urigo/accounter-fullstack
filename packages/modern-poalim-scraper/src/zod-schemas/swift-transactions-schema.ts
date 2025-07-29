import { z } from 'zod';

const MessageSchema = z.object({
  messageDescription: z.enum([
    'לתשומת לבך: לא נמצאו זיכויי סוויפט בטווח התאריכים המוצג.',
    'זיכויי הסוויפט המופיעים במסך זה הם על תנאי ולידיעה בלבד , עד לזיכוי חשבונך בפועל',
  ]),
  messageCode: z.number().int(),
  severity: z.enum(['I']),
  messagePurposeCategoryCode: z.enum(['1']).optional(),
});

const MetadataSchema = z
  .object({
    messages: z.array(MessageSchema),
    links: z.object({}).strict(),
  })
  .strict();

const SwiftItemSchema = z
  .object({
    startDate: z.number().int(),
    formattedStartDate: z.string().datetime(),
    swiftStatusCode: z.enum(['0Y', '0W', '0B']),
    swiftStatusDesc: z.string(),
    amount: z.number(),
    currencyCodeCatenatedKey: z.string(),
    currencyLongDescription: z.string(),
    chargePartyName: z.string(),
    referenceNumber: z.string(),
    transferCatenatedId: z.string(),
    dataOriginCode: z.number().int().min(1).max(2),
  })
  .strict();

const FyiMessageSchema = z
  .object({
    messageCode: z.literal(55),
    messageTypeCode: z.literal('I'),
    screenCommentText: z.literal(
      'זיכויי הסוויפט המופיעים במסך זה הם על תנאי ולידיעה בלבד , עד לזיכוי חשבונך בפועל',
    ),
  })
  .strict();

const CurrencyCodeCatenatedKeyValueSchema = z
  .object({
    systemCode: z.literal(320),
    bankNumber: z.literal(12),
    currencyCode: z.number().int().min(0).max(999),
    currencyShortedDescription: z.string(),
    currencySwiftCode: z.string().length(3),
    currencyLongDescription: z.string(),
    compKey: z.string().length(12),
    currencyUnitsQuantity: z.number().int().min(1).max(100),
  })
  .strict();

const CurrencyCodeCatenatedKeySchema = z
  .object({
    code: z.enum(['-1']),
    values: z.array(CurrencyCodeCatenatedKeyValueSchema),
  })
  .strict();

const SwiftStatusCodeValueSchema = z.union([
  z
    .object({
      swiftStatusCode: z.literal('0B'),
      swiftStatusDesc: z.literal('בהמתנה לאישור הבנק בחו"ל'),
    })
    .strict(),
  z
    .object({
      swiftStatusCode: z.literal('1C'),
      swiftStatusDesc: z.literal('בוטלה ע"י המעביר'),
    })
    .strict(),
  z
    .object({
      swiftStatusCode: z.literal('0W'),
      swiftStatusDesc: z.literal('ממתין לביצוע'),
    })
    .strict(),
  z
    .object({
      swiftStatusCode: z.literal('0Y'),
      swiftStatusDesc: z.literal('ההעברה בוצעה'),
    })
    .strict(),
]);

const SwiftStatusCodeSchema = z
  .object({
    code: z.enum(['-1']),
    values: z.array(SwiftStatusCodeValueSchema),
  })
  .strict();

export const SwiftTransactionsSchema = z
  .object({
    metadata: MetadataSchema,
    trailersCounter: z.number().int(),
    minInputDate: z.number().int(),
    formattedMinInputDate: z.string().datetime().nullable(),
    swiftsList: z.array(SwiftItemSchema),
    fyiMessages: z.array(FyiMessageSchema),
    currencyCodeCatenatedKey: CurrencyCodeCatenatedKeySchema,
    swiftStatusCode: SwiftStatusCodeSchema,
  })
  .strict();

export type SwiftTransactions = z.infer<typeof SwiftTransactionsSchema>;
