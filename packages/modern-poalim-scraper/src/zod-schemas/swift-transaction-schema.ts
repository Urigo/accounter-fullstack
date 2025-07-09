import { z } from 'zod';

// swiftBankDetails object
const SwiftBankDetailsSchema = z
  .object({
    swiftIsnSerialNumber: z.string(),
    swiftBankCode: z.string(),
    orderCustomerName: z.string(),
    beneficiaryEnglishStreetName1: z.string(),
    beneficiaryEnglishCityName1: z.string(),
    beneficiaryEnglishCountryName: z.string(),
  })
  .strict(); // no additional properties

const SwiftTransferDetailsGeneralItemSchema = z
  .object({
    swiftTransferAttributeCode: z.null(),
    swiftTransferAttributeDesc: z.null(),
    swiftTransferAttributeValue: z.string(),
  })
  .strict(); // only these properties allowed

const SwiftTransferDetailsSendersRefItemSchema = z
  .object({
    swiftTransferAttributeCode: z.enum([':20:']),
    swiftTransferAttributeDesc: z.literal("SENDER'S REFERENCE"),
    swiftTransferAttributeValue: z.string(),
  })
  .strict(); // only these properties allowed

const SwiftTransferDetailsBankOperationCodeItemSchema = z
  .object({
    swiftTransferAttributeCode: z.enum([':23B:']),
    swiftTransferAttributeDesc: z.literal('BANK OPERATION CODE'),
    swiftTransferAttributeValue: z.string(),
  })
  .strict(); // only these properties allowed

const SwiftTransferDetailsInstructionCodeItemSchema = z
  .object({
    swiftTransferAttributeCode: z.enum([':23E:']),
    swiftTransferAttributeDesc: z.literal('INSTRUCTION CODE'),
    swiftTransferAttributeValue: z.string(),
  })
  .strict(); // only these properties allowed

const SwiftTransferDetailsValueDateCurrencyAmountItemSchema = z
  .object({
    swiftTransferAttributeCode: z.enum([':32A:']),
    swiftTransferAttributeDesc: z.literal('VALUE DATE,CURRENCY,AMOUNT'),
    swiftTransferAttributeValue: z.string(),
  })
  .strict(); // only these properties allowed

const SwiftTransferDetailsCurrencyInstructedAmountItemSchema = z
  .object({
    swiftTransferAttributeCode: z.enum([':33B:']),
    swiftTransferAttributeDesc: z.literal('CURRENCY/INSTRUCTED AMOUNT'),
    swiftTransferAttributeValue: z.string(),
  })
  .strict(); // only these properties allowed

const SwiftTransferDetailsExchangeRateItemSchema = z
  .object({
    swiftTransferAttributeCode: z.enum([':36:']),
    swiftTransferAttributeDesc: z.literal('EXCHANGE RATE'),
    swiftTransferAttributeValue: z.string(),
  })
  .strict(); // only these properties allowed

const SwiftTransferDetailsOrderingCustomerItemSchema = z
  .object({
    swiftTransferAttributeCode: z.enum([':50F:', ':50K:']),
    swiftTransferAttributeDesc: z.literal('ORDERING CUSTOMER'),
    swiftTransferAttributeValue: z.string(),
  })
  .strict(); // only these properties allowed

const SwiftTransferDetailsOrderingInstitutionItemSchema = z
  .object({
    swiftTransferAttributeCode: z.enum([':52A:', ':52D:']),
    swiftTransferAttributeDesc: z.literal('ORDERING INSTITUTION'),
    swiftTransferAttributeValue: z.string(),
  })
  .strict(); // only these properties allowed

const SwiftTransferDetailsSendersCorrespondentItemSchema = z
  .object({
    swiftTransferAttributeCode: z.enum([':53A:', ':53B:']),
    swiftTransferAttributeDesc: z.literal('SENDERS  CORRESPONDENT'),
    swiftTransferAttributeValue: z.string(),
  })
  .strict(); // only these properties allowed

const SwiftTransferDetailsReceiversCorrespondentItemSchema = z
  .object({
    swiftTransferAttributeCode: z.enum([':54A:']),
    swiftTransferAttributeDesc: z.literal('RECEIVERS  CORRESPONDENT'),
    swiftTransferAttributeValue: z.string(),
  })
  .strict(); // only these properties allowed

