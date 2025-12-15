import { z } from 'zod';

const BankNumberSchema = z.literal(12);
const ExtendedBankNumberSchema = z.literal(912);

const BranchNumberSchema = z.number().int().min(100).max(999);

const AccountNumberSchema = z.number().int().min(10_000).max(999_999);

const PartyPreferredIndicationSchema = z.literal(0);

const PartyAccountInvolvementCodeSchema = z.union([z.literal(1), z.literal(201), z.literal(603)]);

const AccountDealDateSchema = z.literal(0);

const AccountUpdateDateSchema = z.union([
  z.number().int().min(10_000_000).max(99_999_999),
  z.literal(0),
]);

const MetegDoarNetSchema = z.union([z.literal(0), z.literal(1)]);

const KodHarshaatPeilutSchema = z.union([z.literal(1), z.literal(3)]);

const AccountClosingReasonCodeSchema = z.union([z.literal(0), z.literal(1)]);

const ProductLabelSchema = z.string();

const AccountAgreementOpeningDateSchema = z.literal(0);

const ServiceAuthorizationDescSchema = z.union([z.literal('לא חתום'), z.literal('פעולות ומידע')]);

const BranchTypeCodeSchema = z.union([z.literal(0), z.literal(2)]);

const MymailEntitlementSwitchSchema = z.union([z.literal(0), z.literal(1)]);

export const AccountDataItemSchema = z
  .object({
    bankNumber: BankNumberSchema,
    extendedBankNumber: ExtendedBankNumberSchema,
    branchNumber: BranchNumberSchema,
    accountNumber: AccountNumberSchema,
    partyPreferredIndication: PartyPreferredIndicationSchema,
    partyAccountInvolvementCode: PartyAccountInvolvementCodeSchema,
    accountDealDate: AccountDealDateSchema,
    accountUpdateDate: AccountUpdateDateSchema,
    metegDoarNet: MetegDoarNetSchema,
    kodHarshaatPeilut: KodHarshaatPeilutSchema,
    accountClosingReasonCode: AccountClosingReasonCodeSchema,
    productLabel: ProductLabelSchema,
    accountAgreementOpeningDate: AccountAgreementOpeningDateSchema,
    serviceAuthorizationDesc: ServiceAuthorizationDescSchema,
    branchTypeCode: BranchTypeCodeSchema,
    mymailEntitlementSwitch: MymailEntitlementSwitchSchema,
  })
  .strict();

export const HapoalimAccountDataSchema = z.array(AccountDataItemSchema).min(1);

export type HapoalimAccountData = z.infer<typeof HapoalimAccountDataSchema>;
