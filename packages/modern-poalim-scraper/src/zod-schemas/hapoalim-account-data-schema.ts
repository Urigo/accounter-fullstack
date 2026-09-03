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

/** Fields both portals return. */
const accountDataItemShape = {
  accountAgreementOpeningDate: AccountAgreementOpeningDateSchema,
  accountClosingReasonCode: AccountClosingReasonCodeSchema,
  accountDealDate: AccountDealDateSchema,
  accountName: z.string().optional(),
  accountNumber: AccountNumberSchema,
  accountUpdateDate: AccountUpdateDateSchema,
  bankNumber: BankNumberSchema,
  branchNumber: BranchNumberSchema,
  branchTypeCode: BranchTypeCodeSchema,
  extendedBankNumber: ExtendedBankNumberSchema,
  kodHarshaatPeilut: KodHarshaatPeilutSchema,
  metegDoarNet: MetegDoarNetSchema,
  mymailEntitlementSwitch: MymailEntitlementSwitchSchema,
  partyAccountInvolvementCode: PartyAccountInvolvementCodeSchema,
  partyPreferredIndication: PartyPreferredIndicationSchema,
  productLabel: ProductLabelSchema,
  serviceAuthorizationDesc: ServiceAuthorizationDescSchema,
} as const;

/**
 * Fields only the personal portal (`isBusiness === false`) returns. Both schemas are strict, so
 * these are rejected on a business response rather than silently ignored.
 */
const personalOnlyAccountDataItemShape = {
  defaultSwitch: z.boolean().optional(),
  isClosed: z.boolean(),
  isPinned: z.boolean(),
} as const;

export const AccountDataItemBusinessSchema = z.object(accountDataItemShape).strict();

export const AccountDataItemPersonalSchema = z
  .object({ ...accountDataItemShape, ...personalOnlyAccountDataItemShape })
  .strict();

export const HapoalimAccountDataBusinessSchema = z.array(AccountDataItemBusinessSchema).min(1);

export const HapoalimAccountDataPersonalSchema = z.array(AccountDataItemPersonalSchema).min(1);

/** An account entry from either portal: the personal-only fields are optional. */
export type HapoalimAccountDataItem = z.infer<typeof AccountDataItemBusinessSchema> &
  Partial<z.infer<typeof AccountDataItemPersonalSchema>>;

export type HapoalimAccountData = HapoalimAccountDataItem[];