const SwiftTransferDetailsAccountWithInstitutionItemSchema = z
  .object({
    swiftTransferAttributeCode: z.enum([':57A:', ':57D:']),
    swiftTransferAttributeDesc: z.literal('ACCOUNT WITH INSTITUTION'),
    swiftTransferAttributeValue: z.string(),
  })
  .strict(); // only these properties allowed

const SwiftTransferDetailsBeneficiaryCustomerItemSchema = z
  .object({
    swiftTransferAttributeCode: z.enum([':59:', ':59F:']),
    swiftTransferAttributeDesc: z.literal('BENEFICIARY CUSTOMER'),
    swiftTransferAttributeValue: z.string(),
  })
  .strict(); // only these properties allowed

const SwiftTransferDetailsRemittanceItemSchema = z
  .object({
    swiftTransferAttributeCode: z.enum([':70:']),
    swiftTransferAttributeDesc: z.literal('REMITTANCE INFORMATION'),
    swiftTransferAttributeValue: z.string(),
  })
  .strict(); // only these properties allowed

const SwiftTransferDetailsChargesItemSchema = z
  .object({
    swiftTransferAttributeCode: z.enum([':71A:']),
    swiftTransferAttributeDesc: z.literal('DETAILS OF CHARGES'),
    swiftTransferAttributeValue: z.string(),
  })
  .strict(); // only these properties allowed

const SwiftTransferDetailsSendersChargesItemSchema = z
  .object({
    swiftTransferAttributeCode: z.enum([':71F:']),
    swiftTransferAttributeDesc: z.literal('SENDERS CHARGES'),
    swiftTransferAttributeValue: z.string(),
  })
  .strict(); // only these properties allowed

const SwiftTransferDetailsSenderToReceiverItemSchema = z
  .object({
    swiftTransferAttributeCode: z.enum([':72:']),
    swiftTransferAttributeDesc: z.literal('SENDER TO RECEIVER INFORMATION'),
    swiftTransferAttributeValue: z.string(),
  })
  .strict(); // only these properties allowed

const SwiftTransferDetailsRegulatoryReportingItemSchema = z
  .object({
    swiftTransferAttributeCode: z.enum([':77B:']),
    swiftTransferAttributeDesc: z.literal('REGULATORY REPORTING'),
    swiftTransferAttributeValue: z.string(),
  })
  .strict(); // only these properties allowed

// Inner object in swiftTransferDetailsList
const SwiftTransferDetailsItemSchema = z.discriminatedUnion('swiftTransferAttributeCode', [
  SwiftTransferDetailsGeneralItemSchema,
  SwiftTransferDetailsSendersRefItemSchema,
  SwiftTransferDetailsBankOperationCodeItemSchema,
  SwiftTransferDetailsInstructionCodeItemSchema,
  SwiftTransferDetailsValueDateCurrencyAmountItemSchema,
  SwiftTransferDetailsCurrencyInstructedAmountItemSchema,
  SwiftTransferDetailsExchangeRateItemSchema,
  SwiftTransferDetailsOrderingCustomerItemSchema,
  SwiftTransferDetailsOrderingInstitutionItemSchema,
  SwiftTransferDetailsSendersCorrespondentItemSchema,
  SwiftTransferDetailsReceiversCorrespondentItemSchema,
  SwiftTransferDetailsAccountWithInstitutionItemSchema,
  SwiftTransferDetailsBeneficiaryCustomerItemSchema,
  SwiftTransferDetailsRemittanceItemSchema,
  SwiftTransferDetailsChargesItemSchema,
  SwiftTransferDetailsSendersChargesItemSchema,
  SwiftTransferDetailsSenderToReceiverItemSchema,
  SwiftTransferDetailsRegulatoryReportingItemSchema,
]);

// Final top-level schema
export const SwiftTransactionSchema = z
  .object({
    swiftBankDetails: SwiftBankDetailsSchema,
    swiftTransferDetailsList: z.array(SwiftTransferDetailsItemSchema),
  })
  .strict();
