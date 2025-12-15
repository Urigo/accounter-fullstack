import { z } from 'zod';

const DisabledAttrSchema = z.object({ disabled: z.string() }).strict();

const AttributesWithSingleDisabled = (key: string) =>
  z
    .object({
      [key]: DisabledAttrSchema,
    })
    .strict();

const MetadataBaseSchema = (attrKey: string) =>
  z
    .object({
      attributes: AttributesWithSingleDisabled(attrKey),
      links: z.object({}).strict(),
    })
    .strict();

const CodeValueItemSchema = z
  .object({
    valueCode: z.number(),
    valueLongDescription: z.string(),
  })
  .strict();

const CodeListSchema = (attrKey: string) =>
  z
    .object({
      metadata: MetadataBaseSchema(attrKey),
      [attrKey]: z
        .object({
          code: z.number(),
          values: z.array(CodeValueItemSchema),
        })
        .strict(),
    })
    .strict();

const RevaluatedForeignCurrencyTotalDepositsRowsSchema = z
  .object({
    exchangeRate: z.number(),
    currencyCode: z.number(),
    shortCurrencyDescription: z.string(),
    revaluatedWithdrawalForeignCurrencyDepositBalanceAmount: z.number(),
    displayedRevaluationCurrencyCode: z.number(),
    revaluationCurrencyShortedDescription: z.string(),
    revaluatedForeignCurrencyDepositBalanceAmount: z.number(),
    productTotalAmtText: z.string(),
  })
  .strict();

const RevaluatedForeignCurrencyDepositsRowsSchema = z
  .object({
    depositSerialId: z.number(),
    originalValueDate: z.number(),
    formattedOriginalValueDate: z.string(),
    periodCounter: z.number(),
    timeUnitDescription: z.string(),
    foreignCurrencyDepositOriginCode: z.number(),
    foreignCurrencyDepositOriginDescription: z.string(),
    valueDate: z.number(),
    formattedValueDate: z.string(),
    nextPaymentDate: z.number(),
    formattedNextPaymentDate: z.string(),
    paymentDate: z.number(),
    formattedPaymentDate: z.string(),
    renewalMethodCode: z.number(),
    renewalMethodDescription: z.string(),
    foreignCurrencyDepositCurrentBalanceAmount: z.number(),
    interestRate: z.number(),
    revaluatedWithdrawalForeignCurrencyDepositBalanceAmount: z.number(),
    foreignCurrencyDepositPrincipalBalanceAmount: z.number(),
    productSerialId: z.number(),
    currencyCode: z.number(),
    packageNumber: z.number(),
    productTypeCode: z.number(),
    variableInterestDescription: z.string(),
    timeUnitCode: z.number(),
    periodDescription: z.string(),
    lienIndication: z.string(),
    warningExistenceSwitch: z.number(),
    revaluatedForeignCurrencyDepositsRowsMsg: z.unknown(),
  })
  .strict();

const RevaluatedForeignCurrencyCodeDepositsSchema = z
  .object({
    currencyCode: z.number(),
    currencyLongDescription: z.string(),
    listRevaluatedForeignCurrencyDepositsRows: z.array(RevaluatedForeignCurrencyDepositsRowsSchema),
    listRevaluatedForeignCurrencyTotalDepositsRows: z.array(
      RevaluatedForeignCurrencyTotalDepositsRowsSchema,
    ),
  })
  .strict();

const RevaluatedForeignCurrencyDepositTotalCurrencyCodeSchema = z
  .object({
    productSerialId: z.number(),
    packageNumber: z.number(),
    displayedRevaluationCurrencyCode: z.number(),
    revaluationCurrencyShortedDescription: z.string(),
    revaluatedForeignCurrencyDepositBalanceAmount: z.number(),
    productTotalAmtText: z.string(),
  })
  .strict();

const RevaluatedForeignCurrencyDepositProductSerialIdSchema = z
  .object({
    productSerialId: z.number(),
    fullProductName: z.string(),
    packageNumber: z.number(),
    packageName: z.string(),
    listRevaluatedForeignCurrencyCodeDeposits: z.array(RevaluatedForeignCurrencyCodeDepositsSchema),
    listRevaluatedForeignCurrencyDepositTotalCurrencyCode: z.array(
      RevaluatedForeignCurrencyDepositTotalCurrencyCodeSchema,
    ),
  })
  .strict();

const RevaluatedForeignCurrencyDepositTotalProductSerialIdSchema = z
  .object({
    detailedAccountTypeCode: z.number(),
    detailedAccountTypeShortedDescription: z.string(),
    displayedRevaluationCurrencyCode: z.number(),
    revaluationCurrencyShortedDescription: z.string(),
    revaluatedForeignCurrencyDepositBalanceAmount: z.number(),
    productTotalAmtText: z.string(),
  })
  .strict();

const RevaluatedForeignCurrencyDepositAccountTypeCodeSchema = z
  .object({
    detailedAccountTypeCode: z.number(),
    detailedAccountTypeShortedDescription: z.string(),
    listRevaluatedForeignCurrencyDepositProductSerialId: z.array(
      RevaluatedForeignCurrencyDepositProductSerialIdSchema,
    ),
    listRevaluatedForeignCurrencyDepositTotalProductSerialId: z.array(
      RevaluatedForeignCurrencyDepositTotalProductSerialIdSchema,
    ),
  })
  .strict();

const RevaluatedForeignCurrencyDepositBalanceAmountSchema = z
  .object({
    accountNumber: z.number(),
    displayedRevaluationCurrencyCode: z.number(),
    revaluationCurrencyShortedDescription: z.string(),
    revaluatedForeignCurrencyDepositBalanceAmount: z.number(),
    productTotalAmtText: z.string(),
    currencyLongDescription: z.string(),
  })
  .strict();

const RevaluatedForeignCurrencyDepositsMsgItemSchema = z
  .object({
    messageCode: z.number(),
    messageDescription: z.string(),
    messageTypeCode: z.string(),
  })
  .strict();

export const HapoalimForeignDepositsSchema = z
  .object({
    dataQueryTypeCode: z.number(),
    validityDate: z.number(),
    formattedValidityDate: z.string(),
    validityDateMin: z.number(),
    formattedValidityDateMin: z.string(),
    chosenDate: z.number(),
    formattedChosenDate: z.unknown(),
    detailedAccountTypeCode: z.number(),
    productSerialId: z.number(),
    packageNumber: z.number(),
    currencyCode: z.number(),
    depositSerialId: z.number(),
    dataRetrievalMethodCode: z.number(),
    filterTypeCode: z.number(),
    generalNumberValidation: z.number(),
    detailedAccountTypeCodeList: CodeListSchema('detailedAccountTypeCode'),
    productSerialIdList: CodeListSchema('productSerialId'),
    packageNumberList: CodeListSchema('packageNumber'),
    currencyCodeList: CodeListSchema('currencyCode'),
    listRevaluatedForeignCurrencyDepositAccountTypeCode: z.array(
      RevaluatedForeignCurrencyDepositAccountTypeCodeSchema,
    ),
    listRevaluatedForeignCurrencyDepositBalanceAmount: z.array(
      RevaluatedForeignCurrencyDepositBalanceAmountSchema,
    ),
    listRevaluatedForeignCurrencyDepositTotalMortgagedRows: z.array(z.unknown()),
    listRevaluatedForeignCurrencyDepositsMsg: z.array(
      RevaluatedForeignCurrencyDepositsMsgItemSchema,
    ),
  })
  .strict();

export type HapoalimForeignDeposits = z.infer<typeof HapoalimForeignDepositsSchema>;
