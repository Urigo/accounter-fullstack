import { z } from 'zod';

// Metadata messages item at top-level metadata
const TopMetadataMessageSchema = z
  .object({
    messageDescription: z.string(),
    messageCode: z.number().int(),
    severity: z.string(),
  })
  .passthrough(); // schema allows additionalProperties: true

// Deposit-level messages item
const DepositMessageItemSchema = z
  .object({
    messageCode: z.union([
      z.literal(803),
      z.literal(804),
      z.literal(805),
      z.literal(821),
      z.literal(822),
      z.literal(823),
      z.literal(824),
      z.literal(825),
      z.literal(826),
    ]),
    messageDescription: z.union([
      z.literal('בכל מקרה לא תפחת הריבית על הפיקדון משיעור 0% בשנה.'),
      z.literal(
        'הוראת משיכה/אי חידוש לפיקדון צמוד מט"ח יש לתת שני ימי עסקים לפחות לפני תאריך התחנה/החידוש.',
      ),
      z.literal(
        'שערוך הפיקדונות המובנים מחושב בשיטה דומה, אך לא זהה, לתנאי ההתקשרות ואין בנתונים כדי לחייב את הבנק או לשמש אסמכתא לפדיון או משיכה.',
      ),
      z.literal(
        'פעולה המבוצעת בפיקדונות בשקלים עד השעה 18:30 (בימי ו׳ וערבי חג עד 14:00) ביום שהינו יום עסקים, נקלטת מיד עם אישורה ומשתקפת מיידית במסך פירוט פיקדונות.',
      ),
      z.literal('לאחר קליטת הפעולה לא ניתן יהיה לבטלה.'),
      z.literal(
        'הוראה הניתנת לאחר השעה 18:30 ( בימי ו׳ וערבי חג - לאחר השעה 14:00 ) תשתקף בחשבונך החל מהשעה 02:00 ועד למועד זה ניתן יהיה לבטלה.',
      ),
      z.literal(
        'הוראה הניתנת ביום שאינו יום עסקים, תבוצע ביום העסקים הבא ותשתקף בחשבונך החל מהשעה 02:00 של אותו יום ועד למועד זה ניתן יהיה לבטלה.',
      ),
      z.literal('הוראה לביצוע עתידי ניתנת לביטול עד לשעה 02:00 של יום ערך הביצוע.'),
      z.literal(
        'במסך "סטטוס הוראות בפיקדונות" ניתן לצפות בסטטוס הפעולה. אם סטטוס הפעולה הינו "ממתין לביצוע" - ניתן לבטלה.',
      ),
    ]),
    messageTypeCode: z.literal('I'),
  })
  .strict();

// Inner metadata.attributes.* with { hidden: string } and additionalProperties: true
const HiddenFlagSchema = z
  .object({
    hidden: z.string(),
  })
  .passthrough();

const DepositAttributesSchema = z
  .object({
    actualCurrencyRate: HiddenFlagSchema,
    lastIndexRate: HiddenFlagSchema,
    basicIndexValue: HiddenFlagSchema,
    basicCurrencyRate: HiddenFlagSchema,
    standingOrderAmount: HiddenFlagSchema,
    linkagePercent: HiddenFlagSchema,
    ratePercentFactor: HiddenFlagSchema,
    fixedInterestRate: HiddenFlagSchema,
  })
  .passthrough(); // allows additionalProperties: true

const DepositMetadataSchema = z
  .object({
    attributes: DepositAttributesSchema,
    links: z.object({}).passthrough(),
  })
  .passthrough(); // additionalProperties: true

const DepositDataItemSchema = z
  .object({
    metadata: DepositMetadataSchema,
    shortProductName: z.literal('פריים'),
    principalAmount: z.number(),
    revaluedTotalAmount: z.number(),
    endExitDate: z.number().int(),
    paymentDate: z.number().int(),
    statedAnnualInterestRate: z.number(),
    hebrewPurposeDescription: z.literal('לא רלוונטי'),
    objectiveAmount: z.number(),
    objectiveDate: z.number().int(),
    agreementOpeningDate: z.number().int(),
    eventWithdrawalAmount: z.number(),
    startExitDate: z.number().int(),
    periodUntilNextEvent: z.number().int(),
    renewalDescription: z.union([z.literal('פיקדון מתחדש'), z.literal('יפרע לעו"ש')]),
    requestedRenewalNumber: z.number().int(),
    interestBaseDescription: z.literal('פריים'),
    interestTypeDescription: z.literal('משתנה'),
    spreadPercent: z.number(),
    variableInterestDescription: z.string(),
    adjustedInterest: z.number(),
    interestCalculatingMethodDescription: z.literal('קו ישר'),
    interestCreditingMethodDescription: z.literal('לקרן הפיקדון'),
    interestPaymentDescription: z.literal('תחנה'),
    nominalInterest: z.number(),
    depositSerialId: z.number().int(),
    linkageBaseDescription: z.null(),
    renewalCounter: z.number().int(),
    productFreeText: z.string(),
    partyTextId: z.number().int(),
    actualIndexRate: z.number(),
    interestTypeCode: z.number().int(),
    productNumber: z.number().int(),
    productPurposeCode: z.number().int(),
    detailedAccountTypeCode: z.number().int(),
    formattedEndExitDate: z.string(),
    formattedPaymentDate: z.string(),
    formattedObjectiveDate: z.null(),
    formattedAgreementOpeningDate: z.string(),
    formattedStartExitDate: z.string(),
    lienDescription: z.union([z.literal('משועבד'), z.literal('מבטיח אשראי')]),
    withdrawalEnablingIndication: z.number().int(),
    renewalEnablingIndication: z.number().int(),
    standingOrderEnablingIndication: z.number().int(),
    additionEnablingIndication: z.number().int(),
    timeUnitDescription: z.literal('ימים'),
    formattedRevaluedTotalAmount: z.null(),
    warningExistanceIndication: z.number().int(),
    renewalDateExplanation: z.union([z.literal('תחנה קרובה'), z.literal('ייפרע לעו"ש בתאריך')]),
    expectedRepaymentSwitch: z.union([z.literal(0), z.literal(1)]),
  })
  .strict();

const DepositItemSchema = z
  .object({
    data: z.array(DepositDataItemSchema),
    source: z.literal('israeliCurrencyDeposit'),
    validityDate: z.number().int(),
    validityTime: z.number().int(),
    israeliCurrencyDepositPrincipalBalanceAmount: z.number(),
    depositsRevaluedAmount: z.number(),
    formattedValidityTime: z.string(),
    formattedDate: z.string(),
    amount: z.number(),
    revaluatedAmount: z.number(),
    messages: z.array(DepositMessageItemSchema),
  })
  .strict();

const DepositsArraySchema = z.array(DepositItemSchema);

const TopMetadataSchema = z
  .object({
    messages: z.array(TopMetadataMessageSchema),
    links: z.object({}).passthrough(),
  })
  .passthrough(); // top-level metadata allows additionalProperties: true

export const HapoalimDepositsSchema = z
  .object({
    metadata: TopMetadataSchema,
    list: DepositsArraySchema,
    depositsWrapperData: DepositsArraySchema,
  })
  .strict();

export type HapoalimDeposits = z.infer<typeof HapoalimDepositsSchema>;
