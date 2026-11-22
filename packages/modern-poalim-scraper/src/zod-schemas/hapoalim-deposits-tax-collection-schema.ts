import { z } from 'zod';

/**
 * A single deposits tax event from Poalim's deposits tax-collection report
 * (`deposits-and-savings/taxCollection?view=savingsAndCurrentProducts`).
 *
 * On every principal event of a deposit the bank realizes the interest accrued on
 * the whole deposit: the withdrawn share is paid out (`actionTypeDescription`
 * "משיכה"), the rest is capitalized into the deposit ("תשלום ריבית ל"), and tax is
 * charged (`debitAmount`) or credited (`crditAmount` — the bank's spelling) per row.
 *
 * Rows carry no account or deposit id; `eventSerialNumber` restarts every day.
 * `actionTypeDescription` is a free string so unseen action types still load.
 */
const PoalimDepositTaxEventSchema = z.strictObject({
  eventSerialNumber: z.number().int(),
  executingDate: z.number().int(),
  formattedExecutingDate: z.string().nullable(),
  actionTypeDescription: z.string(),
  shortProductName: z.string().nullable(),
  taxActionTypeDescription: z.string().nullable(),
  taxEventAmount: z.number(),
  debitCurrencyShortedDescription: z.string().nullable(),
  debitAmount: z.number(),
  crditAmount: z.number(),
  additionalInformationExistenceSwitch: z.number().int().nullable(),
});

const PoalimMessageSchema = z.strictObject({
  messageCode: z.number(),
  messageDescription: z.string(),
  messageTypeCode: z.string(),
});

export const HapoalimDepositsTaxCollectionSchema = z.strictObject({
  savingsAndCurrentProductsTaxEvents: z.array(PoalimDepositTaxEventSchema).default([]),
  messages: z.array(PoalimMessageSchema).optional(),
});

export type HapoalimDepositsTaxCollection = z.infer<typeof HapoalimDepositsTaxCollectionSchema>;
export type PoalimDepositTaxEvent = z.infer<typeof PoalimDepositTaxEventSchema>;
